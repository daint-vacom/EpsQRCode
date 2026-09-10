-- Customer responsibility is a tenant-scoped business classification. It is
-- intentionally separate from the tenant roles and permission catalog.

create table if not exists public.customer_responsibility_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint customer_responsibility_roles_code_not_blank
    check (length(btrim(code)) > 0),
  constraint customer_responsibility_roles_name_not_blank
    check (length(btrim(name)) > 0),
  unique (tenant_id, code)
);

create index if not exists customer_responsibility_roles_tenant_active_idx
  on public.customer_responsibility_roles(tenant_id, is_active, sort_order);

drop trigger if exists customer_responsibility_roles_set_updated_at
  on public.customer_responsibility_roles;
create trigger customer_responsibility_roles_set_updated_at
before update on public.customer_responsibility_roles
for each row execute function public.set_updated_at();

create table if not exists public.customer_responsibles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  responsibility_role_id uuid not null references public.customer_responsibility_roles(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, customer_id, employee_id, responsibility_role_id)
);

create index if not exists customer_responsibles_customer_idx
  on public.customer_responsibles(tenant_id, customer_id, employee_id);
create index if not exists customer_responsibles_employee_idx
  on public.customer_responsibles(tenant_id, employee_id, customer_id);

insert into public.customer_responsibility_roles (
  tenant_id, code, name, description, sort_order, is_system
)
select
  tenant.id,
  seed.code,
  seed.name,
  seed.description,
  seed.sort_order,
  true
from public.tenants tenant
cross join (
  values
    ('contract', 'Hợp đồng', 'Phụ trách hợp đồng của khách hàng.', 10),
    ('receivables', 'Công nợ và thanh toán', 'Phụ trách công nợ và thanh toán của khách hàng.', 20)
) as seed(code, name, description, sort_order)
on conflict (tenant_id, code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_system = true,
  is_active = true;

create or replace function public.seed_customer_responsibility_roles_for_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.customer_responsibility_roles (
    tenant_id, code, name, description, sort_order, is_system
  )
  values
    (
      new.id,
      'contract',
      'Hợp đồng',
      'Phụ trách hợp đồng của khách hàng.',
      10,
      true
    ),
    (
      new.id,
      'receivables',
      'Công nợ và thanh toán',
      'Phụ trách công nợ và thanh toán của khách hàng.',
      20,
      true
    )
  on conflict (tenant_id, code) do nothing;

  return new;
end;
$$;

drop trigger if exists tenants_seed_customer_responsibility_roles
  on public.tenants;
create trigger tenants_seed_customer_responsibility_roles
after insert on public.tenants
for each row execute function public.seed_customer_responsibility_roles_for_tenant();

grant select on public.customer_responsibility_roles,
  public.customer_responsibles to authenticated;

alter table public.customer_responsibility_roles enable row level security;
alter table public.customer_responsibles enable row level security;

drop policy if exists "Members with customer view can view responsibility roles"
  on public.customer_responsibility_roles;
create policy "Members with customer view can view responsibility roles"
on public.customer_responsibility_roles
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
  and public.has_tenant_permission(tenant_id, 'customers:view')
);

drop policy if exists "Members with customer view can view customer responsibles"
  on public.customer_responsibles;
create policy "Members with customer view can view customer responsibles"
on public.customer_responsibles
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
  and public.has_tenant_permission(tenant_id, 'customers:view')
);

revoke insert, update, delete on public.customer_responsibility_roles
  from authenticated;
revoke insert, update, delete on public.customer_responsibles
  from authenticated;

