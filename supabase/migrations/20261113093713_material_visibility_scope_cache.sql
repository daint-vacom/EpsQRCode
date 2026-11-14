-- Evaluate material-view scope checks once per distinct owner party instead of
-- once per material row. Preserve the existing permission helper as the source
-- of truth for scoped and unscoped grants.
create or replace function private.current_material_visibility_context()
returns table (can_view_all boolean, visible_party_ids uuid[])
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_can_view_all boolean;
begin
  if (select auth.uid()) is null then
    return query select false, array[]::uuid[];
    return;
  end if;

  v_can_view_all := public.has_scoped_permission(
    'materials:material:view', null
  );

  if v_can_view_all then
    return query select true, array[]::uuid[];
    return;
  end if;

  return query
    with candidate_party_ids as materialized (
      select distinct candidate.party_id
      from public.materials material
      cross join lateral (
        values
          (coalesce(
            material.owner_party_id,
            nullif(material.owner_snapshot->>'scopePartyId', '')::uuid
          )),
          (case
            when material.status = 'loaned' then coalesce(
              material.borrower_party_id,
              nullif(material.borrower_snapshot->>'scopePartyId', '')::uuid
            )
            else null::uuid
          end)
      ) as candidate(party_id)
      where candidate.party_id is not null
    )
    select false, coalesce(
      array_agg(candidate_party_ids.party_id),
      array[]::uuid[]
    )
    from candidate_party_ids
    where public.has_scoped_permission(
      'materials:material:view', candidate_party_ids.party_id
    );
end;
$function$;

revoke all on function private.current_material_visibility_context()
  from public, anon, authenticated, service_role;

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
  v_account_type text;
  v_external_organization_id uuid;
  v_current_department_id text;
  v_current_team_id text;
  v_department_id uuid;
  v_team_id uuid;
  v_access_scopes text[] := '{}'::text[];
  v_owner_filter_types text[] := '{}'::text[];
  v_owner_filter jsonb;
begin
  if (select auth.uid()) is null
    or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode = '42501';
  end if;

  select profile.account_type, profile.external_organization_id
  into v_account_type, v_external_organization_id
  from public.user_profiles profile
  where profile.id = (select auth.uid());

  select current_employee.department_id, current_employee.team_id
  into v_current_department_id, v_current_team_id
  from private.current_account_eps_employee() current_employee;

  if v_current_department_id is not null then
    select party.id into v_department_id
    from public.material_custodians party
    where party.type = 'department'
      and party.source_type = 'eps_department'
      and party.source_id = v_current_department_id
      and party.is_active
    limit 1;
  end if;

  if v_current_team_id is not null then
    select party.id into v_team_id
    from public.material_custodians party
    where party.type = 'team'
      and party.source_type = 'eps_team'
      and party.source_id = v_current_team_id
      and party.is_active
    limit 1;
  end if;

  select coalesce(
    array_agg(distinct role_permission.scope)
      filter (where role_permission.scope is not null),
    '{}'::text[]
  )
  into v_access_scopes
  from public.user_roles assignment
  join public.roles role_record
    on role_record.id = assignment.role_id and role_record.is_active
  join public.role_permissions role_permission
    on role_permission.role_id = role_record.id
   and role_permission.permission_code = 'materials:material:view'
  join public.permission_definitions definition
    on definition.code = role_permission.permission_code
   and definition.is_active
  where assignment.user_id = (select auth.uid());

  if v_account_type = 'eps' and 'all' = any(v_access_scopes) then
    v_owner_filter_types := v_owner_filter_types || array['department', 'person']::text[];
  end if;

  if 'department' = any(v_access_scopes)
    and not ('all' = any(v_access_scopes))
  then
    if v_account_type = 'external' and v_external_organization_id is not null then
      v_owner_filter_types := v_owner_filter_types || array['external']::text[];
    elsif v_account_type = 'eps' and v_department_id is not null then
      v_owner_filter_types := v_owner_filter_types || array['person', 'team']::text[];
    end if;
  end if;

  if v_account_type = 'eps'
    and 'team' = any(v_access_scopes)
    and not ('all' = any(v_access_scopes))
    and not ('department' = any(v_access_scopes))
    and v_team_id is not null
  then
    v_owner_filter_types := v_owner_filter_types || array['person']::text[];
  end if;

  if 'assigned_warehouses' = any(v_access_scopes) then
    v_owner_filter_types := v_owner_filter_types || array['warehouse']::text[];
  end if;

  select coalesce(array_agg(distinct owner_type), '{}'::text[])
  into v_owner_filter_types
  from pg_catalog.unnest(v_owner_filter_types) as owner_types(owner_type);

  v_owner_filter := pg_catalog.jsonb_build_object(
    'types', pg_catalog.to_jsonb(v_owner_filter_types),
    'departmentId', case
      when v_account_type = 'eps'
        and 'all' <> all(v_access_scopes)
        and 'department' = any(v_access_scopes)
        then v_department_id
      else null
    end,
    'teamId', case
      when v_account_type = 'eps'
        and 'all' <> all(v_access_scopes)
        and 'department' <> all(v_access_scopes)
        and 'team' = any(v_access_scopes)
        then v_team_id
      else null
    end
  );

  return (
    with visibility_context as materialized (
      select * from private.current_material_visibility_context()
    ),
    visible_materials as materialized (
      select material.is_active, material.condition
      from public.materials as material
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
        and (v_status is null or material.status = v_status)
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
    )
    select pg_catalog.jsonb_build_object(
      'total', pg_catalog.count(*)::integer,
      'active', (pg_catalog.count(*) filter (where visible_materials.is_active))::integer,
      'inactive', (pg_catalog.count(*) filter (where not visible_materials.is_active))::integer,
      'good', (pg_catalog.count(*) filter (where visible_materials.condition = 'good'))::integer,
      'damaged', (pg_catalog.count(*) filter (where visible_materials.condition = 'damaged'))::integer,
      'ownerFilter', v_owner_filter
    )
    from visible_materials
  );
end;
$function$;

revoke all on function public.get_material_filter_summary(jsonb)
  from public, anon;
grant execute on function public.get_material_filter_summary(jsonb)
  to authenticated;

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
    with visibility_context as materialized (
      select * from private.current_material_visibility_context()
    ),
    qr_filtered as materialized (
      select coalesce(scan.scan_count, 0) as scan_count
      from public.materials material
      cross join visibility_context visibility
      left join public.material_qr_scan_counts scan
        on scan.material_id = material.id
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
    )
    select jsonb_build_object(
      'qrTotal', count(*)::integer,
      'qrScanned', count(*) filter (where qr_filtered.scan_count > 0)::integer,
      'qrNotScanned', count(*) filter (where qr_filtered.scan_count = 0)::integer
    )
    from qr_filtered
  );
end;
$$;

revoke all on function public.get_material_qr_tracking_filter_summary(jsonb)
  from public, anon;
grant execute on function public.get_material_qr_tracking_filter_summary(jsonb)
  to authenticated;
