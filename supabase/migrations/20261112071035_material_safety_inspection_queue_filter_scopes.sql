drop function public.list_material_party_employees(text, uuid, uuid, integer, integer);

create or replace function public.list_material_party_employees(
  p_search text default '',
  p_department_id uuid default null,
  p_team_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 30,
  p_access_mode text default 'manage'
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
  if coalesce(p_access_mode, '') not in ('view', 'manage') then
    raise exception 'Invalid employee access mode' using errcode = '22023';
  end if;

  if auth.uid() is null or (
    p_access_mode = 'view'
      and not public.has_permission('materials:material:view')
  ) or (
    p_access_mode = 'manage'
      and not (
        public.has_permission('materials:material:manage')
        or public.has_permission('materials:handover:manage')
        or public.has_permission('materials:receipt:manage')
      )
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
          (
            p_access_mode = 'view'
            and public.has_scoped_permission('materials:material:view', employee.id)
          )
          or (
            p_access_mode = 'manage'
            and (
              public.has_scoped_permission('materials:material:manage', employee.id)
              or public.has_scoped_permission('materials:handover:manage', employee.id)
              or public.has_scoped_permission('materials:receipt:manage', employee.id)
              or private.has_all_eps_custodian_manage()
            )
          )
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
revoke all on function public.list_material_party_employees(text, uuid, uuid, integer, integer, text)
  from public, anon;
grant execute on function public.list_material_party_employees(text, uuid, uuid, integer, integer, text)
  to authenticated;
create or replace function private.list_materials_requiring_safety_inspection(
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
  v_owner_party_id uuid := nullif(p_filters ->> 'ownerPartyId', '')::uuid;
  v_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_account_type text;
  v_external_organization_id uuid;
  v_current_department_id text;
  v_current_team_id text;
  v_department_id uuid;
  v_team_id uuid;
  v_access_scopes text[] := '{}'::text[];
  v_owner_filter_types text[] := '{}'::text[];
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
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
  with current_models as (
    select
      material.id,
      material.code,
      coalesce(
        nullif(pg_catalog.btrim(material.name_override), ''),
        nullif(material.model_snapshot ->> 'name', ''),
        material.code
      ) as name,
      material.created_at,
      material.inspection_settings_override_enabled,
      material.requires_inspection_override,
      material.inspection_interval_value_override,
      material.inspection_interval_unit_override,
      material.safety_inspection_checklist_override_enabled,
      model_snapshot.snapshot as model_config,
      material_checklist.checklist as checklist_override
    from public.materials material
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
      )
  ), effective_settings as (
    select
      current_models.*,
      case
        when inspection_settings_override_enabled
          then coalesce(requires_inspection_override, false)
        else coalesce((model_config ->> 'requiresInspection')::boolean, false)
      end as requires_inspection,
      case
        when inspection_settings_override_enabled and requires_inspection_override
          then coalesce(inspection_interval_value_override,
            (model_config ->> 'inspectionIntervalValue')::integer)
        else (model_config ->> 'inspectionIntervalValue')::integer
      end as interval_value,
      case
        when inspection_settings_override_enabled and requires_inspection_override
          then coalesce(inspection_interval_unit_override,
            model_config ->> 'inspectionIntervalUnit')
        else model_config ->> 'inspectionIntervalUnit'
      end as interval_unit,
      coalesce((model_config ->> 'skipInitialInspection')::boolean, false)
        as skip_initial_inspection,
      case
        when safety_inspection_checklist_override_enabled
          then coalesce(checklist_override, '[]'::jsonb)
        else coalesce(model_config -> 'safetyInspectionChecklist', '[]'::jsonb)
      end as effective_checklist
    from current_models
  ), scheduled as (
    select
      effective_settings.id,
      effective_settings.code,
      effective_settings.name,
      effective_settings.created_at,
      effective_settings.interval_value,
      effective_settings.interval_unit,
      effective_settings.skip_initial_inspection,
      effective_settings.effective_checklist,
      latest.inspected_at as last_inspected_at,
      active.id as active_inspection_id,
      case
        when latest.inspected_at is not null then
          ((latest.inspected_at at time zone 'Asia/Ho_Chi_Minh')::date
          + case effective_settings.interval_unit
              when 'day' then effective_settings.interval_value * interval '1 day'
              else effective_settings.interval_value * interval '1 month'
            end)::date
        else
          ((effective_settings.created_at at time zone 'Asia/Ho_Chi_Minh')::date
          + case
              when effective_settings.skip_initial_inspection then
                case effective_settings.interval_unit
                  when 'day' then effective_settings.interval_value * interval '1 day'
                  else effective_settings.interval_value * interval '1 month'
                end
              else interval '0 days'
            end)::date
      end as next_due_date
    from effective_settings
    left join lateral (
      select inspection.inspected_at
      from public.material_safety_inspections inspection
      where inspection.material_id = effective_settings.id
        and inspection.status = 'completed'
      order by inspection.inspected_at desc, inspection.id desc
      limit 1
    ) latest on true
    left join lateral (
      select inspection.id
      from public.material_safety_inspections inspection
      where inspection.material_id = effective_settings.id
        and inspection.status = 'in_progress'
      limit 1
    ) active on true
    where effective_settings.requires_inspection
  ), filtered as (
    select
      scheduled.*,
      case
        when active_inspection_id is not null then 'in_progress'
        when next_due_date <= v_today then 'due'
        else 'upcoming'
      end as status
    from scheduled
    where (
      v_search is null
      or code ilike '%' || v_search || '%'
      or name ilike '%' || v_search || '%'
    )
  ), status_filtered as (
    select *
    from filtered
    where v_status is null or status = v_status
  ), page_items as (
    select *
    from status_filtered
    order by
      case status when 'due' then 0 when 'in_progress' then 1 else 2 end,
      next_due_date asc,
      code asc,
      id asc
    offset (v_page - 1) * v_page_size
    limit v_page_size
  )
  select pg_catalog.jsonb_build_object(
    'items', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'lastInspectedAt', last_inspected_at,
        'nextDueDate', next_due_date,
        'daysRemaining', next_due_date - v_today,
        'status', status,
        'activeInspectionId', active_inspection_id,
        'hasChecklist', pg_catalog.jsonb_array_length(effective_checklist) > 0
      ) order by
        case status when 'due' then 0 when 'in_progress' then 1 else 2 end,
        next_due_date asc, code asc, id asc)
      from page_items
    ), '[]'::jsonb),
    'ownerFilter', pg_catalog.jsonb_build_object(
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
    ),
    'summary', pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*)::integer from filtered),
      'due', (select pg_catalog.count(*)::integer from filtered where status = 'due'),
      'upcoming', (select pg_catalog.count(*)::integer from filtered where status = 'upcoming'),
      'inProgress', (select pg_catalog.count(*)::integer from filtered where status = 'in_progress')
    ),
    'total', (select pg_catalog.count(*) from status_filtered),
    'page', v_page,
    'pageSize', v_page_size
  ) into v_result;

  return v_result;
end;
$$;

