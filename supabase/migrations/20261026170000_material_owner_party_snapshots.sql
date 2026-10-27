-- Store a durable, editable party snapshot beside each material owner while
-- retaining material_custodians IDs for authorization and catalog reporting.
alter table public.materials
  add column owner_snapshot jsonb not null default '{}'::jsonb
  check (jsonb_typeof(owner_snapshot) = 'object');

create or replace function public.material_party_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with party_levels as (
    select party.*,
      parent.id as parent_party_id,
      parent.type as parent_type,
      parent.source_id as parent_source_id,
      parent.code as parent_code,
      parent.name as parent_name,
      parent.parent_id as parent_parent_id,
      parent_parent.source_id as parent_parent_source_id,
      parent_parent.id as parent_parent_party_id,
      parent_parent.code as parent_parent_code,
      parent_parent.name as parent_parent_name
    from public.material_custodians party
    left join public.material_custodians parent on parent.id = party.parent_id
    left join public.material_custodians parent_parent on parent_parent.id = parent.parent_id
    where party.id = p_id
  )
  select jsonb_build_object(
    'id', party.id,
    'type', party.type,
    'code', party.code,
    'name', party.name,
    'parentId', party.parent_id,
    'sourceType', party.source_type,
    'sourceId', party.source_id,
    'catalogPartyId', case when party.is_handover_custom then null else party.id end,
    'departmentId', case
      when party.type = 'department' then party.id
      when party.type = 'team' then party.parent_party_id
      when party.type = 'person' and party.parent_type = 'team' then party.parent_parent_party_id
      when party.type = 'person' then party.parent_party_id
      else null end,
    'departmentSourceId', case
      when party.type = 'department' then party.source_id
      when party.type = 'team' then party.parent_source_id
      when party.type = 'person' and party.parent_type = 'team' then party.parent_parent_source_id
      when party.type = 'person' then party.parent_source_id
      else null end,
    'departmentCode', case
      when party.type = 'department' then party.code
      when party.type = 'team' then party.parent_code
      when party.type = 'person' and party.parent_type = 'team' then party.parent_parent_code
      when party.type = 'person' then party.parent_code
      else null end,
    'departmentName', case
      when party.type = 'department' then party.name
      when party.type = 'team' then party.parent_name
      when party.type = 'person' and party.parent_type = 'team' then party.parent_parent_name
      when party.type = 'person' then party.parent_name
      else null end,
    'teamId', case when party.type = 'team' then party.id
      when party.type = 'person' and party.parent_type = 'team' then party.parent_party_id
      else null end,
    'teamSourceId', case when party.type = 'team' then party.source_id
      when party.type = 'person' and party.parent_type = 'team' then party.parent_source_id
      else null end,
    'teamCode', case when party.type = 'team' then party.code
      when party.type = 'person' and party.parent_type = 'team' then party.parent_code
      else null end,
    'teamName', case when party.type = 'team' then party.name
      when party.type = 'person' and party.parent_type = 'team' then party.parent_name
      else null end,
    'employeeId', case when party.type = 'person' then party.id else null end,
    'employeeSourceId', case when party.type = 'person' then party.source_id else null end,
    'employeeCode', case when party.type = 'person' then party.code else null end,
    'employeeName', case when party.type = 'person' then party.name else null end,
    'externalOrganizationId', case when party.type = 'external' then party.id else null end,
    'warehouseId', case when party.type = 'warehouse' then party.id else null end,
    'accountUserId', party.account_user_id,
    'accountUserIds', case when party.type = 'warehouse' then coalesce((
      select jsonb_agg(assignment.user_id order by assignment.user_id)
      from public.material_warehouse_accounts assignment
      where assignment.warehouse_id = party.id
    ), '[]'::jsonb) else case when party.account_user_id is null
      then '[]'::jsonb else jsonb_build_array(party.account_user_id) end end,
    'representativeUserId', party.representative_user_id,
    'isActive', party.is_active,
    'phone', party.phone,
    'email', party.email,
    'representativeName', coalesce(
      nullif(btrim(party.representative_name), ''),
      nullif(btrim(profile.display_name), ''),
      nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), '')
    ),
    'isHandoverCustom', party.is_handover_custom,
    'handoverScopePartyId', party.handover_scope_party_id
  )
  from party_levels party
  left join public.user_profiles profile
    on profile.id = party.representative_user_id
  where party.id = p_id
$$;
revoke all on function public.material_party_json(uuid)
  from public, anon, authenticated;

