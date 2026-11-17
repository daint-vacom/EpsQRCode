create or replace function public.get_warehouse_stock_summary(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_search text := nullif(pg_catalog.btrim(p_filters ->> 'search'), '');
  v_warehouse_id uuid := nullif(p_filters ->> 'warehouseId', '')::uuid;
begin
  if (select auth.uid()) is null
    or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode = '42501';
  end if;

  return (
    with visibility_context as materialized (
      select * from private.current_material_visibility_context()
    ),
    stock_base as materialized (
      select
        material.owner_party_id as warehouse_id,
        material.model_snapshot ->> 'groupId' as group_id
      from public.materials as material
      cross join visibility_context as visibility
      where material.owner_snapshot ->> 'kind' = 'warehouse'
        and material.owner_party_id is not null
        and material.status = 'available'
        and (
          visibility.can_view_all
          or material.owner_party_id = any(visibility.visible_party_ids)
        )
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
    ),
    chip_filtered as materialized (
      select stock_base.*
      from stock_base
      where
        p_filters -> 'groupIds' is null
        or exists (
          select 1
          from pg_catalog.jsonb_array_elements_text(
            case
              when pg_catalog.jsonb_typeof(p_filters -> 'groupIds') = 'array'
                then p_filters -> 'groupIds'
              else '[]'::jsonb
            end
          ) as selected_group(group_id)
          where stock_base.group_id = selected_group.group_id
        )
    ),
    warehouse_counts as (
      select warehouse_id, pg_catalog.count(*)::integer as item_count
      from chip_filtered
      group by warehouse_id
    ),
    group_filtered as materialized (
      select stock_base.*
      from stock_base
      where v_warehouse_id is null or stock_base.warehouse_id = v_warehouse_id
    ),
    group_counts as (
      select group_id, pg_catalog.count(*)::integer as item_count
      from group_filtered
      where group_id is not null
      group by group_id
    )
    select pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*)::integer from chip_filtered),
      'warehouses', coalesce(
        (select pg_catalog.jsonb_object_agg(warehouse_id::text, item_count)
         from warehouse_counts),
        '{}'::jsonb
      ),
      'groupTotal', (select pg_catalog.count(*)::integer from group_filtered),
      'groupCounts', coalesce(
        (select pg_catalog.jsonb_object_agg(group_id, item_count)
         from group_counts),
        '{}'::jsonb
      )
    )
  );
end;
$function$;

revoke all on function public.get_warehouse_stock_summary(jsonb)
  from public, anon;
grant execute on function public.get_warehouse_stock_summary(jsonb)
  to authenticated;
