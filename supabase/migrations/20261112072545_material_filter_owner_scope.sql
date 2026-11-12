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
    select pg_catalog.jsonb_build_object(
      'total', pg_catalog.count(*)::integer,
      'active', (pg_catalog.count(*) filter (where material.is_active))::integer,
      'inactive', (pg_catalog.count(*) filter (where not material.is_active))::integer,
      'good', (pg_catalog.count(*) filter (where material.condition = 'good'))::integer,
      'damaged', (pg_catalog.count(*) filter (where material.condition = 'damaged'))::integer,
      'ownerFilter', v_owner_filter
    )
    from public.materials as material
    where public.can_view_material_current(material.id)
      and (v_status is null or material.status = v_status)
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
  );
end;
$function$;

revoke all on function public.get_material_filter_summary(jsonb)
  from public, anon;
grant execute on function public.get_material_filter_summary(jsonb)
  to authenticated;
