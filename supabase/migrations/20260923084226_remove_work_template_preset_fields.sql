-- Mẫu lưu các thuộc tính có thể tái sử dụng; trạng thái và khung giờ được chọn
-- khi tạo công việc thực tế.
alter table public.work_templates
  drop column if exists status,
  drop column if exists planned_start_time,
  drop column if exists planned_end_time;

alter table public.work_template_items
  drop column if exists status,
  drop column if exists planned_start_time,
  drop column if exists planned_end_time;

create or replace function public.save_work_template(
  p_tenant_id uuid,
  p_template_id uuid,
  p_payload jsonb,
  p_children jsonb default '[]'::jsonb,
  p_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_template_id uuid := p_template_id;
  v_assignee_id uuid := nullif(p_payload->>'assigneeEmployeeId', '')::uuid;
  v_child jsonb;
  v_child_id uuid;
  v_child_assignee_id uuid;
  v_order integer := 0;
begin
  if auth.uid() is null or not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_payload->>'name', ''))) = 0 then
    raise exception 'Template name cannot be blank' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_children, '[]'::jsonb)) <> 'array' then
    raise exception 'Template children must be an array' using errcode = '22023';
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

  if v_template_id is null then
    insert into public.work_templates (
      tenant_id, code, name, description, priority,
      assignee_employee_id, color, created_by
    ) values (
      p_tenant_id,
      coalesce(nullif(btrim(p_payload->>'code'), ''), 'MVT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
      btrim(p_payload->>'name'),
      coalesce(p_payload->>'description', ''),
      coalesce(nullif(p_payload->>'priority', ''), 'normal')::public.work_item_priority,
      v_assignee_id,
      coalesce(nullif(p_payload->>'color', ''), '#2563eb'),
      auth.uid()
    ) returning id into v_template_id;
  else
    update public.work_templates
    set code = btrim(p_payload->>'code'),
        name = btrim(p_payload->>'name'),
        description = coalesce(p_payload->>'description', ''),
        priority = coalesce(nullif(p_payload->>'priority', ''), 'normal')::public.work_item_priority,
        assignee_employee_id = v_assignee_id,
        color = coalesce(nullif(p_payload->>'color', ''), '#2563eb')
    where tenant_id = p_tenant_id and id = v_template_id;
    if not found then
      raise exception 'Work template not found for tenant' using errcode = 'P0002';
    end if;
  end if;

  delete from public.tag_assignments assignment
  where assignment.tenant_id = p_tenant_id
    and assignment.subject_type = 'work_template'
    and assignment.subject_id = v_template_id;
  insert into public.tag_assignments (tenant_id, tag_id, subject_type, subject_id, created_by)
  select p_tenant_id, requested.label_id, 'work_template', v_template_id, auth.uid()
  from (select distinct label_id from unnest(coalesce(p_label_ids, '{}'::uuid[])) labels(label_id)) requested
  on conflict (tenant_id, tag_id, subject_type, subject_id) do nothing;

  delete from public.tag_assignments assignment
  where assignment.tenant_id = p_tenant_id
    and assignment.subject_type = 'work_template_item'
    and assignment.subject_id in (
      select item.id from public.work_template_items item
      where item.tenant_id = p_tenant_id and item.template_id = v_template_id
    );
  delete from public.work_template_items item
  where item.tenant_id = p_tenant_id and item.template_id = v_template_id;

  for v_child in select value from jsonb_array_elements(coalesce(p_children, '[]'::jsonb)) loop
    v_child_assignee_id := nullif(v_child->>'assigneeEmployeeId', '')::uuid;
    if length(btrim(coalesce(v_child->>'title', ''))) = 0 then
      raise exception 'Template child title cannot be blank' using errcode = '22023';
    end if;
    if v_child_assignee_id is not null and not exists (
      select 1 from public.employees employee
      where employee.tenant_id = p_tenant_id and employee.id = v_child_assignee_id
    ) then
      raise exception 'Template child assignee does not belong to tenant' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(coalesce(v_child->'labelIds', '[]'::jsonb)) labels(label_id)
      where not exists (
        select 1
        from public.tags tag
        join public.tag_groups tag_group
          on tag_group.tenant_id = tag.tenant_id and tag_group.id = tag.group_id
        where tag.tenant_id = p_tenant_id and tag.id = labels.label_id::uuid
          and tag.is_active and tag_group.code = 'work-labels'
          and tag_group.kind = 'tag' and tag_group.is_active
      )
    ) then
      raise exception 'Template child work label not found for tenant' using errcode = '23503';
    end if;

    insert into public.work_template_items (
      tenant_id, template_id, title, description, sort_order, priority,
      assignee_employee_id, color
    ) values (
      p_tenant_id, v_template_id, btrim(v_child->>'title'),
      coalesce(v_child->>'description', ''), v_order,
      coalesce(nullif(v_child->>'priority', ''), 'normal')::public.work_item_priority,
      v_child_assignee_id,
      coalesce(nullif(v_child->>'color', ''), '#2563eb')
    ) returning id into v_child_id;

    insert into public.tag_assignments (tenant_id, tag_id, subject_type, subject_id, created_by)
    select p_tenant_id, labels.label_id::uuid, 'work_template_item', v_child_id, auth.uid()
    from (
      select distinct value as label_id
      from jsonb_array_elements_text(coalesce(v_child->'labelIds', '[]'::jsonb))
    ) labels
    on conflict (tenant_id, tag_id, subject_type, subject_id) do nothing;
    v_order := v_order + 1;
  end loop;

  return v_template_id;
