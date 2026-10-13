-- Add the read permission to the material-group catalog for existing projects.
insert into public.permission_definitions (
  code, module_code, group_name, group_id, name, action, sensitive,
  sort_order, is_active, tags
)
select
  'material_catalog:material_group:view',
  permission_group.module_code,
  permission_group.name,
  permission_group.id,
  'Xem nhóm vật tư',
  'view',
  false,
  5,
  true,
  array['Xem']::text[]
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

insert into public.role_permissions (role_id, permission_code)
select role_record.id, definition.code
from public.roles role_record
join public.permission_definitions definition
  on definition.code = 'material_catalog:material_group:view'
where role_record.code = 'system_admin'
  and role_record.is_system
  and role_record.grant_all_permissions
  and definition.is_active
on conflict do nothing;
