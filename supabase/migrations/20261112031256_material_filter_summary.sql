create or replace function public.get_material_filter_summary(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_status text := nullif(p_filters ->> 'status', '');
  v_search text := nullif(pg_catalog.btrim(p_filters ->> 'search'), '');
begin
  if (select auth.uid()) is null
    or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode = '42501';
  end if;

  return (
    select pg_catalog.jsonb_build_object(
      'total', pg_catalog.count(*)::integer,
      'active', (pg_catalog.count(*) filter (where material.is_active))::integer,
      'inactive', (pg_catalog.count(*) filter (where not material.is_active))::integer,
      'good', (pg_catalog.count(*) filter (where material.condition = 'good'))::integer,
      'damaged', (pg_catalog.count(*) filter (where material.condition = 'damaged'))::integer
    )
    from public.materials as material
    where public.can_view_material_current(material.id)
      and (v_status is null or material.status = v_status)
      and (
        v_search is null
        or pg_catalog.concat_ws(
          ' ',
          material.code,
          material.serial_number,
          material.name_override,
          material.model_snapshot ->> 'name'
        ) ilike '%' || v_search || '%'
      )
  );
end;
$function$;

revoke all on function public.get_material_filter_summary(jsonb)
  from public, anon;
grant execute on function public.get_material_filter_summary(jsonb)
  to authenticated;