create or replace function public.material_owner_snapshot_from_party(
  p_party_id uuid,
  p_values jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_party public.material_custodians%rowtype;
  v_parent public.material_custodians%rowtype;
  v_department public.material_custodians%rowtype;
  v_team public.material_custodians%rowtype;
  v_employee public.material_custodians%rowtype;
  v_kind text;
begin
  select * into v_party from public.material_custodians where id = p_party_id;
  if not found then raise exception 'Owner party not found' using errcode = 'P0002'; end if;
  if p_values ? 'name' and nullif(btrim(p_values->>'name'), '') is null then
    raise exception 'Owner name is required' using errcode = '22023';
  end if;
  v_kind := case v_party.type
    when 'external' then 'external'
    when 'warehouse' then 'warehouse'
    when 'other' then 'other'
    else 'eps' end;
  if nullif(p_values->>'kind', '') is not null
    and p_values->>'kind' is distinct from v_kind then
    raise exception 'Owner kind does not match the selected catalog party' using errcode = '22023';
  end if;

  if v_party.type = 'department' then
    v_department := v_party;
  elsif v_party.type = 'team' then
    v_team := v_party;
    select * into v_department from public.material_custodians where id = v_party.parent_id;
  elsif v_party.type = 'person' then
    v_employee := v_party;
    select * into v_parent from public.material_custodians where id = v_party.parent_id;
    if v_parent.type = 'team' then
      v_team := v_parent;
      select * into v_department from public.material_custodians where id = v_parent.parent_id;
    elsif v_parent.type = 'department' then
      v_department := v_parent;
    end if;
  end if;

  return jsonb_build_object(
    'kind', v_kind,
    'type', v_party.type,
    'partyId', v_party.id,
    'catalogPartyId', case when v_party.is_handover_custom then null else v_party.id end,
    'sourceType', v_party.source_type,
    'sourceId', v_party.source_id,
    'departmentId', nullif(v_department.id::text, ''),
    'departmentSourceId', v_department.source_id,
    'departmentCode', v_department.code,
    'departmentName', v_department.name,
    'teamId', nullif(v_team.id::text, ''),
    'teamSourceId', v_team.source_id,
    'teamCode', v_team.code,
    'teamName', v_team.name,
    'employeeId', nullif(v_employee.id::text, ''),
    'employeeSourceId', v_employee.source_id,
    'employeeCode', v_employee.code,
    'employeeName', v_employee.name,
    'externalOrganizationId', case when v_party.type = 'external' then v_party.id end,
    'warehouseId', case when v_party.type = 'warehouse' then v_party.id end,
    'scopePartyId', v_party.handover_scope_party_id,
    'code', case when p_values ? 'code' then coalesce(p_values->>'code', '') else v_party.code end,
    'name', case when p_values ? 'name' then coalesce(p_values->>'name', '') else v_party.name end,
    'representativeName', coalesce(case when p_values ? 'representativeName'
      then coalesce(p_values->>'representativeName', '') end,
      nullif(btrim(v_party.representative_name), ''),
      nullif(btrim(concat_ws(' ', (select profile.first_name from public.user_profiles profile where profile.id = v_party.representative_user_id),
        (select profile.last_name from public.user_profiles profile where profile.id = v_party.representative_user_id))), ''), ''
    ),
    'phone', case when p_values ? 'phone' then coalesce(p_values->>'phone', '') else coalesce(v_party.phone, '') end,
    'email', case when p_values ? 'email' then coalesce(p_values->>'email', '') else coalesce(v_party.email, '') end,
    'capturedAt', timezone('utc', now())
  );
end;
$$;
revoke all on function public.material_owner_snapshot_from_party(uuid, jsonb)
  from public, anon, authenticated;

-- Backfill legacy material rows before the API begins returning the new shape.
-- The migration runs as the database owner without an auth.uid(); bypass only
-- the user-scope trigger for this deterministic snapshot-only backfill.
alter table public.materials disable trigger materials_scope_guard;
update public.materials material
set owner_snapshot = public.material_owner_snapshot_from_party(material.owner_party_id, '{}'::jsonb)
where material.owner_snapshot = '{}'::jsonb;
alter table public.materials enable trigger materials_scope_guard;

do $$
begin
  if exists (select 1 from public.materials where owner_snapshot = '{}'::jsonb) then
    raise exception 'Material owner snapshot backfill did not cover every legacy row';
  end if;
end;
$$;

create or replace function public.material_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', material.id,
    'code', material.code,
    'modelId', material.model_id,
    'modelSnapshot', material.model_snapshot,
    'nameOverride', material.name_override,
    'descriptionOverride', material.description_override,
    'images', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', image.id, 'storageBucket', image.storage_bucket,
        'storagePath', image.storage_path, 'externalUrl', image.external_url,
        'sortOrder', image.sort_order, 'isCover', image.is_cover
      ) order by image.sort_order, image.id)
      from public.material_images image where image.material_id = material.id
    ), '[]'::jsonb),
    'specificationOverrides', material.specification_overrides,
    'specificationOverrideLabels', material.specification_override_labels,
    'serialNumber', material.serial_number,
    'ownerPartyId', material.owner_party_id,
    'ownerSnapshot', material.owner_snapshot,
    'borrowerPartyId', material.borrower_party_id,
    'condition', material.condition,
    'note', material.note,
    'status', material.status,
    'isActive', material.is_active,
    'activeLoanHandoverId', material.active_loan_handover_id,
    'reservedHandoverId', material.reserved_handover_id,
    'reservationStatus', material.reservation_status,
    'version', material.version,
    'createdAt', material.created_at,
    'updatedAt', material.updated_at
  )
  from public.materials material where material.id = p_id
