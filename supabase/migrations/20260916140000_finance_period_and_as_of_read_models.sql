-- Finance subledger phase 2 foundation: period locks and parameterized
-- as-of read models. All changes are additive and preserve existing IDs.

create table if not exists public.finance_period_locks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  reason text not null default '',
  closed_at timestamptz not null default timezone('utc', now()),
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, period_start, period_end),
  constraint finance_period_locks_range_check check (period_start <= period_end)
);

create index if not exists finance_period_locks_lookup_idx
  on public.finance_period_locks (tenant_id, period_start, period_end);

alter table public.finance_period_locks enable row level security;
revoke all on public.finance_period_locks from anon;
revoke all on public.finance_period_locks from authenticated;
grant select on public.finance_period_locks to authenticated;

drop policy if exists finance_period_locks_select on public.finance_period_locks;
create policy finance_period_locks_select
  on public.finance_period_locks
  for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and (
      public.has_tenant_permission(tenant_id, 'finance:report:view')
      or public.has_tenant_permission(tenant_id, 'finance:voucher:post')
    )
  );

create or replace function public.finance_period_is_locked(
  p_tenant_id uuid,
  p_effective_date date
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.finance_period_locks lock_record
     where lock_record.tenant_id = p_tenant_id
       and p_effective_date between lock_record.period_start
                                and lock_record.period_end
  );
$$;

revoke execute on function public.finance_period_is_locked(uuid, date)
  from public, anon, authenticated;

create or replace function public.close_finance_period(
  p_tenant_id uuid,
  p_period_start date,
  p_period_end date,
  p_reason text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_existing_type text;
  v_existing_hash text;
  v_existing_result jsonb;
  v_lock public.finance_period_locks;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_period_start is null or p_period_end is null
     or nullif(btrim(p_request_key), '') is null
  then
    raise exception 'tenant_id, period range and request_key are required'
      using errcode = '22004';
  end if;
  if p_period_start > p_period_end then
    raise exception 'Period start must not be after period end'
      using errcode = '22023';
  end if;
  if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:post') then
    raise exception 'Finance period close permission required'
      using errcode = '42501';
  end if;

  v_hash := md5(jsonb_build_object(
    'operation', 'close_finance_period',
    'tenant_id', p_tenant_id,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'reason', coalesce(btrim(p_reason), '')
  )::text);

  select operation_type, request_hash, result_summary
    into v_existing_type, v_existing_hash, v_existing_result
    from public.finance_operations
   where tenant_id = p_tenant_id
     and request_key = p_request_key;

  if found then
    if v_existing_type <> 'close_finance_period'
       or v_existing_hash <> v_hash
    then
      raise exception 'request_key was already used with different data'
        using errcode = '23505';
    end if;
    return v_existing_result;
  end if;

  -- Serialize period close with every finance write guard for this tenant.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 0));

  if exists (
    select 1
      from public.finance_period_locks lock_record
     where lock_record.tenant_id = p_tenant_id
       and lock_record.period_start <= p_period_end
       and lock_record.period_end >= p_period_start
  ) then
    raise exception 'The selected period overlaps an existing closed period'
      using errcode = '23505';
  end if;

  insert into public.finance_period_locks (
    tenant_id, period_start, period_end, reason, closed_by
  )
  values (
    p_tenant_id, p_period_start, p_period_end, coalesce(btrim(p_reason), ''),
    auth.uid()
  )
  returning * into v_lock;

  v_result := jsonb_build_object(
    'id', v_lock.id,
    'tenantId', v_lock.tenant_id,
    'periodStart', v_lock.period_start,
    'periodEnd', v_lock.period_end,
    'closedAt', v_lock.closed_at
  );

  insert into public.finance_operations (
    tenant_id, request_key, operation_type, request_hash,
    result_reference, result_summary
  )
  values (
    p_tenant_id, p_request_key, 'close_finance_period', v_hash,
    v_lock.id, v_result
  );

  return v_result;
end;
$$;

revoke execute on function public.close_finance_period(uuid, date, date, text, text)
  from public, anon;
grant execute on function public.close_finance_period(uuid, date, date, text, text)
  to authenticated;

