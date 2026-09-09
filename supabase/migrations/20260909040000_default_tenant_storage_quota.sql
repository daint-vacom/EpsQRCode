-- Every tenant starts with a 1 GiB storage allowance.
-- The trigger covers both public.create_tenant() and direct service-role inserts.
alter table public.tenant_storage_quotas
  alter column limit_bytes set default 1073741824;

create or replace function public.initialize_tenant_storage_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_storage_quotas (tenant_id)
  values (new.id)
  on conflict (tenant_id) do nothing;

  return new;
end;
$$;

drop trigger if exists tenants_initialize_storage_quota on public.tenants;
create trigger tenants_initialize_storage_quota
after insert on public.tenants
for each row execute function public.initialize_tenant_storage_quota();

insert into public.tenant_storage_quotas (tenant_id)
select tenant.id
from public.tenants tenant
on conflict (tenant_id) do nothing;
