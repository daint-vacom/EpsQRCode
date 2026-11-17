-- Read models for selecting incomplete receipts and showing stock provenance.
create or replace function public.list_incomplete_material_receipt_options(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_page integer := greatest(coalesce((p_filters->>'page')::integer, 1), 1);
  v_size integer := least(greatest(coalesce((p_filters->>'pageSize')::integer, 25), 1), 100);
  v_search text := nullif(pg_catalog.btrim(p_filters->>'search'), '');
begin
  if (select auth.uid()) is null or not public.has_permission('materials:receipt:view') then
    raise exception 'Permission denied to view receipts' using errcode = '42501';
  end if;

  return (
    with filtered as materialized (
      select receipt.id, receipt.code, receipt.status, receipt.warehouse_id,
        warehouse.code as warehouse_code, warehouse.name as warehouse_name,
        receipt.created_at
      from public.material_receipts as receipt
      join public.material_custodians as warehouse on warehouse.id = receipt.warehouse_id
      where receipt.status in ('draft', 'handover')
        and (
          p_filters->'statuses' is null
          or exists (
            select 1 from pg_catalog.jsonb_array_elements_text(
              case when pg_catalog.jsonb_typeof(p_filters->'statuses') = 'array'
                then p_filters->'statuses' else '[]'::jsonb end
            ) as selected_status(status)
            where selected_status.status = receipt.status
              and selected_status.status in ('draft', 'handover')
          )
        )
        and (v_search is null or receipt.code ilike '%' || v_search || '%'
          or warehouse.name ilike '%' || v_search || '%'
          or warehouse.code ilike '%' || v_search || '%')
        and public.can_view_receipt(receipt.id)
    )
    select pg_catalog.jsonb_build_object(
      'items', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', page.id, 'code', page.code, 'status', page.status,
          'warehouseId', page.warehouse_id, 'warehouseCode', page.warehouse_code,
          'warehouseName', page.warehouse_name, 'createdAt', page.created_at
        ) order by page.created_at desc, page.id)
        from (select * from filtered order by created_at desc, id
          offset (v_page - 1) * v_size limit v_size) as page
      ), '[]'::jsonb),
      'total', (select pg_catalog.count(*)::integer from filtered),
      'page', v_page, 'pageSize', v_size
    )
  );
end;
$function$;
revoke all on function public.list_incomplete_material_receipt_options(jsonb) from public, anon;
grant execute on function public.list_incomplete_material_receipt_options(jsonb) to authenticated;

create or replace function public.get_warehouse_stock_receipt_codes(p_material_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode = '42501';
  end if;

  return coalesce((
    with visibility_context as materialized (
      select * from private.current_material_visibility_context()
    ), requested as materialized (
      select distinct unnest(coalesce(p_material_ids, array[]::uuid[])) as id
    ), stock_materials as materialized (
      select material.id, material.owner_party_id
      from requested
      join public.materials as material on material.id = requested.id
      cross join visibility_context as visibility
      where material.status = 'available'
        and material.owner_snapshot->>'kind' = 'warehouse'
        and material.owner_party_id is not null
        and (visibility.can_view_all or material.owner_party_id = any(visibility.visible_party_ids))
    ), codes as (
      select distinct on (stock.id) stock.id as material_id, receipt.code
      from stock_materials as stock
      join public.material_receipt_items as item
        on item.material_id = stock.id and item.status = 'active'
      join public.material_receipts as receipt
        on receipt.id = item.receipt_id
        and receipt.status = 'handover'
        and receipt.warehouse_id = stock.owner_party_id
      where public.can_view_receipt(receipt.id)
      order by stock.id, receipt.created_at desc, receipt.id
    )
    select pg_catalog.jsonb_object_agg(material_id::text, code) from codes
  ), '{}'::jsonb);
end;
$function$;
revoke all on function public.get_warehouse_stock_receipt_codes(uuid[]) from public, anon;
grant execute on function public.get_warehouse_stock_receipt_codes(uuid[]) to authenticated;

create or replace function public.get_warehouse_stock_summary(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_search text := nullif(pg_catalog.btrim(p_filters ->> 'search'), '');
  v_warehouse_id uuid := nullif(p_filters ->> 'warehouseId', '')::uuid;
  v_receipt_id uuid := nullif(p_filters ->> 'receiptId', '')::uuid;
begin
  if (select auth.uid()) is null or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode = '42501';
  end if;

  return (
    with visibility_context as materialized (
      select * from private.current_material_visibility_context()
    ), stock_base as materialized (
      select material.owner_party_id as warehouse_id,
        material.model_snapshot ->> 'groupId' as group_id
      from public.materials as material
      cross join visibility_context as visibility
      where material.owner_snapshot ->> 'kind' = 'warehouse'
        and material.owner_party_id is not null
        and material.status = 'available'
        and (visibility.can_view_all or material.owner_party_id = any(visibility.visible_party_ids))
        and (coalesce(p_filters ->> 'mode', 'warehouse') <> 'receipt' or v_receipt_id is not null)
        and (v_receipt_id is null or exists (
          select 1
          from public.material_receipt_items as item
          join public.material_receipts as receipt on receipt.id = item.receipt_id
          where item.material_id = material.id
            and item.receipt_id = v_receipt_id
            and item.status = 'active'
            and receipt.status = 'handover'
            and receipt.warehouse_id = material.owner_party_id
            and public.can_view_receipt(receipt.id)
        ))
        and (v_search is null or pg_catalog.concat_ws(' ', material.code,
          material.serial_number, material.name_override,
          material.model_snapshot ->> 'name') ilike '%' || v_search || '%')
    ), chip_filtered as materialized (
      select stock_base.* from stock_base
      where p_filters -> 'groupIds' is null
        or exists (
          select 1 from pg_catalog.jsonb_array_elements_text(
            case when pg_catalog.jsonb_typeof(p_filters -> 'groupIds') = 'array'
              then p_filters -> 'groupIds' else '[]'::jsonb end
          ) as selected_group(group_id)
          where stock_base.group_id = selected_group.group_id
        )
    ), warehouse_counts as (
      select warehouse_id, pg_catalog.count(*)::integer as item_count
      from chip_filtered group by warehouse_id
    ), group_filtered as materialized (
      select stock_base.* from stock_base
      where v_warehouse_id is null or stock_base.warehouse_id = v_warehouse_id
    ), group_counts as (
      select group_id, pg_catalog.count(*)::integer as item_count
      from group_filtered where group_id is not null group by group_id
    )
    select pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*)::integer from chip_filtered),
      'warehouses', coalesce((select pg_catalog.jsonb_object_agg(warehouse_id::text, item_count)
        from warehouse_counts), '{}'::jsonb),
      'groupTotal', (select pg_catalog.count(*)::integer from group_filtered),
      'groupCounts', coalesce((select pg_catalog.jsonb_object_agg(group_id, item_count)
        from group_counts), '{}'::jsonb)
    )
  );
end;
$function$;
revoke all on function public.get_warehouse_stock_summary(jsonb) from public, anon;
grant execute on function public.get_warehouse_stock_summary(jsonb) to authenticated;
