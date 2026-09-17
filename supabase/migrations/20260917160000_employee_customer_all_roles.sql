-- A row in this table means that the employee is responsible for the customer
-- with every customer-assignable role currently granted to the employee.
-- Explicit role rows remain in customer_responsibles, so the all-roles mode does
-- not need a sentinel role or duplicated rows for every role.
create table if not exists public.employee_customer_all_roles (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, customer_id, employee_id)
);

create index if not exists employee_customer_all_roles_employee_idx
  on public.employee_customer_all_roles(tenant_id, employee_id, customer_id);

grant select on public.employee_customer_all_roles to authenticated;
alter table public.employee_customer_all_roles enable row level security;

drop policy if exists "Members with customer view can view all role assignments"
  on public.employee_customer_all_roles;
create policy "Members with customer view can view all role assignments"
on public.employee_customer_all_roles
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
  and public.has_tenant_permission(tenant_id, 'customers:view')
);

revoke insert, update, delete on public.employee_customer_all_roles
  from authenticated;

create or replace function public.get_employee_responsibility_workspace(
  p_tenant_id uuid,
  p_employee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'organization:employee:view')
    or not public.has_tenant_permission(p_tenant_id, 'customers:view')
  then
    raise exception 'Employee and customer view permissions required' using errcode = '42501';
  end if;

  select employee.user_id
  into v_user_id
  from public.employees employee
  where employee.id = p_employee_id
    and employee.tenant_id = p_tenant_id;

  if not found then
    raise exception 'Employee does not belong to tenant' using errcode = '42501';
  end if;

  with role_rows as (
    select role_definition.*
    from public.roles role_definition
    where role_definition.customer_assignable
      and (
        role_definition.tenant_id is null
        or role_definition.tenant_id = p_tenant_id
      )
      and (
        role_definition.is_active
        or exists (
          select 1
          from public.customer_responsibles responsible
          where responsible.tenant_id = p_tenant_id
            and responsible.employee_id = p_employee_id
            and responsible.responsibility_role_id = role_definition.id
        )
      )
      and v_user_id is not null
      and (
        exists (
          select 1
          from public.tenant_member_roles member_role
          where member_role.tenant_id = p_tenant_id
            and member_role.user_id = v_user_id
            and member_role.role_id = role_definition.id
        )
        or exists (
          select 1
          from public.customer_responsibles responsible
          where responsible.tenant_id = p_tenant_id
            and responsible.employee_id = p_employee_id
            and responsible.responsibility_role_id = role_definition.id
        )
      )
  ), customer_rows as (
    select
      customer.id,
      customer.customer_code,
      customer.name,
      customer.image_url,
      customer.status
    from public.customers customer
    where customer.tenant_id = p_tenant_id
      and (
        customer.status = 'active'
        or exists (
          select 1
          from public.customer_responsibles responsible
          where responsible.tenant_id = p_tenant_id
            and responsible.employee_id = p_employee_id
            and responsible.customer_id = customer.id
        )
        or exists (
          select 1
          from public.employee_customer_all_roles all_role
          where all_role.tenant_id = p_tenant_id
            and all_role.employee_id = p_employee_id
            and all_role.customer_id = customer.id
        )
      )
  ), explicit_assignment_rows as (
    select
      responsible.customer_id,
      jsonb_agg(
        responsible.responsibility_role_id
        order by role_definition.sort_order, role_definition.code
      ) as responsibility_role_ids
    from public.customer_responsibles responsible
    join public.roles role_definition
      on role_definition.id = responsible.responsibility_role_id
    where responsible.tenant_id = p_tenant_id
      and responsible.employee_id = p_employee_id
    group by responsible.customer_id
  ), assignment_rows as (
    select
      explicit_assignment.customer_id,
      false as all_roles,
      explicit_assignment.responsibility_role_ids
    from explicit_assignment_rows explicit_assignment
    union all
    select
      all_role.customer_id,
      true as all_roles,
      '[]'::jsonb as responsibility_role_ids
    from public.employee_customer_all_roles all_role
    where all_role.tenant_id = p_tenant_id
      and all_role.employee_id = p_employee_id
  )
  select jsonb_build_object(
    'roles', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', role_definition.id,
            'name', role_definition.name,
            'color', role_definition.color,
            'isActive', role_definition.is_active,
            'customerAssignable', role_definition.customer_assignable
          )
          order by role_definition.sort_order, role_definition.name
        )
        from role_rows role_definition
      ),
      '[]'::jsonb
    ),
    'customers', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', customer.id,
            'customerCode', customer.customer_code,
            'name', customer.name,
            'imageUrl', customer.image_url,
            'status', customer.status
          )
          order by customer.name, customer.customer_code
        )
        from customer_rows customer
      ),
      '[]'::jsonb
    ),
    'assignments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'customerId', assignment.customer_id,
            'allRoles', assignment.all_roles,
            'responsibilityRoleIds', assignment.responsibility_role_ids
          )
          order by assignment.customer_id
        )
        from assignment_rows assignment
      ),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.replace_employee_access(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_role_ids uuid[] default null,
  p_customer_assignments jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_effective_role_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select employee.user_id
  into v_user_id
  from public.employees employee
  where employee.id = p_employee_id
    and employee.tenant_id = p_tenant_id;

  if not found or v_user_id is null then
    raise exception 'Employee must be linked to an account' using errcode = '22023';
  end if;

  if p_role_ids is not null then
    if not public.has_tenant_permission(p_tenant_id, 'organization:employee:assign-role') then
      raise exception 'Employee role assignment permission required' using errcode = '42501';
    end if;

    if exists (
      select role_id
      from unnest(p_role_ids) as selected(role_id)
      group by role_id
      having count(*) > 1
    ) then
      raise exception 'An employee role can only be assigned once' using errcode = '22023';
    end if;

    if exists (
      select 1
      from unnest(p_role_ids) as selected(role_id)
      where not exists (
        select 1
        from public.roles role_definition
        where role_definition.id = selected.role_id
          and role_definition.is_active
          and (
            role_definition.tenant_id is null
            or role_definition.tenant_id = p_tenant_id
          )
      )
    ) then
      raise exception 'Assignments contain an invalid or inactive employee role' using errcode = '22023';
    end if;

    v_effective_role_ids := p_role_ids;
  else
    select coalesce(array_agg(member_role.role_id), '{}'::uuid[])
    into v_effective_role_ids
    from public.tenant_member_roles member_role
    where member_role.tenant_id = p_tenant_id
      and member_role.user_id = v_user_id;
  end if;

  if p_role_ids is not null and p_customer_assignments is null
    and exists (
      select 1
      from public.customer_responsibles responsible
      where responsible.tenant_id = p_tenant_id
        and responsible.employee_id = p_employee_id
        and not (responsible.responsibility_role_id = any(v_effective_role_ids))
    )
  then
    raise exception 'Customer assignments must be updated when removing a customer role' using errcode = '22023';
  end if;

  if p_customer_assignments is not null then
    if not public.has_tenant_permission(p_tenant_id, 'customers:update') then
      raise exception 'Customer update permission required' using errcode = '42501';
    end if;

    if jsonb_typeof(p_customer_assignments) <> 'array' then
      raise exception 'Customer assignments must be an array' using errcode = '22023';
    end if;

    if exists (
      select customer_id
      from (
        select (assignment->>'customer_id')::uuid as customer_id
        from jsonb_array_elements(p_customer_assignments) assignment
      ) parsed
      group by customer_id
      having count(*) > 1
    ) then
      raise exception 'A customer can only be assigned once' using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_customer_assignments) assignment
      where (assignment->>'customer_id') is null
        or jsonb_typeof(assignment->'responsibility_role_ids') <> 'array'
        or (
          coalesce((assignment->>'all_roles')::boolean, false) = false
          and jsonb_array_length(assignment->'responsibility_role_ids') = 0
        )
        or (
          coalesce((assignment->>'all_roles')::boolean, false) = true
          and jsonb_array_length(assignment->'responsibility_role_ids') > 0
        )
    ) then
      raise exception 'Every customer assignment must select roles or all roles' using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_customer_assignments) assignment
      where not exists (
        select 1
        from public.customers customer
        where customer.id = (assignment->>'customer_id')::uuid
          and customer.tenant_id = p_tenant_id
      )
    ) then
      raise exception 'Assignments contain an invalid customer' using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_customer_assignments) assignment
      cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item
      where coalesce((assignment->>'all_roles')::boolean, false) = false
        and not exists (
          select 1
          from public.roles role_definition
          where role_definition.id = role_item.value::uuid
            and role_definition.customer_assignable
            and role_definition.is_active
            and role_definition.id = any(v_effective_role_ids)
            and (
              role_definition.tenant_id is null
              or role_definition.tenant_id = p_tenant_id
            )
        )
    ) then
      raise exception 'A customer role must already be assigned to the employee' using errcode = '22023';
    end if;
  end if;

  if p_role_ids is not null then
    delete from public.tenant_member_roles
    where tenant_id = p_tenant_id
      and user_id = v_user_id;

    insert into public.tenant_member_roles (tenant_id, user_id, role_id)
    select p_tenant_id, v_user_id, selected.role_id
    from unnest(p_role_ids) as selected(role_id);
  end if;

  if p_customer_assignments is not null then
    delete from public.customer_responsibles
    where tenant_id = p_tenant_id
      and employee_id = p_employee_id;

    delete from public.employee_customer_all_roles
    where tenant_id = p_tenant_id
      and employee_id = p_employee_id;

    insert into public.customer_responsibles (
      tenant_id,
      customer_id,
      employee_id,
      responsibility_role_id,
      assigned_by
    )
    select
      p_tenant_id,
      (assignment->>'customer_id')::uuid,
      p_employee_id,
      role_item.value::uuid,
      auth.uid()
    from jsonb_array_elements(p_customer_assignments) assignment
    cross join lateral jsonb_array_elements_text(
      assignment->'responsibility_role_ids'
    ) role_item
    where coalesce((assignment->>'all_roles')::boolean, false) = false;

    insert into public.employee_customer_all_roles (
      tenant_id, customer_id, employee_id, assigned_by
    )
    select
      p_tenant_id,
      (assignment->>'customer_id')::uuid,
      p_employee_id,
      auth.uid()
    from jsonb_array_elements(p_customer_assignments) assignment
    where coalesce((assignment->>'all_roles')::boolean, false) = true;
  end if;
