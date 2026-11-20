-- Default material read paths omit warehouse-owned records before grouping, counting, or pagination.
-- Explicit warehouse stock queries keep their existing ownerKind = warehouse path.


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
    and (p_filters->>'ownerKind' = 'warehouse' or material.owner_snapshot->>'kind' is distinct from 'warehouse')
    and (f.group_key is null or private.material_group_key(
      material.model_id, material.owner_party_id, material.owner_snapshot,
      material.condition, f.by_owner, f.by_condition
    ) = f.group_key);
$$;


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
        and (nullif(p_filters->>'ownerKind', '') is null or material.owner_snapshot->>'kind' = p_filters->>'ownerKind')
        and (p_filters->>'ownerKind' = 'warehouse' or material.owner_snapshot->>'kind' is distinct from 'warehouse')
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
        and (nullif(p_filters->>'ownerKind', '') is null or material.owner_snapshot->>'kind' = p_filters->>'ownerKind')
        and (p_filters->>'ownerKind' = 'warehouse' or material.owner_snapshot->>'kind' is distinct from 'warehouse')
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



create or replace function public.get_material_group_material_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null
    or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode = '42501';
  end if;

  return (
    with recursive visibility_context as materialized (
      select * from private.current_material_visibility_context()
    ),
    visible_materials as materialized (
      select nullif(material.model_snapshot->>'groupId', '')::uuid as group_id
      from public.materials as material
      cross join visibility_context as visibility
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
        and material.owner_snapshot->>'kind' is distinct from 'warehouse'
    ),
    group_ancestors as (
      select group_row.id as descendant_id, group_row.id as ancestor_id
      from public.material_groups as group_row

      union all

      select child.id, group_ancestors.ancestor_id
      from group_ancestors
      join public.material_groups as child
        on child.parent_id = group_ancestors.descendant_id
    ),
    counts_by_group as (
      select
        group_ancestors.ancestor_id as group_id,
        count(visible_materials.group_id)::integer as material_count
      from group_ancestors
      left join visible_materials
        on visible_materials.group_id = group_ancestors.descendant_id
      group by group_ancestors.ancestor_id
    )
    select pg_catalog.jsonb_build_object(
      'counts', coalesce(
        (
          select pg_catalog.jsonb_object_agg(
            counts_by_group.group_id::text,
            counts_by_group.material_count
          )
          from counts_by_group
        ),
        '{}'::jsonb
      ),
      'total', (select count(*)::integer from visible_materials)
    )
  );
end;
$function$;

-- Filter the dashboard's shared material set so totals and the EPS ownership chart
-- use the same non-warehouse default scope as material lists.
do $migration$
declare
  v_definition text;
  v_original text := $sql$join visible_material_snapshots snapshot_rows
      on snapshot_rows.material_id = material.id$sql$;
  v_replacement text := $sql$join visible_material_snapshots snapshot_rows
      on snapshot_rows.material_id = material.id
    where material.owner_snapshot ->> 'kind' is distinct from 'warehouse'$sql$;
begin
  v_definition := pg_catalog.pg_get_functiondef(
    'public.get_material_dashboard_summary(date)'::pg_catalog.regprocedure
  );
  if pg_catalog.strpos(v_definition, 'where material.owner_snapshot ->> ''kind'' is distinct from ''warehouse''') > 0 then
    return;
  end if;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Dashboard visible-material CTE did not match the expected definition';
  end if;
  execute pg_catalog.replace(v_definition, v_original, v_replacement);
end;
$migration$;
