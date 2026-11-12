-- Keep QR tracking filters server-side and expose the complete scan counts
-- through one material-domain summary response.
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
    with filtered as (
      select material.id, material.status, material.name_override, material.model_snapshot
      from public.materials material
      where public.can_view_material_current(material.id)
        and (nullif(p_filters->>'id', '') is null or material.id = (p_filters->>'id')::uuid)
        and (not coalesce((p_filters->>'excludeReserved')::boolean, false)
          or material.reserved_handover_id is null
          or material.reserved_handover_id = nullif(p_filters->>'allowReservedByHandoverId', '')::uuid)
        and (nullif(p_filters->>'modelId', '') is null or material.model_id = (p_filters->>'modelId')::uuid)
        and (nullif(p_filters->>'groupId', '') is null or material.model_snapshot->>'groupId' = p_filters->>'groupId')
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

create or replace function public.get_material_qr_tracking_filter_summary(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(p_filters->>'search'), '');
  v_status text := nullif(p_filters->>'status', '');
  v_owner uuid := nullif(p_filters->>'ownerPartyId', '')::uuid;
  v_base jsonb;
begin
  v_base := public.get_material_filter_summary(p_filters);

  return v_base || (
    select jsonb_build_object(
      'qrTotal', count(*)::integer,
      'qrScanned', count(*) filter (where coalesce(scan.scan_count, 0) > 0)::integer,
      'qrNotScanned', count(*) filter (where coalesce(scan.scan_count, 0) = 0)::integer
    )
    from public.materials material
    left join public.material_qr_scan_counts scan on scan.material_id = material.id
    where public.can_view_material_current(material.id)
      and (v_status is null or material.status = v_status)
      and (
        v_search is null
        or concat_ws(' ', material.code, material.serial_number,
          material.name_override, material.model_snapshot->>'name')
          ilike '%' || v_search || '%'
      )
      and (
        v_owner is null
        or material.owner_party_id = v_owner
        or material.owner_snapshot->>'departmentId' = v_owner::text
        or material.owner_snapshot->>'teamId' = v_owner::text
        or material.owner_snapshot->>'employeeId' = v_owner::text
      )
  );
end;
$$;

revoke all on function public.get_material_qr_tracking_filter_summary(jsonb)
  from public, anon;
grant execute on function public.get_material_qr_tracking_filter_summary(jsonb)
  to authenticated;

create or replace function private.list_material_safety_inspections(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(nullif(p_filters ->> 'page', '')::integer, 1), 1);
  v_page_size integer := least(greatest(coalesce(nullif(p_filters ->> 'pageSize', '')::integer, 25), 1), 100);
  v_search text := nullif(pg_catalog.btrim(p_filters ->> 'search'), '');
  v_status text := nullif(p_filters ->> 'status', '');
  v_overall_result text := nullif(p_filters ->> 'overallResult', '');
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  with filtered as (
    select
      inspection.id,
      inspection.material_id,
      inspection.inspected_at,
      inspection.inspector_name,
      inspection.status,
      inspection.overall_result,
      material.code as material_code,
      coalesce(
        nullif(pg_catalog.btrim(material.name_override), ''),
        nullif(material.model_snapshot ->> 'name', ''),
        material.code
      ) as material_name
    from public.material_safety_inspections inspection
    join public.materials material on material.id = inspection.material_id
    where public.can_view_material_current(material.id)
      and (v_status is null or inspection.status = v_status)
      and (
        v_overall_result is null
        or (v_overall_result = 'none' and inspection.overall_result is null)
        or inspection.overall_result = v_overall_result
      )
      and (
        v_search is null
        or material.code ilike '%' || v_search || '%'
        or material.name_override ilike '%' || v_search || '%'
        or material.model_snapshot ->> 'name' ilike '%' || v_search || '%'
        or inspection.inspector_name ilike '%' || v_search || '%'
      )
  ), page_items as (
    select *
    from filtered
    order by inspected_at desc, id desc
    offset (v_page - 1) * v_page_size
    limit v_page_size
  )
  select pg_catalog.jsonb_build_object(
    'items', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', id,
        'materialId', material_id,
        'materialCode', material_code,
        'materialName', material_name,
        'inspectedAt', inspected_at,
        'inspectorName', inspector_name,
        'status', status,
        'overallResult', overall_result
      ) order by inspected_at desc, id desc)
      from page_items
    ), '[]'::jsonb),
    'total', (select pg_catalog.count(*) from filtered),
    'page', v_page,
    'pageSize', v_page_size
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function private.list_material_safety_inspections(jsonb)
  from public, anon, authenticated;
grant execute on function private.list_material_safety_inspections(jsonb)
  to authenticated;

