-- Customer software accounts are relational data rather than custom JSON data.
-- Passwords are stored through Supabase Vault and never exposed by the public
-- account table or returned by the list/replace RPCs.

create table public.customer_software_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  software_name text not null,
  access_url text not null default '',
  username text not null default '',
  account_type text not null default '',
  expires_at date,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint customer_software_accounts_name_not_blank
    check (length(btrim(software_name)) > 0),
  constraint customer_software_accounts_sort_order_check
    check (sort_order >= 0)
);

create index customer_software_accounts_customer_order_idx
  on public.customer_software_accounts(tenant_id, customer_id, sort_order, id);

create trigger customer_software_accounts_set_updated_at
before update on public.customer_software_accounts
for each row execute function public.set_updated_at();

create table public.customer_software_account_secrets (
  account_id uuid primary key
    references public.customer_software_accounts(id) on delete cascade,
  vault_secret_id uuid not null,
  password_updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger customer_software_account_secrets_set_updated_at
before update on public.customer_software_account_secrets
for each row execute function public.set_updated_at();

alter table public.customer_software_accounts enable row level security;
alter table public.customer_software_account_secrets enable row level security;

grant select on public.customer_software_accounts to authenticated;
revoke insert, update, delete on public.customer_software_accounts from authenticated;
revoke all on public.customer_software_account_secrets from public, anon, authenticated;

create policy "Members with customer account view can view software accounts"
on public.customer_software_accounts
for select to authenticated
using (
  public.is_tenant_member(tenant_id)
  and public.has_tenant_permission(tenant_id, 'customers:software-account:view')
);

insert into public.permission_definitions (
  code,
  module_code,
  group_name,
  group_id,
  name,
  action,
  sensitive,
  sort_order,
  tags,
  is_active
)
select
  seed.code,
  'customers',
  'Khách hàng',
  permission_group.id,
  seed.name,
  seed.action,
  seed.sensitive,
  seed.sort_order,
  seed.tags,
  true
from public.permission_groups permission_group
cross join (
  values
    (
      'customers:software-account:view',
      'Xem tài khoản phần mềm khách hàng',
      'view',
      false,
      60,
      array['Xem']::text[]
    ),
    (
      'customers:software-account:manage',
      'Quản lý tài khoản phần mềm khách hàng',
      'update',
      true,
      70,
      array['Chỉnh sửa']::text[]
    ),
    (
      'customers:software-account:reveal-secret',
      'Xem mật khẩu tài khoản phần mềm khách hàng',
      'view',
      true,
      80,
      array['Xem dữ liệu nhạy cảm']::text[]
    )
) as seed(code, name, action, sensitive, sort_order, tags)
where permission_group.module_code = 'customers'
  and permission_group.code = 'customers'
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
where role_record.code = 'admin'
  and definition.code in (
    'customers:software-account:view',
    'customers:software-account:manage',
    'customers:software-account:reveal-secret'
  )
on conflict do nothing;

create or replace function public.list_customer_software_accounts(
  p_customer_id uuid
)
returns table (
  id uuid,
  tenant_id uuid,
  customer_id uuid,
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
    account.software_name,
    account.access_url,
    account.username,
    account.account_type,
    account.expires_at,
    account.sort_order,
    exists (
      select 1
      from public.customer_software_account_secrets secret_link
      join vault.decrypted_secrets secret
        on secret.id = secret_link.vault_secret_id
      where secret_link.account_id = account.id
        and nullif(secret.decrypted_secret, '') is not null
    ) as has_password,
    account.created_at,
    account.updated_at
  from public.customer_software_accounts account
  where account.customer_id = p_customer_id
    and public.is_tenant_member(account.tenant_id)
    and public.has_tenant_permission(
      account.tenant_id,
      'customers:software-account:view'
    )
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
  account_item jsonb;
  account_id uuid;
  account_tenant_id uuid;
  incoming_ids uuid[] := '{}'::uuid[];
  row_index integer := 0;
  password_value text;
  vault_secret_id uuid;
  old_vault_secret_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select customer.tenant_id
  into account_tenant_id
  from public.customers customer
  where customer.id = p_customer_id;

  if account_tenant_id is null then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;

  if not public.is_tenant_member(account_tenant_id)
    or not public.has_tenant_permission(
      account_tenant_id,
      'customers:software-account:manage'
    ) then
    raise exception 'Software account management permission required'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Software accounts payload must be an array'
      using errcode = '22023';
  end if;

  for account_item in
    select value
    from jsonb_array_elements(p_rows)
  loop
    row_index := row_index + 1;
    account_id := null;

    if nullif(account_item->>'softwareName', '') is null then
      raise exception 'Software name is required' using errcode = '22023';
    end if;

    if nullif(account_item->>'id', '') is not null then
      account_id := (account_item->>'id')::uuid;

      if not exists (
        select 1
        from public.customer_software_accounts account
        where account.id = account_id
          and account.tenant_id = account_tenant_id
          and account.customer_id = p_customer_id
      ) then
        raise exception 'Software account does not belong to this customer'
          using errcode = '22023';
      end if;

      update public.customer_software_accounts account
      set
        software_name = btrim(account_item->>'softwareName'),
        access_url = coalesce(account_item->>'accessUrl', ''),
        username = coalesce(account_item->>'username', ''),
        account_type = coalesce(account_item->>'accountType', ''),
        expires_at = nullif(account_item->>'expiresAt', '')::date,
        sort_order = row_index - 1,
        updated_by = auth.uid()
      where account.id = account_id;
    else
      insert into public.customer_software_accounts (
        tenant_id,
        customer_id,
        software_name,
        access_url,
        username,
        account_type,
        expires_at,
        sort_order,
        created_by,
        updated_by
      )
      values (
        account_tenant_id,
        p_customer_id,
        btrim(account_item->>'softwareName'),
        coalesce(account_item->>'accessUrl', ''),
        coalesce(account_item->>'username', ''),
        coalesce(account_item->>'accountType', ''),
        nullif(account_item->>'expiresAt', '')::date,
        row_index - 1,
        auth.uid(),
        auth.uid()
      )
      returning customer_software_accounts.id
      into account_id;
    end if;

    incoming_ids := array_append(incoming_ids, account_id);
    password_value := account_item->>'password';

    if password_value is not null and password_value <> '' then
      select secret_link.vault_secret_id
      into old_vault_secret_id
      from public.customer_software_account_secrets secret_link
      where secret_link.account_id = account_id
      for update;

      if old_vault_secret_id is null then
        vault_secret_id := vault.create_secret(
          password_value,
          format('customer-software-account-%s', account_id),
          'Customer software account password'
        );

        insert into public.customer_software_account_secrets (
          account_id,
          vault_secret_id
        )
        values (account_id, vault_secret_id);
      else
        perform vault.update_secret(
          old_vault_secret_id,
          password_value,
          format('customer-software-account-%s', account_id),
          'Customer software account password'
        );

        update public.customer_software_account_secrets secret_link
        set password_updated_at = timezone('utc', now())
        where secret_link.account_id = account_id;
      end if;
    end if;
  end loop;

  for vault_secret_id in
    select secret_link.vault_secret_id
    from public.customer_software_account_secrets secret_link
    join public.customer_software_accounts account
      on account.id = secret_link.account_id
    where account.tenant_id = account_tenant_id
      and account.customer_id = p_customer_id
      and not (account.id = any(incoming_ids))
  loop
    perform vault.update_secret(
      vault_secret_id,
      '',
      format('deleted-customer-software-account-%s', vault_secret_id),
      'Deleted customer software account password'
    );
  end loop;

  delete from public.customer_software_accounts account
  where account.tenant_id = account_tenant_id
    and account.customer_id = p_customer_id
    and not (account.id = any(incoming_ids));

  return query
  select *
  from public.list_customer_software_accounts(p_customer_id);
end;
$$;

revoke all on function public.list_customer_software_accounts(uuid)
from public, anon;
revoke all on function public.replace_customer_software_accounts(uuid, jsonb)
from public, anon;
grant execute on function public.list_customer_software_accounts(uuid)
to authenticated;
grant execute on function public.replace_customer_software_accounts(uuid, jsonb)
to authenticated;

comment on table public.customer_software_accounts is
  'Non-secret software account metadata associated with a customer.';
comment on table public.customer_software_account_secrets is
  'Private links from customer software accounts to Supabase Vault secrets.';
comment on column public.customer_software_accounts.sort_order is
  'Zero-based display order within one customer.';

notify pgrst, 'reload schema';
