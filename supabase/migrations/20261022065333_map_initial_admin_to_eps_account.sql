-- Keep the synthetic directory entry chosen for the bootstrap admin in fresh
-- development databases as well as in the current remote project.
insert into private.fake_eps_employees (
  id, employee_code, first_name, last_name, email,
  department_id, team_id, employment_status
)
values (
  'EPS-MOCK-E006', 'MOCK-E006', 'Chưa có tài khoản', 'UAT', null,
  'EPS-MOCK-D02', 'EPS-MOCK-T03', 'active'
)
on conflict (id) do nothing;

-- The system admin bootstrap profile is an EPS account linked to its selected
-- synthetic directory entry, so it does not appear as "Cần ánh xạ".
update public.user_profiles profile
set account_type = 'eps',
    eps_employee_id = 'EPS-MOCK-E006'
where profile.username = 'admin'
  and profile.account_type is null
  and profile.eps_employee_id is null
  and profile.external_organization_id is null
  and exists (
    select 1
    from public.user_roles assignment
    join public.roles role on role.id = assignment.role_id
    where assignment.user_id = profile.id
      and role.code = 'system_admin'
      and role.is_active
  )
  and exists (
    select 1
    from private.fake_eps_employees employee
    where employee.id = 'EPS-MOCK-E006'
      and employee.employee_code = 'MOCK-E006'
      and employee.employment_status = 'active'
  )
  and not exists (
    select 1
    from public.user_profiles existing_link
    where existing_link.eps_employee_id = 'EPS-MOCK-E006'
      and existing_link.id <> profile.id
  );
