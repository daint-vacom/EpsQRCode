-- Replace the single default account type and internal catalog code with a
-- reusable list of account types. Existing values are preserved as the first
-- default option.

drop function if exists public.list_software_account_catalogs_with_password(uuid, boolean);
drop function if exists public.save_software_account_catalog(uuid, uuid, text, text, text, text, text, text, text, integer, boolean);

alter table public.software_account_catalogs
  add column account_types jsonb not null default '[]'::jsonb;

update public.software_account_catalogs
set account_types = case
  when nullif(btrim(default_account_type), '') is null then '[]'::jsonb
  else jsonb_build_array(
    jsonb_build_object('name', btrim(default_account_type), 'isDefault', true)
  )
end;

drop index if exists public.software_account_catalogs_tenant_code_idx;
alter table public.software_account_catalogs
  drop constraint if exists software_account_catalogs_code_not_blank,
  drop column default_account_type,
  drop column code,
  add constraint software_account_catalogs_account_types_array
    check (jsonb_typeof(account_types) = 'array');

create or replace function public.list_software_account_catalogs_with_password(
  p_tenant_id uuid,
  p_include_inactive boolean default true
)
returns table (
  id uuid,
  tenant_id uuid,
  group_id uuid,
  name text,
  description text,
  default_access_url text,
  default_username text,
  account_types jsonb,
  default_password text,
  sort_order integer,
  is_active boolean,
  has_default_password boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  if auth.uid() is null
    or not public.is_tenant_member(p_tenant_id)
    or not public.has_tenant_permission(p_tenant_id, 'system:software-account-catalog:view') then
    raise exception 'Software account catalog view permission required' using errcode = '42501';
  end if;

  return query
  select
    catalog.id,
    catalog.tenant_id,
    catalog.group_id,
    catalog.name,
    catalog.description,
    catalog.default_access_url,
    catalog.default_username,
    catalog.account_types,
    coalesce(nullif(secret.decrypted_secret, ''), '') as default_password,
    catalog.sort_order,
    catalog.is_active,
    nullif(secret.decrypted_secret, '') is not null as has_default_password,
    catalog.created_at,
    catalog.updated_at
  from public.software_account_catalogs catalog
  left join public.software_account_catalog_secrets secret_link
    on secret_link.catalog_id = catalog.id
  left join vault.decrypted_secrets secret
    on secret.id = secret_link.vault_secret_id
  where catalog.tenant_id = p_tenant_id
    and (p_include_inactive or catalog.is_active)
  order by catalog.sort_order, catalog.name, catalog.id;
end;
$$;

create or replace function public.save_software_account_catalog(
  p_tenant_id uuid,
  p_catalog_id uuid,
  p_name text,
  p_description text,
  p_default_access_url text,
  p_default_username text,
  p_account_types jsonb,
  p_default_password text default null,
  p_sort_order integer default 0,
  p_is_active boolean default true
)
returns setof public.software_account_catalogs
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_catalog_id uuid;
  v_group_id uuid;
  v_old_secret_id uuid;
  v_new_secret_id uuid;
begin
  if auth.uid() is null
    or not public.is_tenant_member(p_tenant_id)
    or not public.has_tenant_permission(p_tenant_id, 'system:software-account-catalog:update')
    and not public.has_tenant_permission(p_tenant_id, 'system:software-account-catalog:create') then
    raise exception 'Software account catalog management permission required' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'Software account catalog name is required' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_account_types, '[]'::jsonb)) <> 'array' then
    raise exception 'Software account types payload must be an array' using errcode = '22023';
  end if;

  select tag_group.id
  into v_group_id
  from public.tag_groups tag_group
  where tag_group.tenant_id = p_tenant_id
    and tag_group.code = 'software-accounts'
    and tag_group.kind = 'software_account_catalog'
    and tag_group.is_active;

  if v_group_id is null then
    raise exception 'Software account catalog group not found' using errcode = 'P0002';
  end if;

  if p_catalog_id is null then
    insert into public.software_account_catalogs (
      tenant_id, group_id, name, description, default_access_url,
      default_username, account_types, sort_order, is_active,
      created_by, updated_by
    )
    values (
      p_tenant_id, v_group_id, btrim(p_name), coalesce(p_description, ''),
      coalesce(p_default_access_url, ''), coalesce(p_default_username, ''),
      coalesce(p_account_types, '[]'::jsonb), greatest(coalesce(p_sort_order, 0), 0),
      coalesce(p_is_active, true), auth.uid(), auth.uid()
    )
    returning id into v_catalog_id;
  else
    if not exists (
      select 1
      from public.software_account_catalogs catalog
      where catalog.id = p_catalog_id
        and catalog.tenant_id = p_tenant_id
    ) then
      raise exception 'Software account catalog does not belong to this tenant' using errcode = '22023';
    end if;

    update public.software_account_catalogs catalog
    set
      name = btrim(p_name),
      description = coalesce(p_description, ''),
      default_access_url = coalesce(p_default_access_url, ''),
      default_username = coalesce(p_default_username, ''),
      account_types = coalesce(p_account_types, '[]'::jsonb),
      sort_order = greatest(coalesce(p_sort_order, 0), 0),
      is_active = coalesce(p_is_active, true),
      updated_by = auth.uid()
    where catalog.id = p_catalog_id
    returning catalog.id into v_catalog_id;
  end if;

  if p_default_password is not null then
    select secret_link.vault_secret_id
    into v_old_secret_id
    from public.software_account_catalog_secrets secret_link
    where secret_link.catalog_id = v_catalog_id
    for update;

    if btrim(p_default_password) = '' then
      if v_old_secret_id is not null then
        perform vault.update_secret(
          v_old_secret_id,
          '',
          format('deleted-software-account-catalog-%s', v_catalog_id),
          'Deleted software account catalog default password'
        );
        delete from public.software_account_catalog_secrets secret_link
        where secret_link.catalog_id = v_catalog_id;
      end if;
    elsif v_old_secret_id is null then
      v_new_secret_id := vault.create_secret(
        p_default_password,
        format('software-account-catalog-%s', v_catalog_id),
        'Software account catalog default password'
      );
      insert into public.software_account_catalog_secrets (catalog_id, vault_secret_id)
      values (v_catalog_id, v_new_secret_id);
    else
      perform vault.update_secret(
        v_old_secret_id,
        p_default_password,
        format('software-account-catalog-%s', v_catalog_id),
        'Software account catalog default password'
      );
      update public.software_account_catalog_secrets secret_link
      set password_updated_at = timezone('utc', now())
      where secret_link.catalog_id = v_catalog_id;
    end if;
  end if;

  return query
  select catalog.*
  from public.software_account_catalogs catalog
  where catalog.id = v_catalog_id;
end;
$$;

revoke all on function public.list_software_account_catalogs_with_password(uuid, boolean)
  from public, anon;
revoke all on function public.save_software_account_catalog(uuid, uuid, text, text, text, text, jsonb, text, integer, boolean)
  from public, anon;
grant execute on function public.list_software_account_catalogs_with_password(uuid, boolean) to authenticated;
grant execute on function public.save_software_account_catalog(uuid, uuid, text, text, text, text, jsonb, text, integer, boolean) to authenticated;