create or replace function public.get_safety_inspection_filter_summary(
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
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'inProgress', count(*) filter (where inspection.status = 'in_progress')::integer,
      'completed', count(*) filter (where inspection.status = 'completed')::integer,
      'passed', count(*) filter (where inspection.overall_result = 'passed')::integer,
      'failed', count(*) filter (where inspection.overall_result = 'failed')::integer,
      'noResult', count(*) filter (where inspection.overall_result is null)::integer
    )
    from public.material_safety_inspections inspection
    join public.materials material on material.id = inspection.material_id
    where public.can_view_material_current(material.id)
      and (
        v_search is null
        or material.code ilike '%' || v_search || '%'
        or material.name_override ilike '%' || v_search || '%'
        or material.model_snapshot->>'name' ilike '%' || v_search || '%'
        or inspection.inspector_name ilike '%' || v_search || '%'
      )
  );
end;
$$;

revoke all on function public.get_safety_inspection_filter_summary(text)
  from public, anon;
grant execute on function public.get_safety_inspection_filter_summary(text)
  to authenticated;

create or replace function public.get_handover_filter_summary(
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
  if auth.uid() is null or not public.has_permission('materials:handover:view') then
    raise exception 'Permission denied to view handovers' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'draft', count(*) filter (where handover.status = 'draft')::integer,
      'awaitingWarehouseApproval', count(*) filter (where handover.status = 'awaiting_warehouse_approval')::integer,
      'pending', count(*) filter (where handover.status = 'pending')::integer,
      'completed', count(*) filter (where handover.status = 'completed')::integer,
      'rejected', count(*) filter (where handover.status = 'rejected')::integer,
      'cancelled', count(*) filter (where handover.status = 'cancelled')::integer,
      'transfer', count(*) filter (where handover.type = 'transfer')::integer,
      'loan', count(*) filter (where handover.type = 'loan')::integer,
      'return', count(*) filter (where handover.type = 'return')::integer
    )
    from public.material_handovers handover
    where public.can_view_handover(handover.id)
      and (v_search is null or handover.code ilike '%' || v_search || '%')
  );
end;
$$;

revoke all on function public.get_handover_filter_summary(text)
  from public, anon;
grant execute on function public.get_handover_filter_summary(text)
  to authenticated;

create or replace function public.get_material_receipt_filter_summary(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(p_filters->>'search'), '');
  v_warehouse uuid := nullif(p_filters->>'warehouseId', '')::uuid;
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:view') then
    raise exception 'Permission denied to view receipts' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'draft', count(*) filter (where receipt.status = 'draft')::integer,
      'handover', count(*) filter (where receipt.status = 'handover')::integer,
      'completed', count(*) filter (where receipt.status = 'completed')::integer,
      'cancelled', count(*) filter (where receipt.status = 'cancelled')::integer
    )
    from public.material_receipts receipt
    where public.can_view_receipt(receipt.id)
      and (v_warehouse is null or receipt.warehouse_id = v_warehouse)
      and (v_search is null or receipt.code ilike '%' || v_search || '%')
  );
end;
$$;

revoke all on function public.get_material_receipt_filter_summary(jsonb)
  from public, anon;
grant execute on function public.get_material_receipt_filter_summary(jsonb)
  to authenticated;

create or replace function public.get_material_group_filter_summary(
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
  if auth.uid() is null or not public.has_permission('material_catalog:material_group:view') then
    raise exception 'Permission denied to view material groups' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'active', count(*) filter (where group_row.is_active)::integer,
      'inactive', count(*) filter (where not group_row.is_active)::integer
    )
    from public.material_groups group_row
    where v_search is null
      or concat_ws(' ', group_row.code, group_row.name, group_row.description)
        ilike '%' || v_search || '%'
  );
end;
$$;

revoke all on function public.get_material_group_filter_summary(text)
  from public, anon;
grant execute on function public.get_material_group_filter_summary(text)
  to authenticated;

create or replace function public.get_material_model_filter_summary(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(p_filters->>'search'), '');
  v_group uuid := nullif(p_filters->>'groupId', '')::uuid;
begin
  if auth.uid() is null or not public.has_permission('material_catalog:material_model:view') then
    raise exception 'Permission denied to view material models' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'active', count(*) filter (where model.is_active)::integer,
      'inactive', count(*) filter (where not model.is_active)::integer,
      'requiresInspection', count(*) filter (where model.requires_inspection)::integer,
      'notRequiresInspection', count(*) filter (where not model.requires_inspection)::integer
    )
    from public.material_models model
    where (v_group is null or model.group_id = v_group)
      and (
        v_search is null
        or concat_ws(' ', model.code, model.name)
          ilike '%' || v_search || '%'
      )
  );
end;
$$;

revoke all on function public.get_material_model_filter_summary(jsonb)
  from public, anon;