create or replace function public.get_customer_responsibility_workspace(
  p_tenant_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
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

  if not exists (
    select 1
    from public.customers customer
    where customer.id = p_customer_id
      and customer.tenant_id = p_tenant_id
  ) then
    raise exception 'Customer does not belong to tenant' using errcode = '42501';
  end if;

  with role_rows as (
    select role_definition.*
    from public.customer_responsibility_roles role_definition
    where role_definition.tenant_id = p_tenant_id
      and (
        role_definition.is_active
        or exists (
          select 1
          from public.customer_responsibles responsible
          where responsible.tenant_id = p_tenant_id
            and responsible.customer_id = p_customer_id
            and responsible.responsibility_role_id = role_definition.id
        )
      )
  ), employee_rows as (
    select
      employee.id,
      employee.user_id,
      employee.employee_code,
      employee.first_name,
      employee.last_name,
      employee.job_title,
      employee.department,
      employee.status,
      profile.avatar_url
    from public.employees employee
    left join public.user_profiles profile on profile.id = employee.user_id
    where employee.tenant_id = p_tenant_id
      and (
        employee.status = 'active'
        or exists (
          select 1
          from public.customer_responsibles responsible
          where responsible.tenant_id = p_tenant_id
            and responsible.customer_id = p_customer_id
            and responsible.employee_id = employee.id
        )
      )
  ), assignment_rows as (
    select
      responsible.employee_id,
      jsonb_agg(
        responsible.responsibility_role_id
        order by role_definition.sort_order, role_definition.code
      ) as responsibility_role_ids,
      min(responsible.created_at) as created_at,
      min(responsible.assigned_by::text)::uuid as assigned_by
    from public.customer_responsibles responsible
    join public.customer_responsibility_roles role_definition
      on role_definition.id = responsible.responsibility_role_id
    where responsible.tenant_id = p_tenant_id
      and responsible.customer_id = p_customer_id
    group by responsible.employee_id
  )
  select jsonb_build_object(
    'roles', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', role_definition.id,
            'code', role_definition.code,
            'name', role_definition.name,
            'description', role_definition.description,
            'sortOrder', role_definition.sort_order,
            'isSystem', role_definition.is_system,
            'isActive', role_definition.is_active
          )
          order by role_definition.sort_order, role_definition.name
        )
        from role_rows role_definition
      ),
      '[]'::jsonb
    ),
    'employees', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', employee.id,
            'userId', employee.user_id,
            'employeeCode', employee.employee_code,
            'displayName', trim(concat(employee.last_name, ' ', employee.first_name)),
            'jobTitle', employee.job_title,
            'department', employee.department,
            'status', employee.status,
            'avatarUrl', employee.avatar_url
          )
          order by employee.status asc, employee.last_name, employee.first_name, employee.employee_code
        )
        from employee_rows employee
      ),
      '[]'::jsonb
    ),
    'assignments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'employeeId', assignment.employee_id,
            'responsibilityRoleIds', assignment.responsibility_role_ids,
            'assignedBy', assignment.assigned_by,
            'createdAt', assignment.created_at
          )
          order by assignment.created_at, assignment.employee_id
        )
        from assignment_rows assignment
      ),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.replace_customer_responsibilities(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_assignments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'customers:update')
  then
    raise exception 'Customer update permission required' using errcode = '42501';
  end if;

  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'Assignments must be an array' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.customers customer
    where customer.id = p_customer_id
      and customer.tenant_id = p_tenant_id
  ) then
    raise exception 'Customer does not belong to tenant' using errcode = '42501';
  end if;

  if exists (
    select employee_id
    from (
      select (assignment->>'employee_id')::uuid as employee_id
      from jsonb_array_elements(p_assignments) assignment
    ) parsed
    group by employee_id
    having count(*) > 1
  ) then
    raise exception 'An employee can only be assigned once' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) assignment
    where (assignment->>'employee_id') is null
      or jsonb_typeof(assignment->'responsibility_role_ids') <> 'array'
      or jsonb_array_length(assignment->'responsibility_role_ids') = 0
  ) then
    raise exception 'Every employee assignment requires at least one role' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) assignment
    where not exists (
      select 1
      from public.employees employee
      where employee.id = (assignment->>'employee_id')::uuid
        and employee.tenant_id = p_tenant_id
        and (
          employee.status = 'active'
          or exists (
            select 1
            from public.customer_responsibles responsible
            where responsible.tenant_id = p_tenant_id
              and responsible.customer_id = p_customer_id
              and responsible.employee_id = employee.id
          )
        )
    )
  ) then
    raise exception 'Assignments contain an invalid or inactive employee' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) assignment
    cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item
    where not exists (
      select 1
      from public.customer_responsibility_roles role_definition
      where role_definition.id = role_item.value::uuid
        and role_definition.tenant_id = p_tenant_id
        and (
          role_definition.is_active
          or exists (
            select 1
            from public.customer_responsibles responsible
            where responsible.tenant_id = p_tenant_id
              and responsible.customer_id = p_customer_id
              and responsible.responsibility_role_id = role_definition.id
          )
        )
    )
  ) then
    raise exception 'Assignments contain an invalid or inactive responsibility role' using errcode = '22023';
  end if;

  if exists (
    select employee_id, role_id
    from (
      select
        (assignment->>'employee_id')::uuid as employee_id,
        role_item.value::uuid as role_id
      from jsonb_array_elements(p_assignments) assignment
      cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item
    ) parsed
    group by employee_id, role_id
    having count(*) > 1
  ) then
    raise exception 'A responsibility role can only be assigned once per employee' using errcode = '22023';
  end if;

  delete from public.customer_responsibles
  where tenant_id = p_tenant_id
    and customer_id = p_customer_id;

  insert into public.customer_responsibles (
    tenant_id, customer_id, employee_id, responsibility_role_id, assigned_by
  )
  select
    p_tenant_id,
    p_customer_id,
    (assignment->>'employee_id')::uuid,
    role_item.value::uuid,
    auth.uid()
  from jsonb_array_elements(p_assignments) assignment
  cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item;
