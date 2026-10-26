-- Return role colors with account rows so the UI can render the same role badges as employee lists.
-- PostgreSQL does not allow changing a RETURNS TABLE column type with CREATE OR REPLACE,
-- so recreate this RPC and restore its authenticated-only execute grant.
drop function if exists public.list_qrcode_accounts(text);

create function public.list_qrcode_accounts(p_search text default null)
returns table (
  user_id uuid, username text, display_name text, account_type text,
  eps_employee_id text, eps_employee_name text,
  eps_department_id text, eps_department_name text,
  eps_team_id text, eps_team_name text,
  external_organization_id uuid, external_organization_name text,
  status text, role_ids uuid[], roles jsonb, warehouse_ids uuid[], warehouse_names text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('organization:account:view') then
    raise exception 'Account view permission required' using errcode = '42501';
  end if;
  return query
  select profile.id, profile.username,
    case when profile.account_type = 'eps' then
      coalesce(nullif(btrim(concat_ws(' ', employee.last_name, employee.first_name)), ''), 'Nhân viên EPS chưa khả dụng')
    else coalesce(nullif(btrim(profile.display_name), ''),
      nullif(btrim(concat_ws(' ', profile.last_name, profile.first_name)), ''),
      profile.username, 'Tài khoản chưa có tên') end,
    profile.account_type, profile.eps_employee_id,
    case when employee.id is null then null else concat_ws(' ', employee.last_name, employee.first_name) end,
    department.id, department.name, team.id, team.name,
    profile.external_organization_id, external_party.name, profile.status,
    coalesce((select array_agg(role.id order by role.sort_order, lower(role.name) collate "vi-x-icu", role.id)
      from public.user_roles assignment join public.roles role on role.id = assignment.role_id
      where assignment.user_id = profile.id and role.is_active), '{}'::uuid[]),
    coalesce((select jsonb_agg(jsonb_build_object('name', role.name, 'color', role.color)
        order by role.sort_order, lower(role.name) collate "vi-x-icu", role.id)
      from public.user_roles assignment join public.roles role on role.id = assignment.role_id
      where assignment.user_id = profile.id and role.is_active), '[]'::jsonb),
    coalesce((select array_agg(custodian.id order by lower(custodian.name) collate "vi-x-icu", custodian.id)
      from public.material_warehouse_accounts assignment
      join public.material_warehouses warehouse on warehouse.custodian_id = assignment.warehouse_id
      join public.material_custodians custodian on custodian.id = warehouse.custodian_id
      where assignment.user_id = profile.id), '{}'::uuid[]),
    coalesce((select array_agg(custodian.name order by lower(custodian.name) collate "vi-x-icu", custodian.id)
      from public.material_warehouse_accounts assignment
      join public.material_warehouses warehouse on warehouse.custodian_id = assignment.warehouse_id
      join public.material_custodians custodian on custodian.id = warehouse.custodian_id
      where assignment.user_id = profile.id), '{}'::text[])
  from public.user_profiles profile
  left join private.fake_eps_employees employee
    on profile.account_type = 'eps' and employee.id = profile.eps_employee_id
  left join private.fake_eps_departments department on department.id = employee.department_id
  left join private.fake_eps_teams team on team.id = employee.team_id
  left join public.material_custodians external_party
    on profile.account_type = 'external'
   and external_party.id = profile.external_organization_id
   and external_party.type = 'external'
  where nullif(btrim(p_search), '') is null
    or concat_ws(' ', profile.username, profile.display_name, employee.employee_code,
      employee.first_name, employee.last_name, department.name, team.name, external_party.name)
      ilike '%' || btrim(p_search) || '%'
  order by case profile.status when 'active' then 0 when 'suspended' then 1 else 2 end,
    lower(coalesce(nullif(btrim(case when profile.account_type = 'eps'
      then concat_ws(' ', employee.last_name, employee.first_name) else profile.display_name end), ''),
      concat_ws(' ', employee.last_name, employee.first_name), external_party.name, profile.username, '')) collate "vi-x-icu",
    profile.id;
end;
$$;

revoke all on function public.list_qrcode_accounts(text) from public, anon;
grant execute on function public.list_qrcode_accounts(text) to authenticated;

notify pgrst, 'reload schema';
