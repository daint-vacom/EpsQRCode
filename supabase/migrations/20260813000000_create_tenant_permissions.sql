create type public.permission_effect as enum ('allow', 'deny');
create type public.permission_scope as enum ('self', 'department', 'all');

create table public.permission_definitions (
  code text primary key,
  module_code text not null,
  group_name text not null,
  name text not null,
  action text not null,
  sensitive boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint permission_definitions_code_not_blank check (length(btrim(code)) > 0),
  constraint permission_definitions_name_not_blank check (length(btrim(name)) > 0),
  constraint permission_definitions_action_not_blank check (length(btrim(action)) > 0)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  scope public.permission_scope not null default 'all',
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint roles_tenant_code_unique unique (tenant_id, code),
  constraint roles_code_not_blank check (length(btrim(code)) > 0),
  constraint roles_name_not_blank check (length(btrim(name)) > 0)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_code text not null references public.permission_definitions(code) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_id, permission_code)
);

create table public.tenant_member_roles (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, user_id, role_id)
);

create table public.user_permission_overrides (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_code text not null references public.permission_definitions(code) on delete restrict,
  effect public.permission_effect not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, user_id, permission_code)
);

create index roles_tenant_id_idx on public.roles(tenant_id);
create index role_permissions_permission_code_idx on public.role_permissions(permission_code);
create index tenant_member_roles_user_id_idx on public.tenant_member_roles(user_id);
create index user_permission_overrides_user_id_idx on public.user_permission_overrides(user_id);

create trigger permission_definitions_set_updated_at
before update on public.permission_definitions
for each row execute function public.set_updated_at();

create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create trigger user_permission_overrides_set_updated_at
before update on public.user_permission_overrides
for each row execute function public.set_updated_at();

insert into public.permission_definitions (
  code, module_code, group_name, name, action, sensitive, sort_order
)
values
  ('organization:tenant:view', 'organization', 'Thông tin tổ chức', 'Xem thông tin tổ chức', 'view', false, 10),
  ('organization:tenant:update', 'organization', 'Thông tin tổ chức', 'Chỉnh sửa thông tin tổ chức', 'update', false, 20),
  ('organization:employee:view', 'organization', 'Nhân viên', 'Xem danh sách nhân viên', 'view', false, 30),
  ('organization:employee:create', 'organization', 'Nhân viên', 'Thêm nhân viên', 'create', false, 40),
  ('organization:employee:update', 'organization', 'Nhân viên', 'Chỉnh sửa nhân viên', 'update', false, 50),
  ('organization:employee:delete', 'organization', 'Nhân viên', 'Xóa nhân viên', 'delete', true, 60),
  ('organization:employee:assign-role', 'organization', 'Nhân viên', 'Gán vai trò cho nhân viên', 'assign', true, 70)
on conflict (code) do update set
  module_code = excluded.module_code,
  group_name = excluded.group_name,
  name = excluded.name,
  action = excluded.action,
  sensitive = excluded.sensitive,
  sort_order = excluded.sort_order,
  is_active = true;

