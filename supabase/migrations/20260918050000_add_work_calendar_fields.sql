alter table public.work_items
  add column if not exists planned_start_time time not null default time '00:00',
  add column if not exists planned_end_time time not null default time '00:00',
  add column if not exists color text not null default '#2563eb';

alter table public.work_items
  drop constraint if exists work_items_color_format_check;

alter table public.work_items
  add constraint work_items_color_format_check
  check (color ~ '^#[0-9A-Fa-f]{6}$');

create index if not exists work_items_tenant_calendar_idx
  on public.work_items(tenant_id, planned_start_date, planned_start_time);

create or replace function public.create_work_item(
  p_tenant_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_item_id uuid;
  v_parent_id uuid := nullif(p_payload->>'parentId', '')::uuid;
  v_template_id uuid := nullif(p_payload->>'templateId', '')::uuid;
  v_assignee_id uuid := nullif(p_payload->>'assigneeEmployeeId', '')::uuid;
  v_customer_ids jsonb := coalesce(p_payload->'customerIds', '[]'::jsonb);
  v_contract_ids jsonb := coalesce(p_payload->'contractIds', '[]'::jsonb);
  v_step record;
begin
  if auth.uid() is null or not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;

  if v_parent_id is not null and not exists (
    select 1 from public.work_items
    where tenant_id = p_tenant_id and id = v_parent_id
  ) then
    raise exception 'Parent work item does not belong to tenant' using errcode = '22023';
  end if;

  if v_assignee_id is not null and not exists (
    select 1 from public.employees
    where tenant_id = p_tenant_id and id = v_assignee_id
  ) then
    raise exception 'Assignee does not belong to tenant' using errcode = '22023';
  end if;

  if v_template_id is not null and not exists (
    select 1 from public.work_templates
    where tenant_id = p_tenant_id and id = v_template_id
  ) then
    raise exception 'Template does not belong to tenant' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_customer_ids) item(value)
    where not exists (
      select 1 from public.customers customer
      where customer.tenant_id = p_tenant_id and customer.id = item.value::uuid
    )
  ) then
    raise exception 'Customer link does not belong to tenant' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_contract_ids) item(value)
    where not exists (
      select 1 from public.contracts contract
      where contract.tenant_id = p_tenant_id and contract.id = item.value::uuid
    )
  ) then
    raise exception 'Contract link does not belong to tenant' using errcode = '22023';
  end if;

  insert into public.work_items (
    tenant_id,
    parent_id,
    template_id,
    title,
    description,
    status,
    priority,
    assignee_employee_id,
    planned_start_date,
    planned_end_date,
    planned_start_time,
    planned_end_time,
    color,
    created_by
  )
  values (
    p_tenant_id,
    v_parent_id,
    v_template_id,
    btrim(p_payload->>'title'),
    coalesce(p_payload->>'description', ''),
    coalesce(nullif(p_payload->>'status', ''), 'todo')::public.work_item_status,
    coalesce(nullif(p_payload->>'priority', ''), 'normal')::public.work_item_priority,
    v_assignee_id,
    nullif(p_payload->>'plannedStartDate', '')::date,
    nullif(p_payload->>'plannedEndDate', '')::date,
    coalesce(nullif(p_payload->>'plannedStartTime', ''), '00:00')::time,
    coalesce(nullif(p_payload->>'plannedEndTime', ''), '00:00')::time,
    coalesce(nullif(p_payload->>'color', ''), '#2563eb'),
    auth.uid()
  )
  returning id into v_work_item_id;

  insert into public.work_item_customers (tenant_id, work_item_id, customer_id)
  select p_tenant_id, v_work_item_id, item.value::uuid
  from jsonb_array_elements_text(v_customer_ids) item(value)
  on conflict do nothing;

  insert into public.work_item_contracts (tenant_id, work_item_id, contract_id)
  select p_tenant_id, v_work_item_id, item.value::uuid
  from jsonb_array_elements_text(v_contract_ids) item(value)
  on conflict do nothing;

  if v_template_id is not null then
    for v_step in
      select title, description, sort_order
      from public.work_template_steps
      where tenant_id = p_tenant_id and template_id = v_template_id
      order by sort_order, id
    loop
      insert into public.work_items (
        tenant_id, parent_id, title, description, status, priority,
        assignee_employee_id, sort_order, created_by
      )
      values (
        p_tenant_id,
        v_work_item_id,
        v_step.title,
        v_step.description,
        'todo',
        coalesce(nullif(p_payload->>'priority', ''), 'normal')::public.work_item_priority,
        null,
        v_step.sort_order,
        auth.uid()
      );
    end loop;
  end if;

  return v_work_item_id;
