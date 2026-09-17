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
      )
    ) then
      raise exception 'Assignments contain an invalid customer' using errcode = '22023';
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

revoke execute on function public.replace_employee_access(uuid, uuid, uuid[], jsonb)
  from public, anon;
grant execute on function public.replace_employee_access(uuid, uuid, uuid[], jsonb)
  to authenticated;

notify pgrst, 'reload schema';
