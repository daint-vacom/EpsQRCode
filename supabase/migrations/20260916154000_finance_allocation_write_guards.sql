-- Enforce allocation invariants for every write path, including voucher post.

create or replace function public.finance_allocation_write_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source record;
  v_obligation record;
  v_existing_source_allocated numeric(18,2);
  v_existing_obligation_settled numeric(18,2);
  v_obligation_amount numeric(18,2);
begin
  select voucher.tenant_id,
         voucher.voucher_date,
         voucher.voucher_type,
         voucher.party_type,
         voucher.customer_id,
         voucher.employee_id,
         voucher.currency_code,
         line.handling_type,
         line.advance_scope,
         line.related_contract_id
    into v_source
    from public.finance_voucher_lines line
    join public.finance_vouchers voucher
      on voucher.id = line.voucher_id
     and voucher.tenant_id = line.tenant_id
   where line.id = new.voucher_line_id
     and line.tenant_id = new.tenant_id;
  if not found then
    raise exception 'Allocation source line does not belong to tenant' using errcode = '23514';
  end if;

  select obligation.tenant_id,
         obligation.status,
         obligation.direction,
         obligation.party_type,
         obligation.customer_id,
         obligation.employee_id,
         obligation.currency_code,
         obligation.contract_id,
         obligation.effective_date
    into v_obligation
    from public.finance_obligations obligation
   where obligation.id = new.obligation_id
     and obligation.tenant_id = new.tenant_id;
  if not found then
    raise exception 'Allocation target obligation does not belong to tenant' using errcode = '23514';
  end if;
  if v_obligation.status <> 'posted' then
    raise exception 'Allocation target obligation must be posted' using errcode = '23514';
  end if;
  if new.effective_date < v_source.voucher_date
     or new.effective_date < v_obligation.effective_date
  then
    raise exception 'Allocation date cannot be before source or target effective date'
      using errcode = '22023';
  end if;
  if (
    v_source.voucher_type = 'receipt' and v_obligation.direction <> 'receivable'
  ) or (
    v_source.voucher_type = 'payment' and v_obligation.direction <> 'payable'
  ) then
    raise exception 'Allocation voucher and obligation directions do not match'
      using errcode = '23514';
  end if;
  if v_source.party_type <> v_obligation.party_type
     or v_source.customer_id is distinct from v_obligation.customer_id
     or v_source.employee_id is distinct from v_obligation.employee_id
     or v_source.currency_code <> v_obligation.currency_code
  then
    raise exception 'Allocation party or currency does not match'
      using errcode = '23514';
  end if;
  if v_source.handling_type = 'advance'
     and v_source.advance_scope = 'contract'
     and v_source.related_contract_id is distinct from v_obligation.contract_id
  then
    raise exception 'Contract-scoped advance cannot be allocated to another contract'
      using errcode = '23514';
  end if;
  if v_source.related_contract_id is not null
     and v_source.handling_type <> 'advance'
     and v_source.related_contract_id is distinct from v_obligation.contract_id
  then
    raise exception 'Allocation contract scope does not match obligation'
      using errcode = '23514';
  end if;

  select public.finance_advance_allocated_amount_as_of(
    new.tenant_id, new.voucher_line_id, new.effective_date
  ) into v_existing_source_allocated
  where v_source.handling_type = 'advance';
  if v_source.handling_type = 'advance'
     and coalesce(v_existing_source_allocated, 0) + new.amount > (
       select line.amount
         from public.finance_voucher_lines line
        where line.id = new.voucher_line_id
     )
  then
    raise exception 'Allocation exceeds available advance amount' using errcode = '22003';
  end if;

  v_existing_obligation_settled := public.finance_obligation_settled_amount_as_of(
    new.tenant_id, new.obligation_id, new.effective_date
  );
  v_obligation_amount := (
    select obligation.original_amount
      + public.finance_obligation_adjustment_total_as_of(
          obligation.tenant_id, obligation.id, new.effective_date
        )
      from public.finance_obligations obligation
     where obligation.id = new.obligation_id
       and obligation.tenant_id = new.tenant_id
  );
  if coalesce(v_existing_obligation_settled, 0) + new.amount > v_obligation_amount then
    raise exception 'Allocation exceeds outstanding obligation amount' using errcode = '22003';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_allocations_write_guard on public.finance_allocations;
create trigger finance_allocations_write_guard
before insert or update on public.finance_allocations
for each row execute function public.finance_allocation_write_guard();

revoke execute on function public.finance_allocation_write_guard()
  from public, anon, authenticated;