$$;
revoke all on function public.material_json(uuid) from public, anon, authenticated;

-- Resolve custom Other parties through their permission scope so material RLS,
-- handover actions, and storage access use the managing account's real scope.
create or replace function private.party_in_permission_scope(
  target_party_id uuid,
  target_scope text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  party public.material_custodians%rowtype;
  current_department text;
  current_team text;
  external_organization uuid;
begin
  if auth.uid() is null or target_party_id is null then return false; end if;
  select * into party from public.material_custodians where id = target_party_id;
  if not found then return false; end if;
  if party.is_handover_custom and party.handover_scope_party_id is not null then
    return private.party_in_permission_scope(party.handover_scope_party_id, target_scope);
  end if;
  select profile.external_organization_id into external_organization
  from public.user_profiles profile
  where profile.id = auth.uid() and profile.account_type = 'external'
    and profile.status = 'active';

  if target_scope = 'assigned_warehouses' then
    return party.type = 'warehouse' and exists (
      select 1 from public.material_warehouses warehouse
      join public.material_custodians warehouse_party
        on warehouse_party.id = warehouse.custodian_id and warehouse_party.is_active
      join public.material_warehouse_accounts assignment
        on assignment.warehouse_id = warehouse.custodian_id
      where warehouse.custodian_id = party.id and assignment.user_id = auth.uid()
    );
  end if;

  if target_scope = 'department' and external_organization is not null then
    return party.type = 'external' and party.id = external_organization;
  end if;

  select current_employee.department_id, current_employee.team_id
  into current_department, current_team
  from private.current_account_eps_employee() current_employee;
  if current_department is null then return false; end if;

  if target_scope = 'all' then
    return party.source_type in ('eps_department', 'eps_team', 'eps_person');
  elsif target_scope = 'team' then
    if current_team is null then return false; end if;
    if party.source_type = 'eps_team' then return party.source_id = current_team; end if;
    if party.source_type = 'eps_person' then
      return exists (
        select 1 from private.fake_eps_employees employee
        where employee.id = party.source_id and employee.team_id = current_team
          and employee.employment_status = 'active'
      );
    end if;
    return false;
  elsif target_scope = 'department' then
    if party.source_type = 'eps_department' then return party.source_id = current_department; end if;
    if party.source_type = 'eps_team' then
      return exists (
        select 1 from private.fake_eps_teams team
        where team.id = party.source_id and team.department_id = current_department
          and team.is_active
      );
    end if;
    if party.source_type = 'eps_person' then
      return exists (
        select 1 from private.fake_eps_employees employee
        where employee.id = party.source_id and employee.department_id = current_department
          and employee.employment_status = 'active'
      );
    end if;
  end if;
  return false;
end;
$$;
revoke all on function private.party_in_permission_scope(uuid, text)
  from public, anon, authenticated;

-- A manager with the matching party scope can act on behalf of a catalog
-- employee even when that employee has no QRCode account.
alter function public.material_can_represent(uuid)
  rename to material_can_represent_account_base;
revoke all on function public.material_can_represent_account_base(uuid)
  from public, anon, authenticated;

create function public.material_can_represent(p_party_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.material_can_represent_account_base(p_party_id)
    or public.has_scoped_permission('materials:handover:manage', p_party_id)
    or public.has_scoped_permission('materials:material:manage', p_party_id)
    or public.has_scoped_permission('materials:receipt:manage', p_party_id)
$$;
revoke all on function public.material_can_represent(uuid)
  from public, anon, authenticated;

-- Include parties a material/handover manager may act for even when they are
-- not personally assigned as a representative.
create or replace function public.list_custodians(p_include_inactive boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
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
    select jsonb_agg(jsonb_build_object(
      'id', party.id,
      'type', party.type,
      'code', party.code,
      'name', party.name,
      'parentId', party.parent_id,
      'sourceType', party.source_type,
      'sourceId', party.source_id,
      'canRepresent', public.material_can_represent(party.id),
      'canManageMaterial', public.has_scoped_permission('materials:material:manage', party.id),
      'canManageHandover', public.has_scoped_permission('materials:handover:manage', party.id),
      'accountUserId', case when public.has_scoped_permission('materials:custodian:manage', party.id)
        then party.account_user_id else null end,
      'accountUserIds', case
        when public.has_scoped_permission('materials:custodian:manage', party.id)
          or private.has_all_eps_custodian_manage()
        then case when party.type = 'warehouse' then coalesce((
          select jsonb_agg(assignment.user_id order by assignment.user_id)
          from public.material_warehouse_accounts assignment where assignment.warehouse_id = party.id
        ), '[]'::jsonb)
        when party.account_user_id is null then '[]'::jsonb
        else jsonb_build_array(party.account_user_id) end
        when party.type = 'warehouse' and exists (
          select 1 from public.material_warehouse_accounts assignment
          where assignment.warehouse_id = party.id and assignment.user_id = auth.uid()
        ) then jsonb_build_array(auth.uid())
        else '[]'::jsonb end,
      'representativeUserId', case when public.has_scoped_permission('materials:custodian:manage', party.id)
        or private.has_all_eps_custodian_manage() then party.representative_user_id else null end,
      'representativeDisplayName', case when public.has_scoped_permission('materials:custodian:manage', party.id)
        or private.has_all_eps_custodian_manage() then coalesce(
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
    left join public.user_profiles profile on profile.id = party.representative_user_id
    where (p_include_inactive or party.is_active)
      and not party.is_handover_custom
      and (
        public.has_scoped_permission('materials:custodian:view', party.id)
        or public.has_scoped_permission('materials:custodian:manage', party.id)
        or public.has_scoped_permission('materials:material:view', party.id)
        or public.has_scoped_permission('materials:material:manage', party.id)
        or public.has_scoped_permission('materials:handover:view', party.id)
        or public.has_scoped_permission('materials:handover:manage', party.id)
        or public.has_scoped_permission('materials:warehouse:view', party.id)
        or public.has_scoped_permission('materials:warehouse:manage', party.id)
        or public.has_scoped_permission('materials:receipt:view', party.id)
        or public.has_scoped_permission('materials:receipt:manage', party.id)
        or (party.source_type is null and party.type in ('department', 'team', 'person')
          and private.has_all_eps_custodian_manage())
      )
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.list_custodians(boolean) from public, anon;
grant execute on function public.list_custodians(boolean) to authenticated;

-- A selected employee is searched and paged against the EPS employee catalog;
-- the endpoint returns custodian IDs for workflow relations and source IDs for reporting.
create or replace function public.list_material_party_employees(
  p_search text default '',
  p_department_id uuid default null,
  p_team_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := least(greatest(coalesce(p_page_size, 30), 1), 100);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if auth.uid() is null or not (
    public.has_permission('materials:material:manage')
    or public.has_permission('materials:handover:manage')
    or public.has_permission('materials:receipt:manage')
  ) then
    raise exception 'Permission denied to search EPS employees for material ownership' using errcode = '42501';
  end if;
  return (
    with scoped as (
      select employee.id, employee.source_id, employee.code, employee.name,
        department.id as department_id, department.name as department_name,
        team.id as team_id, team.name as team_name
      from public.material_custodians employee
      join private.fake_eps_employees source_employee
        on source_employee.id::text = employee.source_id
      left join public.material_custodians team
        on team.type = 'team' and team.source_type = 'eps_team'
        and team.source_id = source_employee.team_id and team.is_active
      left join public.material_custodians department
        on department.type = 'department' and department.source_type = 'eps_department'
        and department.source_id = source_employee.department_id and department.is_active
      where employee.type = 'person'
        and employee.source_type = 'eps_person'
        and employee.is_active
        and source_employee.employment_status = 'active'
        and department.id is not null
        and (p_department_id is null or department.id = p_department_id)
        and (p_team_id is null or team.id = p_team_id)
        and (v_search is null or concat_ws(' ', employee.name, employee.code) ilike '%' || v_search || '%')
        and (
          public.has_scoped_permission('materials:material:manage', employee.id)
          or public.has_scoped_permission('materials:handover:manage', employee.id)
          or public.has_scoped_permission('materials:receipt:manage', employee.id)
          or private.has_all_eps_custodian_manage()
        )
    )
    select jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', page.id,
          'sourceId', page.source_id,
          'code', page.code,
          'name', page.name,
          'departmentId', page.department_id,
          'departmentName', page.department_name,
          'teamId', page.team_id,
          'teamName', page.team_name
        ) order by lower(page.name) collate "vi-x-icu", page.id)
        from (select * from scoped
          order by lower(name) collate "vi-x-icu", id
          offset (v_page - 1) * v_size limit v_size) page
      ), '[]'::jsonb),
      'total', (select count(*) from scoped),
      'page', v_page,
      'pageSize', v_size
    )
  );
end;
$$;
revoke all on function public.list_material_party_employees(text, uuid, uuid, integer, integer)
  from public, anon;
grant execute on function public.list_material_party_employees(text, uuid, uuid, integer, integer)
  to authenticated;

-- The internal FK remains the selected party ID; the snapshot retains all EPS
-- levels, allowing unit/team reports to include employee-owned materials.
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
        and (v_owner_catalog is null
          or material.owner_snapshot->>'sourceId' = v_owner_catalog
          or material.owner_snapshot->>'departmentSourceId' = v_owner_catalog
          or material.owner_snapshot->>'teamSourceId' = v_owner_catalog
          or material.owner_snapshot->>'employeeSourceId' = v_owner_catalog
          or material.owner_snapshot->>'externalOrganizationId' = v_owner_catalog
          or material.owner_snapshot->>'warehouseId' = v_owner_catalog)
        and (nullif(p_filters->>'borrowerPartyId', '') is null or material.borrower_party_id = (p_filters->>'borrowerPartyId')::uuid)
        and (nullif(p_filters->>'status', '') is null or material.status = p_filters->>'status')
        and (nullif(p_filters->>'condition', '') is null or material.condition = p_filters->>'condition')
        and (nullif(p_filters->>'search', '') is null or concat_ws(' ', material.code, material.serial_number,
          material.name_override, material.model_snapshot->>'name') ilike '%' || btrim(p_filters->>'search') || '%')
        and (nullif(p_filters->>'updatedFrom', '') is null or material.updated_at >= (p_filters->>'updatedFrom')::timestamptz)
        and (nullif(p_filters->>'updatedTo', '') is null or material.updated_at < (p_filters->>'updatedTo')::timestamptz + interval '1 day')
        and (nullif(p_filters->>'isActive', '') is null or material.is_active = (p_filters->>'isActive')::boolean)
        and (nullif(p_filters->>'receiptId', '') is null or exists (
          select 1 from public.material_receipt_items item
          join public.material_receipts receipt on receipt.id = item.receipt_id
          where item.receipt_id = (p_filters->>'receiptId')::uuid and item.material_id = material.id
            and item.status = 'active' and receipt.status = 'handover'
            and receipt.warehouse_id = material.owner_party_id and public.can_view_receipt(receipt.id)
        ))
    )
    select jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(public.material_json(page.id) order by
          case page.status when 'available' then 0 when 'loaned' then 1 else 2 end,
          lower(coalesce(nullif(btrim(page.name_override), ''), page.model_snapshot->>'name', '')) collate "vi-x-icu", page.id)
        from (select * from filtered order by
          case status when 'available' then 0 when 'loaned' then 1 else 2 end,
          lower(coalesce(nullif(btrim(name_override), ''), model_snapshot->>'name', '')) collate "vi-x-icu", id
          offset (v_page - 1) * v_size limit v_size) page
      ), '[]'::jsonb),
      'total', (select count(*) from filtered), 'page', v_page, 'pageSize', v_size
    )
  );
