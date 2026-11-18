-- Return the canonical model identity for each authorized grouped row.
create or replace function public.list_materials_grouped(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce((p_filters->>'groupPage')::integer, 1), 1);
  v_size integer := least(greatest(coalesce((p_filters->>'groupPageSize')::integer, 25), 1), 100);
  v_by_owner boolean := coalesce((p_filters->'groupBy'->>'owner')::boolean, true);
  v_by_condition boolean := coalesce((p_filters->'groupBy'->>'condition')::boolean, false);
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode = '42501';
  end if;

  return (
    with filtered as materialized (
      select
        id, model_id, model_snapshot, owner_party_id, owner_snapshot,
        borrower_party_id, borrower_snapshot, code, serial_number,
        is_active, condition, status
      from private.filtered_materials(p_filters - 'groupKey')
    ), receipt_candidates as materialized (
      select material.id as material_id, receipt.id as receipt_id, receipt.code, receipt.created_at
      from filtered material
      join public.material_receipt_items item
        on item.material_id = material.id and item.status = 'active'
      join public.material_receipts receipt
        on receipt.id = item.receipt_id
        and receipt.status = 'handover'
        and receipt.warehouse_id = material.owner_party_id
      where p_filters->>'ownerKind' = 'warehouse'
        and material.status = 'available'
        and public.has_permission('materials:receipt:view')
    ), visible_receipts as materialized (
      select receipt_id
      from (select distinct receipt_id from receipt_candidates) distinct_receipts
      where public.can_view_receipt(receipt_id)
    ), receipt_codes as (
      select distinct on (candidate.material_id) candidate.material_id, candidate.code
      from receipt_candidates candidate
      join visible_receipts visible using (receipt_id)
      order by candidate.material_id, candidate.created_at desc, candidate.receipt_id
    ), projected as (
      select
        private.material_group_key(
          material.model_id, material.owner_party_id, material.owner_snapshot,
          material.condition, v_by_owner, v_by_condition
        ) as group_key,
        material.model_id,
        nullif(btrim(material.model_snapshot->>'name'), '') as model_name,
        nullif(btrim(material.owner_snapshot->>'name'), '') as owner_name,
        nullif(btrim(material.code), '') as material_code,
        nullif(btrim(material.serial_number), '') as serial_number,
        nullif(btrim(material.model_snapshot->>'groupId'), '') as material_group_id,
        nullif(btrim(receipt_codes.code), '') as receipt_code,
        case when material.status = 'loaned'
          then coalesce(
            nullif(btrim(material.borrower_snapshot->>'name'), ''),
            borrower.name, material.borrower_party_id::text
          )
          else nullif(btrim(material.owner_snapshot->>'name'), '')
        end as holder,
        material.is_active::text as is_active,
        material.condition,
        material.status
      from filtered material
      left join public.material_custodians borrower on borrower.id = material.borrower_party_id
      left join receipt_codes on receipt_codes.material_id = material.id
    ), grouped as (
      select
        group_key, model_id, count(*) as quantity,
        min(case status when 'available' then 0 when 'loaned' then 1 else 2 end) as status_order,
        private.material_group_common(count(*), count(model_name), min(model_name), max(model_name)) as model_name,
        private.material_group_common(count(*), count(owner_name), min(owner_name), max(owner_name)) as owner_name,
        private.material_group_common(count(*), count(condition), min(condition), max(condition)) as condition,
        jsonb_build_object(
          'ownerName', private.material_group_common(count(*), count(owner_name), min(owner_name), max(owner_name)),
          'condition', private.material_group_common(count(*), count(condition), min(condition), max(condition)),
          'status', private.material_group_common(count(*), count(status), min(status), max(status)),
          'availability', private.material_group_common(count(*), count(is_active), min(is_active), max(is_active)),
          'code', private.material_group_common(count(*), count(material_code), min(material_code), max(material_code)),
          'serialNumber', private.material_group_common(count(*), count(serial_number), min(serial_number), max(serial_number)),
          'groupId', private.material_group_common(count(*), count(material_group_id), min(material_group_id), max(material_group_id)),
          'receiptCode', private.material_group_common(count(*), count(receipt_code), min(receipt_code), max(receipt_code)),
          'holder', private.material_group_common(count(*), count(holder), min(holder), max(holder))
        ) as common
      from projected
      group by group_key, model_id
    ), named as (
      select grouped.*, coalesce(nullif(btrim(model.name), ''), grouped.model_name, '—') as display_name, model.code as model_code
      from grouped
      left join public.material_models model on model.id = grouped.model_id
    ), paged as (
      select *
      from named
      order by status_order, lower(display_name) collate "vi-x-icu",
        lower(owner_name) collate "vi-x-icu", group_key
      offset (v_page::bigint - 1) * v_size limit v_size
    )
    select jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'groupKey', group_key, 'modelId', model_id, 'modelName', display_name,
            'modelCode', model_code,
            'modelImage', (
              select jsonb_build_object('storagePath', image.storage_path, 'externalUrl', image.external_url)
              from public.material_model_images image
              where image.model_id = paged.model_id and image.is_cover
              order by image.sort_order, image.id
              limit 1
            ),
            'ownerName', owner_name,
            'condition', case when condition <> '…' then condition end,
            'quantity', quantity, 'common', common
          )
          order by status_order, lower(display_name) collate "vi-x-icu",
            lower(owner_name) collate "vi-x-icu", group_key
        )
        from paged
      ), '[]'::jsonb),
      'total', (select count(*) from named),
      'page', v_page, 'pageSize', v_size
    )
  );
end;
$$;

revoke all on function public.list_materials_grouped(jsonb) from public, anon;
grant execute on function public.list_materials_grouped(jsonb) to authenticated;
