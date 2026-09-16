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
set search_path = public
as $$
declare
  v_source record;
  v_obligation record;
  v_allocated numeric(18,2);
  v_settled numeric(18,2);
  v_operation_id uuid := gen_random_uuid();
  v_allocation_id uuid;
  v_hash text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:post') then
    raise exception 'Finance voucher post permission required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Allocation amount must be greater than zero' using errcode = '22023';
  end if;
  if p_effective_date is null then
    raise exception 'Effective date is required' using errcode = '22004';
  end if;
  if nullif(btrim(p_request_key), '') is null then
    raise exception 'request_key is required' using errcode = '22004';
  end if;

  v_hash := md5(jsonb_build_object(
    'voucherLineId', p_voucher_line_id,
    'obligationId', p_obligation_id,
    'amount', p_amount,
    'effectiveDate', p_effective_date
  )::text);

  if exists (
    select 1
    from public.finance_operations operation
    where operation.tenant_id = p_tenant_id
      and operation.request_key = p_request_key
  ) then
    if (
      select operation.request_hash
      from public.finance_operations operation
      where operation.tenant_id = p_tenant_id
        and operation.request_key = p_request_key
    ) <> v_hash then
      raise exception 'request_key was already used with different data' using errcode = '23505';
    end if;
    return (
      select operation.result_summary
      from public.finance_operations operation
      where operation.tenant_id = p_tenant_id
        and operation.request_key = p_request_key
    );
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
    raise exception 'Allocation date cannot be before the source receipt date' using errcode = '22023';
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
  if v_obligation.party_type <> 'customer'
     or v_source.customer_id is null
     or v_obligation.customer_id <> v_source.customer_id
     or v_obligation.currency_code <> v_source.currency_code then
    raise exception 'Advance and obligation must belong to the same customer and currency' using errcode = '22023';
  end if;
  if v_source.advance_scope = 'contract'
     and (v_source.related_contract_id is null or v_obligation.contract_id <> v_source.related_contract_id) then
    raise exception 'Advance is restricted to its contract' using errcode = '22023';
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
    raise exception 'Allocation exceeds the outstanding obligation amount' using errcode = '22003';
  end if;

  insert into public.finance_allocations (
    tenant_id,
    voucher_line_id,
    obligation_id,
    amount,
    effective_date,
    operation_id,
    created_by
  )
  values (
    p_tenant_id,
    p_voucher_line_id,
    p_obligation_id,
    p_amount,
    p_effective_date,
    v_operation_id,
    auth.uid()
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
    id,
    tenant_id,
    request_key,
    operation_type,
    request_hash,
    result_reference,
    result_summary
  )
  values (
    v_operation_id,
    p_tenant_id,
    p_request_key,
    'allocate_finance_advance',
    v_hash,
    v_allocation_id,
    v_result
  );

  return v_result;
end;
$$;

revoke execute on function public.allocate_finance_advance(uuid, uuid, uuid, numeric, date, text) from public, anon;
grant execute on function public.allocate_finance_advance(uuid, uuid, uuid, numeric, date, text) to authenticated;
