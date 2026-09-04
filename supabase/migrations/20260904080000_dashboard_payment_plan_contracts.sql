create or replace function public.get_dashboard_payment_plan_contracts(
  p_tenant_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'contracts:view')
  then
    raise exception 'Contract view permission required' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Invalid payment plan date range' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'contractId', contract_rows.contract_id,
        'contractCode', contract_rows.contract_code,
        'contractName', contract_rows.contract_name,
        'customerName', contract_rows.customer_name,
        'dueDate', contract_rows.due_date,
        'outstandingAmount', contract_rows.outstanding_amount
      )
      order by
        (contract_rows.due_date < current_date) desc,
        contract_rows.due_date,
        contract_rows.outstanding_amount desc,
        contract_rows.contract_code
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      contract.id as contract_id,
      contract.contract_code,
      contract.name as contract_name,
      customer.name as customer_name,
      min(balance.due_date) as due_date,
      sum(balance.outstanding_amount)::numeric(18, 2) as outstanding_amount
    from public.contract_charge_balances balance
    join public.contracts contract on contract.id = balance.contract_id
    join public.customers customer on customer.id = balance.customer_id
    where balance.tenant_id = p_tenant_id
      and balance.direction = 'receivable'
      and balance.status <> 'voided'
      and balance.outstanding_amount > 0
      and balance.due_date between p_from and p_to
    group by contract.id, contract.contract_code, contract.name, customer.name
  ) contract_rows;

  return v_result;
end;
$$;

revoke execute on function public.get_dashboard_payment_plan_contracts(uuid, date, date)
  from public, anon;
grant execute on function public.get_dashboard_payment_plan_contracts(uuid, date, date)
  to authenticated;

notify pgrst, 'reload schema';
