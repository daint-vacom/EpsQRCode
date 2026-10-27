create or replace function public.get_my_qrcode_account()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'userId', profile.id,
    'username', profile.username,
    'displayName', case when profile.account_type = 'eps'
      then coalesce(nullif(btrim(concat_ws(' ', employee.last_name, employee.first_name)), ''), profile.username)
      else profile.display_name end,
    'accountType', profile.account_type,
    'status', profile.status,
    'roles', coalesce((
      select jsonb_agg(
        jsonb_build_object('name', role.name, 'color', role.color)
        order by role.sort_order, lower(role.name) collate "vi-x-icu", role.id
      )
      from public.user_roles assignment
      join public.roles role on role.id = assignment.role_id
      where assignment.user_id = profile.id and role.is_active
    ), '[]'::jsonb),
    'epsEmployeeId', employee.id,
    'epsEmployeeCode', employee.employee_code,
    'epsEmployeeName', case when employee.id is null then null else concat_ws(' ', employee.last_name, employee.first_name) end,
    'epsEmploymentStatus', employee.employment_status,
    'epsDepartmentId', department.id,
    'epsDepartmentName', department.name,
    'epsTeamId', team.id,
    'epsTeamName', team.name,
    'externalOrganizationId', external_party.id,
    'externalOrganizationName', external_party.name
  ) into result
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
  where profile.id = auth.uid();

  return result;
end;
$$;

revoke all on function public.get_my_qrcode_account() from public, anon;
grant execute on function public.get_my_qrcode_account() to authenticated;

notify pgrst, 'reload schema';
