create or replace function public.customer_statistics(
  p_tenant_id uuid
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
    or not public.has_tenant_permission(p_tenant_id, 'customers:view')
  then
    raise exception 'Customer view permission required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total', count(*)::integer,
    'active', count(*) filter (where status = 'active')::integer,
    'inactive', count(*) filter (where status = 'inactive')::integer,
    'withoutContact', count(*) filter (
      where nullif(btrim(coalesce(phone, '')), '') is null
        and nullif(btrim(coalesce(email, '')), '') is null
    )::integer
  )
  into v_result
  from public.customers
  where tenant_id = p_tenant_id;

  return v_result;
end;
$$;

revoke execute on function public.customer_statistics(uuid) from public, anon;
grant execute on function public.customer_statistics(uuid) to authenticated;

notify pgrst, 'reload schema';
