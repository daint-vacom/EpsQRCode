create or replace function public.get_material_warehouse_filter_summary(
  p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(p_search), '');
begin
  if auth.uid() is null or not (
    public.has_permission('materials:warehouse:view')
    or public.has_permission('materials:warehouse:manage')
    or public.has_permission('materials:receipt:view')
    or public.has_permission('materials:receipt:manage')
    or public.has_permission('materials:handover:view')
    or public.has_permission('materials:handover:manage')
  ) then
    raise exception 'Permission denied to view warehouses' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'active', count(*) filter (where custodian.is_active)::integer,
      'inactive', count(*) filter (where not custodian.is_active)::integer
    )
    from public.material_warehouses warehouse
    join public.material_custodians custodian
      on custodian.id = warehouse.custodian_id
    where custodian.type = 'warehouse'
      and (
        public.has_scoped_permission('materials:warehouse:view', custodian.id)
        or public.has_scoped_permission('materials:warehouse:manage', custodian.id)
        or public.has_scoped_permission('materials:receipt:view', custodian.id)
        or public.has_scoped_permission('materials:receipt:manage', custodian.id)
        or public.has_scoped_permission('materials:handover:view', custodian.id)
        or public.has_scoped_permission('materials:handover:manage', custodian.id)
      )
      and (
        v_search is null
        or concat_ws(' ', custodian.code, custodian.name, warehouse.address)
          ilike '%' || v_search || '%'
      )
  );
end;
$$;

revoke all on function public.get_material_warehouse_filter_summary(text)
  from public, anon;
grant execute on function public.get_material_warehouse_filter_summary(text)
  to authenticated;
