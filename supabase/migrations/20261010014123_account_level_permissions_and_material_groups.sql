-- EpsQRCode single-workspace test schema.
-- Auth UUIDs identify accounts directly in this single-workspace schema.

do $$ begin
  create type public.role_color as enum (
    'blue', 'violet', 'red', 'green', 'amber', 'slate'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.permission_scope as enum ('self', 'department', 'all');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  first_name text,
  last_name text,
  avatar_url text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'deactivated')),
  locale text not null default 'vi',
  timezone text not null default 'Asia/Ho_Chi_Minh',
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_profiles_display_name_not_blank check (
    display_name is null or length(btrim(display_name)) > 0
  ),
  constraint user_profiles_locale_not_blank check (length(btrim(locale)) > 0),
  constraint user_profiles_timezone_not_blank check (length(btrim(timezone)) > 0)
);

create table if not exists public.permission_modules (
  code text primary key,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint permission_modules_code_not_blank check (length(btrim(code)) > 0),
  constraint permission_modules_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.permission_groups (
  id uuid primary key default gen_random_uuid(),
  module_code text not null references public.permission_modules(code) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint permission_groups_module_code_unique unique (module_code, code),
  constraint permission_groups_code_not_blank check (length(btrim(code)) > 0),
  constraint permission_groups_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.permission_definitions (
  code text primary key,
  module_code text not null references public.permission_modules(code) on delete cascade,
  group_name text not null,
  group_id uuid not null references public.permission_groups(id) on delete restrict,
  name text not null,
  action text not null,
  sensitive boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint permission_definitions_code_not_blank check (length(btrim(code)) > 0),
  constraint permission_definitions_name_not_blank check (length(btrim(name)) > 0),
  constraint permission_definitions_action_not_blank check (length(btrim(action)) > 0)
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  scope public.permission_scope not null default 'all',
  is_system boolean not null default false,
  is_active boolean not null default true,
  color public.role_color not null default 'blue',
  sort_order integer not null default 100,
  customer_assignable boolean not null default false,
  grant_all_permissions boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint roles_code_not_blank check (length(btrim(code)) > 0),
  constraint roles_name_not_blank check (length(btrim(name)) > 0),
  constraint roles_grant_all_system_check check (
    not grant_all_permissions or is_system
  )
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_code text not null references public.permission_definitions(code) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_id, permission_code)
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role_id)
);

create table if not exists public.user_permission_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_code text not null references public.permission_definitions(code) on delete restrict,
  effect text not null check (effect in ('allow', 'deny')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, permission_code)
);

create index if not exists user_roles_role_id_idx on public.user_roles(role_id);
create index if not exists role_permissions_permission_code_idx
  on public.role_permissions(permission_code);
create index if not exists permission_definitions_group_id_idx
  on public.permission_definitions(group_id);

