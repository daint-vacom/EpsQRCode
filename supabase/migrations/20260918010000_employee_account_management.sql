alter table public.user_profiles
  add column if not exists username text;

update public.user_profiles profile
set username = lower(split_part(auth_user.email, '@', 1))
from auth.users auth_user
where auth_user.id = profile.id
  and profile.username is null
  and auth_user.email is not null
  and lower(split_part(auth_user.email, '@', 1)) ~ '^[a-z0-9][a-z0-9._-]{2,31}$';

alter table public.user_profiles
  drop constraint if exists user_profiles_username_format;

alter table public.user_profiles
  add constraint user_profiles_username_format check (
    username is null
    or username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
  );

create unique index if not exists user_profiles_username_ci_unique
  on public.user_profiles (lower(username))
  where username is not null;

insert into public.permission_definitions (
  code,
  module_code,
  group_name,
  name,
  action,
  sensitive,
  sort_order,
  group_id,
  tags
)
select
  'organization:employee:reset-password',
  'organization',
  'Nhân viên',
  'Đặt lại mật khẩu tài khoản nhân viên',
  'update',
  true,
  55,
  permission_group.id,
  array['Chỉnh sửa']::text[]
from public.permission_groups permission_group
where permission_group.module_code = 'organization'
  and permission_group.code = 'employees'
on conflict (code) do update
set
  module_code = excluded.module_code,
  group_name = excluded.group_name,
  name = excluded.name,
  action = excluded.action,
  sensitive = excluded.sensitive,
  sort_order = excluded.sort_order,
  group_id = excluded.group_id,
  tags = excluded.tags,
  is_active = true;

insert into public.role_permissions (role_id, permission_code)
select role_record.id, 'organization:employee:reset-password'
from public.roles role_record
where role_record.code = 'admin'
on conflict do nothing;

-- Employee account identity is managed by the trusted account endpoint. The
-- browser can still create/update the employee profile, but cannot assign an
-- arbitrary auth user to an employee through PostgREST.
revoke insert on public.employees from authenticated;
grant insert (
  tenant_id,
  employee_code,
  first_name,
  last_name,
  phone,
  status,
  joined_at,
  note,
  avatar_url
) on public.employees to authenticated;

revoke update on public.employees from authenticated;
grant update (
  employee_code,
  first_name,
  last_name,
  phone,
  status,
  joined_at,
  note,
  avatar_url
) on public.employees to authenticated;

notify pgrst, 'reload schema';