create or replace function public.get_effective_permissions(
  target_tenant_id uuid,
  target_user_id uuid default auth.uid()
)
returns table (permission_code text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if target_user_id <> auth.uid()
    and not public.has_tenant_role(
      target_tenant_id,
      array['owner', 'admin']::public.tenant_member_role[]
    ) then
    raise exception 'Not allowed to inspect another user permissions' using errcode = '42501';
  end if;

  if not public.is_tenant_member(target_tenant_id) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;

  return query
  select definition.code
  from public.permission_definitions definition
  where definition.is_active
    and (
      exists (
        select 1
        from public.tenant_member_roles member_role
        join public.role_permissions role_permission
          on role_permission.role_id = member_role.role_id
        where member_role.tenant_id = target_tenant_id
          and member_role.user_id = target_user_id
          and role_permission.permission_code = definition.code
      )
      or exists (
        select 1
        from public.user_permission_overrides permission_override
        where permission_override.tenant_id = target_tenant_id
          and permission_override.user_id = target_user_id
          and permission_override.permission_code = definition.code
          and permission_override.effect = 'allow'
      )
    )
    and not exists (
      select 1
      from public.user_permission_overrides permission_override
      where permission_override.tenant_id = target_tenant_id
        and permission_override.user_id = target_user_id
        and permission_override.permission_code = definition.code
        and permission_override.effect = 'deny'
    )
  order by definition.sort_order, definition.code;
end;
$$;

create or replace function public.has_tenant_permission(
  target_tenant_id uuid,
  required_permission_code text,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.get_effective_permissions(target_tenant_id, target_user_id)
    where permission_code = required_permission_code
  );
$$;

create or replace function public.ensure_tenant_permission_defaults(target_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_tenant_role(
    target_tenant_id,
    array['owner', 'admin']::public.tenant_member_role[]
  ) then
    raise exception 'Tenant administrator required' using errcode = '42501';
  end if;

  insert into public.roles (tenant_id, code, name, description, scope, is_system)
  values
    (target_tenant_id, 'admin', 'Quản trị viên', 'Quản lý cài đặt, quyền và nhân viên.', 'all', true),
    (target_tenant_id, 'manager', 'Quản lý', 'Quản lý tổ chức và hồ sơ nhân viên.', 'all', false),
    (target_tenant_id, 'employee', 'Nhân viên', 'Truy cập các chức năng được cấp.', 'self', false),
    (target_tenant_id, 'viewer', 'Chỉ xem', 'Chỉ xem thông tin tổ chức và nhân viên.', 'self', false)
  on conflict (tenant_id, code) do nothing;

  insert into public.role_permissions (role_id, permission_code)
  select role_record.id, definition.code
  from public.roles role_record
  cross join public.permission_definitions definition
  where role_record.tenant_id = target_tenant_id
    and role_record.code = 'admin'
    and definition.is_active
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_code)
  select role_record.id, permission_code
  from public.roles role_record
  cross join unnest(array[
    'organization:tenant:view', 'organization:tenant:update',
    'organization:employee:view', 'organization:employee:create',
    'organization:employee:update', 'organization:employee:delete',
    'organization:employee:assign-role'
  ]::text[]) as selected(permission_code)
  where role_record.tenant_id = target_tenant_id
    and role_record.code = 'manager'
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_code)
  select role_record.id, permission_code
  from public.roles role_record
  cross join unnest(array[
    'organization:tenant:view', 'organization:employee:view',
    'organization:employee:create', 'organization:employee:update'
  ]::text[]) as selected(permission_code)
  where role_record.tenant_id = target_tenant_id
    and role_record.code = 'employee'
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_code)
  select role_record.id, permission_code
  from public.roles role_record
  cross join unnest(array[
    'organization:tenant:view', 'organization:employee:view'
  ]::text[]) as selected(permission_code)
  where role_record.tenant_id = target_tenant_id
    and role_record.code = 'viewer'
  on conflict do nothing;

  insert into public.tenant_member_roles (tenant_id, user_id, role_id)
  select target_tenant_id, auth.uid(), role_record.id
  from public.roles role_record
  where role_record.tenant_id = target_tenant_id
    and role_record.code = 'admin'
  on conflict do nothing;
end;
$$;

create or replace function public.replace_role_permissions(
  target_role_id uuid,
  selected_permission_codes text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
begin
  select tenant_id into target_tenant_id
  from public.roles
  where id = target_role_id;

  if target_tenant_id is null then
    raise exception 'Role not found' using errcode = 'P0002';
  end if;

  if not public.has_tenant_role(
    target_tenant_id,
    array['owner', 'admin']::public.tenant_member_role[]
  ) then
    raise exception 'Tenant administrator required' using errcode = '42501';
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

grant select on public.permission_definitions to authenticated;
grant select, insert, update, delete on public.roles to authenticated;
grant select, insert, update, delete on public.role_permissions to authenticated;
grant select, insert, update, delete on public.tenant_member_roles to authenticated;
grant select, insert, update, delete on public.user_permission_overrides to authenticated;

revoke execute on function public.get_effective_permissions(uuid, uuid) from public, anon;
grant execute on function public.get_effective_permissions(uuid, uuid) to authenticated;
revoke execute on function public.has_tenant_permission(uuid, text, uuid) from public, anon;
grant execute on function public.has_tenant_permission(uuid, text, uuid) to authenticated;
revoke execute on function public.ensure_tenant_permission_defaults(uuid) from public, anon;
grant execute on function public.ensure_tenant_permission_defaults(uuid) to authenticated;
revoke execute on function public.replace_role_permissions(uuid, text[]) from public, anon;
grant execute on function public.replace_role_permissions(uuid, text[]) to authenticated;

alter table public.permission_definitions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.tenant_member_roles enable row level security;
alter table public.user_permission_overrides enable row level security;

create policy "Authenticated users can view active permission definitions"
on public.permission_definitions
for select
to authenticated
using (is_active);

create policy "Tenant members can view roles"
on public.roles
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage roles"
on public.roles
for all
to authenticated
using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[]))
with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[]));

create policy "Tenant members can view role permissions"
on public.role_permissions
for select
to authenticated
using (exists (
  select 1 from public.roles
  where id = role_id and public.is_tenant_member(tenant_id)
));

create policy "Tenant admins can manage role permissions"
on public.role_permissions
for all
to authenticated
using (exists (
  select 1 from public.roles
  where id = role_id
    and public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[])
))
with check (exists (
  select 1 from public.roles
  where id = role_id
    and public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[])
));

create policy "Tenant members can view role assignments"
on public.tenant_member_roles
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage role assignments"
on public.tenant_member_roles
for all
to authenticated
using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[]))
with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[]));

create policy "Users and admins can view permission overrides"
on public.user_permission_overrides
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[])
);

create policy "Tenant admins can manage permission overrides"
on public.user_permission_overrides
for all
to authenticated
using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[]))
with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[]));
