-- Passwords are readable by authenticated tenant members who can view the
-- customer's software accounts. A separate reveal permission is intentionally
-- not required yet; the business rule can be tightened in a later migration.
create or replace function public.list_customer_software_accounts_with_password(
  p_customer_id uuid
)
returns table (
  id uuid,
  tenant_id uuid,
  customer_id uuid,
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
    and public.has_tenant_permission(
      account.tenant_id,
      'customers:software-account:view'
    )
  order by account.sort_order, account.id;
$$;

comment on function public.list_customer_software_accounts_with_password(uuid) is
  'Returns customer software-account passwords to authenticated tenant members with software-account view permission.';

notify pgrst, 'reload schema';
