create index if not exists employees_tenant_name_idx
  on public.employees(tenant_id, last_name, first_name, id);

create index if not exists employees_tenant_status_name_vi_idx
  on public.employees (
    tenant_id,
    (case status when 'active' then 0 else 1 end),
    (lower(concat_ws(' ', last_name, first_name)) collate "vi-x-icu"),
    id
  );

create index if not exists tenant_member_roles_tenant_role_user_idx
  on public.tenant_member_roles(tenant_id, role_id, user_id);

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
    or not public.has_tenant_permission(p_tenant_id, 'organization:employee:view') then
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
      employee.phone,
      employee.status,
      employee.joined_at,
      employee.note,
      coalesce(employee.avatar_url, profile.avatar_url) as avatar_url,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('name', role.name, 'color', role.color)
          order by role.sort_order, lower(role.name) collate "vi-x-icu", role.id
        )
        from public.tenant_member_roles member_role
        join public.roles role
          on role.id = member_role.role_id
         and role.tenant_id = employee.tenant_id
         and role.is_active
        where member_role.tenant_id = employee.tenant_id
          and member_role.user_id = employee.user_id
      ), '[]'::jsonb) as roles,
      coalesce((
        select jsonb_agg(role.id order by role.sort_order, lower(role.name) collate "vi-x-icu", role.id)
        from public.tenant_member_roles member_role
        join public.roles role
          on role.id = member_role.role_id
         and role.tenant_id = employee.tenant_id
         and role.is_active
        where member_role.tenant_id = employee.tenant_id
          and member_role.user_id = employee.user_id
      ), '[]'::jsonb) as role_ids,
      count(*) over () as total_count
    from public.employees employee
    left join public.user_profiles profile on profile.id = employee.user_id
    where employee.tenant_id = p_tenant_id
      and (
        v_search is null
        or employee.employee_code ilike '%' || v_search || '%'
        or concat_ws(' ', employee.last_name, employee.first_name) ilike '%' || v_search || '%'
        or employee.phone ilike '%' || v_search || '%'
      )
      and (p_statuses is null or cardinality(p_statuses) = 0 or employee.status = any(p_statuses))
      and (
        p_role_ids is null or cardinality(p_role_ids) = 0
        or exists (
          select 1
          from public.tenant_member_roles member_role
          join public.roles role
            on role.id = member_role.role_id
           and role.tenant_id = employee.tenant_id
           and role.is_active
          where member_role.tenant_id = employee.tenant_id
            and member_role.user_id = employee.user_id
            and member_role.role_id = any(p_role_ids)
        )
      )
      and (p_account_linked is null or (employee.user_id is not null) = p_account_linked)
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
    'items', coalesce((
      select jsonb_agg(to_jsonb(page_row) - 'total_count'
        order by
          case page_row.status when 'active' then 0 else 1 end,
          lower(concat_ws(' ', page_row.last_name, page_row.first_name)) collate "vi-x-icu",
          page_row.id
      )
      from (
        select *
        from filtered_employees
        order by
          case status when 'active' then 0 else 1 end,
          lower(concat_ws(' ', last_name, first_name)) collate "vi-x-icu",
          id
        offset (v_page - 1) * v_page_size
        limit v_page_size
      ) page_row
    ), '[]'::jsonb),
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

create or replace function public.save_employee_role_assignments(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_role_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.has_tenant_permission(p_tenant_id, 'organization:employee:assign-role') then
    raise exception 'Employee role assignment permission required' using errcode = '42501';
  end if;

  select employee.user_id
    into employee_user_id
  from public.employees employee
  where employee.id = p_employee_id
    and employee.tenant_id = p_tenant_id;

  if not found then
    raise exception 'Employee not found in tenant' using errcode = 'P0002';
  end if;
  if employee_user_id is null then
    raise exception 'Employee account is not linked' using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.tenant_members membership
    where membership.tenant_id = p_tenant_id
      and membership.user_id = employee_user_id
      and membership.status = 'active'
  ) then
    raise exception 'Employee account is not an active tenant member' using errcode = '23514';
  end if;

  -- NULL means the caller intentionally leaves the existing assignment unchanged.
  if p_role_ids is null then
    return;
  end if;

  if exists (
    select role_id
    from unnest(p_role_ids) as requested(role_id)
    group by role_id
    having role_id is null or count(*) > 1
  ) then
    raise exception 'Role ids must be non-null and unique' using errcode = '22023';
  end if;

  if exists (
    select requested.role_id
    from unnest(p_role_ids) as requested(role_id)
    where not exists (
      select 1
      from public.roles role_record
      where role_record.id = requested.role_id
        and role_record.tenant_id = p_tenant_id
        and role_record.is_active
    )
  ) then
    raise exception 'Every role must be active and belong to the tenant' using errcode = '23503';
  end if;

  delete from public.tenant_member_roles
  where tenant_id = p_tenant_id
    and user_id = employee_user_id;

  insert into public.tenant_member_roles (tenant_id, user_id, role_id)
  select p_tenant_id, employee_user_id, requested.role_id
  from unnest(p_role_ids) as requested(role_id);
end;
$$;

revoke all on function public.save_employee_role_assignments(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.save_employee_role_assignments(uuid, uuid, uuid[])
  to authenticated;

notify pgrst, 'reload schema';
