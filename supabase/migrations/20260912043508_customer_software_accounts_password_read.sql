-- Passwords remain isolated in Supabase Vault. This RPC is the only read path
-- that returns the decrypted value, and it requires the sensitive reveal
-- permission in addition to the regular software-account view permission.
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
    and public.has_tenant_permission(
      account.tenant_id,
      'customers:software-account:reveal-secret'
    )
  order by account.sort_order, account.id;
$$;

revoke all on function public.list_customer_software_accounts_with_password(uuid)
from public, anon;
grant execute on function public.list_customer_software_accounts_with_password(uuid)
to authenticated;

comment on function public.list_customer_software_accounts_with_password(uuid) is
  'Returns customer software-account passwords only to authenticated tenant members with the sensitive reveal permission.';

notify pgrst, 'reload schema';
