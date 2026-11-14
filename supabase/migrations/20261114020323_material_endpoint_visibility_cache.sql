-- Filter inspection read models with a request-scoped visibility set, then
-- evaluate each distinct material model snapshot only once per request.
create or replace function private.current_visible_active_material_model_snapshots(
  p_owner_party_id uuid default null
)
returns table (
  material_id uuid,
  model_id uuid,
  snapshot jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null
    or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view material model snapshots'
      using errcode = '42501';
  end if;

  return query
    with visibility_context as materialized (
      select * from private.current_material_visibility_context()
    ),
    visible_materials as materialized (
      select material.id, material.model_id
      from public.materials material
      cross join visibility_context visibility
      where material.is_active
        and (
          visibility.can_view_all
          or coalesce(
            material.owner_party_id,
            nullif(material.owner_snapshot ->> 'scopePartyId', '')::uuid
          ) = any(visibility.visible_party_ids)
          or (
            material.status = 'loaned'
            and coalesce(
              material.borrower_party_id,
              nullif(material.borrower_snapshot ->> 'scopePartyId', '')::uuid
            ) = any(visibility.visible_party_ids)
          )
        )
        and (
          p_owner_party_id is null
          or material.owner_party_id = p_owner_party_id
          or material.owner_snapshot ->> 'departmentId' = p_owner_party_id::text
          or material.owner_snapshot ->> 'teamId' = p_owner_party_id::text
          or material.owner_snapshot ->> 'employeeId' = p_owner_party_id::text
        )
    ),
    model_ids as materialized (
      select distinct visible_materials.model_id
      from visible_materials
    ),
    model_configurations as materialized (
      select
        model_ids.model_id,
        public.material_model_snapshot(model_ids.model_id) as snapshot
      from model_ids
    )
    select
      visible_materials.id,
      visible_materials.model_id,
      model_configurations.snapshot
    from visible_materials
    join model_configurations
      on model_configurations.model_id is not distinct from visible_materials.model_id;
end;
$function$;

revoke all on function private.current_visible_active_material_model_snapshots(uuid)
  from public, anon, authenticated, service_role;

-- Replace row-by-row model snapshots and visibility checks in the inspection
-- queue and plan with the shared set-based read model above.
do $migration$
declare
  v_definition text;
  v_original text;
  v_replacement text;
begin
  v_definition := pg_catalog.pg_get_functiondef(
    'private.get_material_safety_inspection_plan(jsonb)'::pg_catalog.regprocedure
  );
  v_original := $sql$from public.materials material
    cross join lateral (
      select public.material_model_snapshot(material.model_id) as snapshot
    ) model_snapshot
    where material.is_active
      and public.can_view_material_current(material.id)
      and (
        v_owner_party_id is null
        or material.owner_party_id = v_owner_party_id
        or material.owner_snapshot ->> 'departmentId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'teamId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'employeeId' = v_owner_party_id::text
      )$sql$;
  v_replacement := $sql$from private.current_visible_active_material_model_snapshots(v_owner_party_id) model_snapshot
    join public.materials material on material.id = model_snapshot.material_id$sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection plan source did not match the expected material read model';
  end if;
  execute pg_catalog.replace(v_definition, v_original, v_replacement);

  v_definition := pg_catalog.pg_get_functiondef(
    'private.list_materials_requiring_safety_inspection(jsonb)'::pg_catalog.regprocedure
  );
  v_original := $sql$from public.materials material
    cross join lateral (
      select public.material_model_snapshot(material.model_id) as snapshot
    ) model_snapshot
    left join public.material_safety_checklists material_checklist
      on material_checklist.material_id = material.id
    where material.is_active
      and public.can_view_material_current(material.id)
      and (
        v_owner_party_id is null
        or material.owner_party_id = v_owner_party_id
        or material.owner_snapshot ->> 'departmentId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'teamId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'employeeId' = v_owner_party_id::text
      )$sql$;
  v_replacement := $sql$from private.current_visible_active_material_model_snapshots(v_owner_party_id) model_snapshot
    join public.materials material on material.id = model_snapshot.material_id
    left join public.material_safety_checklists material_checklist
      on material_checklist.material_id = material.id$sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Safety inspection queue source did not match the expected material read model';
  end if;
  execute pg_catalog.replace(v_definition, v_original, v_replacement);
end;
$migration$;

-- Convert the dashboard summary's row-by-row material permission checks to the
-- same request-scoped visibility context used by the material list endpoints.
do $migration$
declare
  v_definition text;
  v_original text;
  v_replacement text;
begin
  v_definition := pg_catalog.pg_get_functiondef(
    'public.get_material_dashboard_summary(date)'::pg_catalog.regprocedure
  );

  v_original := 'with month_series as (';
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Dashboard summary month-series CTE was not found';
  end if;
  v_definition := pg_catalog.replace(
    v_definition,
    v_original,
    'with visibility_context as materialized (' ||
      'select * from private.current_material_visibility_context()' ||
      '), month_series as ('
  );

  v_original := $sql$from public.materials material
    where material.is_active
      and public.can_view_material_current(material.id)$sql$;
  v_replacement := $sql$from public.materials material
    cross join visibility_context visibility
    where material.is_active
      and (
        visibility.can_view_all
        or coalesce(
          material.owner_party_id,
          nullif(material.owner_snapshot ->> 'scopePartyId', '')::uuid
        ) = any(visibility.visible_party_ids)
        or (
          material.status = 'loaned'
          and coalesce(
            material.borrower_party_id,
            nullif(material.borrower_snapshot ->> 'scopePartyId', '')::uuid
          ) = any(visibility.visible_party_ids)
        )
      )$sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Dashboard summary visibility predicate was not found';
  end if;
  execute pg_catalog.replace(v_definition, v_original, v_replacement);
end;
$migration$;

-- Inspection lists and their summary use the same visibility set without
-- changing their filters, totals, ordering, or page boundaries.
do $migration$
declare
  v_definition text;
  v_original text;
  v_replacement text;
begin
  v_definition := pg_catalog.pg_get_functiondef(
    'private.list_material_safety_inspections(jsonb)'::pg_catalog.regprocedure
  );
  v_original := 'with filtered as (';
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection list filtered CTE was not found';
  end if;
  v_definition := pg_catalog.replace(
    v_definition,
    v_original,
    'with visibility_context as materialized (' ||
      'select * from private.current_material_visibility_context()' ||
      '), filtered as ('
  );

  v_original := $sql$from public.material_safety_inspections inspection
    join public.materials material on material.id = inspection.material_id
    where public.can_view_material_current(material.id)$sql$;
  v_replacement := $sql$from public.material_safety_inspections inspection
    join public.materials material on material.id = inspection.material_id
    cross join visibility_context visibility
    where (
      visibility.can_view_all
      or coalesce(
        material.owner_party_id,
        nullif(material.owner_snapshot ->> 'scopePartyId', '')::uuid
      ) = any(visibility.visible_party_ids)
      or (
        material.status = 'loaned'
        and coalesce(
          material.borrower_party_id,
          nullif(material.borrower_snapshot ->> 'scopePartyId', '')::uuid
        ) = any(visibility.visible_party_ids)
      )
    )$sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection list visibility predicate was not found';
  end if;
  execute pg_catalog.replace(v_definition, v_original, v_replacement);

  v_definition := pg_catalog.pg_get_functiondef(
    'public.get_safety_inspection_filter_summary(text)'::pg_catalog.regprocedure
  );
  v_original := $sql$return (
    select jsonb_build_object($sql$;
  v_replacement := $sql$return (
    with visibility_context as materialized (
      select * from private.current_material_visibility_context()
    )
    select jsonb_build_object($sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection filter summary query was not found';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_original, v_replacement);

  v_original := $sql$from public.material_safety_inspections inspection
    join public.materials material on material.id = inspection.material_id
    where public.can_view_material_current(material.id)$sql$;
  v_replacement := $sql$from public.material_safety_inspections inspection
    join public.materials material on material.id = inspection.material_id
    cross join visibility_context visibility
    where (
      visibility.can_view_all
      or coalesce(
        material.owner_party_id,
        nullif(material.owner_snapshot ->> 'scopePartyId', '')::uuid
      ) = any(visibility.visible_party_ids)
      or (
        material.status = 'loaned'
        and coalesce(
          material.borrower_party_id,
          nullif(material.borrower_snapshot ->> 'scopePartyId', '')::uuid
        ) = any(visibility.visible_party_ids)
      )
    )$sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection filter summary visibility predicate was not found';
  end if;
  execute pg_catalog.replace(v_definition, v_original, v_replacement);
end;
$migration$;

-- Materialize the party permission flags once and reuse them in both the
-- visibility filter and returned JSON, preserving the existing permission set.
create or replace function public.list_custodians(p_include_inactive boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not (
    public.has_permission('materials:custodian:view')
    or public.has_permission('materials:custodian:manage')
    or public.has_permission('materials:material:view')
    or public.has_permission('materials:material:manage')
    or public.has_permission('materials:handover:view')
    or public.has_permission('materials:handover:manage')
    or public.has_permission('materials:warehouse:view')
    or public.has_permission('materials:warehouse:manage')
    or public.has_permission('materials:receipt:view')
    or public.has_permission('materials:receipt:manage')
  ) then
    raise exception 'Permission denied to view custodians' using errcode = '42501';
  end if;

  return coalesce((
    with global_permissions as materialized (
      select private.has_all_eps_custodian_manage() as can_manage_all_eps
    ),
    permission_flags as materialized (
      select
        party.id,
        public.has_scoped_permission('materials:custodian:view', party.id) as can_view_custodian,
        public.has_scoped_permission('materials:custodian:manage', party.id) as can_manage_custodian,
        public.has_scoped_permission('materials:material:view', party.id) as can_view_material,
        public.has_scoped_permission('materials:material:manage', party.id) as can_manage_material,
        public.has_scoped_permission('materials:handover:view', party.id) as can_view_handover,
        public.has_scoped_permission('materials:handover:manage', party.id) as can_manage_handover,
        public.has_scoped_permission('materials:warehouse:view', party.id) as can_view_warehouse,
        public.has_scoped_permission('materials:warehouse:manage', party.id) as can_manage_warehouse,
        public.has_scoped_permission('materials:receipt:view', party.id) as can_view_receipt,
        public.has_scoped_permission('materials:receipt:manage', party.id) as can_manage_receipt
      from public.material_custodians party
      where (p_include_inactive or party.is_active)
        and not party.is_handover_custom
    )
    select jsonb_agg(jsonb_build_object(
      'id', party.id,
      'type', party.type,
      'code', party.code,
      'name', party.name,
      'parentId', party.parent_id,
      'sourceType', party.source_type,
      'sourceId', party.source_id,
      'canRepresent', public.material_can_represent_account_base(party.id)
        or permission_flags.can_manage_handover
        or permission_flags.can_manage_material
        or permission_flags.can_manage_receipt,
      'canManageMaterial', permission_flags.can_manage_material,
      'canManageHandover', permission_flags.can_manage_handover,
      'accountUserId', case when permission_flags.can_manage_custodian
        then party.account_user_id else null end,
      'accountUserIds', case
        when permission_flags.can_manage_custodian or global_permissions.can_manage_all_eps
        then case when party.type = 'warehouse' then coalesce((
          select jsonb_agg(assignment.user_id order by assignment.user_id)
          from public.material_warehouse_accounts assignment
          where assignment.warehouse_id = party.id
        ), '[]'::jsonb)
        when party.account_user_id is null then '[]'::jsonb
        else jsonb_build_array(party.account_user_id) end
        when party.type = 'warehouse' and exists (
          select 1 from public.material_warehouse_accounts assignment
          where assignment.warehouse_id = party.id
            and assignment.user_id = (select auth.uid())
        ) then jsonb_build_array((select auth.uid()))
        else '[]'::jsonb end,
      'representativeUserId', case
        when permission_flags.can_manage_custodian or global_permissions.can_manage_all_eps
          then party.representative_user_id else null end,
      'representativeDisplayName', case
        when permission_flags.can_manage_custodian or global_permissions.can_manage_all_eps
          then coalesce(
            nullif(btrim(profile.display_name), ''),
            nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
            nullif(btrim(profile.username), '')
          ) else null end,
      'representativeName', coalesce(
        nullif(btrim(party.representative_name), ''),
        nullif(btrim(profile.display_name), ''),
        nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), '')
      ),
      'phone', party.phone,
      'email', party.email,
      'isHandoverCustom', false,
      'handoverScopePartyId', null,
      'isActive', party.is_active,
      'createdAt', party.created_at,
      'updatedAt', party.updated_at
    ) order by case when party.is_active then 0 else 1 end,
      lower(party.name) collate "vi-x-icu", party.id)
    from public.material_custodians party
    join permission_flags on permission_flags.id = party.id
    cross join global_permissions
    left join public.user_profiles profile on profile.id = party.representative_user_id
    where permission_flags.can_view_custodian
      or permission_flags.can_manage_custodian
      or permission_flags.can_view_material
      or permission_flags.can_manage_material
      or permission_flags.can_view_handover
      or permission_flags.can_manage_handover
      or permission_flags.can_view_warehouse
      or permission_flags.can_manage_warehouse
      or permission_flags.can_view_receipt
      or permission_flags.can_manage_receipt
      or (party.source_type is null
        and party.type in ('department', 'team', 'person')
        and global_permissions.can_manage_all_eps)
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.list_custodians(boolean) from public, anon;
grant execute on function public.list_custodians(boolean) to authenticated;

revoke all on function private.current_visible_active_material_model_snapshots(uuid)
  from public, anon, authenticated, service_role;

-- The dashboard RPC is SECURITY INVOKER, so it needs to call this guarded
-- private helper while retaining the caller's RLS context for other tables.
grant execute on function private.current_material_visibility_context()
  to authenticated;