grant execute on function public.get_material_model_filter_summary(jsonb)
  to authenticated;

create or replace function public.get_material_specification_filter_summary(
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
  if auth.uid() is null or not public.has_permission('material_catalog:specification:view') then
    raise exception 'Permission denied to view material specifications' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'text', count(*) filter (where specification.data_type = 'text')::integer,
      'number', count(*) filter (where specification.data_type = 'number')::integer,
      'boolean', count(*) filter (where specification.data_type = 'boolean')::integer,
      'date', count(*) filter (where specification.data_type = 'date')::integer,
      'color', count(*) filter (where specification.data_type = 'color')::integer,
      'length', count(*) filter (where specification.data_type = 'length')::integer,
      'weight', count(*) filter (where specification.data_type = 'weight')::integer
    )
    from public.material_specifications specification
    where v_search is null
      or concat_ws(' ', specification.code, specification.name)
        ilike '%' || v_search || '%'
  );
end;
$$;

revoke all on function public.get_material_specification_filter_summary(text)
  from public, anon;
grant execute on function public.get_material_specification_filter_summary(text)
  to authenticated;

create or replace function public.get_material_label_template_filter_summary(
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
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view label templates' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'active', count(*) filter (where template.is_active)::integer,
      'inactive', count(*) filter (where not template.is_active)::integer,
      'default', count(*) filter (where template.is_default)::integer,
      'notDefault', count(*) filter (where not template.is_default)::integer
    )
    from public.material_label_templates template
    where v_search is null
      or concat_ws(' ', template.name, template.description)
        ilike '%' || v_search || '%'
  );
end;
$$;

revoke all on function public.get_material_label_template_filter_summary(text)
  from public, anon;
grant execute on function public.get_material_label_template_filter_summary(text)
  to authenticated;

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
  if auth.uid() is null or not public.has_permission('materials:warehouse:view') then
    raise exception 'Permission denied to view warehouses' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'active', count(*) filter (where custodian.is_active)::integer,
      'inactive', count(*) filter (where not custodian.is_active)::integer
    )
    from public.material_custodians custodian
    left join public.material_warehouses warehouse
      on warehouse.custodian_id = custodian.id
    where custodian.type = 'warehouse'
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

create or replace function public.get_external_organization_filter_summary(
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
    public.has_permission('organization:external-organization:view')
    or public.has_permission('organization:external-organization:manage')
    or public.has_permission('organization:account:view')
    or public.has_permission('organization:account:manage')
  ) then
    raise exception 'External organization view permission required' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'active', count(*) filter (where party.is_active)::integer,
      'inactive', count(*) filter (where not party.is_active)::integer
    )
    from public.material_custodians party
    where party.type = 'external'
      and (
        v_search is null
        or concat_ws(' ', party.code, party.name) ilike '%' || v_search || '%'
      )
  );
end;
$$;

revoke all on function public.get_external_organization_filter_summary(text)
  from public, anon;
grant execute on function public.get_external_organization_filter_summary(text)
  to authenticated;

create or replace function public.get_qrcode_account_filter_summary(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(p_filters->>'search'), '');
  v_organization uuid := nullif(p_filters->>'organizationId', '')::uuid;
begin
  if auth.uid() is null or not public.has_permission('organization:account:view') then
    raise exception 'Account view permission required' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'active', count(*) filter (where profile.status = 'active')::integer,
      'suspended', count(*) filter (where profile.status = 'suspended')::integer,
      'deactivated', count(*) filter (where profile.status = 'deactivated')::integer,
      'eps', count(*) filter (where profile.account_type = 'eps')::integer,
      'external', count(*) filter (where profile.account_type = 'external')::integer,
      'unmapped', count(*) filter (where profile.account_type is null)::integer
    )
    from public.user_profiles profile
    left join private.fake_eps_employees employee
      on profile.account_type = 'eps' and employee.id = profile.eps_employee_id
    left join private.fake_eps_departments department
      on department.id = employee.department_id
    left join private.fake_eps_teams team
      on team.id = employee.team_id
    left join public.material_custodians external_party
      on profile.account_type = 'external'
      and external_party.id = profile.external_organization_id
      and external_party.type = 'external'
    where (v_search is null
      or concat_ws(' ', profile.username, profile.display_name,
          employee.employee_code, employee.first_name, employee.last_name,
          department.name, team.name, external_party.name)
          ilike '%' || v_search || '%'
      )
      and (v_organization is null
        or profile.external_organization_id = v_organization
        or department.id = v_organization)
  );
end;
$$;

revoke all on function public.get_qrcode_account_filter_summary(jsonb)
  from public, anon;
grant execute on function public.get_qrcode_account_filter_summary(jsonb)
  to authenticated;

notify pgrst, 'reload schema';
