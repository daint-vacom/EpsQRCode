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
  ), receipt_scope as materialized (
    select exists (
      select 1
      from public.material_receipts receipt
      where receipt.id = nullif(p_filters->>'receiptId', '')::uuid
        and exists (
          select 1
          from public.material_custodians party
          where party.is_active and party.type <> 'warehouse'
            and private.can_request_material_receipt(receipt.id, party.id)
        )
    ) as can_request
  )
  select material.*
  from public.materials material
  cross join visibility_context visibility
  cross join filters f
  cross join receipt_scope request_scope
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
      or (
        request_scope.can_request
        and material.is_active
        and material.status = 'available'
        and material.borrower_party_id is null
        and material.active_loan_handover_id is null
        and material.reserved_handover_id is null
        and exists (
          select 1
          from public.material_receipt_items item
          join public.material_receipts receipt on receipt.id = item.receipt_id
          where item.receipt_id = nullif(p_filters->>'receiptId', '')::uuid
            and item.material_id = material.id
            and item.status = 'active'
            and receipt.status = 'handover'
            and receipt.warehouse_id = material.owner_party_id
        )
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
      select 1
      from public.material_receipt_items item
      join public.material_receipts receipt on receipt.id = item.receipt_id
      where item.receipt_id = (p_filters->>'receiptId')::uuid
        and item.material_id = material.id
        and item.status = 'active'
        and receipt.status = 'handover'
        and receipt.warehouse_id = material.owner_party_id
        and (public.can_view_receipt(receipt.id) or request_scope.can_request)
    ))
    and (p_filters->>'ownerKind' = 'warehouse' or material.owner_snapshot->>'kind' is distinct from 'warehouse')
    and (f.group_key is null or private.material_group_key(
      material.model_id, material.owner_party_id, material.owner_snapshot,
      material.condition, f.by_owner, f.by_condition
    ) = f.group_key);
$$;
