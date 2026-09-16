-- Harden finance write boundaries and make the current subledger contract explicit.
-- This migration is additive for data and protects posted history.

alter table public.finance_obligations
  add column if not exists effective_date date,
  add column if not exists recognition_basis text not null default 'legacy';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'finance_voucher_lines_contract_scope_check'
       and conrelid = 'public.finance_voucher_lines'::regclass
  ) then
    alter table public.finance_voucher_lines
      add constraint finance_voucher_lines_contract_scope_check
      check (advance_scope <> 'contract' or related_contract_id is not null);
  end if;
end;
$$;

update public.finance_obligations
   set effective_date = document_date
 where effective_date is null;

alter table public.finance_obligations
  alter column effective_date set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'finance_obligations_recognition_basis_check'
       and conrelid = 'public.finance_obligations'::regclass
  ) then
    alter table public.finance_obligations
      add constraint finance_obligations_recognition_basis_check
      check (length(btrim(recognition_basis)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'finance_obligations_posted_at_check'
       and conrelid = 'public.finance_obligations'::regclass
  ) then
    alter table public.finance_obligations
      add constraint finance_obligations_posted_at_check
      check (status <> 'posted' or posted_at is not null);
  end if;
end;
$$;

create index if not exists finance_obligations_effective_date_idx
  on public.finance_obligations(tenant_id, direction, effective_date desc, id desc);

create or replace function public.set_finance_obligation_defaults()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.effective_date is null then
    new.effective_date := new.document_date;
  end if;

  if new.recognition_basis is null or length(btrim(new.recognition_basis)) = 0 then
    new.recognition_basis := 'legacy';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_obligations_set_defaults
  on public.finance_obligations;
create trigger finance_obligations_set_defaults
before insert on public.finance_obligations
for each row
execute function public.set_finance_obligation_defaults();

create or replace function public.protect_posted_finance_obligation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted'
       and coalesce(current_setting('app.finance_internal_mutation', true), '') <> 'obligation'
    then
      raise exception 'Posted finance obligation cannot be deleted'
        using errcode = '55006';
    end if;
    return old;
  end if;

  if old.status = 'posted'
     and coalesce(current_setting('app.finance_internal_mutation', true), '') <> 'obligation'
     and (
       new.tenant_id is distinct from old.tenant_id
       or new.code is distinct from old.code
       or new.description is distinct from old.description
       or new.party_type is distinct from old.party_type
       or new.customer_id is distinct from old.customer_id
       or new.employee_id is distinct from old.employee_id
       or new.party_name_snapshot is distinct from old.party_name_snapshot
       or new.direction is distinct from old.direction
       or new.source_type is distinct from old.source_type
       or new.contract_charge_id is distinct from old.contract_charge_id
       or new.contract_id is distinct from old.contract_id
       or new.category_id is distinct from old.category_id
       or new.document_date is distinct from old.document_date
       or new.effective_date is distinct from old.effective_date
       or new.due_date is distinct from old.due_date
       or new.original_amount is distinct from old.original_amount
       or new.currency_code is distinct from old.currency_code
       or new.status is distinct from old.status
       or new.posted_at is distinct from old.posted_at
       or new.posted_by is distinct from old.posted_by
       or new.created_by is distinct from old.created_by
    )
  then
    raise exception 'Posted finance obligation is immutable; use adjustment or reversal'
      using errcode = '55006';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_obligations_protect_posted
  on public.finance_obligations;
create trigger finance_obligations_protect_posted
before update or delete on public.finance_obligations
for each row
execute function public.protect_posted_finance_obligation();

create or replace function public.sync_contract_charge_finance_obligation_for_date(
  p_charge_id uuid,
  p_as_of_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_charge public.contract_charges;
  v_existing public.finance_obligations;
  v_has_existing boolean := false;
  v_has_active_allocation boolean := false;
  v_previous_mode text;
begin
  if p_charge_id is null or p_as_of_date is null then
    raise exception 'charge_id and as_of_date are required' using errcode = '22004';
  end if;

  select *
    into v_charge
    from public.contract_charges
   where id = p_charge_id
   for update;

  if not found then
    return;
  end if;

  select *
    into v_existing
    from public.finance_obligations
   where contract_charge_id = p_charge_id
   for update;

  v_has_existing := found;

  if v_charge.status = 'voided' then
    if v_has_existing and v_existing.status = 'posted' then
      select exists (
        select 1
          from public.finance_allocations allocation
         where allocation.obligation_id = v_existing.id
           and allocation.status = 'active'
      )
      into v_has_active_allocation;

      if v_has_active_allocation then
        raise exception 'Cannot void a contract charge with active finance allocations'
          using errcode = '23514';
      end if;
    end if;

    if v_has_existing then
      v_previous_mode := current_setting('app.finance_internal_mutation', true);
      perform set_config('app.finance_internal_mutation', 'obligation', true);
      update public.finance_obligations
         set status = 'voided'::public.finance_obligation_status,
             posted_at = null,
             updated_at = timezone('utc', now())
       where id = v_existing.id;
      perform set_config(
        'app.finance_internal_mutation',
        coalesce(v_previous_mode, ''),
        true
      );
    end if;

    return;
  end if;

  if v_charge.due_date > p_as_of_date then
    if v_has_existing and v_existing.status = 'posted' then
      raise exception 'Cannot move a posted contract obligation back to planned'
        using errcode = '23514';
    end if;
    return;
  end if;

  if v_has_existing and v_existing.status = 'posted' then
    if v_existing.customer_id is distinct from v_charge.customer_id
       or v_existing.contract_id is distinct from v_charge.contract_id
       or v_existing.document_date is distinct from v_charge.period_start
       or v_existing.due_date is distinct from v_charge.due_date
       or v_existing.original_amount is distinct from v_charge.amount
       or v_existing.currency_code is distinct from v_charge.currency_code
    then
      raise exception 'Posted contract obligation is immutable; use a finance adjustment'
        using errcode = '23514';
    end if;

    return;
  end if;

  if v_has_existing and v_existing.status = 'voided' then
    raise exception 'Voided contract obligation cannot be reopened directly'
      using errcode = '23514';
  end if;

  v_previous_mode := current_setting('app.finance_internal_mutation', true);
  perform set_config('app.finance_internal_mutation', 'obligation', true);

  insert into public.finance_obligations (
    tenant_id,
    code,
    description,
    party_type,
    customer_id,
    party_name_snapshot,
    direction,
    source_type,
    contract_charge_id,
    contract_id,
    document_date,
    effective_date,
    due_date,
    original_amount,
    currency_code,
    recognition_basis,
    status,
    posted_at,
    posted_by
  )
  select
    charge.tenant_id,
    'contract-charge:' || charge.id::text,
    'Khoản phí hợp đồng ' || to_char(charge.period_start, 'DD/MM/YYYY') ||
      ' - ' || to_char(charge.period_end, 'DD/MM/YYYY'),
    'customer'::public.finance_party_type,
    charge.customer_id,
    coalesce(customer.name, ''),
    line.direction::text::public.finance_obligation_direction,
    'contract'::public.finance_obligation_source,
    charge.id,
    charge.contract_id,
    charge.period_start,
    charge.period_start,
    charge.due_date,
    charge.amount,
    charge.currency_code,
    'contract_due_date',
    'posted'::public.finance_obligation_status,
    timezone('utc', now()),
    auth.uid()
  from public.contract_charges charge
  join public.contract_version_lines line
    on line.id = charge.contract_version_line_id
  left join public.customers customer
    on customer.id = charge.customer_id
   and customer.tenant_id = charge.tenant_id
  where charge.id = p_charge_id
    and charge.status <> 'voided'
    and charge.due_date <= p_as_of_date
  on conflict (contract_charge_id) do nothing;

  perform set_config(
    'app.finance_internal_mutation',
    coalesce(v_previous_mode, ''),
    true
  );
end;
$$;

create or replace function public.sync_contract_charge_finance_obligation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sync_contract_charge_finance_obligation_for_date(
    new.id,
    current_date
  );
  return new;
end;
$$;

drop trigger if exists contract_charges_sync_finance_obligation
  on public.contract_charges;
create trigger contract_charges_sync_finance_obligation
after insert or update of customer_id, contract_id, contract_version_line_id,
  period_start, period_end, due_date, amount, currency_code, status
on public.contract_charges
for each row
execute function public.sync_contract_charge_finance_obligation();

drop policy if exists finance_obligations_manage
  on public.finance_obligations;
revoke insert, update, delete on public.finance_obligations from anon, authenticated;
grant select on public.finance_obligations to authenticated;

create or replace function public.create_finance_obligation(
  p_tenant_id uuid,
  p_payload jsonb,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_hash text;
  v_existing_hash text;
  v_existing_type text;
  v_existing_result jsonb;
  v_party_type public.finance_party_type;
  v_direction public.finance_obligation_direction;
  v_source_type public.finance_obligation_source;
  v_customer_id uuid;
  v_employee_id uuid;
  v_party_name text;
  v_code text;
  v_description text;
  v_document_date date;
  v_effective_date date;
  v_due_date date;
  v_amount numeric(18,2);
  v_currency text;
  v_obligation_id uuid;
  v_result jsonb;
  v_previous_mode text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_tenant_id is null or nullif(btrim(p_request_key), '') is null then
    raise exception 'tenant_id and request_key are required' using errcode = '22004';
  end if;

  if not public.has_tenant_permission(p_tenant_id, 'finance:obligation:create') then
    raise exception 'Finance obligation create permission required' using errcode = '42501';
  end if;

  v_hash := md5(jsonb_build_object(
    'operation', 'create_finance_obligation',
    'tenant_id', p_tenant_id,
    'payload', v_payload
  )::text);

  select operation_type, request_hash, result_summary
    into v_existing_type, v_existing_hash, v_existing_result
    from public.finance_operations
   where tenant_id = p_tenant_id
     and request_key = p_request_key;

  if found then
    if v_existing_type <> 'create_finance_obligation'
       or v_existing_hash <> v_hash
    then
      raise exception 'request_key was already used with different data'
        using errcode = '23505';
    end if;
    return v_existing_result;
  end if;

  v_code := nullif(btrim(v_payload->>'code'), '');
  v_description := nullif(btrim(v_payload->>'description'), '');
  v_party_type := coalesce(v_payload->>'partyType', 'customer')::public.finance_party_type;
  v_direction := coalesce(v_payload->>'direction', 'receivable')::public.finance_obligation_direction;
  v_source_type := coalesce(v_payload->>'sourceType', 'manual')::public.finance_obligation_source;
  v_customer_id := nullif(v_payload->>'customerId', '')::uuid;
  v_employee_id := nullif(v_payload->>'employeeId', '')::uuid;
  v_document_date := nullif(v_payload->>'documentDate', '')::date;
  v_effective_date := coalesce(
    nullif(v_payload->>'effectiveDate', '')::date,
    v_document_date
  );
  v_due_date := nullif(v_payload->>'dueDate', '')::date;
  v_amount := (v_payload->>'originalAmount')::numeric;
  v_currency := coalesce(nullif(v_payload->>'currencyCode', ''), 'VND');

  if v_code is null or v_description is null or v_document_date is null
     or v_effective_date is null or v_amount is null
  then
    raise exception 'code, description, documentDate, effectiveDate and originalAmount are required'
      using errcode = '22004';
  end if;

  if v_source_type <> 'manual' then
    raise exception 'Only manual finance obligations can be created by this operation'
      using errcode = '23514';
  end if;

  if v_amount <= 0 then
    raise exception 'originalAmount must be greater than zero'
      using errcode = '23514';
  end if;

  if v_due_date is not null and v_due_date < v_document_date then
    raise exception 'dueDate cannot be before documentDate'
      using errcode = '23514';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'currencyCode must be an ISO 4217 code'
      using errcode = '23514';
  end if;

  if v_party_type = 'customer' then
    if v_customer_id is null or v_employee_id is not null then
      raise exception 'A customer obligation requires exactly one customer'
        using errcode = '23514';
    end if;

    select customer.name
      into v_party_name
      from public.customers customer
     where customer.id = v_customer_id
       and customer.tenant_id = p_tenant_id;

    if not found then
      raise exception 'Customer does not belong to tenant'
        using errcode = '23503';
    end if;
  elsif v_party_type = 'employee' then
    if v_employee_id is null or v_customer_id is not null then
      raise exception 'An employee obligation requires exactly one employee'
        using errcode = '23514';
    end if;

    select trim(concat(employee.last_name, ' ', employee.first_name))
      into v_party_name
      from public.employees employee
     where employee.id = v_employee_id
       and employee.tenant_id = p_tenant_id;

    if not found then
      raise exception 'Employee does not belong to tenant'
        using errcode = '23503';
    end if;
  else
    raise exception 'Manual obligations support customers or employees only'
      using errcode = '23514';
  end if;

  v_previous_mode := current_setting('app.finance_internal_mutation', true);
  perform set_config('app.finance_internal_mutation', 'obligation', true);

  insert into public.finance_obligations (
    tenant_id,
    code,
    description,
    party_type,
    customer_id,
    employee_id,
    party_name_snapshot,
    direction,
    source_type,
    document_date,
    effective_date,
    due_date,
    original_amount,
    currency_code,
    recognition_basis,
    status,
    posted_at,
    posted_by,
    created_by
  )
  values (
    p_tenant_id,
    v_code,
    v_description,
    v_party_type,
    v_customer_id,
    v_employee_id,
    v_party_name,
    v_direction,
    'manual'::public.finance_obligation_source,
    v_document_date,
    v_effective_date,
    v_due_date,
    v_amount,
    v_currency,
    coalesce(nullif(v_payload->>'recognitionBasis', ''), 'manual_claim'),
    'posted'::public.finance_obligation_status,
    timezone('utc', now()),
    auth.uid(),
    auth.uid()
  )
  returning id into v_obligation_id;

  perform set_config(
    'app.finance_internal_mutation',
    coalesce(v_previous_mode, ''),
    true
  );

  v_result := jsonb_build_object(
    'id', v_obligation_id,
    'status', 'posted',
    'code', v_code
  );

  insert into public.finance_operations (
    tenant_id,
    request_key,
    operation_type,
    request_hash,
    result_reference,
    result_summary
  )
  values (
    p_tenant_id,
    p_request_key,
    'create_finance_obligation',
    v_hash,
    v_obligation_id,
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.save_finance_voucher_draft(
  p_tenant_id uuid,
  p_voucher_id uuid,
  p_payload jsonb,
  p_revision integer,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_voucher public.finance_vouchers;
  v_line jsonb;
  v_allocation jsonb;
  v_index integer := 0;
  v_category_name text;
  v_hash text;
  v_existing_hash text;
  v_existing_type text;
  v_existing_result jsonb;
  v_result jsonb;
  v_party_name text;
  v_account_currency text;
begin
  v_hash := md5(jsonb_build_object(
    'operation', 'save_voucher_draft',
    'tenant_id', p_tenant_id,
    'voucher_id', p_voucher_id,
    'revision', p_revision,
    'payload', p_payload
  )::text);

  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_voucher_id is null then
    if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:create') then
      raise exception 'Finance voucher create permission required' using errcode = '42501';
    end if;
  else
    if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:update') then
      raise exception 'Finance voucher update permission required' using errcode = '42501';
    end if;
  end if;

  if nullif(btrim(p_request_key), '') is null then
    raise exception 'request_key is required' using errcode = '22004';
  end if;

  select operation_type, request_hash, result_summary
    into v_existing_type, v_existing_hash, v_existing_result
    from public.finance_operations
   where tenant_id = p_tenant_id
     and request_key = p_request_key;

  if found then
    if v_existing_type <> 'save_voucher_draft'
       or v_existing_hash <> v_hash
    then
      raise exception 'request_key was already used with different data'
        using errcode = '23505';
    end if;
    return v_existing_result;
  end if;

  if p_tenant_id is null then
    raise exception 'tenant_id is required' using errcode = '22004';
  end if;

  select currency_code
    into v_account_currency
    from public.finance_accounts
   where id = (p_payload->>'accountId')::uuid
     and tenant_id = p_tenant_id
     and is_active;

  if not found then
    raise exception 'Account is not available for tenant'
      using errcode = '23503';
  end if;

  if coalesce(p_payload->>'currencyCode', 'VND') <> v_account_currency then
    raise exception 'Voucher currency does not match account currency'
      using errcode = '23514';
  end if;

  if p_payload->>'partyType' = 'customer' then
    select customer.name
      into v_party_name
      from public.customers customer
     where customer.id = nullif(p_payload->>'customerId', '')::uuid
       and customer.tenant_id = p_tenant_id;
    if not found then
      raise exception 'Customer does not belong to tenant'
        using errcode = '23503';
    end if;
  elsif p_payload->>'partyType' = 'employee' then
    select trim(concat(employee.last_name, ' ', employee.first_name))
      into v_party_name
      from public.employees employee
     where employee.id = nullif(p_payload->>'employeeId', '')::uuid
       and employee.tenant_id = p_tenant_id;
    if not found then
      raise exception 'Employee does not belong to tenant'
        using errcode = '23503';
    end if;
  else
    v_party_name := nullif(btrim(p_payload->>'partyName'), '');
  end if;

  if p_voucher_id is null then
    insert into public.finance_vouchers (
      tenant_id, voucher_type, voucher_date, transaction_at, party_type,
      customer_id, employee_id, party_name_snapshot, contact_name,
      address_snapshot, account_id, currency_code, description,
      external_reference, created_by
    )
    values (
      p_tenant_id,
      (p_payload->>'voucherType')::public.finance_voucher_type,
      (p_payload->>'voucherDate')::date,
      (p_payload->>'transactionAt')::timestamptz,
      (p_payload->>'partyType')::public.finance_party_type,
      nullif(p_payload->>'customerId', '')::uuid,
      nullif(p_payload->>'employeeId', '')::uuid,
      coalesce(v_party_name, ''),
      coalesce(p_payload->>'contactName', ''),
      coalesce(p_payload->>'address', ''),
      (p_payload->>'accountId')::uuid,
      coalesce(p_payload->>'currencyCode', 'VND'),
      coalesce(p_payload->>'description', ''),
      coalesce(p_payload->>'externalReference', ''),
      auth.uid()
    )
    returning * into v_voucher;
  else
    select *
      into v_voucher
      from public.finance_vouchers
     where id = p_voucher_id
       and tenant_id = p_tenant_id
     for update;

    if not found then
      raise exception 'Voucher not found' using errcode = 'P0002';
    end if;

    if v_voucher.status <> 'draft' then
      raise exception 'Only draft vouchers can be edited' using errcode = 'P0001';
    end if;

    if v_voucher.revision <> p_revision then
      raise exception 'Voucher draft has changed, please reload' using errcode = '40001';
    end if;

    update public.finance_vouchers
       set voucher_type = (p_payload->>'voucherType')::public.finance_voucher_type,
           voucher_date = (p_payload->>'voucherDate')::date,
           transaction_at = (p_payload->>'transactionAt')::timestamptz,
           party_type = (p_payload->>'partyType')::public.finance_party_type,
           customer_id = nullif(p_payload->>'customerId', '')::uuid,
           employee_id = nullif(p_payload->>'employeeId', '')::uuid,
           party_name_snapshot = coalesce(v_party_name, ''),
           contact_name = coalesce(p_payload->>'contactName', ''),
           address_snapshot = coalesce(p_payload->>'address', ''),
           account_id = (p_payload->>'accountId')::uuid,
           currency_code = coalesce(p_payload->>'currencyCode', 'VND'),
           description = coalesce(p_payload->>'description', ''),
           external_reference = coalesce(p_payload->>'externalReference', ''),
           revision = revision + 1
     where id = p_voucher_id
    returning * into v_voucher;
  end if;

  delete from public.finance_voucher_lines
   where voucher_id = v_voucher.id;

  for v_line in
    select value
      from jsonb_array_elements(coalesce(p_payload->'lines', '[]'::jsonb))
  loop
    v_index := v_index + 1;

    select name
      into v_category_name
      from public.finance_categories
     where id = (v_line->>'categoryId')::uuid
       and tenant_id = p_tenant_id
       and is_active;

    if v_category_name is null then
      raise exception 'Invalid or inactive finance category'
        using errcode = '23503';
    end if;

    if nullif(v_line->>'relatedContractId', '') is not null
       and not exists (
         select 1
           from public.contracts contract
          where contract.id = (v_line->>'relatedContractId')::uuid
            and contract.tenant_id = p_tenant_id
       )
    then
      raise exception 'Related contract does not belong to tenant'
        using errcode = '23503';
    end if;

    insert into public.finance_voucher_lines (
      tenant_id, voucher_id, line_no, category_id, category_name_snapshot,
      description, amount, handling_type, related_contract_id, advance_scope
    )
    values (
      p_tenant_id,
      v_voucher.id,
      v_index,
      (v_line->>'categoryId')::uuid,
      v_category_name,
      coalesce(v_line->>'description', ''),
      (v_line->>'amount')::numeric,
      (v_line->>'handlingType')::public.finance_handling_type,
      nullif(v_line->>'relatedContractId', '')::uuid,
      nullif(v_line->>'advanceScope', '')::public.finance_advance_scope
    );

    for v_allocation in
      select value
        from jsonb_array_elements(coalesce(v_line->'allocations', '[]'::jsonb))
    loop
      insert into public.finance_voucher_line_allocation_drafts (
        tenant_id, voucher_line_id, obligation_id, amount
      )
      values (
        p_tenant_id,
        (
          select id
            from public.finance_voucher_lines
           where voucher_id = v_voucher.id
             and line_no = v_index
        ),
        (v_allocation->>'obligationId')::uuid,
        (v_allocation->>'amount')::numeric
      );
    end loop;
  end loop;

  update public.finance_vouchers
     set total_amount = coalesce((
       select sum(amount)
         from public.finance_voucher_lines
        where voucher_id = v_voucher.id
     ), 0)
   where id = v_voucher.id
  returning * into v_voucher;

  v_result := jsonb_build_object(
    'id', v_voucher.id,
    'status', v_voucher.status,
    'revision', v_voucher.revision
  );

  insert into public.finance_operations (
    tenant_id, request_key, operation_type, request_hash,
    result_reference, result_summary
  )
  values (
    p_tenant_id, p_request_key, 'save_voucher_draft', v_hash,
    v_voucher.id, v_result
  );

  return v_result;
end;
$$;

create or replace function public.post_finance_voucher(
  p_tenant_id uuid,
  p_voucher_id uuid,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_voucher public.finance_vouchers;
  v_account public.finance_accounts;
  v_line record;
  v_obligation public.finance_obligations;
  v_total numeric(18,2);
  v_line_allocated numeric(18,2);
  v_obligation_allocated numeric(18,2);
  v_existing_hash text;
  v_existing_type text;
  v_existing_result jsonb;
  v_hash text;
  v_movement_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_tenant_id is null or p_voucher_id is null
     or nullif(btrim(p_request_key), '') is null
  then
    raise exception 'tenant_id, voucher_id and request_key are required'
      using errcode = '22004';
  end if;

  if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:post') then
    raise exception 'Finance voucher post permission required' using errcode = '42501';
  end if;

  v_hash := md5(jsonb_build_object(
    'operation', 'post_finance_voucher',
    'tenant_id', p_tenant_id,
    'voucher_id', p_voucher_id
  )::text);

  select operation_type, request_hash, result_summary
    into v_existing_type, v_existing_hash, v_existing_result
    from public.finance_operations
   where tenant_id = p_tenant_id
     and request_key = p_request_key;

  if found then
    if v_existing_type <> 'post_voucher'
       or v_existing_hash <> v_hash
    then
      raise exception 'request_key was already used with different data'
        using errcode = '23505';
    end if;
    return v_existing_result;
  end if;

  select *
    into v_voucher
    from public.finance_vouchers
   where id = p_voucher_id
     and tenant_id = p_tenant_id
   for update;

  if not found or v_voucher.status <> 'draft' then
    raise exception 'Only a draft voucher can be posted' using errcode = 'P0001';
  end if;

  select *
    into v_account
    from public.finance_accounts
   where id = v_voucher.account_id
     and tenant_id = p_tenant_id
   for update;

  if not found or not v_account.is_active then
    raise exception 'Account is not available' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.finance_voucher_lines
     where voucher_id = v_voucher.id
  ) then
    raise exception 'Posted voucher requires at least one line'
      using errcode = '23514';
  end if;

  if length(btrim(v_voucher.party_name_snapshot)) = 0 then
    raise exception 'Party name is required' using errcode = '23514';
  end if;

  select sum(amount)::numeric(18,2)
    into v_total
    from public.finance_voucher_lines
   where voucher_id = v_voucher.id;

  if v_voucher.voucher_type = 'payment'
     and (
       v_account.opening_balance
       + coalesce((
         select sum(case when direction = 'in' then amount else -amount end)
           from public.finance_account_movements
          where tenant_id = p_tenant_id
            and account_id = v_account.id
            and effective_date >= v_account.opening_date
       ), 0)
       - v_total
     ) < 0
  then
    raise exception 'Số dư tài khoản không đủ để ghi nhận phiếu chi'
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from public.finance_voucher_line_allocation_drafts draft
      join public.finance_voucher_lines line
        on line.id = draft.voucher_line_id
      left join public.finance_obligations obligation
        on obligation.id = draft.obligation_id
     where line.voucher_id = v_voucher.id
       and (
         draft.tenant_id <> p_tenant_id
         or line.tenant_id <> p_tenant_id
         or obligation.id is null
         or obligation.tenant_id <> p_tenant_id
       )
  ) then
    raise exception 'Allocation tenant/source/target mismatch'
      using errcode = '23514';
  end if;

  for v_line in
    select line.*
      from public.finance_voucher_lines line
     where line.voucher_id = v_voucher.id
     order by line.line_no
  loop
    select coalesce(sum(draft.amount), 0)::numeric(18,2)
      into v_line_allocated
      from public.finance_voucher_line_allocation_drafts draft
     where draft.tenant_id = p_tenant_id
       and draft.voucher_line_id = v_line.id;

    if v_line.handling_type = 'settlement'
       and v_line_allocated <> v_line.amount
    then
      raise exception 'Tổng phân bổ phải bằng số tiền dòng thanh toán công nợ'
        using errcode = '23514';
    end if;

    if v_line.handling_type <> 'settlement'
       and v_line_allocated > 0
    then
      raise exception 'Chỉ dòng thanh toán công nợ được phân bổ'
        using errcode = '23514';
    end if;

    if v_line.handling_type = 'settlement'
       and v_voucher.party_type = 'other'
    then
      raise exception 'Vãng lai không được thanh toán công nợ'
        using errcode = '23514';
    end if;
  end loop;

  for v_obligation in
    select obligation.*
      from public.finance_obligations obligation
     where obligation.id in (
       select draft.obligation_id
         from public.finance_voucher_line_allocation_drafts draft
         join public.finance_voucher_lines line
           on line.id = draft.voucher_line_id
        where line.voucher_id = v_voucher.id
     )
     order by obligation.id
     for update
  loop
    if v_obligation.status <> 'posted' then
      raise exception 'Công nợ chưa được ghi nhận' using errcode = '23514';
    end if;

    if (
      v_voucher.voucher_type = 'receipt'
      and v_obligation.direction <> 'receivable'
    ) or (
      v_voucher.voucher_type = 'payment'
      and v_obligation.direction <> 'payable'
    ) then
      raise exception 'Chiều phiếu không khớp chiều công nợ'
        using errcode = '23514';
    end if;

    if v_obligation.currency_code <> v_voucher.currency_code then
      raise exception 'Loại tiền phiếu và công nợ không khớp'
        using errcode = '23514';
    end if;

    if v_voucher.party_type = 'customer'
       and v_obligation.customer_id is distinct from v_voucher.customer_id
    then
      raise exception 'Khách hàng của phiếu và công nợ không khớp'
        using errcode = '23514';
    end if;

    if v_voucher.party_type = 'employee'
       and v_obligation.employee_id is distinct from v_voucher.employee_id
    then
      raise exception 'Nhân viên của phiếu và công nợ không khớp'
        using errcode = '23514';
    end if;

    select coalesce(sum(allocation.amount), 0)::numeric(18,2)
      into v_obligation_allocated
      from public.finance_allocations allocation
     where allocation.tenant_id = p_tenant_id
       and allocation.obligation_id = v_obligation.id
       and allocation.status = 'active';

    select v_obligation_allocated + coalesce(sum(draft.amount), 0)::numeric(18,2)
      into v_obligation_allocated
      from public.finance_voucher_line_allocation_drafts draft
      join public.finance_voucher_lines line
        on line.id = draft.voucher_line_id
     where draft.tenant_id = p_tenant_id
       and draft.obligation_id = v_obligation.id
       and line.voucher_id = v_voucher.id;

    if v_obligation_allocated > v_obligation.original_amount then
      raise exception 'Phân bổ vượt số còn nợ'
        using errcode = '23514';
    end if;

    if exists (
      select 1
        from public.finance_voucher_line_allocation_drafts draft
        join public.finance_voucher_lines line
          on line.id = draft.voucher_line_id
       where draft.obligation_id = v_obligation.id
         and line.voucher_id = v_voucher.id
         and line.related_contract_id is not null
         and v_obligation.contract_id is distinct from line.related_contract_id
    ) then
      raise exception 'Phạm vi hợp đồng của phiếu và công nợ không khớp'
        using errcode = '23514';
    end if;
  end loop;

  update public.finance_vouchers
     set voucher_no = coalesce(
           voucher_no,
           to_char(voucher_date, 'YYYYMMDD') || '-' ||
             lpad(nextval('finance_voucher_no_seq')::text, 6, '0')
         ),
         total_amount = v_total,
         status = 'posted',
         posted_at = timezone('utc', now()),
         posted_by = auth.uid()
   where id = v_voucher.id
  returning * into v_voucher;

  insert into public.finance_account_movements (
    tenant_id, account_id, effective_date, direction, amount,
    voucher_id, event_type
  )
  values (
    p_tenant_id,
    v_voucher.account_id,
    v_voucher.voucher_date,
    case when v_voucher.voucher_type = 'receipt'
      then 'in'::public.finance_movement_direction
      else 'out'::public.finance_movement_direction
    end,
    v_total,
    v_voucher.id,
    'voucher_posting'
  )
  returning id into v_movement_id;

  insert into public.finance_allocations (
    tenant_id, voucher_line_id, obligation_id, amount, effective_date, created_by
  )
  select
    tenant_id,
    voucher_line_id,
    obligation_id,
    amount,
    v_voucher.voucher_date,
    auth.uid()
    from public.finance_voucher_line_allocation_drafts
   where tenant_id = p_tenant_id
     and voucher_line_id in (
       select id from public.finance_voucher_lines where voucher_id = v_voucher.id
     );

  delete from public.finance_voucher_line_allocation_drafts
   where voucher_line_id in (
     select id from public.finance_voucher_lines where voucher_id = v_voucher.id
   );

  v_result := jsonb_build_object(
    'id', v_voucher.id,
    'voucherNo', v_voucher.voucher_no,
    'status', v_voucher.status,
    'movementId', v_movement_id
  );

  insert into public.finance_operations (
    tenant_id, request_key, operation_type, request_hash,
    result_reference, result_summary
  )
  values (
    p_tenant_id, p_request_key, 'post_voucher', v_hash,
    v_voucher.id, v_result
  );

  return v_result;
end;
$$;

create or replace view public.finance_obligation_balances as
select
  obligation.id,
  obligation.tenant_id,
  obligation.code,
  obligation.description,
  obligation.party_type,
  obligation.customer_id,
  obligation.employee_id,
  obligation.party_name_snapshot,
  obligation.direction,
  obligation.source_type,
  obligation.contract_id,
  contract.name as contract_name,
  obligation.document_date,
  obligation.due_date,
  obligation.original_amount,
  obligation.currency_code,
  obligation.status,
  coalesce(sum(allocation.amount) filter (
    where allocation.status = 'active'
  ), 0)::numeric(18,2) as settled_amount,
  (
    obligation.original_amount
    - coalesce(sum(allocation.amount) filter (
      where allocation.status = 'active'
    ), 0)
  )::numeric(18,2) as outstanding_amount,
  obligation.effective_date,
  obligation.recognition_basis
from public.finance_obligations obligation
left join public.contracts contract on contract.id = obligation.contract_id
left join public.finance_allocations allocation
  on allocation.obligation_id = obligation.id
group by obligation.id, contract.name;

create or replace view public.customer_receivable_summary as
with receivables as (
  select
    balance.tenant_id,
    balance.customer_id,
    balance.currency_code,
    coalesce(sum(balance.original_amount), 0)::numeric(18,2) as total_billed,
    coalesce(sum(balance.settled_amount), 0)::numeric(18,2) as total_paid,
    coalesce(sum(balance.outstanding_amount), 0)::numeric(18,2) as total_outstanding,
    coalesce(sum(balance.outstanding_amount) filter (
      where balance.due_date < current_date
        and balance.outstanding_amount > 0
    ), 0)::numeric(18,2) as overdue_outstanding
  from public.finance_obligation_balances balance
  where balance.status = 'posted'
    and balance.direction = 'receivable'
    and balance.party_type = 'customer'
    and balance.effective_date <= current_date
  group by balance.tenant_id, balance.customer_id, balance.currency_code
),
advances as (
  select
    voucher.tenant_id,
    voucher.customer_id,
    voucher.currency_code,
    coalesce(sum(line.amount), 0)::numeric(18,2) as advance_amount,
    coalesce(sum(allocated.amount), 0)::numeric(18,2) as allocated_amount
  from public.finance_vouchers voucher
  join public.finance_voucher_lines line
    on line.voucher_id = voucher.id
   and line.tenant_id = voucher.tenant_id
   and line.handling_type = 'advance'
  left join lateral (
    select coalesce(sum(allocation.amount), 0)::numeric(18,2) as amount
      from public.finance_allocations allocation
     where allocation.voucher_line_id = line.id
       and allocation.status = 'active'
  ) allocated on true
  where voucher.status = 'posted'
    and voucher.voucher_type = 'receipt'
    and voucher.party_type = 'customer'
    and voucher.customer_id is not null
    and voucher.voucher_date <= current_date
  group by voucher.tenant_id, voucher.customer_id, voucher.currency_code
)
select
  coalesce(receivables.tenant_id, advances.tenant_id) as tenant_id,
  coalesce(receivables.customer_id, advances.customer_id) as customer_id,
  coalesce(receivables.currency_code, advances.currency_code) as currency_code,
  coalesce(receivables.total_billed, 0)::numeric(18,2) as total_billed,
  coalesce(receivables.total_paid, 0)::numeric(18,2) as total_paid,
  coalesce(receivables.total_outstanding, 0)::numeric(18,2) as total_outstanding,
  coalesce(receivables.overdue_outstanding, 0)::numeric(18,2) as overdue_outstanding,
  greatest(
    coalesce(advances.advance_amount, 0) - coalesce(advances.allocated_amount, 0),
    0
  )::numeric(18,2) as unapplied_credit
from receivables
full outer join advances
  on advances.tenant_id = receivables.tenant_id
 and advances.customer_id = receivables.customer_id
 and advances.currency_code = receivables.currency_code;

alter view public.finance_obligation_balances set (security_invoker = true);
alter view public.customer_receivable_summary set (security_invoker = true);

revoke all on function public.create_finance_obligation(uuid, jsonb, text)
  from public, anon;
grant execute on function public.create_finance_obligation(uuid, jsonb, text)
  to authenticated;

revoke all on function public.sync_contract_charge_finance_obligation_for_date(uuid, date),
  public.sync_due_contract_charge_finance_obligations(date)
  from public, anon, authenticated;