create or replace function public.finance_posted_obligation_period_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'posted'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'posted'
       or old.effective_date is distinct from new.effective_date
     )
  then
    perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text, 0));
    if public.finance_period_is_locked(new.tenant_id, new.effective_date) then
      raise exception 'Không thể ghi nhận công nợ trong kỳ đã khóa'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.finance_voucher_post_period_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'posted'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'posted'
       or old.voucher_date is distinct from new.voucher_date
     )
  then
    perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text, 0));
    if public.finance_period_is_locked(new.tenant_id, new.voucher_date) then
      raise exception 'Không thể ghi nhận phiếu trong kỳ đã khóa'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.finance_effective_date_period_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text, 0));
  if public.finance_period_is_locked(new.tenant_id, new.effective_date) then
    raise exception 'Không thể ghi nhận nghiệp vụ trong kỳ đã khóa'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.finance_voucher_line_contract_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_voucher record;
  v_contract record;
begin
  if new.handling_type = 'advance'
     and new.advance_scope = 'contract'
     and new.related_contract_id is null
  then
    raise exception 'Ứng trước theo hợp đồng phải chọn hợp đồng'
      using errcode = '23514';
  end if;

  if new.handling_type = 'advance'
     and new.advance_scope = 'party'
     and new.related_contract_id is not null
  then
    raise exception 'Ứng trước theo khách hàng không được gắn hợp đồng'
      using errcode = '23514';
  end if;

  if new.related_contract_id is null then
    return new;
  end if;

  select voucher.tenant_id, voucher.party_type, voucher.customer_id,
         voucher.currency_code
    into v_voucher
    from public.finance_vouchers voucher
   where voucher.id = new.voucher_id;

  if not found or v_voucher.tenant_id <> new.tenant_id then
    raise exception 'Related contract voucher tenant mismatch'
      using errcode = '23514';
  end if;

  select contract.tenant_id, contract.customer_id, contract.currency_code
    into v_contract
    from public.contracts contract
   where contract.id = new.related_contract_id;

  if not found or v_contract.tenant_id <> new.tenant_id then
    raise exception 'Related contract does not belong to tenant'
      using errcode = '23503';
  end if;
  if v_voucher.party_type <> 'customer'
     or v_voucher.customer_id is distinct from v_contract.customer_id
  then
    raise exception 'Related contract does not belong to voucher customer'
      using errcode = '23514';
  end if;
  if v_voucher.currency_code <> v_contract.currency_code then
    raise exception 'Related contract currency does not match voucher currency'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_obligations_period_guard
  on public.finance_obligations;
create trigger finance_obligations_period_guard
before insert or update on public.finance_obligations
for each row execute function public.finance_posted_obligation_period_guard();

drop trigger if exists finance_vouchers_period_guard
  on public.finance_vouchers;
create trigger finance_vouchers_period_guard
before insert or update on public.finance_vouchers
for each row execute function public.finance_voucher_post_period_guard();

drop trigger if exists finance_allocations_period_guard
  on public.finance_allocations;
create trigger finance_allocations_period_guard
before insert or update on public.finance_allocations
for each row execute function public.finance_effective_date_period_guard();

drop trigger if exists finance_movements_period_guard
  on public.finance_account_movements;
create trigger finance_movements_period_guard
before insert or update on public.finance_account_movements
for each row execute function public.finance_effective_date_period_guard();

drop trigger if exists finance_voucher_lines_contract_guard
  on public.finance_voucher_lines;
create trigger finance_voucher_lines_contract_guard
before insert or update on public.finance_voucher_lines
for each row execute function public.finance_voucher_line_contract_guard();

