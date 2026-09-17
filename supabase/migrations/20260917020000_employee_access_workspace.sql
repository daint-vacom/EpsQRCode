-- Employee-side access editor support.
-- Keeps role assignment and employee -> customer responsibility changes in one
-- transaction while allowing the UI to work from either direction.

create or replace function public.list_employees(
  p_tenant_id uuid,
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null,
  p_statuses public.employee_status[] default null,
  p_role_ids uuid[] default null,
  p_account_linked boolean default null,
  p_tag_ids uuid[] default null
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
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'organization:employee:view')
  then
    raise exception 'Employee view permission required' using errcode = '42501';
  end if;

  with filtered_employees as (
    select
      employee.id,
      employee.tenant_id,
      employee.user_id,
      employee.employee_code,
      employee.first_name,
      employee.last_name,
      employee.job_title,
      employee.department,
      employee.phone,
      employee.status,
      employee.joined_at,
      employee.note,
      coalesce(employee.avatar_url, profile.avatar_url) as avatar_url,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('name', role.name, 'color', role.color)
            order by role.name, role.id
          )
          from public.tenant_member_roles member_role
          join public.roles role
            on role.id = member_role.role_id
           and (role.tenant_id is null or role.tenant_id = employee.tenant_id)
           and role.is_active
          where member_role.tenant_id = employee.tenant_id
            and member_role.user_id = employee.user_id
        ),
        '[]'::jsonb
      ) as roles,
      coalesce(
        (
          select jsonb_agg(member_role.role_id order by member_role.role_id)
          from public.tenant_member_roles member_role
          join public.roles role
            on role.id = member_role.role_id
           and (role.tenant_id is null or role.tenant_id = employee.tenant_id)
           and role.is_active
          where member_role.tenant_id = employee.tenant_id
            and member_role.user_id = employee.user_id
        ),
        '[]'::jsonb
      ) as role_ids,
      count(*) over () as total_count
    from public.employees employee
    left join public.user_profiles profile
      on profile.id = employee.user_id
    where employee.tenant_id = p_tenant_id
      and (
        v_search is null
        or employee.employee_code ilike '%' || v_search || '%'
        or concat_ws(' ', employee.last_name, employee.first_name) ilike '%' || v_search || '%'
        or employee.job_title ilike '%' || v_search || '%'
        or employee.department ilike '%' || v_search || '%'
        or employee.phone ilike '%' || v_search || '%'
      )
      and (
        p_statuses is null or cardinality(p_statuses) = 0
        or employee.status = any(p_statuses)
      )
      and (
        p_role_ids is null or cardinality(p_role_ids) = 0
        or exists (
          select 1
          from public.tenant_member_roles member_role
          where member_role.tenant_id = employee.tenant_id
            and member_role.user_id = employee.user_id
            and member_role.role_id = any(p_role_ids)
        )
      )
      and (
        p_account_linked is null
        or (employee.user_id is not null) = p_account_linked
      )
      and (
        p_tag_ids is null or cardinality(p_tag_ids) = 0
        or exists (
          select 1
          from public.tag_assignments assignment
          where assignment.tenant_id = employee.tenant_id
            and assignment.subject_type = 'employee'
            and assignment.subject_id = employee.id
            and assignment.tag_id = any(p_tag_ids)
        )
      )
  )
  select jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(
          to_jsonb(page_row) - 'total_count'
          order by page_row.last_name asc, page_row.first_name asc, page_row.id asc
        )
        from (
          select *
          from filtered_employees
          order by last_name asc, first_name asc, id asc
          offset (v_page - 1) * v_page_size
          limit v_page_size
        ) page_row
      ),
      '[]'::jsonb
    ),
    'total', coalesce((select max(total_count) from filtered_employees), 0)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.list_employees(
  uuid, integer, integer, text, public.employee_status[], uuid[], boolean, uuid[]
) from public, anon;
grant execute on function public.list_employees(
  uuid, integer, integer, text, public.employee_status[], uuid[], boolean, uuid[]
) to authenticated;

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
      and (
        v_user_id is not null
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
      )
  ), assignment_rows as (
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
    if not public.has_tenant_permission(
      p_tenant_id,
      'organization:employee:assign-role'
    ) then
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
        or jsonb_array_length(assignment->'responsibility_role_ids') = 0
    ) then
      raise exception 'Every customer assignment requires at least one role' using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_customer_assignments) assignment
      where not exists (
        select 1
        from public.customers customer
        where customer.id = (assignment->>'customer_id')::uuid
          and customer.tenant_id = p_tenant_id
          and customer.status = 'active'
      )
    ) then
      raise exception 'Assignments contain an invalid or inactive customer' using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_customer_assignments) assignment
      cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item
      where not exists (
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
    ) role_item;
  end if;
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

notify pgrst, 'reload schema';
