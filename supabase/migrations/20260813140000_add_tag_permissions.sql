-- Tag permissions start in the organization catalog and move to system:tag:* in
-- the immediately following migration so fresh installs use one final catalog.
insert into public.permission_groups (
  module_code, code, name, description, sort_order, is_active
)
values (
  'organization', 'tags', 'Nhãn',
  'Quản lý nhóm nhãn và nhãn dùng chung.', 30, true
)
on conflict (module_code, code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.permission_definitions (
  code, module_code, group_name, name, action, sensitive, sort_order, is_active
)
values
  ('organization:tag:view', 'organization', 'Nhãn', 'Xem danh sách nhãn', 'view', false, 80, true),
  ('organization:tag:create', 'organization', 'Nhãn', 'Thêm nhóm nhãn và nhãn', 'create', false, 90, true),
  ('organization:tag:update', 'organization', 'Nhãn', 'Chỉnh sửa nhóm nhãn và nhãn', 'update', false, 100, true),
  ('organization:tag:delete', 'organization', 'Nhãn', 'Xóa nhóm nhãn và nhãn', 'delete', true, 110, true)
on conflict (code) do update set
  module_code = excluded.module_code,
  group_name = excluded.group_name,
  name = excluded.name,
  action = excluded.action,
  sensitive = excluded.sensitive,
  sort_order = excluded.sort_order,
  is_active = true;

update public.permission_definitions definition
set
  group_id = permission_group.id,
  tags = case definition.action
    when 'view' then array['Xem']::text[]
    when 'delete' then array['Xóa']::text[]
    else array['Chỉnh sửa']::text[]
  end
from public.permission_groups permission_group
where definition.code like 'organization:tag:%'
  and permission_group.module_code = 'organization'
  and permission_group.code = 'tags';

insert into public.role_permissions (role_id, permission_code)
select role_record.id, definition.code
from public.roles role_record
join public.permission_definitions definition
  on definition.code like 'organization:tag:%'
where role_record.code = 'admin'
  and definition.is_active
on conflict do nothing;

insert into public.role_permissions (role_id, permission_code)
select role_record.id, selected.permission_code
from public.roles role_record
cross join unnest(array[
  'organization:tag:view',
  'organization:tag:create',
  'organization:tag:update'
]::text[]) as selected(permission_code)
where role_record.code = 'manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_code)
select role_record.id, 'organization:tag:view'
from public.roles role_record
where role_record.code in ('employee', 'viewer')
on conflict do nothing;