end;
$$;

revoke execute on function public.create_work_item(uuid, jsonb) from public, anon;
grant execute on function public.create_work_item(uuid, jsonb) to authenticated;

create or replace function public.list_work_items(
  p_tenant_id uuid,
  p_assignee_employee_id uuid default null,
  p_search text default null,
  p_statuses text[] default null,
  p_priority text default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 200);
  v_search text := nullif(btrim(p_search), '');
begin
  if auth.uid() is null or not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;

  return (
    with filtered as (
      select work_item.*
      from public.work_items work_item
      where work_item.tenant_id = p_tenant_id
        and (
          p_assignee_employee_id is null
          or work_item.assignee_employee_id = p_assignee_employee_id
        )
        and (
          p_statuses is null
          or cardinality(p_statuses) = 0
          or work_item.status::text = any(p_statuses)
        )
        and (p_priority is null or work_item.priority::text = p_priority)
        and (
          v_search is null
          or work_item.code ilike '%' || v_search || '%'
          or work_item.title ilike '%' || v_search || '%'
          or work_item.description ilike '%' || v_search || '%'
        )
    ),
    page_rows as (
      select
        work_item.*,
        employee.employee_code as assignee_employee_code,
        concat_ws(' ', employee.last_name, employee.first_name) as assignee_name,
        (
          select count(*)::integer
          from public.work_items child
          where child.tenant_id = work_item.tenant_id
            and child.parent_id = work_item.id
        ) as child_count,
        (
          select count(*)::integer
          from public.work_items child
          where child.tenant_id = work_item.tenant_id
            and child.parent_id = work_item.id
            and child.status = 'completed'
        ) as completed_child_count,
        count(*) over () as total_count
      from filtered work_item
      left join public.employees employee
        on employee.tenant_id = work_item.tenant_id
       and employee.id = work_item.assignee_employee_id
      order by work_item.planned_end_date nulls last,
        work_item.planned_end_time,
        work_item.created_at desc,
        work_item.id
      offset (v_page - 1) * v_page_size
      limit v_page_size
    )
    select jsonb_build_object(
      'items', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', row.id,
              'tenantId', row.tenant_id,
              'code', row.code,
              'parentId', row.parent_id,
              'templateId', row.template_id,
              'title', row.title,
              'description', row.description,
              'status', row.status,
              'priority', row.priority,
              'assigneeEmployeeId', row.assignee_employee_id,
              'assigneeEmployeeCode', row.assignee_employee_code,
              'assigneeName', nullif(row.assignee_name, ''),
              'plannedStartDate', row.planned_start_date,
              'plannedEndDate', row.planned_end_date,
              'plannedStartTime', to_char(row.planned_start_time, 'HH24:MI'),
              'plannedEndTime', to_char(row.planned_end_time, 'HH24:MI'),
              'color', row.color,
              'actualStartedAt', row.actual_started_at,
              'actualCompletedAt', row.actual_completed_at,
              'childCount', row.child_count,
              'completedChildCount', row.completed_child_count,
              'customers', coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', customer.id,
                      'code', customer.customer_code,
                      'name', customer.name
                    ) order by customer.name, customer.id
                  )
                  from public.work_item_customers link
                  join public.customers customer
                    on customer.tenant_id = link.tenant_id
                   and customer.id = link.customer_id
                  where link.tenant_id = row.tenant_id
                    and link.work_item_id = row.id
                ),
                '[]'::jsonb
              ),
              'contracts', coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', contract.id,
                      'code', contract.contract_code,
                      'name', contract.name
                    ) order by contract.name, contract.id
                  )
                  from public.work_item_contracts link
                  join public.contracts contract
                    on contract.tenant_id = link.tenant_id
                   and contract.id = link.contract_id
                  where link.tenant_id = row.tenant_id
                    and link.work_item_id = row.id
                ),
                '[]'::jsonb
              )
            ) order by row.planned_end_date nulls last,
              row.planned_end_time,
              row.created_at desc,
              row.id
          )
          from page_rows row
        ),
        '[]'::jsonb
      ),
      'total', coalesce((select max(total_count) from page_rows), 0)
    )
  );
end;
$$;

revoke execute on function public.list_work_items(uuid, uuid, text, text[], text, integer, integer)
  from public, anon;
grant execute on function public.list_work_items(uuid, uuid, text, text[], text, integer, integer)
  to authenticated;
