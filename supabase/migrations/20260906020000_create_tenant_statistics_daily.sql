-- Store one end-of-day snapshot per tenant. Each domain owns its JSONB object so
-- adding a new domain does not require another statistics table.

create table public.tenant_statistics_daily (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  snapshot_date date not null,
  captured_at timestamptz not null default timezone('utc', now()),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  schema_version smallint not null default 1,
  customers jsonb not null default '{}'::jsonb,
  contracts jsonb not null default '{}'::jsonb,
  employees jsonb not null default '{}'::jsonb,
  primary key (tenant_id, snapshot_date),
  constraint tenant_statistics_daily_timezone_not_blank check (length(btrim(timezone)) > 0),
  constraint tenant_statistics_daily_schema_version_positive check (schema_version > 0),
  constraint tenant_statistics_daily_customers_object check (jsonb_typeof(customers) = 'object'),
  constraint tenant_statistics_daily_contracts_object check (jsonb_typeof(contracts) = 'object'),
  constraint tenant_statistics_daily_employees_object check (jsonb_typeof(employees) = 'object')
);

comment on table public.tenant_statistics_daily is
  'Daily tenant KPI snapshots. JSONB is separated by domain to keep one row per tenant and day.';
comment on column public.tenant_statistics_daily.snapshot_date is
  'Business date in the stored timezone. The scheduled capture writes the previous local day at 00:05.';

alter table public.tenant_statistics_daily enable row level security;
revoke all on table public.tenant_statistics_daily from public, anon, authenticated;

