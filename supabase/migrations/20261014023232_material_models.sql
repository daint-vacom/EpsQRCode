create table if not exists public.material_models (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  image_url text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_models_code_not_blank check (length(btrim(code)) > 0),
  constraint material_models_name_not_blank check (length(btrim(name)) > 0),
  constraint material_models_image_url_not_blank check (
    image_url is null or length(btrim(image_url)) > 0
  )
);

create unique index if not exists material_models_code_ci_uidx
  on public.material_models (lower(btrim(code)));

create index if not exists material_models_list_order_idx
  on public.material_models (is_active desc, id);

create or replace function public.set_material_models_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists material_models_set_updated_at
  on public.material_models;
create trigger material_models_set_updated_at
before update on public.material_models
for each row execute function public.set_material_models_updated_at();

create or replace function public.list_material_models()
returns setof public.material_models
language sql
stable
security invoker
set search_path = ''
as $$
  select model.*
  from public.material_models as model
  order by
    case when model.is_active then 0 else 1 end,
    lower(model.name) collate "vi-x-icu",
    model.id;
$$;

alter table public.material_models enable row level security;
revoke all privileges on public.material_models from anon, authenticated;
grant select, insert, update, delete on public.material_models to authenticated;

drop policy if exists material_models_select_with_permission
  on public.material_models;
create policy material_models_select_with_permission
on public.material_models for select to authenticated
using (public.has_permission('material_catalog:material_model:view'));

drop policy if exists material_models_insert_with_permission
  on public.material_models;
create policy material_models_insert_with_permission
on public.material_models for insert to authenticated
with check (public.has_permission('material_catalog:material_model:manage'));

drop policy if exists material_models_update_with_permission
  on public.material_models;
create policy material_models_update_with_permission
on public.material_models for update to authenticated
using (public.has_permission('material_catalog:material_model:manage'))
with check (public.has_permission('material_catalog:material_model:manage'));

drop policy if exists material_models_delete_with_permission
  on public.material_models;
create policy material_models_delete_with_permission
on public.material_models for delete to authenticated
using (public.has_permission('material_catalog:material_model:manage'));

insert into public.permission_groups (
  module_code, code, name, description, sort_order, is_active
)
values (
  'material_catalog',
  'material_models',
  'Mẫu vật tư',
  'Quản lý danh sách mẫu vật tư.',
  20,
  true
)
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
    (
      'material_catalog:material_model:view',
      'material_catalog',
      'Xem mẫu vật tư',
      'view',
      false,
      20,
      array['Xem']::text[]
    ),
    (
      'material_catalog:material_model:manage',
      'material_catalog',
      'Thêm, sửa, xóa mẫu vật tư',
      'manage',
      true,
      30,
      array['Chỉnh sửa', 'Xóa']::text[]
    )
) as permission(code, module_code, name, action, sensitive, sort_order, tags)
join public.permission_groups permission_group
  on permission_group.module_code = permission.module_code
 and permission_group.code = 'material_models'
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
cross join public.permission_definitions definition
where role_record.is_system
  and role_record.grant_all_permissions
  and definition.code in (
    'material_catalog:material_model:view',
    'material_catalog:material_model:manage'
  )
on conflict do nothing;

revoke all on function public.set_material_models_updated_at()
  from public, anon, authenticated;
revoke all on function public.list_material_models() from public, anon;
grant execute on function public.list_material_models() to authenticated;

notify pgrst, 'reload schema';
