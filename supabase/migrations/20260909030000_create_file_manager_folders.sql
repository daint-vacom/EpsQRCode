-- File Manager foundation: logical folders are stored in Postgres while the
-- binary object path remains stable and is keyed by files.id.
create table if not exists public.file_folders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid,
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
  unique (tenant_id, id),
  foreign key (tenant_id, parent_id)
    references public.file_folders(tenant_id, id),
  constraint file_folders_name_check check (
    folder_type = 'entity' or length(btrim(coalesce(name, ''))) > 0
  ),
  constraint file_folders_type_check check (
    folder_type in ('system_root', 'entity', 'custom')
  ),
  constraint file_folders_entity_reference_check check (
    (folder_type = 'entity' and subject_type is not null and subject_id is not null)
    or (folder_type <> 'entity' and subject_type is null and subject_id is null)
  )
);

create unique index if not exists file_folders_sibling_name_uq
  on public.file_folders (
    tenant_id,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  )
  where deleted_at is null and folder_type <> 'entity';

create unique index if not exists file_folders_system_key_uq
  on public.file_folders(tenant_id, system_key)
  where system_key is not null and deleted_at is null;

create unique index if not exists file_folders_entity_subject_uq
  on public.file_folders(tenant_id, subject_type, subject_id)
  where folder_type = 'entity' and deleted_at is null;

create index if not exists file_folders_parent_idx
  on public.file_folders(tenant_id, parent_id, sort_order, id)
  where deleted_at is null;

alter table public.files
  add column if not exists folder_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'files_folder_same_tenant_fk'
      and conrelid = 'public.files'::regclass
  ) then
    alter table public.files
      add constraint files_folder_same_tenant_fk
      foreign key (tenant_id, folder_id)
      references public.file_folders(tenant_id, id);
  end if;
end;
$$;

create index if not exists files_folder_idx
  on public.files(tenant_id, folder_id, created_at desc)
  where status = 'active';

create table if not exists public.tenant_storage_quotas (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  limit_bytes bigint not null,
  used_bytes bigint not null default 0,
  reserved_bytes bigint not null default 0,
  max_file_size_bytes bigint,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tenant_storage_quotas_limit_check check (limit_bytes > 0),
  constraint tenant_storage_quotas_used_check check (used_bytes >= 0),
  constraint tenant_storage_quotas_reserved_check check (reserved_bytes >= 0)
);

create table if not exists public.file_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  folder_id uuid not null,
  file_id uuid,
  file_name text not null,
  mime_type text not null,
  expected_size bigint not null,
  uploaded_size bigint not null default 0,
  reserved_bytes bigint not null,
  storage_path text not null,
  status text not null default 'initiated',
  error_message text,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  foreign key (tenant_id, folder_id)
    references public.file_folders(tenant_id, id),
  constraint file_upload_sessions_status_check check (
    status in ('initiated', 'uploading', 'completed', 'failed', 'cancelled', 'expired')
  ),
  constraint file_upload_sessions_size_check check (
    expected_size >= 0 and uploaded_size >= 0 and reserved_bytes >= 0
  )
);

create index if not exists file_upload_sessions_cleanup_idx
  on public.file_upload_sessions(status, expires_at);

create or replace function public.account_file_storage_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quota public.tenant_storage_quotas;
  delta bigint := 0;