create or replace function public.get_finance_obligation_balances_as_of(
  p_tenant_id uuid,
  p_as_of_date date,
  p_direction public.finance_obligation_direction default null,
  p_customer_id uuid default null,
  p_currency_code text default null
)
returns table (
  id uuid,
  tenant_id uuid,
  code text,
  description text,
  party_type public.finance_party_type,
  customer_id uuid,
  employee_id uuid,
  party_name_snapshot text,
  direction public.finance_obligation_direction,
  source_type public.finance_obligation_source,
  contract_id uuid,
  contract_name text,
  document_date date,
  effective_date date,
  due_date date,
  recognition_basis text,
  original_amount numeric,
  adjustment_amount numeric,
  obligation_amount numeric,
  settled_amount numeric,
  outstanding_amount numeric,
  currency_code text,
  status public.finance_obligation_status
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_as_of_date is null then
    raise exception 'tenant_id and as_of_date are required' using errcode = '22004';
  end if;
  if p_currency_code is not null and p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'currency_code must be an ISO 4217 code' using errcode = '22023';
  end if;
  if not (
    public.has_tenant_permission(p_tenant_id, 'finance:obligation:view')
    or public.has_tenant_permission(p_tenant_id, 'finance:report:view')
  ) then
    raise exception 'Finance obligation view permission required'
      using errcode = '42501';
  end if;

  return query
  with allocation_totals as (
    select allocation.obligation_id,
           sum(allocation.amount)::numeric(18,2) as settled_amount
      from public.finance_allocations allocation
     where allocation.tenant_id = p_tenant_id
       and allocation.status = 'active'
       and allocation.effective_date <= p_as_of_date
     group by allocation.obligation_id
  )
  select obligation.id,
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
         contract.name,
         obligation.document_date,
         obligation.effective_date,
         obligation.due_date,
         obligation.recognition_basis,
         obligation.original_amount,
         0::numeric(18,2),
         obligation.original_amount,
         coalesce(allocation_totals.settled_amount, 0)::numeric(18,2),
         (
           obligation.original_amount
           - coalesce(allocation_totals.settled_amount, 0)
         )::numeric(18,2),
         obligation.currency_code,
         obligation.status
    from public.finance_obligations obligation
    left join allocation_totals
      on allocation_totals.obligation_id = obligation.id
    left join public.contracts contract
      on contract.id = obligation.contract_id
     and contract.tenant_id = obligation.tenant_id
   where obligation.tenant_id = p_tenant_id
     and obligation.status = 'posted'
     and obligation.effective_date <= p_as_of_date
     and (p_direction is null or obligation.direction = p_direction)
     and (p_customer_id is null or obligation.customer_id = p_customer_id)
     and (p_currency_code is null or obligation.currency_code = p_currency_code)
   order by obligation.effective_date, obligation.id;
end;
$$;

revoke execute on function public.get_finance_obligation_balances_as_of(
  uuid, date, public.finance_obligation_direction, uuid, text
) from public, anon;
grant execute on function public.get_finance_obligation_balances_as_of(
  uuid, date, public.finance_obligation_direction, uuid, text
) to authenticated;

create or replace function public.get_finance_advance_balances_as_of(
  p_tenant_id uuid,
  p_as_of_date date,
  p_customer_id uuid default null,
  p_currency_code text default null
)
returns table (
  source_line_id uuid,
  voucher_id uuid,
  voucher_no text,
  effective_date date,
  customer_id uuid,
  party_name_snapshot text,
  related_contract_id uuid,
  advance_scope public.finance_advance_scope,
  amount numeric,
  allocated_amount numeric,
  refunded_amount numeric,
  available_amount numeric,
  currency_code text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_as_of_date is null then
    raise exception 'tenant_id and as_of_date are required' using errcode = '22004';
  end if;
  if p_currency_code is not null and p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'currency_code must be an ISO 4217 code' using errcode = '22023';
  end if;
  if not (
    public.has_tenant_permission(p_tenant_id, 'finance:obligation:view')
    or public.has_tenant_permission(p_tenant_id, 'finance:report:view')
  ) then
    raise exception 'Finance advance view permission required'
      using errcode = '42501';
  end if;

  return query
  select line.id,
         voucher.id,
         voucher.voucher_no,
         voucher.voucher_date,
         voucher.customer_id,
         voucher.party_name_snapshot,
         line.related_contract_id,
         line.advance_scope,
         line.amount,
         coalesce(sum(allocation.amount) filter (
           where allocation.status = 'active'
             and allocation.effective_date <= p_as_of_date
         ), 0)::numeric(18,2),
         0::numeric(18,2),
         (
           line.amount
           - coalesce(sum(allocation.amount) filter (
             where allocation.status = 'active'
               and allocation.effective_date <= p_as_of_date
           ), 0)
         )::numeric(18,2),
         voucher.currency_code
    from public.finance_voucher_lines line
    join public.finance_vouchers voucher
      on voucher.id = line.voucher_id
     and voucher.tenant_id = line.tenant_id
    left join public.finance_allocations allocation
      on allocation.voucher_line_id = line.id
     and allocation.tenant_id = line.tenant_id
   where line.tenant_id = p_tenant_id
     and voucher.status = 'posted'
     and voucher.voucher_type = 'receipt'
     and voucher.party_type = 'customer'
     and voucher.customer_id is not null
     and voucher.voucher_date <= p_as_of_date
     and line.handling_type = 'advance'
     and (p_customer_id is null or voucher.customer_id = p_customer_id)
     and (p_currency_code is null or voucher.currency_code = p_currency_code)
   group by line.id, voucher.id
   order by voucher.voucher_date, line.line_no, line.id;
end;
$$;

revoke execute on function public.get_finance_advance_balances_as_of(uuid, date, uuid, text)
  from public, anon;
grant execute on function public.get_finance_advance_balances_as_of(uuid, date, uuid, text)
  to authenticated;

create or replace function public.get_customer_finance_summary_as_of(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_as_of_date date,
  p_currency_code text default null
)
returns table (
  tenant_id uuid,
  customer_id uuid,
  currency_code text,
  total_billed numeric,
  total_paid numeric,
  total_outstanding numeric,
  overdue_outstanding numeric,
  unapplied_credit numeric,
  cash_received numeric,
  cash_paid numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_customer_id is null or p_as_of_date is null then
    raise exception 'tenant_id, customer_id and as_of_date are required'
      using errcode = '22004';
  end if;
  if p_currency_code is not null and p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'currency_code must be an ISO 4217 code' using errcode = '22023';
  end if;
  if not (
    public.has_tenant_permission(p_tenant_id, 'finance:obligation:view')
    or public.has_tenant_permission(p_tenant_id, 'finance:report:view')
  ) then
    raise exception 'Finance summary view permission required'
      using errcode = '42501';
  end if;

  return query
  with allocation_totals as (
    select allocation.obligation_id,
           sum(allocation.amount)::numeric(18,2) as settled_amount
      from public.finance_allocations allocation
     where allocation.tenant_id = p_tenant_id
       and allocation.status = 'active'
       and allocation.effective_date <= p_as_of_date
     group by allocation.obligation_id
  ), obligation_totals as (
    select obligation.currency_code,
           sum(obligation.original_amount)::numeric(18,2) as total_billed,
           sum(coalesce(allocation_totals.settled_amount, 0))::numeric(18,2)
             as total_paid,
           sum(
             obligation.original_amount
             - coalesce(allocation_totals.settled_amount, 0)
           )::numeric(18,2) as total_outstanding,
           sum(case
             when obligation.due_date < p_as_of_date
              and obligation.original_amount
                    - coalesce(allocation_totals.settled_amount, 0) > 0
             then obligation.original_amount
                    - coalesce(allocation_totals.settled_amount, 0)
             else 0
           end)::numeric(18,2) as overdue_outstanding
      from public.finance_obligations obligation
      left join allocation_totals
        on allocation_totals.obligation_id = obligation.id
     where obligation.tenant_id = p_tenant_id
       and obligation.customer_id = p_customer_id
       and obligation.party_type = 'customer'
       and obligation.direction = 'receivable'
       and obligation.status = 'posted'
       and obligation.effective_date <= p_as_of_date
       and (p_currency_code is null or obligation.currency_code = p_currency_code)
     group by obligation.currency_code
  ), advance_totals as (
    select voucher.currency_code,
           sum(line.amount)::numeric(18,2) as advance_amount,
           sum(coalesce(allocated.amount, 0))::numeric(18,2) as allocated_amount
      from public.finance_vouchers voucher
      join public.finance_voucher_lines line
        on line.voucher_id = voucher.id
       and line.tenant_id = voucher.tenant_id
       and line.handling_type = 'advance'
      left join lateral (
        select sum(allocation.amount)::numeric(18,2) as amount
          from public.finance_allocations allocation
         where allocation.tenant_id = voucher.tenant_id
           and allocation.voucher_line_id = line.id
           and allocation.status = 'active'
           and allocation.effective_date <= p_as_of_date
      ) allocated on true
     where voucher.tenant_id = p_tenant_id
       and voucher.customer_id = p_customer_id
       and voucher.party_type = 'customer'
       and voucher.voucher_type = 'receipt'
       and voucher.status = 'posted'
       and voucher.voucher_date <= p_as_of_date
       and (p_currency_code is null or voucher.currency_code = p_currency_code)
     group by voucher.currency_code
  ), cash_totals as (
    select voucher.currency_code,
           sum(case when movement.direction = 'in'
                    then movement.amount else 0 end)::numeric(18,2)
             as cash_received,
           sum(case when movement.direction = 'out'
                    then movement.amount else 0 end)::numeric(18,2)
             as cash_paid
      from public.finance_account_movements movement
      join public.finance_vouchers voucher
        on voucher.id = movement.voucher_id
       and voucher.tenant_id = movement.tenant_id
     where movement.tenant_id = p_tenant_id
       and voucher.customer_id = p_customer_id
       and voucher.party_type = 'customer'
       and movement.effective_date <= p_as_of_date
       and (p_currency_code is null or voucher.currency_code = p_currency_code)
     group by voucher.currency_code
  )
  select p_tenant_id,
         p_customer_id,
         coalesce(obligation_totals.currency_code,
                  advance_totals.currency_code,
                  cash_totals.currency_code),
         coalesce(obligation_totals.total_billed, 0)::numeric(18,2),
         coalesce(obligation_totals.total_paid, 0)::numeric(18,2),
         coalesce(obligation_totals.total_outstanding, 0)::numeric(18,2),
         coalesce(obligation_totals.overdue_outstanding, 0)::numeric(18,2),
         (
           coalesce(advance_totals.advance_amount, 0)
           - coalesce(advance_totals.allocated_amount, 0)
         )::numeric(18,2),
         coalesce(cash_totals.cash_received, 0)::numeric(18,2),
         coalesce(cash_totals.cash_paid, 0)::numeric(18,2)
    from obligation_totals
    full join advance_totals
      on advance_totals.currency_code = obligation_totals.currency_code
    full join cash_totals
      on cash_totals.currency_code = coalesce(
        obligation_totals.currency_code,
        advance_totals.currency_code
      );
end;
$$;

revoke execute on function public.get_customer_finance_summary_as_of(uuid, uuid, date, text)
  from public, anon;
grant execute on function public.get_customer_finance_summary_as_of(uuid, uuid, date, text)
  to authenticated;

-- Keep the existing summary view useful for current-day consumers while
-- exposing the raw unapplied balance instead of hiding an integrity deficit.
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
), advances as (
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
     where allocation.tenant_id = voucher.tenant_id
       and allocation.voucher_line_id = line.id
       and allocation.status = 'active'
       and allocation.effective_date <= current_date
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
  (
    coalesce(advances.advance_amount, 0)
    - coalesce(advances.allocated_amount, 0)
  )::numeric(18,2) as unapplied_credit
from receivables
full outer join advances
  on advances.tenant_id = receivables.tenant_id
 and advances.customer_id = receivables.customer_id
 and advances.currency_code = receivables.currency_code;

alter view public.customer_receivable_summary set (security_invoker = true);

create or replace function public.allocate_finance_advance(
  p_tenant_id uuid,
  p_voucher_line_id uuid,
  p_obligation_id uuid,
  p_amount numeric,
  p_effective_date date,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source record;
  v_obligation record;
  v_allocated numeric(18,2);
  v_settled numeric(18,2);
  v_operation_id uuid := gen_random_uuid();
  v_allocation_id uuid;
  v_hash text;
  v_existing_type text;
  v_existing_hash text;
  v_existing_result jsonb;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_voucher_line_id is null
     or p_obligation_id is null or p_amount is null or p_amount <= 0
     or p_effective_date is null
     or nullif(btrim(p_request_key), '') is null
  then
    raise exception 'tenant_id, source, target, amount, effective_date and request_key are required'
      using errcode = '22004';
  end if;
  if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:post') then
    raise exception 'Finance voucher post permission required' using errcode = '42501';
  end if;

  v_hash := md5(jsonb_build_object(
    'operation', 'allocate_finance_advance',
    'tenant_id', p_tenant_id,
    'voucher_line_id', p_voucher_line_id,
    'obligation_id', p_obligation_id,
    'amount', p_amount,
    'effective_date', p_effective_date
  )::text);

  -- Serialize retries of the same intent so a concurrent double submit can
  -- replay the committed result instead of racing the unique operation key.
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':' || p_request_key,
    0
  ));

  select operation_type, request_hash, result_summary
    into v_existing_type, v_existing_hash, v_existing_result
    from public.finance_operations operation
   where operation.tenant_id = p_tenant_id
     and operation.request_key = p_request_key;

  if found then
    if v_existing_type <> 'allocate_finance_advance'
       or v_existing_hash <> v_hash
    then
      raise exception 'request_key was already used with different data'
        using errcode = '23505';
    end if;
    return v_existing_result;
  end if;

  select
    line.id,
    line.tenant_id,
    line.amount,
    line.handling_type,
    line.advance_scope,
    line.related_contract_id,
    voucher.status as voucher_status,
    voucher.voucher_type,
    voucher.customer_id,
    voucher.currency_code,
    voucher.voucher_date
  into v_source
  from public.finance_voucher_lines line
  join public.finance_vouchers voucher
    on voucher.id = line.voucher_id
   and voucher.tenant_id = line.tenant_id
  where line.id = p_voucher_line_id
    and line.tenant_id = p_tenant_id
  for update of line, voucher;

  if not found then
    raise exception 'Advance source line not found' using errcode = 'P0002';
  end if;
  if v_source.voucher_status <> 'posted' or v_source.voucher_type <> 'receipt' then
    raise exception 'Advance source voucher must be a posted receipt' using errcode = 'P0001';
  end if;
  if v_source.handling_type <> 'advance' then
    raise exception 'Source line is not an advance' using errcode = '22023';
  end if;
  if p_effective_date < v_source.voucher_date then
    raise exception 'Allocation date cannot be before the source receipt date'
      using errcode = '22023';
  end if;

  select
    obligation.id,
    obligation.tenant_id,
    obligation.customer_id,
    obligation.party_type,
    obligation.direction,
    obligation.currency_code,
    obligation.status,
    obligation.contract_id,
    obligation.effective_date,
    obligation.original_amount
  into v_obligation
  from public.finance_obligations obligation
  where obligation.id = p_obligation_id
    and obligation.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'Target obligation not found' using errcode = 'P0002';
  end if;
  if v_obligation.status <> 'posted' or v_obligation.direction <> 'receivable' then
    raise exception 'Target obligation must be a posted receivable' using errcode = 'P0001';
  end if;
  if p_effective_date < v_obligation.effective_date then
    raise exception 'Allocation date cannot be before the target obligation date'
      using errcode = '22023';
  end if;
  if v_obligation.party_type <> 'customer'
     or v_source.customer_id is null
     or v_obligation.customer_id <> v_source.customer_id
     or v_obligation.currency_code <> v_source.currency_code
  then
    raise exception 'Advance and obligation must belong to the same customer and currency'
      using errcode = '22023';
  end if;
  if v_source.advance_scope = 'contract'
     and (
       v_source.related_contract_id is null
       or v_obligation.contract_id <> v_source.related_contract_id
     )
  then
    raise exception 'Advance is restricted to its contract' using errcode = '22023';
  end if;
  if public.finance_period_is_locked(p_tenant_id, p_effective_date) then
    raise exception 'Không thể phân bổ trong kỳ đã khóa' using errcode = '23514';
  end if;

  select coalesce(sum(allocation.amount), 0)::numeric(18,2)
    into v_allocated
    from public.finance_allocations allocation
   where allocation.tenant_id = p_tenant_id
     and allocation.voucher_line_id = p_voucher_line_id
     and allocation.status = 'active';

  if p_amount > v_source.amount - v_allocated then
    raise exception 'Allocation exceeds the available advance amount' using errcode = '22003';
  end if;

  select coalesce(sum(allocation.amount), 0)::numeric(18,2)
    into v_settled
    from public.finance_allocations allocation
   where allocation.tenant_id = p_tenant_id
     and allocation.obligation_id = p_obligation_id
     and allocation.status = 'active';

  if p_amount > v_obligation.original_amount - v_settled then
    raise exception 'Allocation exceeds the outstanding obligation amount'
      using errcode = '22003';
  end if;

  insert into public.finance_allocations (
    tenant_id, voucher_line_id, obligation_id, amount, effective_date,
    operation_id, created_by
  )
  values (
    p_tenant_id, p_voucher_line_id, p_obligation_id, p_amount,
    p_effective_date, v_operation_id, auth.uid()
  )
  returning id into v_allocation_id;

  v_result := jsonb_build_object(
    'id', v_allocation_id,
    'voucherLineId', p_voucher_line_id,
    'obligationId', p_obligation_id,
    'amount', p_amount,
    'effectiveDate', p_effective_date
  );

  insert into public.finance_operations (
    id, tenant_id, request_key, operation_type, request_hash,
    result_reference, result_summary
  )
  values (
    v_operation_id, p_tenant_id, p_request_key,
    'allocate_finance_advance', v_hash, v_allocation_id, v_result
  );

  return v_result;
end;
$$;

revoke execute on function public.allocate_finance_advance(uuid, uuid, uuid, numeric, date, text)
  from public, anon;
grant execute on function public.allocate_finance_advance(uuid, uuid, uuid, numeric, date, text)
  to authenticated;
