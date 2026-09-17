-- Canonical single-obligation read model for detail routes. The legacy view
-- remains for dependent contract views, while finance consumers use this RPC.

create or replace function public.get_finance_obligation_detail_as_of(
  p_tenant_id uuid,
  p_obligation_id uuid,
  p_as_of_date date
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
  if p_tenant_id is null or p_obligation_id is null or p_as_of_date is null then
    raise exception 'tenant_id, obligation_id and as_of_date are required' using errcode = '22004';
  end if;
  if not (
    public.has_tenant_permission(p_tenant_id, 'finance:obligation:view')
    or public.has_tenant_permission(p_tenant_id, 'finance:report:view')
  ) then
    raise exception 'Finance obligation view permission required' using errcode = '42501';
  end if;

  return query
  select balance.id,
         balance.tenant_id,
         balance.code,
         balance.description,
         balance.party_type,
         balance.customer_id,
         balance.employee_id,
         balance.party_name_snapshot,
         balance.direction,
         balance.source_type,
         balance.contract_id,
         balance.contract_name,
         balance.document_date,
         balance.effective_date,
         balance.due_date,
         balance.recognition_basis,
         balance.original_amount,
         balance.adjustment_amount,
         balance.obligation_amount,
         balance.settled_amount,
         balance.outstanding_amount,
         balance.currency_code,
         balance.status
    from public.get_finance_obligation_balances_as_of(
      p_tenant_id,
      p_as_of_date,
      null::public.finance_obligation_direction,
      null::uuid,
      null::text
    ) balance
   where balance.id = p_obligation_id;
end;
$$;

revoke execute on function public.get_finance_obligation_detail_as_of(uuid, uuid, date)
  from public, anon;
grant execute on function public.get_finance_obligation_detail_as_of(uuid, uuid, date)
  to authenticated;
