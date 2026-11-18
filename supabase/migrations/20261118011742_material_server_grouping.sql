-- Share the authorized material scope across physical rows and grouped counts.
create or replace function private.material_group_key(
  p_model_id uuid,
  p_owner_party_id uuid,
  p_owner jsonb,
  p_condition text,
  p_by_owner boolean,
  p_by_condition boolean
)
returns text
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_array(
    p_model_id,
    case when p_by_owner then
      case
        when p_owner->>'kind' = 'other' then jsonb_build_array(
          'manual', nullif(p_owner->>'scopePartyId', ''),
          lower(nullif(btrim(p_owner->>'name'), '')),
          case when nullif(btrim(p_owner->>'name'), '') is null
            then lower(nullif(btrim(p_owner->>'code'), '')) end
        )
        when coalesce(p_owner_party_id::text, nullif(p_owner->>'partyId', ''), nullif(p_owner->>'catalogPartyId', '')) is not null
          then jsonb_build_array('party', coalesce(p_owner_party_id::text, nullif(p_owner->>'partyId', ''), nullif(p_owner->>'catalogPartyId', '')))
        when nullif(p_owner->>'employeeId', '') is not null then jsonb_build_array('employee', p_owner->>'employeeId')
        when nullif(p_owner->>'teamId', '') is not null then jsonb_build_array('team', p_owner->>'teamId')
        when nullif(p_owner->>'departmentId', '') is not null then jsonb_build_array('department', p_owner->>'departmentId')
        when nullif(p_owner->>'externalOrganizationId', '') is not null then jsonb_build_array('external', p_owner->>'externalOrganizationId')
        when nullif(p_owner->>'warehouseId', '') is not null then jsonb_build_array('warehouse', p_owner->>'warehouseId')
        when nullif(p_owner->>'sourceId', '') is not null then jsonb_build_array('source', p_owner->>'sourceType', p_owner->>'sourceId')
        else jsonb_build_array(
          'snapshot', p_owner->>'kind', p_owner->>'type', nullif(p_owner->>'scopePartyId', ''),
          lower(nullif(btrim(p_owner->>'code'), '')), lower(nullif(btrim(p_owner->>'name'), ''))
        )
      end
    end,
    case when p_by_condition then p_condition end
  )::text;
$$;

revoke all on function private.material_group_key(uuid, uuid, jsonb, text, boolean, boolean) from public, anon, authenticated;