create or replace function public.set_epsqrcode_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, display_name, avatar_url, metadata)
  values (
    new.id,
    nullif(btrim(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name'
    )), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    jsonb_build_object(
      'authProvider', coalesce(new.raw_app_meta_data ->> 'provider', 'email')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.user_profiles (id, display_name, avatar_url, metadata)
select
  auth_user.id,
  nullif(btrim(coalesce(
    auth_user.raw_user_meta_data ->> 'display_name',
    auth_user.raw_user_meta_data ->> 'full_name'
  )), ''),
  nullif(btrim(auth_user.raw_user_meta_data ->> 'avatar_url'), ''),
  jsonb_build_object(
    'authProvider', coalesce(auth_user.raw_app_meta_data ->> 'provider', 'email')
  )
from auth.users auth_user
on conflict (id) do nothing;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles assignment
    join public.roles role_record on role_record.id = assignment.role_id
    where assignment.user_id = auth.uid()
      and role_record.code = 'system_admin'
      and role_record.is_system
      and role_record.is_active
  );
$$;

create or replace function public.get_effective_permissions(
  target_user_id uuid default auth.uid()
)
returns table (permission_code text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if target_user_id is distinct from auth.uid()
    and not public.is_system_admin() then
    raise exception 'Not allowed to inspect another account permissions'
      using errcode = '42501';
  end if;

  return query
  select definition.code
  from public.permission_definitions definition
  where definition.is_active
    and (
      exists (
        select 1
        from public.user_roles assignment
        join public.role_permissions role_permission
          on role_permission.role_id = assignment.role_id
        join public.roles role_record
          on role_record.id = assignment.role_id
        where assignment.user_id = target_user_id
          and role_record.is_active
          and role_permission.permission_code = definition.code
      )
      or exists (
        select 1
        from public.user_permission_overrides permission_override
        where permission_override.user_id = target_user_id
          and permission_override.permission_code = definition.code
          and permission_override.effect = 'allow'
      )
    )
    and not exists (
      select 1
      from public.user_permission_overrides permission_override
      where permission_override.user_id = target_user_id
        and permission_override.permission_code = definition.code
        and permission_override.effect = 'deny'
    )
  order by definition.sort_order, definition.code;
end;
$$;

create or replace function public.has_permission(
  required_permission_code text,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.get_effective_permissions(target_user_id) effective
    where effective.permission_code = required_permission_code
  );
$$;

create or replace function public.replace_role_permissions(
  target_role_id uuid,
  selected_permission_codes text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_is_system boolean;
begin
  if not public.is_system_admin() then
    raise exception 'System administrator required' using errcode = '42501';
  end if;

  select role_record.is_system into target_is_system
  from public.roles role_record
  where role_record.id = target_role_id;

  if not found then
    raise exception 'Role not found' using errcode = 'P0002';
  end if;

  if target_is_system then
    raise exception 'System roles cannot be edited' using errcode = '42501';
  end if;

  delete from public.role_permissions
  where role_id = target_role_id;

  insert into public.role_permissions (role_id, permission_code)
  select target_role_id, definition.code
  from public.permission_definitions definition
  where definition.is_active
    and definition.code = any(coalesce(selected_permission_codes, array[]::text[]));
end;
$$;

insert into public.permission_modules (code, name, description, sort_order, is_active)
values
  ('system', 'Hệ thống', 'Quản lý vai trò và quyền truy cập.', 10, true),
  ('material_catalog', 'Vật tư', 'Quản lý danh mục vật tư dùng chung.', 30, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.permission_groups (module_code, code, name, description, sort_order, is_active)
values
  ('system', 'roles', 'Vai trò và phân quyền', 'Quản lý vai trò và quyền truy cập.', 10, true),
  ('material_catalog', 'material_groups', 'Nhóm vật tư', 'Quản lý danh sách nhóm vật tư.', 10, true)
on conflict (module_code, code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.permission_definitions (
  code, module_code, group_name, group_id, name, action, sensitive,
  sort_order, is_active, tags
)
select
  permission.code,
  permission.module_code,
  permission_group.name,
  permission_group.id,
  permission.name,
  permission.action,
  permission.sensitive,
  permission.sort_order,
  true,
  permission.tags
from (
  values
    ('system:roles:view', 'system', 'Xem vai trò', 'view', false, 10, array['Xem']::text[]),
    ('system:roles:edit', 'system', 'Quản lý vai trò', 'update', true, 20, array['Chỉnh sửa']::text[]),
    ('system:roles:permissions-edit', 'system', 'Phân quyền vai trò', 'update', true, 30, array['Chỉnh sửa']::text[]),
    ('material_catalog:material_group:view', 'material_catalog', 'Xem nhóm vật tư', 'view', false, 5, array['Xem']::text[]),
    ('material_catalog:material_group:manage', 'material_catalog', 'Thêm, sửa, xóa nhóm vật tư', 'manage', true, 10, array['Chỉnh sửa', 'Xóa']::text[])
) as permission(code, module_code, name, action, sensitive, sort_order, tags)
join public.permission_groups permission_group
  on permission_group.module_code = permission.module_code
 and permission_group.code = case permission.module_code
   when 'system' then 'roles'
   else 'material_groups'
 end
on conflict (code) do update set
  module_code = excluded.module_code,
  group_name = excluded.group_name,
  group_id = excluded.group_id,
  name = excluded.name,
  action = excluded.action,
  sensitive = excluded.sensitive,
  sort_order = excluded.sort_order,
  is_active = true,
  tags = excluded.tags;

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

create or replace function public.sync_grant_all_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active then
    insert into public.role_permissions (role_id, permission_code)
    select role_record.id, new.code
    from public.roles role_record
    where role_record.is_system
      and role_record.grant_all_permissions
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists permission_definitions_sync_grant_all_roles
  on public.permission_definitions;
create trigger permission_definitions_sync_grant_all_roles
after insert or update of is_active on public.permission_definitions
for each row execute function public.sync_grant_all_role_permissions();

insert into public.role_permissions (role_id, permission_code)
select role_record.id, definition.code
from public.roles role_record
cross join public.permission_definitions definition
where role_record.is_system
  and role_record.grant_all_permissions
  and definition.is_active
on conflict do nothing;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_epsqrcode_updated_at();

drop trigger if exists permission_modules_set_updated_at on public.permission_modules;
create trigger permission_modules_set_updated_at
before update on public.permission_modules
for each row execute function public.set_epsqrcode_updated_at();

drop trigger if exists permission_groups_set_updated_at on public.permission_groups;
create trigger permission_groups_set_updated_at
before update on public.permission_groups
for each row execute function public.set_epsqrcode_updated_at();

drop trigger if exists permission_definitions_set_updated_at on public.permission_definitions;
create trigger permission_definitions_set_updated_at
before update on public.permission_definitions
for each row execute function public.set_epsqrcode_updated_at();

drop trigger if exists roles_set_updated_at on public.roles;
create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_epsqrcode_updated_at();

drop trigger if exists user_permission_overrides_set_updated_at on public.user_permission_overrides;
create trigger user_permission_overrides_set_updated_at
before update on public.user_permission_overrides
for each row execute function public.set_epsqrcode_updated_at();

revoke all on public.user_profiles,
  public.permission_modules,
  public.permission_groups,
  public.permission_definitions,
  public.roles,
  public.role_permissions,
  public.user_roles,
  public.user_permission_overrides
from anon, authenticated;

grant select on public.user_profiles,
  public.permission_modules,
  public.permission_groups,
  public.permission_definitions,
  public.roles,
  public.role_permissions,
  public.user_roles,
  public.user_permission_overrides
to authenticated;

grant update (display_name, first_name, last_name, avatar_url, locale, timezone, settings)
  on public.user_profiles to authenticated;
grant insert, update, delete on public.roles,
  public.role_permissions,
  public.user_roles,
  public.user_permission_overrides
to authenticated;

alter table public.user_profiles enable row level security;
alter table public.permission_modules enable row level security;
alter table public.permission_groups enable row level security;
alter table public.permission_definitions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_permission_overrides enable row level security;

drop policy if exists user_profiles_select_account on public.user_profiles;
create policy user_profiles_select_account
on public.user_profiles for select to authenticated
using (id = auth.uid() or public.is_system_admin());

drop policy if exists user_profiles_update_self on public.user_profiles;
create policy user_profiles_update_self
on public.user_profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists permission_modules_select_active on public.permission_modules;
create policy permission_modules_select_active
on public.permission_modules for select to authenticated
using (is_active);

drop policy if exists permission_groups_select_active on public.permission_groups;
create policy permission_groups_select_active
on public.permission_groups for select to authenticated
using (is_active);

drop policy if exists permission_definitions_select_active on public.permission_definitions;
create policy permission_definitions_select_active
on public.permission_definitions for select to authenticated
using (is_active);

drop policy if exists roles_select_account on public.roles;
create policy roles_select_account
on public.roles for select to authenticated
using (is_active and public.has_permission('system:roles:view'));

drop policy if exists roles_insert_custom on public.roles;
create policy roles_insert_custom
on public.roles for insert to authenticated
with check (not is_system and not grant_all_permissions and public.is_system_admin());

drop policy if exists roles_update_custom on public.roles;
create policy roles_update_custom
on public.roles for update to authenticated
using (not is_system and public.is_system_admin())
with check (not is_system and not grant_all_permissions and public.is_system_admin());

drop policy if exists roles_delete_custom on public.roles;
create policy roles_delete_custom
on public.roles for delete to authenticated
using (not is_system and public.is_system_admin());

drop policy if exists role_permissions_select_account on public.role_permissions;
create policy role_permissions_select_account
on public.role_permissions for select to authenticated
using (public.has_permission('system:roles:view'));

drop policy if exists role_permissions_manage_custom on public.role_permissions;
create policy role_permissions_manage_custom
on public.role_permissions for all to authenticated
using (
  public.is_system_admin()
  and exists (
    select 1 from public.roles role_record
    where role_record.id = role_permissions.role_id
      and not role_record.is_system
  )
)
with check (
  public.is_system_admin()
  and exists (
    select 1 from public.roles role_record
    where role_record.id = role_permissions.role_id
      and not role_record.is_system
  )
);

drop policy if exists user_roles_select_account on public.user_roles;
create policy user_roles_select_account
on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.is_system_admin());

drop policy if exists user_roles_manage_account on public.user_roles;
create policy user_roles_manage_account
on public.user_roles for all to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

drop policy if exists user_permission_overrides_select_account on public.user_permission_overrides;
create policy user_permission_overrides_select_account
on public.user_permission_overrides for select to authenticated
using (user_id = auth.uid() or public.is_system_admin());

drop policy if exists user_permission_overrides_manage_account on public.user_permission_overrides;
create policy user_permission_overrides_manage_account
on public.user_permission_overrides for all to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
revoke all on function public.is_system_admin() from public, anon;
revoke all on function public.get_effective_permissions(uuid) from public, anon;
revoke all on function public.has_permission(text, uuid) from public, anon;
revoke all on function public.replace_role_permissions(uuid, text[]) from public, anon;
grant execute on function public.is_system_admin() to authenticated;
grant execute on function public.get_effective_permissions(uuid) to authenticated;
grant execute on function public.has_permission(text, uuid) to authenticated;
grant execute on function public.replace_role_permissions(uuid, text[]) to authenticated;

revoke all privileges on public.material_groups from anon;
grant select, insert, update, delete on public.material_groups to authenticated;

drop policy if exists material_groups_select_authenticated on public.material_groups;
drop policy if exists material_groups_select_with_permission on public.material_groups;
drop policy if exists material_groups_insert_authenticated on public.material_groups;
drop policy if exists material_groups_update_authenticated on public.material_groups;
drop policy if exists material_groups_delete_authenticated on public.material_groups;
drop policy if exists material_groups_insert_with_permission on public.material_groups;
drop policy if exists material_groups_update_with_permission on public.material_groups;
drop policy if exists material_groups_delete_with_permission on public.material_groups;

create policy material_groups_select_with_permission
on public.material_groups for select to authenticated
using (public.has_permission('material_catalog:material_group:view'));

create policy material_groups_insert_with_permission
on public.material_groups for insert to authenticated
with check (public.has_permission('material_catalog:material_group:manage'));

create policy material_groups_update_with_permission
on public.material_groups for update to authenticated
using (public.has_permission('material_catalog:material_group:manage'))
with check (public.has_permission('material_catalog:material_group:manage'));

create policy material_groups_delete_with_permission
on public.material_groups for delete to authenticated
using (public.has_permission('material_catalog:material_group:manage'));

revoke all on function public.list_material_groups() from public, anon;
grant execute on function public.list_material_groups() to authenticated;

notify pgrst, 'reload schema';
