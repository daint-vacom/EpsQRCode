-- Move shared tag permissions out of the organization catalog.
insert into public.permission_modules (
  code, name, description, sort_order, is_active
)
values (
  'system', 'Hệ thống',
  'Cài đặt, phân quyền và các danh mục dùng chung.', 20, true
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.permission_groups (
  module_code, code, name, description, sort_order, is_active
)
values (
  'system', 'tags', 'Nhãn',
  'Quản lý nhóm nhãn và nhãn dùng chung cho các đối tượng.', 30, true
)
on conflict (module_code, code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.permission_definitions (
  code, module_code, group_name, name, action, sensitive, sort_order,
  is_active, tags, group_id
)
select
  replace(definition.code, 'organization:tag:', 'system:tag:'),
  'system',
  definition.group_name,
  definition.name,
  definition.action,
  definition.sensitive,
  definition.sort_order,
  definition.is_active,
  definition.tags,
  permission_group.id
from public.permission_definitions definition
join public.permission_groups permission_group
  on permission_group.module_code = 'system'
 and permission_group.code = 'tags'
where definition.code like 'organization:tag:%'
on conflict (code) do update set
  module_code = excluded.module_code,
  group_name = excluded.group_name,
  name = excluded.name,
  action = excluded.action,
  sensitive = excluded.sensitive,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  tags = excluded.tags,
  group_id = excluded.group_id;

insert into public.role_permissions (role_id, permission_code, created_at)
select role_permission.role_id,
       replace(role_permission.permission_code, 'organization:tag:', 'system:tag:'),
       role_permission.created_at
from public.role_permissions role_permission
where role_permission.permission_code like 'organization:tag:%'
on conflict do nothing;

insert into public.user_permission_overrides (
  tenant_id, user_id, permission_code, effect, created_at, updated_at
)
select permission_override.tenant_id,
       permission_override.user_id,
       replace(permission_override.permission_code, 'organization:tag:', 'system:tag:'),
       permission_override.effect,
       permission_override.created_at,
       permission_override.updated_at
from public.user_permission_overrides permission_override
where permission_override.permission_code like 'organization:tag:%'
on conflict do nothing;

delete from public.role_permissions
where permission_code like 'organization:tag:%';
delete from public.user_permission_overrides
where permission_code like 'organization:tag:%';
delete from public.permission_definitions
where code like 'organization:tag:%';
delete from public.permission_groups
where module_code = 'organization' and code = 'tags';

-- Provision tenant-scoped roles and their baseline permissions.
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
    (target_tenant_id, 'admin', 'Quản trị viên', 'Quản lý cấu hình và quyền trong tổ chức.', 'all', true),
    (target_tenant_id, 'manager', 'Quản lý', 'Quản lý thông tin tổ chức và nhân viên.', 'all', false),
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
  select role_record.id, selected.permission_code
  from public.roles role_record
  cross join unnest(array[
    'organization:tenant:view', 'organization:tenant:update',
    'organization:employee:view', 'organization:employee:create',
    'organization:employee:update', 'organization:employee:delete',
    'organization:employee:assign-role', 'system:tag:view',
    'system:tag:create', 'system:tag:update'
  ]::text[]) as selected(permission_code)
  where role_record.tenant_id = target_tenant_id
    and role_record.code = 'manager'
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_code)
  select role_record.id, selected.permission_code
  from public.roles role_record
  cross join unnest(array[
    'organization:tenant:view', 'organization:employee:view',
    'system:tag:view'
  ]::text[]) as selected(permission_code)
  where role_record.tenant_id = target_tenant_id
    and role_record.code in ('employee', 'viewer')
  on conflict do nothing;

  insert into public.tenant_member_roles (tenant_id, user_id, role_id)
  select target_tenant_id, auth.uid(), role_record.id
  from public.roles role_record
  where role_record.tenant_id = target_tenant_id
    and role_record.code = 'admin'
  on conflict do nothing;
end;
$$;

-- Tenant creation also provisions its initial product roles and current user's admin role.
create or replace function public.create_tenant(
  tenant_name text,
  tenant_slug text,
  tenant_legal_name text default null,
  tenant_plan public.tenant_plan default 'free'
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  created_tenant public.tenants;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.tenants (name, slug, legal_name, plan, created_by)
  values (tenant_name, lower(tenant_slug), tenant_legal_name, tenant_plan, auth.uid())
  returning * into created_tenant;

  insert into public.tenant_members (tenant_id, user_id, role, status, joined_at)
  values (created_tenant.id, auth.uid(), 'owner', 'active', timezone('utc', now()));

  perform public.ensure_tenant_permission_defaults(created_tenant.id);
  return created_tenant;
end;
$$;

revoke execute on function public.ensure_tenant_permission_defaults(uuid) from public, anon;
grant execute on function public.ensure_tenant_permission_defaults(uuid) to authenticated;
revoke execute on function public.create_tenant(text, text, text, public.tenant_plan) from public, anon;
grant execute on function public.create_tenant(text, text, text, public.tenant_plan) to authenticated;

-- Tag catalog and assignment access follows the shared system permission catalog.
drop policy if exists "Members can view tag groups" on public.tag_groups;
drop policy if exists "Tenant admins can manage tag groups" on public.tag_groups;
drop policy if exists "Members can view tags" on public.tags;
drop policy if exists "Tenant admins can manage tags" on public.tags;
drop policy if exists "Members can view tag assignments" on public.tag_assignments;
drop policy if exists "Tenant admins can manage tag assignments" on public.tag_assignments;
drop policy if exists "Members with tag view can view tag groups" on public.tag_groups;
drop policy if exists "Members with tag create can create tag groups" on public.tag_groups;
drop policy if exists "Members with tag update can update tag groups" on public.tag_groups;
drop policy if exists "Members with tag delete can delete tag groups" on public.tag_groups;
drop policy if exists "Members with tag view can view tags" on public.tags;
drop policy if exists "Members with tag create can create tags" on public.tags;
drop policy if exists "Members with tag update can update tags" on public.tags;
drop policy if exists "Members with tag delete can delete tags" on public.tags;
drop policy if exists "Members with tag view can view tag assignments" on public.tag_assignments;

create policy "Members with tag view can view tag groups"
on public.tag_groups for select to authenticated
using (public.is_tenant_member(tenant_id)
  and public.has_tenant_permission(tenant_id, 'system:tag:view') and is_active);
create policy "Members with tag create can create tag groups"
on public.tag_groups for insert to authenticated
with check (
  public.has_tenant_permission(tenant_id, 'system:tag:create')
  and not is_system
  and module_code is null
);
create policy "Members with tag update can update tag groups"
on public.tag_groups for update to authenticated
using (public.has_tenant_permission(tenant_id, 'system:tag:update') and not is_system)
with check (
  public.has_tenant_permission(tenant_id, 'system:tag:update')
  and not is_system
  and module_code is null
);
create policy "Members with tag delete can delete tag groups"
on public.tag_groups for delete to authenticated
using (public.has_tenant_permission(tenant_id, 'system:tag:delete') and not is_system);

create policy "Members with tag view can view tags"
on public.tags for select to authenticated
using (public.is_tenant_member(tenant_id)
  and public.has_tenant_permission(tenant_id, 'system:tag:view') and is_active);
create policy "Members with tag create can create tags"
on public.tags for insert to authenticated
with check (public.has_tenant_permission(tenant_id, 'system:tag:create'));
create policy "Members with tag update can update tags"
on public.tags for update to authenticated
using (public.has_tenant_permission(tenant_id, 'system:tag:update'))
with check (public.has_tenant_permission(tenant_id, 'system:tag:update'));
create policy "Members with tag delete can delete tags"
on public.tags for delete to authenticated
using (public.has_tenant_permission(tenant_id, 'system:tag:delete'));

create policy "Members with tag view can view tag assignments"
on public.tag_assignments for select to authenticated
using (public.is_tenant_member(tenant_id)
  and public.has_tenant_permission(tenant_id, 'system:tag:view'));
create policy "Members with tag update can insert assignments"
on public.tag_assignments for insert to authenticated
with check (public.has_tenant_permission(tenant_id, 'system:tag:update'));
create policy "Members with tag update can update assignments"
on public.tag_assignments for update to authenticated
using (public.has_tenant_permission(tenant_id, 'system:tag:update'))
with check (public.has_tenant_permission(tenant_id, 'system:tag:update'));
create policy "Members with tag update can delete assignments"
on public.tag_assignments for delete to authenticated
using (public.has_tenant_permission(tenant_id, 'system:tag:update'));

create or replace function public.replace_tag_assignments(
  target_tenant_id uuid,
  target_subject_type text,
  target_subject_id uuid,
  target_tag_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_subject_type !~ '^[a-z][a-z0-9_]*$'
    or not public.has_tenant_permission(target_tenant_id, 'system:tag:update') then
    raise exception 'Tag update permission required' using errcode = '42501';
  end if;

  delete from public.tag_assignments
  where tenant_id = target_tenant_id
    and subject_type = target_subject_type
    and subject_id = target_subject_id;

  insert into public.tag_assignments (
    tenant_id, tag_id, subject_type, subject_id, created_by
  )
  select target_tenant_id, tag.id, target_subject_type, target_subject_id, auth.uid()
  from public.tags tag
  where tag.tenant_id = target_tenant_id
    and tag.is_active
    and tag.id = any(coalesce(target_tag_ids, array[]::uuid[]))
  on conflict (tenant_id, tag_id, subject_type, subject_id) do nothing;
end;
$$;

revoke all on function public.replace_tag_assignments(uuid, text, uuid, uuid[])
  from public, anon;
grant execute on function public.replace_tag_assignments(uuid, text, uuid, uuid[])
  to authenticated;

notify pgrst, 'reload schema';