create or replace function private.filtered_materials(p_filters jsonb)
returns setof public.materials
language sql
stable
as $$
  with visibility_context as materialized (
    select * from private.current_material_visibility_context()
  ), filters as (
    select
      nullif(p_filters->>'ownerPartyId', '')::uuid as owner_id,
      nullif(p_filters->>'ownerCatalogId', '') as owner_catalog,
      nullif(p_filters->>'ownerScopePartyId', '')::uuid as owner_scope,
      nullif(p_filters->>'borrowerScopePartyId', '')::uuid as borrower_scope,
      nullif(btrim(p_filters->>'ownerName'), '') as owner_name,
      nullif(btrim(p_filters->>'borrowerName'), '') as borrower_name,
      nullif(p_filters->>'scanState', '') as scan_state,
      nullif(p_filters->>'groupKey', '') as group_key,
      coalesce((p_filters->'groupBy'->>'owner')::boolean, true) as by_owner,
      coalesce((p_filters->'groupBy'->>'condition')::boolean, false) as by_condition
  )
  select material.*
  from public.materials material
  cross join visibility_context visibility
  cross join filters f
  where (
      visibility.can_view_all
      or coalesce(
        material.owner_party_id,
        nullif(material.owner_snapshot->>'scopePartyId', '')::uuid
      ) = any(visibility.visible_party_ids)
      or (
        material.status = 'loaned'
        and coalesce(
          material.borrower_party_id,
          nullif(material.borrower_snapshot->>'scopePartyId', '')::uuid
        ) = any(visibility.visible_party_ids)
      )
    )
    and (nullif(p_filters->>'id', '') is null or material.id = (p_filters->>'id')::uuid)
    and (not coalesce((p_filters->>'excludeReserved')::boolean, false)
      or material.reserved_handover_id is null
      or material.reserved_handover_id = nullif(p_filters->>'allowReservedByHandoverId', '')::uuid)
    and (nullif(p_filters->>'modelId', '') is null or material.model_id = (p_filters->>'modelId')::uuid)
    and (nullif(p_filters->>'groupId', '') is null or material.model_snapshot->>'groupId' = p_filters->>'groupId')
    and (
      p_filters->'groupIds' is null
      or exists (
        select 1
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(p_filters->'groupIds') = 'array'
              then p_filters->'groupIds'
            else '[]'::jsonb
          end
        ) as selected_group(group_id)
        where material.model_snapshot->>'groupId' = selected_group.group_id
      )
    )
    and (f.owner_id is null or material.owner_party_id = f.owner_id
      or material.owner_snapshot->>'departmentId' = f.owner_id::text
      or material.owner_snapshot->>'teamId' = f.owner_id::text
      or material.owner_snapshot->>'employeeId' = f.owner_id::text)
    and (f.owner_scope is null or (material.owner_party_id is null
      and material.owner_snapshot->>'kind' = 'other'
      and nullif(material.owner_snapshot->>'scopePartyId', '')::uuid = f.owner_scope
      and (f.owner_name is null or lower(btrim(material.owner_snapshot->>'name')) = lower(f.owner_name))))
    and (f.owner_catalog is null
      or material.owner_snapshot->>'sourceId' = f.owner_catalog
      or material.owner_snapshot->>'departmentSourceId' = f.owner_catalog
      or material.owner_snapshot->>'teamSourceId' = f.owner_catalog
      or material.owner_snapshot->>'employeeSourceId' = f.owner_catalog
      or material.owner_snapshot->>'externalOrganizationId' = f.owner_catalog
      or material.owner_snapshot->>'warehouseId' = f.owner_catalog)
    and (nullif(p_filters->>'borrowerPartyId', '') is null
      or material.borrower_party_id = (p_filters->>'borrowerPartyId')::uuid)
    and (f.borrower_scope is null or (material.borrower_party_id is null
      and material.borrower_snapshot->>'type' = 'other'
      and nullif(material.borrower_snapshot->>'scopePartyId', '')::uuid = f.borrower_scope
      and (f.borrower_name is null or lower(btrim(material.borrower_snapshot->>'name')) = lower(f.borrower_name))))
    and (nullif(p_filters->>'status', '') is null or material.status = p_filters->>'status')
    and (nullif(p_filters->>'condition', '') is null or material.condition = p_filters->>'condition')
    and (nullif(p_filters->>'search', '') is null or concat_ws(' ', material.code, material.serial_number,
      material.name_override, material.model_snapshot->>'name') ilike '%' || btrim(p_filters->>'search') || '%')
    and (nullif(p_filters->>'updatedFrom', '') is null or material.updated_at >= (p_filters->>'updatedFrom')::timestamptz)
    and (nullif(p_filters->>'updatedTo', '') is null or material.updated_at < (p_filters->>'updatedTo')::timestamptz + interval '1 day')
    and (nullif(p_filters->>'isActive', '') is null or material.is_active = (p_filters->>'isActive')::boolean)
    and (nullif(p_filters->>'ownerKind', '') is null or material.owner_snapshot->>'kind' = p_filters->>'ownerKind')
    and (
      f.scan_state is null
      or (f.scan_state = 'scanned' and exists (
        select 1 from public.material_qr_scan_counts scan
        where scan.material_id = material.id and scan.scan_count > 0
      ))
      or (f.scan_state = 'not_scanned' and not exists (
        select 1 from public.material_qr_scan_counts scan
        where scan.material_id = material.id and scan.scan_count > 0
      ))
    )
    and (nullif(p_filters->>'receiptId', '') is null or exists (
      select 1 from public.material_receipt_items item
      join public.material_receipts receipt on receipt.id = item.receipt_id
      where item.receipt_id = (p_filters->>'receiptId')::uuid and item.material_id = material.id
        and item.status = 'active' and receipt.status = 'handover'
        and receipt.warehouse_id = material.owner_party_id and public.can_view_receipt(receipt.id)
    ))
    and (f.group_key is null or private.material_group_key(
      material.model_id, material.owner_party_id, material.owner_snapshot,
      material.condition, f.by_owner, f.by_condition
    ) = f.group_key);
$$;

revoke all on function private.filtered_materials(jsonb) from public, anon, authenticated;

create or replace function public.list_materials(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce((p_filters->>'page')::integer, 1), 1);
  v_size integer := least(greatest(coalesce((p_filters->>'pageSize')::integer, 20), 1), 100);
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode = '42501';
  end if;

  return (
    with filtered as materialized (
      select id, status, name_override, model_snapshot
      from private.filtered_materials(p_filters)
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(public.material_json(page.id) order by
        case page.status when 'available' then 0 when 'loaned' then 1 else 2 end,
        lower(coalesce(nullif(btrim(page.name_override), ''), page.model_snapshot->>'name', '')) collate "vi-x-icu", page.id)
        from (select * from filtered order by
          case status when 'available' then 0 when 'loaned' then 1 else 2 end,
          lower(coalesce(nullif(btrim(name_override), ''), model_snapshot->>'name', '')) collate "vi-x-icu", id
          offset (v_page::bigint - 1) * v_size limit v_size) page), '[]'::jsonb),
      'total', (select count(*) from filtered), 'page', v_page, 'pageSize', v_size
    )
  );
end;
$$;

revoke all on function public.list_materials(jsonb) from public, anon;
grant execute on function public.list_materials(jsonb) to authenticated;

create or replace function private.material_group_common(
  p_total bigint,
  p_populated bigint,
  p_min text,
  p_max text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_populated = 0 then null
    when p_populated = p_total and p_min = p_max then p_min
    else '…'
  end;
$$;

revoke all on function private.material_group_common(bigint, bigint, text, text) from public, anon, authenticated;

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
      select grouped.*, coalesce(nullif(btrim(model.name), ''), grouped.model_name, '—') as display_name
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