end;
$$;

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
    from public.roles role_definition
    where role_definition.customer_assignable
      and (
        role_definition.tenant_id is null
        or role_definition.tenant_id = p_tenant_id
      )
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
      employee.status,
      profile.avatar_url,
      coalesce(
        (
          select jsonb_agg(member_role.role_id order by member_role.role_id)
          from public.tenant_member_roles member_role
          where member_role.tenant_id = p_tenant_id
            and member_role.user_id = employee.user_id
        ),
        '[]'::jsonb
      ) as role_ids
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
        or exists (
          select 1
          from public.employee_customer_all_roles all_role
          where all_role.tenant_id = p_tenant_id
            and all_role.customer_id = p_customer_id
            and all_role.employee_id = employee.id
        )
      )
  ), explicit_assignment_rows as (
    select
      responsible.employee_id,
      jsonb_agg(
        responsible.responsibility_role_id
        order by role_definition.sort_order, role_definition.code
      ) as responsibility_role_ids,
      min(responsible.created_at) as created_at,
      min(responsible.assigned_by::text)::uuid as assigned_by
    from public.customer_responsibles responsible
    join public.roles role_definition
      on role_definition.id = responsible.responsibility_role_id
    where responsible.tenant_id = p_tenant_id
      and responsible.customer_id = p_customer_id
    group by responsible.employee_id
  ), assignment_rows as (
    select
      explicit_assignment.employee_id,
      false as all_roles,
      explicit_assignment.responsibility_role_ids,
      explicit_assignment.created_at,
      explicit_assignment.assigned_by
    from explicit_assignment_rows explicit_assignment
    union all
    select
      all_role.employee_id,
      true as all_roles,
      '[]'::jsonb as responsibility_role_ids,
      all_role.created_at,
      all_role.assigned_by
    from public.employee_customer_all_roles all_role
    where all_role.tenant_id = p_tenant_id
      and all_role.customer_id = p_customer_id
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
            'status', employee.status,
            'avatarUrl', employee.avatar_url,
            'roleIds', employee.role_ids
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
            'allRoles', assignment.all_roles,
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
      or (
        coalesce((assignment->>'all_roles')::boolean, false) = false
        and jsonb_array_length(assignment->'responsibility_role_ids') = 0
      )
      or (
        coalesce((assignment->>'all_roles')::boolean, false) = true
        and jsonb_array_length(assignment->'responsibility_role_ids') > 0
      )
  ) then
    raise exception 'Every employee assignment must select roles or all roles' using errcode = '22023';
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
          or exists (
            select 1
            from public.employee_customer_all_roles all_role
            where all_role.tenant_id = p_tenant_id
              and all_role.customer_id = p_customer_id
              and all_role.employee_id = employee.id
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
    where coalesce((assignment->>'all_roles')::boolean, false) = false
      and not exists (
        select 1
        from public.roles role_definition
        where role_definition.id = role_item.value::uuid
          and role_definition.customer_assignable
          and (
            role_definition.tenant_id is null
            or role_definition.tenant_id = p_tenant_id
          )
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
    select 1
    from jsonb_array_elements(p_assignments) assignment
    cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item
    join public.employees employee
      on employee.id = (assignment->>'employee_id')::uuid
    where coalesce((assignment->>'all_roles')::boolean, false) = false
      and employee.user_id is not null
      and not exists (
        select 1
        from public.tenant_member_roles member_role
        where member_role.tenant_id = p_tenant_id
          and member_role.user_id = employee.user_id
          and member_role.role_id = role_item.value::uuid
      )
      and not exists (
        select 1
        from public.customer_responsibles existing_responsible
        where existing_responsible.tenant_id = p_tenant_id
          and existing_responsible.customer_id = p_customer_id
          and existing_responsible.employee_id = employee.id
          and existing_responsible.responsibility_role_id = role_item.value::uuid
      )
  ) then
    raise exception 'An employee can only be assigned customer roles already granted to that employee' using errcode = '22023';
  end if;

  if exists (
    select employee_id, role_id
    from (
      select
        (assignment->>'employee_id')::uuid as employee_id,
        role_item.value::uuid as role_id
      from jsonb_array_elements(p_assignments) assignment
      cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item
      where coalesce((assignment->>'all_roles')::boolean, false) = false
    ) parsed
    group by employee_id, role_id
    having count(*) > 1
  ) then
    raise exception 'A responsibility role can only be assigned once per employee' using errcode = '22023';
  end if;

  delete from public.customer_responsibles
  where tenant_id = p_tenant_id
    and customer_id = p_customer_id;

  delete from public.employee_customer_all_roles
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
  cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item
  where coalesce((assignment->>'all_roles')::boolean, false) = false;

  insert into public.employee_customer_all_roles (
    tenant_id, customer_id, employee_id, assigned_by
  )
  select
    p_tenant_id,
    p_customer_id,
    (assignment->>'employee_id')::uuid,
    auth.uid()
  from jsonb_array_elements(p_assignments) assignment
  where coalesce((assignment->>'all_roles')::boolean, false) = true;
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
            'status', employee.status,
            'avatarUrl', profile.avatar_url,
            'customerCount', (
              select count(distinct assignment.customer_id)
              from (
                select responsible.customer_id
                from public.customer_responsibles responsible
                where responsible.tenant_id = p_tenant_id
                  and responsible.employee_id = employee.id
                union
                select all_role.customer_id
                from public.employee_customer_all_roles all_role
                where all_role.tenant_id = p_tenant_id
                  and all_role.employee_id = employee.id
              ) assignment
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
            or exists (
              select 1
              from public.employee_customer_all_roles all_role
              where all_role.tenant_id = p_tenant_id
                and all_role.employee_id = employee.id
            )
          )
      ),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

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
      customer.district_name,
      customer.ward_name,
      customer.street_address,
      customer.phone,
      customer.email,
      customer.address_detail,
      customer.contact_name,
      customer.contact_title,
      customer.established_date,
      customer.vat_declaration_period,
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
        select 1 from public.tag_assignments assignment
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
        union all
        select 1
        from public.employee_customer_all_roles all_role
        where all_role.tenant_id = customer.tenant_id
          and all_role.customer_id = customer.id
          and all_role.employee_id = any(p_responsible_employee_ids)
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

revoke execute on function public.get_employee_responsibility_workspace(uuid, uuid)
  from public, anon;
grant execute on function public.get_employee_responsibility_workspace(uuid, uuid)
  to authenticated;
revoke execute on function public.replace_employee_access(uuid, uuid, uuid[], jsonb)
  from public, anon;
grant execute on function public.replace_employee_access(uuid, uuid, uuid[], jsonb)
  to authenticated;
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

notify pgrst, 'reload schema';