-- This helper is intentionally not exposed to API clients. It is used by the
-- authenticated wrapper and the scheduled all-tenant capture function.
create or replace function public._capture_tenant_statistics_daily(
  p_tenant_id uuid,
  p_snapshot_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customers jsonb;
  v_contracts jsonb;
  v_employees jsonb;
  v_result jsonb;
begin
  if p_tenant_id is null or p_snapshot_date is null then
    raise exception 'Tenant and snapshot date are required' using errcode = '22004';
  end if;

  select jsonb_build_object(
    'total', count(*)::integer,
    'active', count(*) filter (where status = 'active')::integer,
    'inactive', count(*) filter (where status = 'inactive')::integer,
    'uncontacted', count(*) filter (where status = 'uncontacted')::integer
  )
  into v_customers
  from public.customers
  where tenant_id = p_tenant_id;

  select jsonb_build_object(
    'total', count(*)::integer,
    'draft', count(*) filter (where status = 'draft')::integer,
    'active', count(*) filter (where status = 'active')::integer,
    'suspended', count(*) filter (where status = 'suspended')::integer,
    'expired', count(*) filter (where status = 'expired')::integer,
    'terminated', count(*) filter (where status = 'terminated')::integer
  )
  into v_contracts
  from public.contracts
  where tenant_id = p_tenant_id;

  select jsonb_build_object(
    'total', count(*)::integer,
    'active', count(*) filter (where status = 'active')::integer,
    'inactive', count(*) filter (where status = 'inactive')::integer
  )
  into v_employees
  from public.employees
  where tenant_id = p_tenant_id;

  insert into public.tenant_statistics_daily (
    tenant_id,
    snapshot_date,
    captured_at,
    customers,
    contracts,
    employees
  )
  values (
    p_tenant_id,
    p_snapshot_date,
    timezone('utc', now()),
    v_customers,
    v_contracts,
    v_employees
  )
  on conflict (tenant_id, snapshot_date) do update
  set captured_at = excluded.captured_at,
      customers = excluded.customers,
      contracts = excluded.contracts,
      employees = excluded.employees;

  select jsonb_build_object(
    'tenantId', tenant_id,
    'snapshotDate', snapshot_date,
    'capturedAt', captured_at,
    'timezone', timezone,
    'schemaVersion', schema_version,
    'customers', customers,
    'contracts', contracts,
    'employees', employees
  )
  into v_result
  from public.tenant_statistics_daily
  where tenant_id = p_tenant_id
    and snapshot_date = p_snapshot_date;

  return v_result;
end;
$$;

revoke execute on function public._capture_tenant_statistics_daily(uuid, date)
  from public, anon, authenticated;

-- Manual capture is permission-gated because the single row contains metrics
-- for all currently supported domains.
create or replace function public.capture_tenant_statistics_daily(
  p_tenant_id uuid,
  p_snapshot_date date default (timezone('Asia/Ho_Chi_Minh', now())::date - 1)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.has_tenant_permission(p_tenant_id, 'customers:view')
    or not public.has_tenant_permission(p_tenant_id, 'contracts:view')
    or not public.has_tenant_permission(p_tenant_id, 'organization:employee:view')
  then
    raise exception 'Statistics view permission required' using errcode = '42501';
  end if;

  return public._capture_tenant_statistics_daily(p_tenant_id, p_snapshot_date);
end;
$$;

revoke execute on function public.capture_tenant_statistics_daily(uuid, date)
  from public, anon;
grant execute on function public.capture_tenant_statistics_daily(uuid, date)
  to authenticated;

-- The scheduler runs once after midnight in the product timezone and records
-- the completed previous local day. Re-running the same date is idempotent.
create or replace function public.capture_all_tenant_statistics_daily(
  p_snapshot_date date default (timezone('Asia/Ho_Chi_Minh', now())::date - 1)
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant record;
  v_captured integer := 0;
begin
  if p_snapshot_date is null then
    raise exception 'Snapshot date is required' using errcode = '22004';
  end if;

  for v_tenant in
    select tenant.id
    from public.tenants tenant
    where tenant.status = 'active'
    order by tenant.id
  loop
    perform public._capture_tenant_statistics_daily(v_tenant.id, p_snapshot_date);
    v_captured := v_captured + 1;
  end loop;

  return v_captured;
end;
$$;

revoke execute on function public.capture_all_tenant_statistics_daily(date)
  from public, anon, authenticated;

create extension if not exists pg_cron;

do $schedule$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'tenant-statistics-daily-capture';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'tenant-statistics-daily-capture',
    '5 17 * * *',
    $$select public.capture_all_tenant_statistics_daily();$$
  );
end;
$schedule$;

-- Keep the existing live endpoint compatible with the frontend while making
-- "Chưa liên hệ" an explicit user-managed status, never an inferred contact
-- information state.
create or replace function public.customer_statistics(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'customers:view')
  then
    raise exception 'Customer view permission required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total', count(*)::integer,
    'active', count(*) filter (where status = 'active')::integer,
    'inactive', count(*) filter (where status = 'inactive')::integer,
    'withoutContact', count(*) filter (where status = 'uncontacted')::integer
  )
  into v_result
  from public.customers
  where tenant_id = p_tenant_id;

  return v_result;
end;
$$;

revoke execute on function public.customer_statistics(uuid) from public, anon;
grant execute on function public.customer_statistics(uuid) to authenticated;

-- Read the latest snapshot in the previous calendar month. Returning the
-- snapshot date lets the client detect a missing or delayed daily capture.
create or replace function public.tenant_statistics_previous_month(
  p_tenant_id uuid,
  p_entity text,
  p_as_of_date date default (timezone('Asia/Ho_Chi_Minh', now())::date)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text := lower(btrim(coalesce(p_entity, '')));
  v_previous_month_start date;
  v_previous_month_end date;
  v_snapshot_date date;
  v_values jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_tenant_id is null or p_as_of_date is null then
    raise exception 'Tenant and as-of date are required' using errcode = '22004';
  end if;

  if v_entity not in ('customers', 'contracts', 'employees') then
    raise exception 'Unsupported statistics entity' using errcode = '22023';
  end if;

  if v_entity = 'customers'
    and not public.has_tenant_permission(p_tenant_id, 'customers:view')
  then
    raise exception 'Customer view permission required' using errcode = '42501';
  end if;

  if v_entity = 'contracts'
    and not public.has_tenant_permission(p_tenant_id, 'contracts:view')
  then
    raise exception 'Contract view permission required' using errcode = '42501';
  end if;

  if v_entity = 'employees'
    and not public.has_tenant_permission(p_tenant_id, 'organization:employee:view')
  then
    raise exception 'Employee view permission required' using errcode = '42501';
  end if;

  v_previous_month_start := (date_trunc('month', p_as_of_date)::date - interval '1 month')::date;
  v_previous_month_end := date_trunc('month', p_as_of_date)::date - 1;

  select
    snapshot_date,
    case v_entity
      when 'customers' then customers
      when 'contracts' then contracts
      when 'employees' then employees
    end
  into v_snapshot_date, v_values
  from public.tenant_statistics_daily
  where tenant_id = p_tenant_id
    and snapshot_date between v_previous_month_start and v_previous_month_end
  order by snapshot_date desc
  limit 1;

  return jsonb_build_object(
    'entity', v_entity,
    'periodStart', v_previous_month_start,
    'periodEnd', v_previous_month_end,
    'snapshotDate', v_snapshot_date,
    'values', v_values
  );
end;
$$;

revoke execute on function public.tenant_statistics_previous_month(uuid, text, date)
  from public, anon;
grant execute on function public.tenant_statistics_previous_month(uuid, text, date)
  to authenticated;

notify pgrst, 'reload schema';