begin
  if tg_op = 'INSERT' and new.status = 'active' then
    select * into quota
    from public.tenant_storage_quotas
    where tenant_id = new.tenant_id
    for update;

    if not found then
      raise exception 'Tenant storage quota is not configured';
    end if;

    if quota.max_file_size_bytes is not null
       and new.size_bytes > quota.max_file_size_bytes then
      raise exception 'File exceeds tenant max file size';
    end if;

    if quota.used_bytes + quota.reserved_bytes + new.size_bytes > quota.limit_bytes then
      raise exception 'Tenant storage quota exceeded';
    end if;

    update public.tenant_storage_quotas
    set used_bytes = used_bytes + new.size_bytes,
        updated_at = timezone('utc', now())
    where tenant_id = new.tenant_id;
    return new;
  end if;

  if tg_op = 'DELETE' and old.status = 'active' then
    delta := old.size_bytes;
    update public.tenant_storage_quotas
    set used_bytes = greatest(0, used_bytes - delta),
        updated_at = timezone('utc', now())
    where tenant_id = old.tenant_id;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status <> new.status then
    if old.status <> 'active' and new.status = 'active' then
      select * into quota
      from public.tenant_storage_quotas
      where tenant_id = new.tenant_id
      for update;
      if not found or quota.used_bytes + quota.reserved_bytes + new.size_bytes > quota.limit_bytes then
        raise exception 'Tenant storage quota exceeded';
      end if;
      update public.tenant_storage_quotas
      set used_bytes = used_bytes + new.size_bytes,
          updated_at = timezone('utc', now())
      where tenant_id = new.tenant_id;
    elsif old.status = 'active' and new.status <> 'active' then
      update public.tenant_storage_quotas
      set used_bytes = greatest(0, used_bytes - old.size_bytes),
          updated_at = timezone('utc', now())
      where tenant_id = old.tenant_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists files_account_storage_usage on public.files;
create trigger files_account_storage_usage
after insert or update of status or delete on public.files
for each row execute function public.account_file_storage_usage();

-- Entity folders are named at read time. This view deliberately keeps the
-- polymorphic subject reference in one place so the frontend does not issue
-- one query per folder.
create or replace view public.file_folder_listing with (security_invoker = true) as
select
  folder.id,
  folder.tenant_id,
  folder.parent_id,
  folder.folder_type,
  folder.system_key,
  folder.subject_type,
  folder.subject_id,
  folder.name,
  folder.sort_order,
  folder.created_at,
  folder.updated_at,
  folder.deleted_at,
  coalesce(folder.name, 'Thư mục đối tượng') as display_name
from public.file_folders folder

alter table public.file_folders enable row level security;
alter table public.tenant_storage_quotas enable row level security;
alter table public.file_upload_sessions enable row level security;

drop policy if exists "Members can view file folders" on public.file_folders;
create policy "Members can view file folders"
on public.file_folders
for select to authenticated
using (public.is_tenant_member(tenant_id) and deleted_at is null);

drop policy if exists "Members can manage file folders" on public.file_folders;
create policy "Members can manage file folders"
on public.file_folders
for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists "Members can view storage quota" on public.tenant_storage_quotas;
create policy "Members can view storage quota"
on public.tenant_storage_quotas
for select to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "Tenant admins can manage storage quota" on public.tenant_storage_quotas;
create policy "Tenant admins can manage storage quota"
on public.tenant_storage_quotas
for all to authenticated
using (
  public.has_tenant_role(
    tenant_id,
    array['owner', 'admin']::public.tenant_member_role[]
  )
)
with check (
  public.has_tenant_role(
    tenant_id,
    array['owner', 'admin']::public.tenant_member_role[]
  )
);

drop policy if exists "Members can view upload sessions" on public.file_upload_sessions;
create policy "Members can view upload sessions"
on public.file_upload_sessions
for select to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "Members can manage upload sessions" on public.file_upload_sessions;
create policy "Members can manage upload sessions"
on public.file_upload_sessions
for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

grant select, insert, update, delete
  on public.file_folders, public.tenant_storage_quotas, public.file_upload_sessions
  to authenticated;

update storage.buckets
set public = false
where id = 'tenant-assets';

-- Seed the shared and custom roots. Entity folders are created lazily when
-- another supported feature links a file to a record.
create or replace function public.seed_file_manager_root_for_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.file_folders (tenant_id, name, folder_type, system_key, sort_order)
  values (new.id, 'Tệp dùng chung', 'system_root', 'shared', 10)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists tenants_seed_file_manager_root on public.tenants;
create trigger tenants_seed_file_manager_root
after insert on public.tenants
for each row execute function public.seed_file_manager_root_for_tenant();

insert into public.file_folders (tenant_id, name, folder_type, system_key, sort_order)
select tenant.id, root.name, 'system_root', root.system_key, root.sort_order
from public.tenants tenant
cross join (values
  ('Tệp dùng chung', 'shared', 10),
  ('Tệp tùy chỉnh', 'custom', 20)
) as root(name, system_key, sort_order)
on conflict do nothing;
