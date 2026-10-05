-- Work item and reusable-template colors are removed. Status drives kanban indicators.
create or replace function public.save_work_template(
  p_tenant_id uuid,
  p_template_id uuid,
  p_parent_id uuid,
  p_payload jsonb,
  p_sort_order integer,
  p_label_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_template_id uuid := p_template_id;
  v_assignee_id uuid := nullif(p_payload->>'assigneeEmployeeId', '')::uuid;
  v_parent_parent_id uuid;
begin
  if auth.uid() is null or not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_payload->>'name', ''))) = 0 then
    raise exception 'Template name cannot be blank' using errcode = '22023';
  end if;
  if coalesce(p_sort_order, 0) < 0 then
    raise exception 'Template sort order must be non-negative' using errcode = '22023';
  end if;
  if v_assignee_id is not null and not exists (
    select 1 from public.employees employee
    where employee.tenant_id = p_tenant_id and employee.id = v_assignee_id
  ) then
    raise exception 'Template assignee does not belong to tenant' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_label_ids, '{}'::uuid[])) requested(label_id)
    where requested.label_id is null or not exists (
      select 1
      from public.tags tag
      join public.tag_groups tag_group
        on tag_group.tenant_id = tag.tenant_id and tag_group.id = tag.group_id
      where tag.tenant_id = p_tenant_id and tag.id = requested.label_id
        and tag.is_active and tag_group.code = 'work-labels'
        and tag_group.kind = 'tag' and tag_group.is_active
    )
  ) then
    raise exception 'Work label not found for tenant' using errcode = '23503';
  end if;

  if p_parent_id is not null then
    select parent.parent_id
    into v_parent_parent_id
    from public.work_templates parent
    where parent.tenant_id = p_tenant_id and parent.id = p_parent_id
    for update;
    if not found then
      raise exception 'Work template parent not found for tenant' using errcode = '22023';
    end if;
    if v_parent_parent_id is not null then
      raise exception 'Work templates may only have two levels' using errcode = '23514';
    end if;
  end if;

  if v_template_id is null then
    insert into public.work_templates (
      tenant_id, parent_id, sort_order, code, name, description, priority,
      assignee_employee_id, created_by
    ) values (
      p_tenant_id,
      p_parent_id,
      coalesce(p_sort_order, 0),
      coalesce(nullif(btrim(p_payload->>'code'), ''), 'MVT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
      btrim(p_payload->>'name'),
      coalesce(p_payload->>'description', ''),
      coalesce(nullif(p_payload->>'priority', ''), 'normal')::public.work_item_priority,
      v_assignee_id,
      auth.uid()
    ) returning id into v_template_id;
  else
    update public.work_templates
    set parent_id = p_parent_id,
        sort_order = coalesce(p_sort_order, 0),
        code = btrim(p_payload->>'code'),
        name = btrim(p_payload->>'name'),
        description = coalesce(p_payload->>'description', ''),
        priority = coalesce(nullif(p_payload->>'priority', ''), 'normal')::public.work_item_priority,
        assignee_employee_id = v_assignee_id
    where tenant_id = p_tenant_id and id = v_template_id;
    if not found then
      raise exception 'Work template not found for tenant' using errcode = 'P0002';
    end if;
  end if;

  delete from public.tag_assignments assignment
  where assignment.tenant_id = p_tenant_id
    and assignment.subject_type = 'work_template'
    and assignment.subject_id = v_template_id;
  insert into public.tag_assignments (
    tenant_id, tag_id, subject_type, subject_id, created_by
  )
  select p_tenant_id, requested.label_id, 'work_template', v_template_id, auth.uid()
  from (
    select distinct label_id
    from unnest(coalesce(p_label_ids, '{}'::uuid[])) labels(label_id)
  ) requested
  on conflict (tenant_id, tag_id, subject_type, subject_id) do nothing;

  return v_template_id;
end;
$function$;

revoke all on function public.save_work_template(uuid, uuid, uuid, jsonb, integer, uuid[])
  from public, anon;
grant execute on function public.save_work_template(uuid, uuid, uuid, jsonb, integer, uuid[])
  to authenticated;

create or replace function public.create_work_item(
  p_tenant_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_work_item_id uuid;
  v_child_work_item_id uuid;
  v_parent_id uuid := nullif(p_payload->>'parentId', '')::uuid;
  v_template_id uuid := nullif(p_payload->>'templateId', '')::uuid;
  v_parent_parent_id uuid;
  v_template_parent_id uuid;
  v_assignee_id uuid := nullif(p_payload->>'assigneeEmployeeId', '')::uuid;
  v_customer_ids jsonb := coalesce(p_payload->'customerIds', '[]'::jsonb);
  v_contract_ids jsonb := coalesce(p_payload->'contractIds', '[]'::jsonb);
  v_child record;
begin
  if auth.uid() is null or not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;
  if v_parent_id is not null then
    select parent.parent_id
    into v_parent_parent_id
    from public.work_items parent
    where parent.tenant_id = p_tenant_id and parent.id = v_parent_id
    for update;
    if not found then
      raise exception 'Parent work item does not belong to tenant' using errcode = '22023';
    end if;
    if v_parent_parent_id is not null then
      raise exception 'Work items may only have two levels' using errcode = '23514';
    end if;
  end if;
  if v_assignee_id is not null and not exists (
    select 1 from public.employees employee
    where employee.tenant_id = p_tenant_id and employee.id = v_assignee_id
  ) then
    raise exception 'Assignee does not belong to tenant' using errcode = '22023';
  end if;
  if v_template_id is not null then
    select template.parent_id
    into v_template_parent_id
    from public.work_templates template
    where template.tenant_id = p_tenant_id
      and template.id = v_template_id
      and template.is_active;
    if not found then
      raise exception 'Active template does not belong to tenant' using errcode = '22023';
    end if;
    if v_template_parent_id is not null then
      raise exception 'A child template cannot be used as a root template' using errcode = '22023';
    end if;
    if v_parent_id is not null and exists (
      select 1 from public.work_templates child_template
      where child_template.tenant_id = p_tenant_id
        and child_template.parent_id = v_template_id
    ) then
      raise exception 'A template with child templates can only create root work items' using errcode = '23514';
    end if;
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_customer_ids) item(value)
    where not exists (
      select 1 from public.customers customer
      where customer.tenant_id = p_tenant_id and customer.id = item.value::uuid
    )
  ) then
    raise exception 'Customer link does not belong to tenant' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_contract_ids) item(value)
    where not exists (
      select 1 from public.contracts contract
      where contract.tenant_id = p_tenant_id and contract.id = item.value::uuid
    )
  ) then
    raise exception 'Contract link does not belong to tenant' using errcode = '22023';
  end if;

  insert into public.work_items (
    tenant_id, parent_id, template_id, title, description, status, priority,
    assignee_employee_id, planned_start_date, planned_end_date,
    planned_start_time, planned_end_time, created_by
  ) values (
    p_tenant_id, v_parent_id, v_template_id, btrim(p_payload->>'title'),
    coalesce(p_payload->>'description', ''),
    coalesce(nullif(p_payload->>'status', ''), 'todo')::public.work_item_status,
    coalesce(nullif(p_payload->>'priority', ''), 'normal')::public.work_item_priority,
    v_assignee_id, nullif(p_payload->>'plannedStartDate', '')::date,
    nullif(p_payload->>'plannedEndDate', '')::date,
    coalesce(nullif(p_payload->>'plannedStartTime', ''), '00:00')::time,
    coalesce(nullif(p_payload->>'plannedEndTime', ''), '00:00')::time,
    auth.uid()
  ) returning id into v_work_item_id;

  insert into public.work_item_customers (tenant_id, work_item_id, customer_id)
  select p_tenant_id, v_work_item_id, item.value::uuid
  from jsonb_array_elements_text(v_customer_ids) item(value)
  on conflict do nothing;
  insert into public.work_item_contracts (tenant_id, work_item_id, contract_id)
  select p_tenant_id, v_work_item_id, item.value::uuid
  from jsonb_array_elements_text(v_contract_ids) item(value)
  on conflict do nothing;

  if v_template_id is not null then
    insert into public.tag_assignments (
      tenant_id, tag_id, subject_type, subject_id, created_by
    )
    select p_tenant_id, assignment.tag_id, 'work_item', v_work_item_id, auth.uid()
    from public.tag_assignments assignment
    join public.tags tag
      on tag.tenant_id = assignment.tenant_id and tag.id = assignment.tag_id
    join public.tag_groups tag_group
      on tag_group.tenant_id = tag.tenant_id and tag_group.id = tag.group_id
    where assignment.tenant_id = p_tenant_id
      and assignment.subject_type = 'work_template'
      and assignment.subject_id = v_template_id
      and tag.is_active
      and tag_group.code = 'work-labels'
      and tag_group.kind = 'tag'
      and tag_group.is_active
    on conflict (tenant_id, tag_id, subject_type, subject_id) do nothing;

    insert into public.file_links (
      tenant_id, file_id, subject_type, subject_id, relation_type, sort_order, created_by
    )
    select p_tenant_id, link.file_id, 'work_item', v_work_item_id,
      link.relation_type, link.sort_order, auth.uid()
    from public.file_links link
    join public.files file
      on file.tenant_id = link.tenant_id and file.id = link.file_id
    where link.tenant_id = p_tenant_id
      and link.subject_type = 'work_template'
      and link.subject_id = v_template_id
      and file.status = 'active'
    on conflict (tenant_id, file_id, subject_type, subject_id, relation_type) do nothing;

    for v_child in
      select child_template.*
      from public.work_templates child_template
      where child_template.tenant_id = p_tenant_id
        and child_template.parent_id = v_template_id
      order by child_template.sort_order, child_template.id
    loop
      insert into public.work_items (
        tenant_id, parent_id, template_id, title, description, status, priority,
        assignee_employee_id, sort_order, planned_start_time, planned_end_time,
        created_by
      ) values (
        p_tenant_id, v_work_item_id, v_child.id, v_child.name, v_child.description,
        'todo'::public.work_item_status, v_child.priority,
        v_child.assignee_employee_id, v_child.sort_order,
        time '00:00', time '00:00', auth.uid()
      ) returning id into v_child_work_item_id;

      insert into public.tag_assignments (
        tenant_id, tag_id, subject_type, subject_id, created_by
      )
      select p_tenant_id, assignment.tag_id, 'work_item', v_child_work_item_id, auth.uid()
      from public.tag_assignments assignment
      join public.tags tag
        on tag.tenant_id = assignment.tenant_id and tag.id = assignment.tag_id
      join public.tag_groups tag_group
        on tag_group.tenant_id = tag.tenant_id and tag_group.id = tag.group_id
      where assignment.tenant_id = p_tenant_id
        and assignment.subject_type = 'work_template'
        and assignment.subject_id = v_child.id
        and tag.is_active
        and tag_group.code = 'work-labels'
        and tag_group.kind = 'tag'
        and tag_group.is_active
      on conflict (tenant_id, tag_id, subject_type, subject_id) do nothing;

      insert into public.file_links (
        tenant_id, file_id, subject_type, subject_id, relation_type, sort_order, created_by
      )
      select p_tenant_id, link.file_id, 'work_item', v_child_work_item_id,
        link.relation_type, link.sort_order, auth.uid()
      from public.file_links link
      join public.files file
        on file.tenant_id = link.tenant_id and file.id = link.file_id
      where link.tenant_id = p_tenant_id
        and link.subject_type = 'work_template'
        and link.subject_id = v_child.id
        and file.status = 'active'
      on conflict (tenant_id, file_id, subject_type, subject_id, relation_type) do nothing;
    end loop;
  end if;

  return v_work_item_id;
