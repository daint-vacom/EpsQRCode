-- Tài khoản phần mềm là một nhóm trong Danh mục nhưng có catalog dữ liệu riêng.
-- Mật khẩu mặc định không lưu plaintext trong bảng nghiệp vụ; chỉ lưu liên kết tới Vault.

alter table public.tag_groups
  add column if not exists kind text not null default 'tag';

alter table public.tag_groups
  drop constraint if exists tag_groups_kind_check;

alter table public.tag_groups
  add constraint tag_groups_kind_check check (
    kind in ('tag', 'software_account_catalog')
  );

create index if not exists tag_groups_kind_idx
  on public.tag_groups(tenant_id, kind, is_active, sort_order, name);

create or replace function public.seed_system_tag_groups_for_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.tag_groups (
    tenant_id, code, name, description, module_code, is_system, kind, sort_order
  )
  values
    (
      new.id, 'employees', 'Nhóm nhân viên',
      'Nhóm hệ thống dành cho các nhãn phân loại nhân viên.',
      'organization', true, 'tag', 5
    ),
    (
      new.id, 'customers', 'Nhóm khách hàng',
      'Nhóm hệ thống dành cho các nhãn phân loại khách hàng.',
      'customers', true, 'tag', 6
    ),
    (
      new.id, 'contracts', 'Nhóm hợp đồng',
      'Nhóm hệ thống dành cho các nhãn phân loại hợp đồng.',
      'contracts', true, 'tag', 7
    ),
    (
      new.id, 'software-accounts', 'Tài khoản phần mềm',
      'Danh mục tài khoản phần mềm mặc định có thể tái sử dụng cho khách hàng.',
      'system', true, 'software_account_catalog', 40
    )
  on conflict (tenant_id, code) do nothing;

  return new;
end;
$$;

insert into public.tag_groups (
  tenant_id, code, name, description, module_code, is_system, kind, sort_order
)
select
  tenant.id,
  'software-accounts',
  'Tài khoản phần mềm',
  'Danh mục tài khoản phần mềm mặc định có thể tái sử dụng cho khách hàng.',
  'system',
  true,
  'software_account_catalog',
  40
from public.tenants tenant
on conflict (tenant_id, code) do update set
  name = excluded.name,
  description = excluded.description,
  module_code = excluded.module_code,
  is_system = true,
  kind = 'software_account_catalog',
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.permission_groups (
  module_code, code, name, description, sort_order, is_active
)
values (
  'system',
  'software-account-catalog',
  'Tài khoản phần mềm',
  'Quản lý các tài khoản phần mềm mặc định dùng lại khi cấp cho khách hàng.',
  40,
  true
)
on conflict (module_code, code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.permission_definitions (
  code, module_code, group_name, group_id, name, action,
  sensitive, sort_order, tags, is_active
)
select
  seed.code,
  'system',
  'Tài khoản phần mềm',
  permission_group.id,
  seed.name,
  seed.action,
  false,
  seed.sort_order,
  seed.tags,
  true
from public.permission_groups permission_group
cross join (
  values
    ('system:software-account-catalog:view', 'Xem danh mục tài khoản phần mềm', 'view', 10, array['Xem']::text[]),
    ('system:software-account-catalog:create', 'Thêm tài khoản phần mềm mặc định', 'create', 20, array['Chỉnh sửa']::text[]),
    ('system:software-account-catalog:update', 'Chỉnh sửa tài khoản phần mềm mặc định', 'update', 30, array['Chỉnh sửa']::text[]),
    ('system:software-account-catalog:delete', 'Xóa tài khoản phần mềm mặc định', 'delete', 40, array['Xóa']::text[])
) as seed(code, name, action, sort_order, tags)
where permission_group.module_code = 'system'
  and permission_group.code = 'software-account-catalog'
on conflict (code) do update set
  module_code = excluded.module_code,
  group_name = excluded.group_name,
  group_id = excluded.group_id,
  name = excluded.name,
  action = excluded.action,
  sensitive = excluded.sensitive,
  sort_order = excluded.sort_order,
  tags = excluded.tags,
  is_active = true;

insert into public.role_permissions (role_id, permission_code)
select role_record.id, definition.code
from public.roles role_record
cross join public.permission_definitions definition
where role_record.code in ('admin', 'manager')
  and definition.module_code = 'system'
  and definition.group_id = (
    select permission_group.id
    from public.permission_groups permission_group
    where permission_group.module_code = 'system'
      and permission_group.code = 'software-account-catalog'
  )
  and definition.is_active
on conflict do nothing;

create table public.software_account_catalogs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid not null references public.tag_groups(id) on delete restrict,
  code text not null,
  name text not null,
  description text not null default '',
  default_access_url text not null default '',
  default_username text not null default '',
  default_account_type text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint software_account_catalogs_code_not_blank check (length(btrim(code)) > 0),
  constraint software_account_catalogs_name_not_blank check (length(btrim(name)) > 0),
  constraint software_account_catalogs_sort_order_check check (sort_order >= 0),
  constraint software_account_catalogs_url_format check (
    default_access_url = '' or default_access_url ~* '^https?://'
  ),
  constraint software_account_catalogs_group_tenant_fkey
    foreign key (tenant_id, group_id)
    references public.tag_groups(tenant_id, id)
);

