CREATE OR REPLACE FUNCTION public.list_eps_organizations()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'EPS organization view permission required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', party.id,
      'sourceId', party.source_id,
      'type', party.type,
      'code', party.code,
      'name', party.name,
      'parentName', parent.name,
      'isActive', party.is_active,
      'canManageRepresentatives',
        public.has_scoped_permission('materials:custodian:manage', party.id)
        or private.has_all_eps_custodian_manage(),
      'representativeUserIds', coalesce((
        select jsonb_agg(representative.user_id order by
          (representative.user_id = party.representative_user_id) desc,
          lower(coalesce(nullif(btrim(profile.display_name), ''),
            nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
            profile.username)) collate "vi-x-icu", profile.id)
        from private.material_custodian_representatives representative
        join public.user_profiles profile on profile.id = representative.user_id
        where representative.custodian_id = party.id and profile.status = 'active'
          and profile.account_type = 'eps'
          and exists (select 1 from private.fake_eps_employees employee
            where employee.id = profile.eps_employee_id
              and employee.employment_status = 'active'
              and case party.type when 'department'
                then employee.department_id = party.source_id
                else employee.team_id = party.source_id end)
      ), '[]'::jsonb),
      'representativeAccounts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', profile.id,
          'displayName', coalesce(nullif(btrim(profile.display_name), ''),
            nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
            profile.username),
          'username', profile.username
        ) order by lower(coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          profile.username)) collate "vi-x-icu", profile.id)
        from private.material_custodian_representatives representative
        join public.user_profiles profile on profile.id = representative.user_id
        where representative.custodian_id = party.id and profile.status = 'active'
          and profile.account_type = 'eps'
          and exists (select 1 from private.fake_eps_employees employee
            where employee.id = profile.eps_employee_id
              and employee.employment_status = 'active'
              and case party.type when 'department'
                then employee.department_id = party.source_id
                else employee.team_id = party.source_id end)
      ), '[]'::jsonb),
      'representativeOptions', case when
        public.has_scoped_permission('materials:custodian:manage', party.id)
        or private.has_all_eps_custodian_manage()
      then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', profile.id,
          'displayName', coalesce(nullif(btrim(profile.display_name), ''),
            nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
            profile.username),
          'username', profile.username
        ) order by lower(coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          profile.username)) collate "vi-x-icu", profile.id)
        from public.user_profiles profile
        join private.fake_eps_employees employee on employee.id = profile.eps_employee_id
        where profile.account_type = 'eps' and profile.status = 'active'
          and employee.employment_status = 'active'
          and case party.type when 'department' then employee.department_id = party.source_id
            else employee.team_id = party.source_id end
      ), '[]'::jsonb) else '[]'::jsonb end
    ) order by case party.type when 'department' then 0 else 1 end,
      case when party.is_active then 0 else 1 end,
      lower(party.name) collate "vi-x-icu", party.id)
    from public.material_custodians party
    left join public.material_custodians parent on parent.id = party.parent_id
    where party.source_type in ('eps_department', 'eps_team')
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_external_organizations(p_include_inactive boolean DEFAULT false)
 RETURNS TABLE(id uuid, code text, name text, is_active boolean, created_at timestamp with time zone, representative_user_ids uuid[], representative_accounts jsonb, representative_options jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'External organization view permission required' using errcode = '42501';
  end if;

  return query
  select party.id, party.code, party.name, party.is_active, party.created_at,
    coalesce((
      select array_agg(representative.user_id order by
        (representative.user_id = party.representative_user_id) desc,
        lower(coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          profile.username)) collate "vi-x-icu", profile.id)
      from private.material_custodian_representatives representative
      join public.user_profiles profile on profile.id = representative.user_id
      where representative.custodian_id = party.id and profile.status = 'active'
        and profile.account_type = 'external'
        and profile.external_organization_id = party.id
    ), array[]::uuid[]),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id,
        'displayName', coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          profile.username),
        'username', profile.username
      ) order by lower(coalesce(nullif(btrim(profile.display_name), ''),
        nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
        profile.username)) collate "vi-x-icu", profile.id)
      from private.material_custodian_representatives representative
      join public.user_profiles profile on profile.id = representative.user_id
      where representative.custodian_id = party.id and profile.status = 'active'
        and profile.account_type = 'external'
        and profile.external_organization_id = party.id
    ), '[]'::jsonb),
    case when public.has_permission('organization:external-organization:manage')
      then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id,
        'displayName', coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          profile.username),
        'username', profile.username
      ) order by lower(coalesce(nullif(btrim(profile.display_name), ''),
        nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
        profile.username)) collate "vi-x-icu", profile.id)
      from public.user_profiles profile
      where profile.account_type = 'external'
        and profile.external_organization_id = party.id
        and profile.status = 'active'
      ), '[]'::jsonb)
      else '[]'::jsonb end
  from public.material_custodians party
  where party.type = 'external' and (p_include_inactive or party.is_active)
  order by case when party.is_active then 0 else 1 end,
    lower(party.name) collate "vi-x-icu", party.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_external_organization_filter_summary(p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_search text := nullif(btrim(p_search), '');
begin
  if auth.uid() is null then
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
$function$;

revoke all on function public.list_eps_organizations() from public, anon;
grant execute on function public.list_eps_organizations() to authenticated;
revoke all on function public.list_external_organizations(boolean) from public, anon;
grant execute on function public.list_external_organizations(boolean) to authenticated;
revoke all on function public.get_external_organization_filter_summary(text) from public, anon;
grant execute on function public.get_external_organization_filter_summary(text) to authenticated;
