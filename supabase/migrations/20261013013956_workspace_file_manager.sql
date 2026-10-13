-- Workspace-wide file manager. There is no tenant, quota or per-file max size.
create table if not exists public.file_folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.file_folders(id) on delete cascade,
  name text,
  folder_type text not null default 'custom',
  system_key text,
  subject_type text,
  subject_id uuid,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint file_folders_name_check check (folder_type = 'entity' or length(btrim(coalesce(name, ''))) > 0),
  constraint file_folders_type_check check (folder_type in ('system_root', 'entity', 'custom')),
  constraint file_folders_entity_reference_check check (
    (folder_type = 'entity' and subject_type = 'material_group' and subject_id is not null)
    or (folder_type <> 'entity' and subject_type is null and subject_id is null)
  )
);

create unique index if not exists file_folders_sibling_name_uq
  on public.file_folders (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null and folder_type <> 'entity';
create unique index if not exists file_folders_system_key_uq
  on public.file_folders(system_key) where system_key is not null and deleted_at is null;
create unique index if not exists file_folders_entity_subject_uq
  on public.file_folders(subject_type, subject_id)
  where folder_type = 'entity' and deleted_at is null;
create index if not exists file_folders_parent_idx
  on public.file_folders(parent_id, sort_order, id) where deleted_at is null;

drop trigger if exists file_folders_set_updated_at on public.file_folders;
create trigger file_folders_set_updated_at
before update on public.file_folders
for each row execute function public.set_epsqrcode_updated_at();

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.file_folders(id) on delete set null,
  storage_bucket text not null default 'workspace-assets',
  storage_path text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  checksum_sha256 text,
  uploaded_by uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique (storage_bucket, storage_path),
  constraint files_file_name_not_blank check (length(btrim(file_name)) > 0),
  constraint files_storage_path_not_blank check (length(btrim(storage_path)) > 0),
  constraint files_size_check check (size_bytes >= 0),
  constraint files_status_check check (status in ('active', 'deleted', 'quarantined'))
);
create index if not exists files_created_idx on public.files(created_at desc, id);
create index if not exists files_name_idx on public.files(lower(file_name), id);
create index if not exists files_folder_idx
  on public.files(folder_id, created_at desc, id) where status = 'active';

create table if not exists public.file_links (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  subject_type text not null default 'material_group',
  subject_id uuid not null references public.material_groups(id) on delete cascade,
  relation_type text not null default 'attachment',
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (file_id, subject_type, subject_id, relation_type),
  constraint file_links_subject_type_check check (subject_type = 'material_group'),
  constraint file_links_relation_type_not_blank check (length(btrim(relation_type)) > 0)
);
create index if not exists file_links_subject_idx
  on public.file_links(subject_type, subject_id, created_at desc, id);
create index if not exists file_links_file_idx on public.file_links(file_id, id);

create or replace view public.file_folder_listing with (security_invoker = true) as
select
  folder.id, folder.parent_id, folder.folder_type, folder.system_key,
  folder.subject_type, folder.subject_id, folder.name, folder.sort_order,
  folder.created_at, folder.updated_at, folder.deleted_at,
  case
    when folder.folder_type = 'system_root' then folder.name
    else coalesce(folder.name, 'Đối tượng đã xóa')
  end as display_name
from public.file_folders folder;