end;
$function$;
revoke all on function public.save_work_template(uuid, uuid, jsonb, jsonb, uuid[])
  from public, anon;
grant execute on function public.save_work_template(uuid, uuid, jsonb, jsonb, uuid[])
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
  v_assignee_id uuid := nullif(p_payload->>'assigneeEmployeeId', '')::uuid;
  v_customer_ids jsonb := coalesce(p_payload->'customerIds', '[]'::jsonb);
  v_contract_ids jsonb := coalesce(p_payload->'contractIds', '[]'::jsonb);
  v_child record;
begin
  if auth.uid() is null or not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;
  if v_parent_id is not null and not exists (
    select 1 from public.work_items where tenant_id = p_tenant_id and id = v_parent_id
  ) then
    raise exception 'Parent work item does not belong to tenant' using errcode = '22023';
  end if;
  if v_assignee_id is not null and not exists (
    select 1 from public.employees where tenant_id = p_tenant_id and id = v_assignee_id
  ) then
    raise exception 'Assignee does not belong to tenant' using errcode = '22023';
  end if;
  if v_template_id is not null and not exists (
    select 1 from public.work_templates
    where tenant_id = p_tenant_id and id = v_template_id and is_active
  ) then
    raise exception 'Active template does not belong to tenant' using errcode = '22023';
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
    planned_start_time, planned_end_time, color, created_by
  ) values (
    p_tenant_id, v_parent_id, v_template_id, btrim(p_payload->>'title'),
    coalesce(p_payload->>'description', ''),
    coalesce(nullif(p_payload->>'status', ''), 'todo')::public.work_item_status,
    coalesce(nullif(p_payload->>'priority', ''), 'normal')::public.work_item_priority,
    v_assignee_id, nullif(p_payload->>'plannedStartDate', '')::date,
    nullif(p_payload->>'plannedEndDate', '')::date,
    coalesce(nullif(p_payload->>'plannedStartTime', ''), '00:00')::time,
    coalesce(nullif(p_payload->>'plannedEndTime', ''), '00:00')::time,
    coalesce(nullif(p_payload->>'color', ''), '#2563eb'), auth.uid()
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
    insert into public.tag_assignments (tenant_id, tag_id, subject_type, subject_id, created_by)
    select p_tenant_id, assignment.tag_id, 'work_item', v_work_item_id, auth.uid()
    from public.tag_assignments assignment
    join public.tags tag on tag.tenant_id = assignment.tenant_id and tag.id = assignment.tag_id
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
    join public.files file on file.tenant_id = link.tenant_id and file.id = link.file_id
    where link.tenant_id = p_tenant_id
      and link.subject_type = 'work_template'
      and link.subject_id = v_template_id
      and file.status = 'active'
    on conflict (tenant_id, file_id, subject_type, subject_id, relation_type) do nothing;

    for v_child in
      select item.* from public.work_template_items item
      where item.tenant_id = p_tenant_id and item.template_id = v_template_id
      order by item.sort_order, item.id
    loop
      insert into public.work_items (
        tenant_id, parent_id, title, description, status, priority,
        assignee_employee_id, sort_order, planned_start_time, planned_end_time,
        color, created_by
      ) values (
        p_tenant_id, v_work_item_id, v_child.title, v_child.description,
        'todo'::public.work_item_status, v_child.priority, v_child.assignee_employee_id,
        v_child.sort_order, time '00:00', time '00:00',
        v_child.color, auth.uid()
      ) returning id into v_child_work_item_id;

      insert into public.tag_assignments (tenant_id, tag_id, subject_type, subject_id, created_by)
      select p_tenant_id, assignment.tag_id, 'work_item', v_child_work_item_id, auth.uid()
      from public.tag_assignments assignment
      join public.tags tag on tag.tenant_id = assignment.tenant_id and tag.id = assignment.tag_id
      join public.tag_groups tag_group
        on tag_group.tenant_id = tag.tenant_id and tag_group.id = tag.group_id
      where assignment.tenant_id = p_tenant_id
        and assignment.subject_type = 'work_template_item'
        and assignment.subject_id = v_child.id
        and tag.is_active
        and tag_group.code = 'work-labels'
        and tag_group.kind = 'tag'
        and tag_group.is_active
      on conflict (tenant_id, tag_id, subject_type, subject_id) do nothing;
    end loop;
  end if;

  return v_work_item_id;
end;
$function$;
revoke execute on function public.create_work_item(uuid, jsonb) from public, anon;
grant execute on function public.create_work_item(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