create unique index software_account_catalogs_tenant_code_idx
  on public.software_account_catalogs(tenant_id, code);
create unique index software_account_catalogs_tenant_name_ci_idx
  on public.software_account_catalogs(tenant_id, lower(name));
create index software_account_catalogs_tenant_order_idx
  on public.software_account_catalogs(tenant_id, is_active, sort_order, name);

create trigger software_account_catalogs_set_updated_at
before update on public.software_account_catalogs
for each row execute function public.set_updated_at();

create table public.software_account_catalog_secrets (
  catalog_id uuid primary key references public.software_account_catalogs(id) on delete cascade,
  vault_secret_id uuid not null,
  password_updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger software_account_catalog_secrets_set_updated_at
before update on public.software_account_catalog_secrets
for each row execute function public.set_updated_at();

alter table public.software_account_catalogs enable row level security;
alter table public.software_account_catalog_secrets enable row level security;
revoke all on public.software_account_catalogs from public, anon, authenticated;
revoke all on public.software_account_catalog_secrets from public, anon, authenticated;

alter table public.customer_software_accounts
  add column if not exists catalog_id uuid references public.software_account_catalogs(id) on delete set null;

create index if not exists customer_software_accounts_catalog_idx
  on public.customer_software_accounts(catalog_id);

create or replace function public.list_software_account_catalogs_with_password(
  p_tenant_id uuid,
  p_include_inactive boolean default true
)
returns table (
  id uuid,
  tenant_id uuid,
  group_id uuid,
  code text,
  name text,
  description text,
  default_access_url text,
  default_username text,
  default_password text,
  default_account_type text,
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
    catalog.code,
    catalog.name,
    catalog.description,
    catalog.default_access_url,
    catalog.default_username,
    coalesce(nullif(secret.decrypted_secret, ''), '') as default_password,
    catalog.default_account_type,
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
  p_code text,
  p_name text,
  p_description text,
  p_default_access_url text,
  p_default_username text,
  p_default_password text default null,
  p_default_account_type text default '',
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

  if nullif(btrim(p_code), '') is null or nullif(btrim(p_name), '') is null then
    raise exception 'Software account catalog code and name are required' using errcode = '22023';
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
      tenant_id, group_id, code, name, description, default_access_url,
      default_username, default_account_type, sort_order, is_active,
      created_by, updated_by
    )
    values (
      p_tenant_id, v_group_id, btrim(p_code), btrim(p_name), coalesce(p_description, ''),
      coalesce(p_default_access_url, ''), coalesce(p_default_username, ''),
      coalesce(p_default_account_type, ''), greatest(coalesce(p_sort_order, 0), 0),
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
      code = btrim(p_code),
      name = btrim(p_name),
      description = coalesce(p_description, ''),
      default_access_url = coalesce(p_default_access_url, ''),
      default_username = coalesce(p_default_username, ''),
      default_account_type = coalesce(p_default_account_type, ''),
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

create or replace function public.delete_software_account_catalog(p_catalog_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_tenant_id uuid;
  v_secret_id uuid;
begin
  select catalog.tenant_id
  into v_tenant_id
  from public.software_account_catalogs catalog
  where catalog.id = p_catalog_id;

  if v_tenant_id is null then
    raise exception 'Software account catalog not found' using errcode = 'P0002';
  end if;

  if auth.uid() is null
    or not public.is_tenant_member(v_tenant_id)
    or not public.has_tenant_permission(v_tenant_id, 'system:software-account-catalog:delete') then
    raise exception 'Software account catalog delete permission required' using errcode = '42501';
  end if;

  select secret_link.vault_secret_id
  into v_secret_id
  from public.software_account_catalog_secrets secret_link
  where secret_link.catalog_id = p_catalog_id;

  if v_secret_id is not null then
    perform vault.update_secret(
      v_secret_id,
      '',
      format('deleted-software-account-catalog-%s', p_catalog_id),
      'Deleted software account catalog default password'
    );
  end if;

  delete from public.software_account_catalogs catalog
  where catalog.id = p_catalog_id;
end;
$$;

create or replace function public.reorder_software_account_catalogs(
  p_tenant_id uuid,
  p_catalog_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_index integer;
begin
  if auth.uid() is null
    or not public.is_tenant_member(p_tenant_id)
    or not public.has_tenant_permission(p_tenant_id, 'system:software-account-catalog:update') then
    raise exception 'Software account catalog update permission required' using errcode = '42501';
  end if;

  for v_index in 1..coalesce(array_length(p_catalog_ids, 1), 0) loop
    update public.software_account_catalogs catalog
    set sort_order = v_index - 1, updated_by = auth.uid()
    where catalog.id = p_catalog_ids[v_index]
      and catalog.tenant_id = p_tenant_id;
  end loop;
end;
$$;

revoke all on function public.list_software_account_catalogs_with_password(uuid, boolean)
  from public, anon;
revoke all on function public.save_software_account_catalog(uuid, uuid, text, text, text, text, text, text, text, integer, boolean)
  from public, anon;
revoke all on function public.delete_software_account_catalog(uuid) from public, anon;
revoke all on function public.reorder_software_account_catalogs(uuid, uuid[]) from public, anon;
grant execute on function public.list_software_account_catalogs_with_password(uuid, boolean) to authenticated;
grant execute on function public.save_software_account_catalog(uuid, uuid, text, text, text, text, text, text, text, integer, boolean) to authenticated;
grant execute on function public.delete_software_account_catalog(uuid) to authenticated;
grant execute on function public.reorder_software_account_catalogs(uuid, uuid[]) to authenticated;

-- The existing RPC return shapes do not include catalog_id. PostgreSQL cannot
-- change OUT columns with CREATE OR REPLACE, so replace the three signatures.
drop function if exists public.replace_customer_software_accounts(uuid, jsonb);
drop function if exists public.list_customer_software_accounts_with_password(uuid);
drop function if exists public.list_customer_software_accounts(uuid);

create or replace function public.list_customer_software_accounts(p_customer_id uuid)
returns table (
  id uuid,
  tenant_id uuid,
  customer_id uuid,
  catalog_id uuid,
  software_name text,
  access_url text,
  username text,
  account_type text,
  expires_at date,
  sort_order integer,
  has_password boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, vault
as $$
  select
    account.id,
    account.tenant_id,
    account.customer_id,
    account.catalog_id,
    account.software_name,
    account.access_url,
    account.username,
    account.account_type,
    account.expires_at,
    account.sort_order,
    nullif(secret.decrypted_secret, '') is not null as has_password,
    account.created_at,
    account.updated_at
  from public.customer_software_accounts account
  left join public.customer_software_account_secrets secret_link
    on secret_link.account_id = account.id
  left join vault.decrypted_secrets secret
    on secret.id = secret_link.vault_secret_id
  where account.customer_id = p_customer_id
    and public.is_tenant_member(account.tenant_id)
    and public.has_tenant_permission(account.tenant_id, 'customers:software-account:view')
  order by account.sort_order, account.id;
$$;

create or replace function public.list_customer_software_accounts_with_password(p_customer_id uuid)
returns table (
  id uuid,
  tenant_id uuid,
  customer_id uuid,
  catalog_id uuid,
  software_name text,
  access_url text,
  username text,
  password text,
  account_type text,
  expires_at date,
  sort_order integer,
  has_password boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, vault
as $$
  select
    account.id,
    account.tenant_id,
    account.customer_id,
    account.catalog_id,
    account.software_name,
    account.access_url,
    account.username,
    coalesce(nullif(secret.decrypted_secret, ''), '') as password,
    account.account_type,
    account.expires_at,
    account.sort_order,
    nullif(secret.decrypted_secret, '') is not null as has_password,
    account.created_at,
    account.updated_at
  from public.customer_software_accounts account
  left join public.customer_software_account_secrets secret_link
    on secret_link.account_id = account.id
  left join vault.decrypted_secrets secret
    on secret.id = secret_link.vault_secret_id
  where account.customer_id = p_customer_id
    and public.is_tenant_member(account.tenant_id)
    and public.has_tenant_permission(account.tenant_id, 'customers:software-account:view')
  order by account.sort_order, account.id;
$$;

create or replace function public.replace_customer_software_accounts(
  p_customer_id uuid,
  p_rows jsonb
)
returns table (
  id uuid,
  tenant_id uuid,
  customer_id uuid,
  catalog_id uuid,
  software_name text,
  access_url text,
  username text,
  account_type text,
  expires_at date,
  sort_order integer,
  has_password boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_account_item jsonb;
  v_account_id uuid;
  v_catalog_id uuid;
  v_account_tenant_id uuid;
  v_incoming_ids uuid[] := '{}'::uuid[];
  v_row_index integer := 0;
  v_password_value text;
  v_vault_secret_id uuid;
  v_old_vault_secret_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select customer.tenant_id
  into v_account_tenant_id
  from public.customers customer
  where customer.id = p_customer_id;

  if v_account_tenant_id is null then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;

  if not public.is_tenant_member(v_account_tenant_id)
    or not public.has_tenant_permission(v_account_tenant_id, 'customers:software-account:manage') then
    raise exception 'Software account management permission required' using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Software accounts payload must be an array' using errcode = '22023';
  end if;

  for v_account_item in select value from jsonb_array_elements(p_rows) loop
    v_row_index := v_row_index + 1;
    v_account_id := null;
    v_catalog_id := nullif(v_account_item->>'catalogId', '')::uuid;

    if v_catalog_id is not null then
      if not exists (
        select 1
        from public.software_account_catalogs catalog
        where catalog.id = v_catalog_id
          and catalog.tenant_id = v_account_tenant_id
      ) then
        raise exception 'Software account catalog does not belong to this tenant' using errcode = '22023';
      end if;
    end if;

    if nullif(v_account_item->>'softwareName', '') is null then
      raise exception 'Software name is required' using errcode = '22023';
    end if;

    if nullif(v_account_item->>'id', '') is not null then
      v_account_id := (v_account_item->>'id')::uuid;
      if not exists (
        select 1 from public.customer_software_accounts existing_account
        where existing_account.id = v_account_id
          and existing_account.tenant_id = v_account_tenant_id
          and existing_account.customer_id = p_customer_id
      ) then
        raise exception 'Software account does not belong to this customer' using errcode = '22023';
      end if;

      update public.customer_software_accounts existing_account
      set
        catalog_id = v_catalog_id,
        software_name = btrim(v_account_item->>'softwareName'),
        access_url = coalesce(v_account_item->>'accessUrl', ''),
        username = coalesce(v_account_item->>'username', ''),
        account_type = coalesce(v_account_item->>'accountType', ''),
        expires_at = nullif(v_account_item->>'expiresAt', '')::date,
        sort_order = v_row_index - 1,
        updated_by = auth.uid()
      where existing_account.id = v_account_id;
    else
      insert into public.customer_software_accounts (
        tenant_id, customer_id, catalog_id, software_name, access_url, username,
        account_type, expires_at, sort_order, created_by, updated_by
      )
      values (
        v_account_tenant_id, p_customer_id, v_catalog_id,
        btrim(v_account_item->>'softwareName'), coalesce(v_account_item->>'accessUrl', ''),
        coalesce(v_account_item->>'username', ''), coalesce(v_account_item->>'accountType', ''),
        nullif(v_account_item->>'expiresAt', '')::date, v_row_index - 1,
        auth.uid(), auth.uid()
      )
      returning customer_software_accounts.id into v_account_id;
    end if;

    v_incoming_ids := array_append(v_incoming_ids, v_account_id);
    v_password_value := nullif(v_account_item->>'password', '');

    if v_password_value is null and v_catalog_id is not null then
      select nullif(secret.decrypted_secret, '')
      into v_password_value
      from public.software_account_catalog_secrets secret_link
      left join vault.decrypted_secrets secret
        on secret.id = secret_link.vault_secret_id
      where secret_link.catalog_id = v_catalog_id;
    end if;

    if v_password_value is not null then
      select secret_link.vault_secret_id
      into v_old_vault_secret_id
      from public.customer_software_account_secrets secret_link
      where secret_link.account_id = v_account_id
      for update;

      if v_old_vault_secret_id is null then
        v_vault_secret_id := vault.create_secret(
          v_password_value,
          format('customer-software-account-%s', v_account_id),
          'Customer software account password'
        );
        insert into public.customer_software_account_secrets (account_id, vault_secret_id)
        values (v_account_id, v_vault_secret_id);
      else
        perform vault.update_secret(
          v_old_vault_secret_id,
          v_password_value,
          format('customer-software-account-%s', v_account_id),
          'Customer software account password'
        );
        update public.customer_software_account_secrets secret_link
        set password_updated_at = timezone('utc', now())
        where secret_link.account_id = v_account_id;
      end if;
    end if;
  end loop;

  for v_vault_secret_id in
    select secret_link.vault_secret_id
    from public.customer_software_account_secrets secret_link
    join public.customer_software_accounts existing_account
      on existing_account.id = secret_link.account_id
    where existing_account.tenant_id = v_account_tenant_id
      and existing_account.customer_id = p_customer_id
      and not (existing_account.id = any(v_incoming_ids))
  loop
    perform vault.update_secret(
      v_vault_secret_id, '',
      format('deleted-customer-software-account-%s', v_vault_secret_id),
      'Deleted customer software account password'
    );
  end loop;

  delete from public.customer_software_accounts existing_account
  where existing_account.tenant_id = v_account_tenant_id
    and existing_account.customer_id = p_customer_id
    and not (existing_account.id = any(v_incoming_ids));

  return query select * from public.list_customer_software_accounts(p_customer_id);
end;
$$;

revoke all on function public.list_customer_software_accounts(uuid) from public, anon;
revoke all on function public.list_customer_software_accounts_with_password(uuid) from public, anon;
revoke all on function public.replace_customer_software_accounts(uuid, jsonb) from public, anon;
grant execute on function public.list_customer_software_accounts(uuid) to authenticated;
grant execute on function public.list_customer_software_accounts_with_password(uuid) to authenticated;
grant execute on function public.replace_customer_software_accounts(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
