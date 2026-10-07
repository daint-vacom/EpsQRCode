create table public.permission_modules (
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

create table public.permission_groups (
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

alter table public.permission_definitions
  add column group_id uuid,
  add column tags text[] not null default '{}'::text[];

create index permission_groups_module_code_idx on public.permission_groups(module_code);
create index permission_definitions_group_id_idx on public.permission_definitions(group_id);

create trigger permission_modules_set_updated_at
before update on public.permission_modules
for each row execute function public.set_updated_at();

create trigger permission_groups_set_updated_at
before update on public.permission_groups
for each row execute function public.set_updated_at();

insert into public.permission_modules (code, name, description, sort_order)
values
  ('organization', 'Tổ chức', 'Quản lý thông tin tổ chức, nhân viên và phân quyền', 10)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.permission_groups (module_code, code, name, description, sort_order)
values
  ('organization', 'tenant', 'Thông tin tổ chức', '', 10),
  ('organization', 'employees', 'Nhân viên', '', 20)
on conflict (module_code, code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

update public.permission_definitions definition
set group_id = permission_group.id
from public.permission_groups permission_group
where permission_group.module_code = definition.module_code
  and permission_group.name = definition.group_name;

update public.permission_definitions
set tags = case action
  when 'view' then array['Xem']::text[]
  when 'delete' then array['Xóa']::text[]
  when 'assign' then array['Chỉnh sửa', 'Duyệt']::text[]
  else array['Chỉnh sửa']::text[]
end;

alter table public.permission_definitions
  alter column group_id set not null;

alter table public.permission_definitions
  add constraint permission_definitions_group_id_fkey
  foreign key (group_id) references public.permission_groups(id) on delete restrict;

grant select on public.permission_modules to authenticated;
grant select on public.permission_groups to authenticated;

alter table public.permission_modules enable row level security;
alter table public.permission_groups enable row level security;

create policy "Authenticated users can view active permission modules"
on public.permission_modules
for select
to authenticated
using (is_active);

create policy "Authenticated users can view active permission groups"
on public.permission_groups
for select
to authenticated
using (is_active);