end;
$$;
revoke all on function public.list_materials(jsonb) from public, anon;
grant execute on function public.list_materials(jsonb) to authenticated;

-- Keep the previous complete save workflow and place owner snapshots around it.
alter function public.save_material(uuid, integer, jsonb)
  rename to save_material_owner_snapshot_base;
revoke all on function public.save_material_owner_snapshot_base(uuid, integer, jsonb)
  from public, anon, authenticated;

create function public.save_material(
  p_id uuid,
  p_expected_version integer,
  p_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_values jsonb := p_values;
  v_owner uuid := nullif(p_values->>'ownerPartyId', '')::uuid;
  v_kind text := coalesce(p_values->'ownerSnapshot'->>'kind', 'eps');
  v_scope uuid := nullif(p_values->'ownerSnapshot'->>'scopePartyId', '')::uuid;
  v_id uuid;
  v_owner_snapshot jsonb;
begin
  if p_id is null and v_kind = 'other' and v_owner is null then
    if nullif(btrim(p_values->'ownerSnapshot'->>'name'), '') is null then
      raise exception 'An Other owner name is required' using errcode = '22023';
    end if;
    if v_scope is not null and not exists (
      select 1 from public.material_custodians party
      where party.id = v_scope and party.is_active
        and party.type in ('department', 'team', 'person')
        and public.has_scoped_permission('materials:material:manage', party.id)
    ) then
      raise exception 'Selected owner scope is not available for material management' using errcode = '42501';
    end if;
    if v_scope is null then
      select party.id into v_scope
      from public.material_custodians party
      where party.is_active and party.type in ('department', 'team', 'person')
        and public.has_scoped_permission('materials:material:manage', party.id)
      order by case party.type when 'department' then 0 when 'team' then 1 else 2 end,
        lower(party.name) collate "vi-x-icu", party.id
      limit 1;
    end if;
    if v_scope is null then
      raise exception 'No owner scope is available for a new Other party' using errcode = '42501';
    end if;
    v_owner := gen_random_uuid();
    insert into public.material_custodians(
      id, type, code, name, is_active, phone, email, representative_name,
      is_handover_custom, handover_scope_party_id
    ) values (
      v_owner, 'other',
      coalesce(nullif(btrim(p_values->'ownerSnapshot'->>'code'), ''),
        'OTH-' || upper(substr(replace(v_owner::text, '-', ''), 1, 12))),
      btrim(p_values->'ownerSnapshot'->>'name'), true,
      nullif(btrim(p_values->'ownerSnapshot'->>'phone'), ''),
      nullif(btrim(p_values->'ownerSnapshot'->>'email'), ''),
      nullif(btrim(p_values->'ownerSnapshot'->>'representativeName'), ''),
      true, v_scope
    );
    v_values := p_values || jsonb_build_object('ownerPartyId', v_owner);
  elsif p_id is null and v_kind not in ('eps', 'external', 'warehouse', 'other') then
    raise exception 'Invalid owner kind' using errcode = '22023';
  end if;

  v_id := public.save_material_owner_snapshot_base(p_id, p_expected_version, v_values);
  if p_id is null then
    v_owner_snapshot := public.material_owner_snapshot_from_party(
      v_owner, coalesce(p_values->'ownerSnapshot', '{}'::jsonb)
    );
    update public.materials set owner_snapshot = v_owner_snapshot where id = v_id;
    update public.material_history history
    set to_state = public.material_json(v_id)
    where history.id = (
      select latest.id from public.material_history latest
      where latest.material_id = v_id and latest.action = 'created'
      order by latest.created_at desc, latest.id desc limit 1
    );
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_material(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_material(uuid, integer, jsonb) to authenticated;

-- Snapshot the recipient exactly as entered when a completed transfer changes
-- ownership. Receipt-created materials receive their catalog snapshot too.
create or replace function private.sync_material_owner_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb;
  v_key text;
begin
  if tg_op = 'INSERT' then
    if new.owner_snapshot = '{}'::jsonb then
      new.owner_snapshot := public.material_owner_snapshot_from_party(new.owner_party_id, '{}'::jsonb);
    end if;
  elsif new.owner_party_id is distinct from old.owner_party_id then
    select handover.recipient_party_snapshot into v_snapshot
    from public.material_handover_items item
    join public.material_handovers handover on handover.id = item.handover_id
    where item.material_id = new.id
      and handover.recipient_party_id = new.owner_party_id
      and handover.status = 'pending'
      and handover.type = 'transfer'
    order by handover.created_at desc, handover.id desc
    limit 1;
    new.owner_snapshot := public.material_owner_snapshot_from_party(
      new.owner_party_id, coalesce(v_snapshot, '{}'::jsonb)
    );
    if v_snapshot is not null then
      foreach v_key in array array[
        'type', 'catalogPartyId', 'sourceType', 'sourceId',
        'departmentId', 'departmentSourceId', 'departmentCode', 'departmentName',
        'teamId', 'teamSourceId', 'teamCode', 'teamName',
        'employeeId', 'employeeSourceId', 'employeeCode', 'employeeName',
        'externalOrganizationId', 'warehouseId'
      ] loop
        if v_snapshot ? v_key then
          new.owner_snapshot := jsonb_set(new.owner_snapshot, array[v_key], v_snapshot->v_key, true);
        end if;
      end loop;
      foreach v_key in array array['code', 'name'] loop
        if v_snapshot ? v_key then
          new.owner_snapshot := jsonb_set(new.owner_snapshot, array[v_key], to_jsonb(coalesce(v_snapshot->>v_key, '')), true);
        end if;
      end loop;
      foreach v_key in array array['representativeName', 'phone', 'email'] loop
        if v_snapshot ? v_key then
          new.owner_snapshot := jsonb_set(new.owner_snapshot, array[v_key], to_jsonb(coalesce(v_snapshot->>v_key, '')), true);
        end if;
      end loop;
      if v_snapshot ? 'handoverScopePartyId' then
        new.owner_snapshot := jsonb_set(new.owner_snapshot, '{scopePartyId}', v_snapshot->'handoverScopePartyId', true);
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_material_owner_snapshot() from public, anon, authenticated;
drop trigger if exists materials_sync_owner_snapshot on public.materials;
create trigger materials_sync_owner_snapshot
before insert or update of owner_party_id on public.materials
for each row execute function private.sync_material_owner_snapshot();

-- Add warehouse as a standard handover party and persist editable code fields.
alter function public.save_handover(uuid, jsonb)
  rename to save_handover_party_snapshot_base;
revoke all on function public.save_handover_party_snapshot_base(uuid, jsonb)
  from public, anon, authenticated;

create function public.save_handover(p_id uuid, p_values jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid := nullif(p_values->>'senderPartyId', '')::uuid;
  v_recipient uuid := nullif(p_values->>'recipientPartyId', '')::uuid;
  v_sender_kind text := coalesce(p_values->>'senderPartyKind', 'eps');
  v_recipient_kind text := coalesce(p_values->>'recipientPartyKind', 'eps');
  v_sender_party public.material_custodians%rowtype;
  v_recipient_party public.material_custodians%rowtype;
  v_scope uuid;
  v_values jsonb := p_values;
  v_id uuid;
  v_snapshot jsonb;
  v_reverse_id uuid := nullif(p_values->>'reverseFromHandoverId', '')::uuid;
  v_reverse public.material_handovers%rowtype;
  v_item_count integer;
  v_source_item_count integer;
begin
  if v_sender_kind not in ('eps', 'external', 'warehouse', 'other')
    or v_recipient_kind not in ('eps', 'external', 'warehouse', 'other') then
    raise exception 'Invalid handover party kind' using errcode = '22023';
  end if;

  if v_sender_kind <> 'warehouse' and v_recipient_kind <> 'warehouse' then
    v_id := public.save_handover_party_snapshot_base(p_id, p_values);
    update public.material_handovers handover set
      sender_party_snapshot = handover.sender_party_snapshot || jsonb_build_object(
        'code', case when p_values ? 'senderPartyCode'
          then coalesce(p_values->>'senderPartyCode', '') else handover.sender_party_snapshot->>'code' end),
      recipient_party_snapshot = handover.recipient_party_snapshot || jsonb_build_object(
        'code', case when p_values ? 'recipientPartyCode'
          then coalesce(p_values->>'recipientPartyCode', '') else handover.recipient_party_snapshot->>'code' end)
    where handover.id = v_id;
    return v_id;
  end if;

  if auth.uid() is null or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to manage handovers' using errcode = '42501';
  end if;
  if p_values->>'type' not in ('transfer', 'loan', 'return') then
    raise exception 'Invalid handover type' using errcode = '22023';
  end if;
  if nullif(btrim(p_values->>'senderPartyName'), '') is null
    or nullif(btrim(p_values->>'recipientPartyName'), '') is null then
    raise exception 'Both handover party names are required' using errcode = '22023';
  end if;
  if coalesce(p_values->>'senderPartyEmail', '') <> ''
    and p_values->>'senderPartyEmail' !~* '^\S+@\S+\.\S+$' then
    raise exception 'Sender email is invalid' using errcode = '22023';
  end if;
  if coalesce(p_values->>'recipientPartyEmail', '') <> ''
    and p_values->>'recipientPartyEmail' !~* '^\S+@\S+\.\S+$' then
    raise exception 'Recipient email is invalid' using errcode = '22023';
  end if;

  if v_sender_kind = 'other' then
    select * into v_sender_party from public.material_custodians
    where id = v_sender and is_handover_custom for update;
    if not found then raise exception 'The selected custom sender no longer exists' using errcode = 'P0002'; end if;
    if not public.has_scoped_permission('materials:handover:manage', v_sender)
      or not public.material_can_represent(v_sender) then
      raise exception 'You cannot manage or represent the selected custom sender' using errcode = '42501';
    end if;
    update public.material_custodians set
      name = btrim(p_values->>'senderPartyName'),
      phone = nullif(btrim(p_values->>'senderPartyPhone'), ''),
      email = nullif(btrim(p_values->>'senderPartyEmail'), ''),
      representative_name = nullif(btrim(p_values->>'senderRepresentativeName'), ''),
      updated_at = timezone('utc', now()) where id = v_sender;
  elsif v_sender is null or not exists (
    select 1 from public.material_custodians party
    where party.id = v_sender and party.is_active and not party.is_handover_custom
      and ((v_sender_kind = 'external' and party.type = 'external')
        or (v_sender_kind = 'warehouse' and party.type = 'warehouse')
        or (v_sender_kind = 'eps' and party.type in ('department', 'team', 'person')))
  ) then
    raise exception 'Select a valid sender from the selected catalog' using errcode = '22023';
  end if;

  if v_recipient_kind = 'other' then
    if v_recipient is null then
      select case when party.is_handover_custom then party.handover_scope_party_id else party.id end
      into v_scope from public.material_custodians party where party.id = v_sender and party.is_active;
      if v_scope is null then raise exception 'Could not determine the custom recipient scope' using errcode = '22023'; end if;
      v_recipient := gen_random_uuid();
      insert into public.material_custodians(
        id, type, code, name, is_active, phone, email, representative_name,
        is_handover_custom, handover_scope_party_id
      ) values (
        v_recipient, 'other',
        coalesce(nullif(btrim(p_values->>'recipientPartyCode'), ''), 'OTH-' || upper(substr(replace(v_recipient::text, '-', ''), 1, 12))),
        btrim(p_values->>'recipientPartyName'), true,
        nullif(btrim(p_values->>'recipientPartyPhone'), ''),
        nullif(btrim(p_values->>'recipientPartyEmail'), ''),
        nullif(btrim(p_values->>'recipientRepresentativeName'), ''), true, v_scope
      );
    else
      select * into v_recipient_party from public.material_custodians
      where id = v_recipient and is_handover_custom for update;
      if not found then raise exception 'The selected custom recipient no longer exists' using errcode = 'P0002'; end if;
      if not public.has_scoped_permission('materials:handover:manage', v_recipient) then
        raise exception 'You cannot select this custom recipient outside your handover scope' using errcode = '42501';
      end if;
      update public.material_custodians set
        name = btrim(p_values->>'recipientPartyName'),
        phone = nullif(btrim(p_values->>'recipientPartyPhone'), ''),
        email = nullif(btrim(p_values->>'recipientPartyEmail'), ''),
        representative_name = nullif(btrim(p_values->>'recipientRepresentativeName'), ''),
        updated_at = timezone('utc', now()) where id = v_recipient;
    end if;
  elsif v_recipient is null or not exists (
    select 1 from public.material_custodians party
    where party.id = v_recipient and party.is_active and not party.is_handover_custom
      and ((v_recipient_kind = 'external' and party.type = 'external')
        or (v_recipient_kind = 'warehouse' and party.type = 'warehouse')
        or (v_recipient_kind = 'eps' and party.type in ('department', 'team', 'person')))
  ) then
    raise exception 'Select a valid recipient from the selected catalog' using errcode = '22023';
  end if;

  if v_reverse_id is not null then
    select * into v_reverse from public.material_handovers
    where id = v_reverse_id for share;
    if not found or v_reverse.status <> 'completed'
      or v_reverse.mode <> 'standard' or v_reverse.type not in ('transfer', 'loan') then
      raise exception 'Only a completed transfer or loan can be reversed' using errcode = '55000';
    end if;
    if v_sender <> v_reverse.recipient_party_id
      or v_recipient <> v_reverse.sender_party_id
      or (p_values->>'type' is distinct from
        case when v_reverse.type = 'loan' then 'return' else 'transfer' end) then
      raise exception 'Reverse handover parties or type do not match the source' using errcode = '22023';
    end if;
    select count(*) into v_item_count from jsonb_array_elements(coalesce(p_values->'items', '[]'::jsonb));
    select count(*) into v_source_item_count from public.material_handover_items where handover_id = v_reverse_id;
    if v_item_count <> v_source_item_count or exists (
      select 1 from public.material_handover_items source_item
      where source_item.handover_id = v_reverse_id and not exists (
        select 1 from jsonb_array_elements(coalesce(p_values->'items', '[]'::jsonb)) selected
        where (selected.value->>'materialId')::uuid = source_item.material_id
      )
    ) then
      raise exception 'Reverse handover must include all source materials' using errcode = '22023';
    end if;
  end if;

  v_values := p_values || jsonb_build_object('senderPartyId', v_sender, 'recipientPartyId', v_recipient);
  v_id := public.save_handover_base(p_id, v_values);
  if v_reverse_id is not null then
    update public.material_handovers set reverses_handover_id = v_reverse_id where id = v_id;
  end if;

  select * into v_sender_party from public.material_custodians where id = v_sender;
  v_snapshot := public.material_party_json(v_sender) || jsonb_build_object(
    'id', v_sender,
    'code', case when p_values ? 'senderPartyCode' then coalesce(p_values->>'senderPartyCode', '') else v_sender_party.code end,
    'name', btrim(p_values->>'senderPartyName'),
    'type', v_sender_party.type,
    'phone', nullif(btrim(p_values->>'senderPartyPhone'), ''),
    'email', nullif(btrim(p_values->>'senderPartyEmail'), ''),
    'representativeName', nullif(btrim(p_values->>'senderRepresentativeName'), ''),
    'isHandoverCustom', v_sender_party.is_handover_custom,
    'handoverScopePartyId', v_sender_party.handover_scope_party_id
  );
  update public.material_handovers handover set
    sender_party_snapshot = v_snapshot,
    sender_representative_snapshot = case
      when nullif(btrim(p_values->>'senderRepresentativeName'), '') is null
        and handover.sender_representative_user_id is null then null
      else jsonb_build_object('userId', handover.sender_representative_user_id,
        'displayName', coalesce(nullif(btrim(p_values->>'senderRepresentativeName'), ''), '')) end
  where handover.id = v_id;

  select * into v_recipient_party from public.material_custodians where id = v_recipient;
  v_snapshot := public.material_party_json(v_recipient) || jsonb_build_object(
    'id', v_recipient,
    'code', case when p_values ? 'recipientPartyCode' then coalesce(p_values->>'recipientPartyCode', '') else v_recipient_party.code end,
    'name', btrim(p_values->>'recipientPartyName'),
    'type', v_recipient_party.type,
    'phone', nullif(btrim(p_values->>'recipientPartyPhone'), ''),
    'email', nullif(btrim(p_values->>'recipientPartyEmail'), ''),
    'representativeName', nullif(btrim(p_values->>'recipientRepresentativeName'), ''),
    'isHandoverCustom', v_recipient_party.is_handover_custom,
    'handoverScopePartyId', v_recipient_party.handover_scope_party_id
  );
  update public.material_handovers handover set
    recipient_party_snapshot = v_snapshot,
    recipient_representative_snapshot = case
      when nullif(btrim(p_values->>'recipientRepresentativeName'), '') is null
        and handover.recipient_representative_user_id is null then null
      else jsonb_build_object('userId', handover.recipient_representative_user_id,
        'displayName', coalesce(nullif(btrim(p_values->>'recipientRepresentativeName'), ''), '')) end
  where handover.id = v_id;
  return v_id;
end;
$$;
revoke all on function public.save_handover(uuid, jsonb) from public, anon;
grant execute on function public.save_handover(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
