-- Root is a valid file location. Custom folders are optional and can be
-- created directly under the tenant root instead of under a seeded container.
alter table public.file_upload_sessions
  alter column folder_id drop not null;

do $$
declare
  custom_root record;
begin
  for custom_root in
    select id, tenant_id
    from public.file_folders
    where folder_type = 'system_root'
      and system_key = 'custom'
      and deleted_at is null
  loop
    -- Preserve existing data when removing the legacy "Tệp tùy chỉnh" root.
    update public.file_folders
    set parent_id = null,
        updated_at = timezone('utc', now())
    where tenant_id = custom_root.tenant_id
      and parent_id = custom_root.id;

    update public.files
    set folder_id = null
    where tenant_id = custom_root.tenant_id
      and folder_id = custom_root.id;

    update public.file_upload_sessions
    set folder_id = null
    where tenant_id = custom_root.tenant_id
      and folder_id = custom_root.id;

    delete from public.file_folders
    where tenant_id = custom_root.tenant_id
      and id = custom_root.id;
  end loop;
end;
$$;
