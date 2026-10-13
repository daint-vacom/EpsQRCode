-- Combine material-group create, update, and delete into one manage permission.
insert into public.permission_definitions (
  code, module_code, group_name, group_id, name, action, sensitive,
  sort_order, is_active, tags
)
select
  'material_catalog:material_group:manage',
  permission_group.module_code,
  permission_group.name,
  permission_group.id,
  'Thêm, sửa, xóa nhóm vật tư',
  'manage',
  true,
  10,
  true,
  array['Chỉnh sửa', 'Xóa']::text[]
from public.permission_groups permission_group
where permission_group.module_code = 'material_catalog'
  and permission_group.code = 'material_groups'
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

-- Preserve the combined capability for every role that had any CRUD grant.
insert into public.role_permissions (role_id, permission_code)
select distinct role_permission.role_id,
  'material_catalog:material_group:manage'
from public.role_permissions role_permission
where role_permission.permission_code in (
  'material_catalog:material_group:create',
  'material_catalog:material_group:update',
  'material_catalog:material_group:delete'
)
on conflict do nothing;

-- A deny on any old CRUD action wins when collapsing account overrides.
insert into public.user_permission_overrides (user_id, permission_code, effect)
select
  permission_override.user_id,
  'material_catalog:material_group:manage',
  case
    when bool_or(permission_override.effect = 'deny') then 'deny'
    else 'allow'
  end
from public.user_permission_overrides permission_override
where permission_override.permission_code in (
  'material_catalog:material_group:create',
  'material_catalog:material_group:update',
  'material_catalog:material_group:delete'
)
group by permission_override.user_id
on conflict (user_id, permission_code) do update set
  effect = excluded.effect,
  updated_at = timezone('utc', now());

delete from public.user_permission_overrides
where permission_code in (
  'material_catalog:material_group:create',
  'material_catalog:material_group:update',
  'material_catalog:material_group:delete'
);

delete from public.role_permissions
where permission_code in (
  'material_catalog:material_group:create',
  'material_catalog:material_group:update',
  'material_catalog:material_group:delete'
);

delete from public.permission_definitions
where code in (
  'material_catalog:material_group:create',
  'material_catalog:material_group:update',
  'material_catalog:material_group:delete'
);

drop policy if exists material_groups_insert_with_permission
  on public.material_groups;
create policy material_groups_insert_with_permission
on public.material_groups for insert to authenticated
with check (public.has_permission('material_catalog:material_group:manage'));

drop policy if exists material_groups_update_with_permission
  on public.material_groups;
create policy material_groups_update_with_permission
on public.material_groups for update to authenticated
using (public.has_permission('material_catalog:material_group:manage'))
with check (public.has_permission('material_catalog:material_group:manage'));

drop policy if exists material_groups_delete_with_permission
  on public.material_groups;
create policy material_groups_delete_with_permission
on public.material_groups for delete to authenticated
using (public.has_permission('material_catalog:material_group:manage'));

notify pgrst, 'reload schema';
