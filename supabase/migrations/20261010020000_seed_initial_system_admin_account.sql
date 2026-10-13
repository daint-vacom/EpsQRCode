-- Bootstrap the system administrator on a fresh single-account test project.
-- Do not grant this role automatically when multiple Auth accounts exist.
insert into public.roles (
  code, name, description, scope, is_system, is_active, color,
  sort_order, customer_assignable, grant_all_permissions
)
values (
  'system_admin',
  'Quản trị hệ thống',
  'Toàn quyền quản trị và vận hành EpsQRCode.',
  'all', true, true, 'red', 10, false, true
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  scope = excluded.scope,
  is_system = true,
  is_active = true,
  color = excluded.color,
  sort_order = excluded.sort_order,
  customer_assignable = false,
  grant_all_permissions = true;

insert into public.role_permissions (role_id, permission_code)
select role_record.id, definition.code
from public.roles role_record
cross join public.permission_definitions definition
where role_record.code = 'system_admin'
  and role_record.is_system
  and role_record.grant_all_permissions
  and definition.is_active
on conflict do nothing;

do $$
declare
  auth_user_count bigint;
begin
  select count(*) into auth_user_count from auth.users;

  if auth_user_count = 1
    and not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role_id)
    select auth_user.id, role_record.id
    from auth.users auth_user
    cross join public.roles role_record
    where role_record.code = 'system_admin'
      and role_record.is_system
      and role_record.is_active
    on conflict do nothing;
  end if;
end;
$$;