alter table public.file_folders enable row level security;
alter table public.files enable row level security;
alter table public.file_links enable row level security;
drop policy if exists file_folders_view on public.file_folders;
create policy file_folders_view on public.file_folders for select to authenticated
using (deleted_at is null and public.has_permission('files:file_manager:view'));
drop policy if exists file_folders_manage on public.file_folders;
create policy file_folders_manage on public.file_folders for all to authenticated
using (folder_type = 'custom' and public.has_permission('files:file_manager:manage'))
with check (folder_type = 'custom' and public.has_permission('files:file_manager:manage'));
drop policy if exists files_view on public.files;
create policy files_view on public.files for select to authenticated
using (status = 'active' and public.has_permission('files:file_manager:view'));
drop policy if exists files_manage on public.files;
create policy files_manage on public.files for all to authenticated
using (public.has_permission('files:file_manager:manage'))
with check (public.has_permission('files:file_manager:manage'));
drop policy if exists file_links_view on public.file_links;
create policy file_links_view on public.file_links for select to authenticated
using (public.has_permission('files:file_manager:view'));
drop policy if exists file_links_manage on public.file_links;
create policy file_links_manage on public.file_links for all to authenticated
using (public.has_permission('files:file_manager:manage'))
with check (public.has_permission('files:file_manager:manage'));
grant select, insert, update, delete on public.file_folders, public.files, public.file_links to authenticated;
grant select on public.file_folder_listing to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-assets', 'workspace-assets', false, null, null)
on conflict (id) do update set public = false, file_size_limit = null, allowed_mime_types = null;
drop policy if exists workspace_assets_view on storage.objects;
create policy workspace_assets_view on storage.objects for select to authenticated
using (bucket_id = 'workspace-assets' and public.has_permission('files:file_manager:view'));
drop policy if exists workspace_assets_insert on storage.objects;
create policy workspace_assets_insert on storage.objects for insert to authenticated
with check (bucket_id = 'workspace-assets' and public.has_permission('files:file_manager:manage'));
drop policy if exists workspace_assets_update on storage.objects;
create policy workspace_assets_update on storage.objects for update to authenticated
using (bucket_id = 'workspace-assets' and public.has_permission('files:file_manager:manage'))
with check (bucket_id = 'workspace-assets' and public.has_permission('files:file_manager:manage'));
drop policy if exists workspace_assets_delete on storage.objects;
create policy workspace_assets_delete on storage.objects for delete to authenticated
using (bucket_id = 'workspace-assets' and public.has_permission('files:file_manager:manage'));

insert into public.permission_modules (code, name, description, sort_order, is_active)
values ('files', 'Tệp lưu trữ', 'Quản lý tệp và thư mục của workspace.', 40, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.permission_groups (module_code, code, name, description, sort_order, is_active)
values ('files', 'file_manager', 'Kho tệp', 'Xem và quản lý tệp lưu trữ.', 10, true)
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
  permission.code, 'files', permission_group.name, permission_group.id,
  permission.name, permission.action, permission.sensitive,
  permission.sort_order, true, permission.tags
from (
  values
    ('files:file_manager:view', 'Xem tệp lưu trữ', 'view', false, 10, array['Xem']::text[]),
    ('files:file_manager:manage', 'Tải lên và quản lý tệp', 'manage', true, 20, array['Chỉnh sửa', 'Xóa']::text[])
) as permission(code, name, action, sensitive, sort_order, tags)
join public.permission_groups permission_group
  on permission_group.module_code = 'files'
 and permission_group.code = 'file_manager'
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
where role_record.code = 'system_admin'
  and role_record.grant_all_permissions
  and definition.module_code = 'files'
  and definition.is_active
on conflict do nothing;

-- A root category contains one folder per material group. New groups get one too.
insert into public.file_folders (name, folder_type, system_key, sort_order)
values ('Nhóm vật tư', 'system_root', 'material_groups', 10)
on conflict do nothing;

insert into public.file_folders (
  parent_id, folder_type, subject_type, subject_id, name, sort_order
)
select
  root.id, 'entity', 'material_group', material_group.id,
  concat(material_group.code, ' · ', material_group.name), 0
from public.file_folders root
cross join public.material_groups material_group
where root.folder_type = 'system_root'
  and root.system_key = 'material_groups'
  and root.deleted_at is null
on conflict do nothing;

create or replace function public.create_material_group_file_folder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.file_folders (
      parent_id, folder_type, subject_type, subject_id, name, sort_order
    )
    select
      root.id, 'entity', 'material_group', new.id,
      concat(new.code, ' · ', new.name), 0
    from public.file_folders root
    where root.folder_type = 'system_root'
      and root.system_key = 'material_groups'
      and root.deleted_at is null
    on conflict do nothing;
  else
    update public.file_folders folder
    set name = concat(new.code, ' · ', new.name)
    where folder.folder_type = 'entity'
      and folder.subject_type = 'material_group'
      and folder.subject_id = new.id
      and folder.deleted_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.create_material_group_file_folder() from public, anon, authenticated;
drop trigger if exists material_groups_create_file_folder on public.material_groups;
create trigger material_groups_create_file_folder
after insert or update of code, name on public.material_groups
for each row execute function public.create_material_group_file_folder();