end;
$function$;

revoke execute on function public.create_work_item(uuid, jsonb) from public, anon;
grant execute on function public.create_work_item(uuid, jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.list_work_items(p_tenant_id uuid, p_assignee_employee_id uuid DEFAULT NULL::uuid, p_search text DEFAULT NULL::text, p_statuses text[] DEFAULT NULL::text[], p_priority text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
      order by work_item.created_at desc, work_item.id desc
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
                    ) order by
                      case customer.status::text when 'active' then 0 when 'uncontacted' then 1 when 'inactive' then 2 else 3 end,
                      lower(customer.name) collate "vi-x-icu",
                      customer.id asc
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
                    ) order by contract.created_at desc, contract.id desc
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
            ) order by row.created_at desc, row.id desc
          )
          from page_rows row
        ),
        '[]'::jsonb
      ),
      'total', coalesce((select max(total_count) from page_rows), 0)
    )
  );
end;
$function$;

revoke execute on function public.list_work_items(uuid, uuid, text, text[], text, integer, integer)
  from public, anon;
grant execute on function public.list_work_items(uuid, uuid, text, text[], text, integer, integer)
  to authenticated;

alter table public.work_items
  drop constraint if exists work_items_color_format_check;
alter table public.work_items
  drop column if exists color;

alter table public.work_templates
  drop constraint if exists work_templates_color_format_check;
alter table public.work_templates
  drop column if exists color;

alter table public.work_template_items
  drop constraint if exists work_template_items_color_format_check;
alter table public.work_template_items
  drop column if exists color;

notify pgrst, 'reload schema';