end;
$$;

create or replace function public.list_customer_responsibility_filter_options(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
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
    'employees', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', employee.id,
            'employeeCode', employee.employee_code,
            'displayName', trim(concat(employee.last_name, ' ', employee.first_name)),
            'department', employee.department,
            'status', employee.status,
            'avatarUrl', profile.avatar_url,
            'customerCount', (
              select count(distinct responsible.customer_id)
              from public.customer_responsibles responsible
              where responsible.tenant_id = p_tenant_id
                and responsible.employee_id = employee.id
            )
          )
          order by employee.status asc, employee.last_name, employee.first_name, employee.employee_code
        )
        from public.employees employee
        left join public.user_profiles profile on profile.id = employee.user_id
        where employee.tenant_id = p_tenant_id
          and (
            employee.status = 'active'
            or exists (
              select 1
              from public.customer_responsibles responsible
              where responsible.tenant_id = p_tenant_id
                and responsible.employee_id = employee.id
            )
          )
      ),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_customer_responsibility_workspace(uuid, uuid)
  from public, anon;
grant execute on function public.get_customer_responsibility_workspace(uuid, uuid)
  to authenticated;
revoke execute on function public.replace_customer_responsibilities(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.replace_customer_responsibilities(uuid, uuid, jsonb)
  to authenticated;
revoke execute on function public.list_customer_responsibility_filter_options(uuid)
  from public, anon;
grant execute on function public.list_customer_responsibility_filter_options(uuid)
  to authenticated;

-- Keep customer list filtering server-side when the employee chip row is used.
drop function if exists public.list_customers(
  uuid, integer, integer, text, text, public.business_type[], text,
  public.customer_status[], uuid[], jsonb
);

create or replace function public.list_customers(
  p_tenant_id uuid,
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null,
  p_customer_search text default null,
  p_business_types public.business_type[] default null,
  p_contact_search text default null,
  p_statuses public.customer_status[] default null,
  p_tag_ids uuid[] default null,
  p_field_filters jsonb default '{}'::jsonb,
  p_responsible_employee_ids uuid[] default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 100);
  v_search text := nullif(btrim(p_search), '');
  v_customer_search text := nullif(btrim(p_customer_search), '');
  v_contact_search text := nullif(btrim(p_contact_search), '');
  v_field_contact_search text := nullif(btrim(p_field_filters ->> 'contactSearch'), '');
  v_customer_code text := nullif(btrim(p_field_filters ->> 'customerCode'), '');
  v_name text := nullif(btrim(p_field_filters ->> 'name'), '');
  v_business_registration_code text := nullif(btrim(p_field_filters ->> 'businessRegistrationCode'), '');
  v_country_code text := nullif(btrim(p_field_filters ->> 'countryCode'), '');
  v_region text := nullif(btrim(p_field_filters ->> 'region'), '');
  v_phone text := nullif(btrim(p_field_filters ->> 'phone'), '');
  v_email text := nullif(btrim(p_field_filters ->> 'email'), '');
  v_address_detail text := nullif(btrim(p_field_filters ->> 'addressDetail'), '');
  v_note text := nullif(btrim(p_field_filters ->> 'note'), '');
  v_custom_filters jsonb := case
    when jsonb_typeof(p_field_filters -> 'customFields') = 'object'
      then p_field_filters -> 'customFields'
    else '{}'::jsonb
  end;
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'customers:view')
  then
    raise exception 'Customer view permission required' using errcode = '42501';
  end if;

  with filtered_customers as (
    select
      customer.id,
      customer.tenant_id,
      customer.customer_code,
      customer.name,
      customer.business_type,
      customer.business_registration_code,
      customer.image_url,
      customer.country_code,
      customer.region_code,
      customer.region_name,
      customer.phone,
      customer.email,
      customer.address_detail,
      customer.status,
      customer.note,
      customer.created_at,
      customer.updated_at,
      coalesce(custom_data.data, '{}'::jsonb) as custom_fields,
      count(*) over () as total_count
    from public.customers customer
    left join public.entity_custom_data custom_data
      on custom_data.tenant_id = customer.tenant_id
     and custom_data.entity_type = 'customer'
     and custom_data.entity_id = customer.id
    where customer.tenant_id = p_tenant_id
      and (
        v_search is null
        or customer.customer_code ilike '%' || v_search || '%'
        or customer.name ilike '%' || v_search || '%'
        or customer.phone ilike '%' || v_search || '%'
        or customer.email ilike '%' || v_search || '%'
        or customer.address_detail ilike '%' || v_search || '%'
        or custom_data.data::text ilike '%' || v_search || '%'
      )
      and (v_customer_search is null or customer.customer_code ilike '%' || v_customer_search || '%' or customer.name ilike '%' || v_customer_search || '%')
      and (v_customer_code is null or customer.customer_code ilike '%' || v_customer_code || '%')
      and (v_name is null or customer.name ilike '%' || v_name || '%')
      and (v_business_registration_code is null or customer.business_registration_code ilike '%' || v_business_registration_code || '%')
      and (v_country_code is null or customer.country_code ilike '%' || v_country_code || '%')
      and (v_region is null or customer.region_code ilike '%' || v_region || '%' or customer.region_name ilike '%' || v_region || '%')
      and (v_phone is null or customer.phone ilike '%' || v_phone || '%')
      and (v_email is null or customer.email ilike '%' || v_email || '%')
      and (v_address_detail is null or customer.address_detail ilike '%' || v_address_detail || '%')
      and (v_note is null or customer.note ilike '%' || v_note || '%')
      and (v_contact_search is null or customer.phone ilike '%' || v_contact_search || '%' or customer.email ilike '%' || v_contact_search || '%')
      and (v_field_contact_search is null or customer.phone ilike '%' || v_field_contact_search || '%' or customer.email ilike '%' || v_field_contact_search || '%')
      and (p_business_types is null or cardinality(p_business_types) = 0 or customer.business_type = any(p_business_types))
      and (p_statuses is null or cardinality(p_statuses) = 0 or customer.status = any(p_statuses))
      and (p_tag_ids is null or cardinality(p_tag_ids) = 0 or exists (
        select 1
        from public.tag_assignments assignment
        where assignment.tenant_id = customer.tenant_id
          and assignment.subject_type = 'customer'
          and assignment.subject_id = customer.id
          and assignment.tag_id = any(p_tag_ids)
      ))
      and (p_responsible_employee_ids is null or cardinality(p_responsible_employee_ids) = 0 or exists (
        select 1
        from public.customer_responsibles responsible
        where responsible.tenant_id = customer.tenant_id
          and responsible.customer_id = customer.id
          and responsible.employee_id = any(p_responsible_employee_ids)
      ))
      and not exists (
        select 1
        from jsonb_each_text(v_custom_filters) filter_item
        where coalesce(custom_data.data ->> filter_item.key, '') not ilike '%' || filter_item.value || '%'
      )
  )
  select jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(
          to_jsonb(page_row) - 'total_count' - 'created_at'
          order by page_row.created_at asc, page_row.id asc
        )
        from (
          select *
          from filtered_customers
          order by created_at asc, id asc
          offset (v_page - 1) * v_page_size
          limit v_page_size
        ) page_row
      ),
      '[]'::jsonb
    ),
    'total', coalesce((select max(total_count) from filtered_customers), 0)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.list_customers(
  uuid, integer, integer, text, text, public.business_type[], text,
  public.customer_status[], uuid[], jsonb, uuid[]
) from public, anon;
grant execute on function public.list_customers(
  uuid, integer, integer, text, text, public.business_type[], text,
  public.customer_status[], uuid[], jsonb, uuid[]
) to authenticated;

notify pgrst, 'reload schema';
