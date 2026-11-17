-- Filter material lists by owner kind so warehouse stock can be queried server-side.
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
  v_owner uuid := nullif(p_filters->>'ownerPartyId', '')::uuid;
  v_owner_catalog text := nullif(p_filters->>'ownerCatalogId', '');
  v_owner_scope uuid := nullif(p_filters->>'ownerScopePartyId', '')::uuid;
  v_borrower_scope uuid := nullif(p_filters->>'borrowerScopePartyId', '')::uuid;
  v_owner_name text := nullif(btrim(p_filters->>'ownerName'), '');
  v_borrower_name text := nullif(btrim(p_filters->>'borrowerName'), '');
  v_scan_state text := nullif(p_filters->>'scanState', '');
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode = '42501';
  end if;
  return (
    with visibility_context as materialized (
      select * from private.current_material_visibility_context()
    ),
    filtered as (
      select material.id, material.status, material.name_override, material.model_snapshot
      from public.materials material
      cross join visibility_context visibility
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
        and (v_owner is null or material.owner_party_id = v_owner
          or material.owner_snapshot->>'departmentId' = v_owner::text
          or material.owner_snapshot->>'teamId' = v_owner::text
          or material.owner_snapshot->>'employeeId' = v_owner::text)
        and (v_owner_scope is null or (material.owner_party_id is null
          and material.owner_snapshot->>'kind' = 'other'
          and nullif(material.owner_snapshot->>'scopePartyId', '')::uuid = v_owner_scope
          and (v_owner_name is null or lower(btrim(material.owner_snapshot->>'name')) = lower(v_owner_name))))
        and (v_owner_catalog is null
          or material.owner_snapshot->>'sourceId' = v_owner_catalog
          or material.owner_snapshot->>'departmentSourceId' = v_owner_catalog
          or material.owner_snapshot->>'teamSourceId' = v_owner_catalog
          or material.owner_snapshot->>'employeeSourceId' = v_owner_catalog
          or material.owner_snapshot->>'externalOrganizationId' = v_owner_catalog
          or material.owner_snapshot->>'warehouseId' = v_owner_catalog)
        and (nullif(p_filters->>'borrowerPartyId', '') is null
          or material.borrower_party_id = (p_filters->>'borrowerPartyId')::uuid)
        and (v_borrower_scope is null or (material.borrower_party_id is null
          and material.borrower_snapshot->>'type' = 'other'
          and nullif(material.borrower_snapshot->>'scopePartyId', '')::uuid = v_borrower_scope
          and (v_borrower_name is null or lower(btrim(material.borrower_snapshot->>'name')) = lower(v_borrower_name))))
        and (nullif(p_filters->>'status', '') is null or material.status = p_filters->>'status')
        and (nullif(p_filters->>'condition', '') is null or material.condition = p_filters->>'condition')
        and (nullif(p_filters->>'search', '') is null or concat_ws(' ', material.code, material.serial_number,
          material.name_override, material.model_snapshot->>'name') ilike '%' || btrim(p_filters->>'search') || '%')
        and (nullif(p_filters->>'updatedFrom', '') is null or material.updated_at >= (p_filters->>'updatedFrom')::timestamptz)
        and (nullif(p_filters->>'updatedTo', '') is null or material.updated_at < (p_filters->>'updatedTo')::timestamptz + interval '1 day')
        and (nullif(p_filters->>'isActive', '') is null or material.is_active = (p_filters->>'isActive')::boolean)
        and (nullif(p_filters->>'ownerKind', '') is null or material.owner_snapshot->>'kind' = p_filters->>'ownerKind')
        and (
          v_scan_state is null
          or (v_scan_state = 'scanned' and exists (
            select 1 from public.material_qr_scan_counts scan
            where scan.material_id = material.id and scan.scan_count > 0
          ))
          or (v_scan_state = 'not_scanned' and not exists (
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
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(public.material_json(page.id) order by
        case page.status when 'available' then 0 when 'loaned' then 1 else 2 end,
        lower(coalesce(nullif(btrim(page.name_override), ''), page.model_snapshot->>'name', '')) collate "vi-x-icu", page.id)
        from (select * from filtered order by
          case status when 'available' then 0 when 'loaned' then 1 else 2 end,
          lower(coalesce(nullif(btrim(name_override), ''), model_snapshot->>'name', '')) collate "vi-x-icu", id
          offset (v_page - 1) * v_size limit v_size) page), '[]'::jsonb),
      'total', (select count(*) from filtered), 'page', v_page, 'pageSize', v_size
    )
  );
end;
$$;

revoke all on function public.list_materials(jsonb) from public, anon;
grant execute on function public.list_materials(jsonb) to authenticated;


