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
  v_account_item jsonb;
  v_account_id uuid;
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
    or not public.has_tenant_permission(
      v_account_tenant_id,
      'customers:software-account:manage'
    ) then
    raise exception 'Software account management permission required'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Software accounts payload must be an array'
      using errcode = '22023';
  end if;

  for v_account_item in
    select value
    from jsonb_array_elements(p_rows)
  loop
    v_row_index := v_row_index + 1;
    v_account_id := null;

    if nullif(v_account_item->>'softwareName', '') is null then
      raise exception 'Software name is required' using errcode = '22023';
    end if;

    if nullif(v_account_item->>'id', '') is not null then
      v_account_id := (v_account_item->>'id')::uuid;

      if not exists (
        select 1
        from public.customer_software_accounts existing_account
        where existing_account.id = v_account_id
          and existing_account.tenant_id = v_account_tenant_id
          and existing_account.customer_id = p_customer_id
      ) then
        raise exception 'Software account does not belong to this customer'
          using errcode = '22023';
      end if;

      update public.customer_software_accounts existing_account
      set
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
        v_account_tenant_id,
        p_customer_id,
        btrim(v_account_item->>'softwareName'),
        coalesce(v_account_item->>'accessUrl', ''),
        coalesce(v_account_item->>'username', ''),
        coalesce(v_account_item->>'accountType', ''),
        nullif(v_account_item->>'expiresAt', '')::date,
        v_row_index - 1,
        auth.uid(),
        auth.uid()
      )
      returning customer_software_accounts.id
      into v_account_id;
    end if;

    v_incoming_ids := array_append(v_incoming_ids, v_account_id);
    v_password_value := v_account_item->>'password';

    if v_password_value is not null and v_password_value <> '' then
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

        insert into public.customer_software_account_secrets (
          account_id,
          vault_secret_id
        )
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
      v_vault_secret_id,
      '',
      format('deleted-customer-software-account-%s', v_vault_secret_id),
      'Deleted customer software account password'
    );
  end loop;

  delete from public.customer_software_accounts existing_account
  where existing_account.tenant_id = v_account_tenant_id
    and existing_account.customer_id = p_customer_id
    and not (existing_account.id = any(v_incoming_ids));

  return query
  select *
  from public.list_customer_software_accounts(p_customer_id);
end;
$$;

notify pgrst, 'reload schema';
