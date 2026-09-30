-- Mẫu công việc và công việc đều có tối đa hai cấp:
-- cấp 0 có thể chứa các mục cấp 1; cấp 1 không thể có mục con.

do $migration$
begin
  if exists (
    select 1
    from public.work_items child
    left join public.work_items parent
      on parent.id = child.parent_id
    where child.parent_id is not null
      and (
        parent.id is null
        or parent.tenant_id <> child.tenant_id
        or parent.parent_id is not null
      )
  ) then
    raise exception 'Cannot enforce the two-level work hierarchy while invalid or level-three work items exist';
  end if;
end;
$migration$;

alter table public.work_templates
  add column parent_id uuid,
  add column sort_order integer not null default 0;

alter table public.work_templates
  add constraint work_templates_sort_order_check check (sort_order >= 0);

alter table public.work_templates
  add constraint work_templates_parent_fk
  foreign key (parent_id)
  references public.work_templates(id)
  on delete cascade;

create index work_templates_parent_idx
  on public.work_templates(parent_id, tenant_id, sort_order, id)
  where parent_id is not null;

create index work_items_parent_idx
  on public.work_items(parent_id)
  where parent_id is not null;

do $migration$
begin
  if exists (
    select 1
    from public.work_template_items item
    join public.work_templates template
      on template.id = item.id
  ) then
    raise exception 'A work template item ID conflicts with an existing work template ID';
  end if;

  if exists (
    select 1
    from public.work_template_items item
    join public.work_templates template
      on template.tenant_id = item.tenant_id
     and template.code = 'MVT-C-' || upper(replace(item.id::text, '-', ''))
  ) then
    raise exception 'A generated child-template code conflicts with an existing template code';
  end if;
end;
$migration$;

insert into public.work_templates (
  id, tenant_id, code, name, description, is_active, created_at, updated_at,
  priority, assignee_employee_id, color, parent_id, sort_order
)
select
  item.id,
  item.tenant_id,
  'MVT-C-' || upper(replace(item.id::text, '-', '')),
  item.title,
  item.description,
  true,
  item.created_at,
  item.updated_at,
  item.priority,
  item.assignee_employee_id,
  item.color,
  item.template_id,
  item.sort_order
from public.work_template_items item;

insert into public.tag_assignments (
  tenant_id, tag_id, subject_type, subject_id, created_by, created_at
)
select
  assignment.tenant_id,
  assignment.tag_id,
  'work_template',
  assignment.subject_id,
  assignment.created_by,
  assignment.created_at
from public.tag_assignments assignment
where assignment.subject_type = 'work_template_item'
on conflict (tenant_id, tag_id, subject_type, subject_id) do nothing;

delete from public.tag_assignments
where subject_type = 'work_template_item';

drop policy if exists "Tenant members can view work tag assignments"
  on public.tag_assignments;
create policy "Tenant members can view work tag assignments"
on public.tag_assignments for select to authenticated
using (
  public.is_tenant_member(tenant_id)
  and subject_type in ('work_item', 'work_template')
  and exists (
    select 1
    from public.tags tag
    join public.tag_groups tag_group
      on tag_group.tenant_id = tag.tenant_id
     and tag_group.id = tag.group_id
    where tag.tenant_id = tag_assignments.tenant_id
      and tag.id = tag_assignments.tag_id
      and tag_group.code = 'work-labels'
      and tag_group.kind = 'tag'
      and tag_group.is_active
  )
);

create or replace function public.enforce_work_template_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_parent_parent_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A work template cannot be its own parent'
      using errcode = '23514';
  end if;

  select parent.parent_id
  into v_parent_parent_id
  from public.work_templates parent
  where parent.id = new.parent_id
    and parent.tenant_id = new.tenant_id
  for update;

  if not found then
    raise exception 'Work template parent must belong to the same tenant'
      using errcode = '23503';
  end if;

  if v_parent_parent_id is not null then
    raise exception 'Work templates may only have two levels'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.work_templates child
    where child.parent_id = new.id
      and child.id <> new.id
  ) then
    raise exception 'A work template with children cannot become a child template'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_work_template_hierarchy()
  from public, anon, authenticated;
drop trigger if exists work_templates_enforce_hierarchy
  on public.work_templates;
create trigger work_templates_enforce_hierarchy
before insert or update on public.work_templates
for each row execute function public.enforce_work_template_hierarchy();

create or replace function public.enforce_work_item_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_parent_parent_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A work item cannot be its own parent'
      using errcode = '23514';
  end if;

  select parent.parent_id
  into v_parent_parent_id
  from public.work_items parent
  where parent.id = new.parent_id
    and parent.tenant_id = new.tenant_id
  for update;

  if not found then
    raise exception 'Work item parent must belong to the same tenant'
      using errcode = '23503';
  end if;

  if v_parent_parent_id is not null then
    raise exception 'Work items may only have two levels'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.work_items child
    where child.parent_id = new.id
      and child.id <> new.id
  ) then
    raise exception 'A work item with children cannot become a child item'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_work_item_hierarchy()
  from public, anon, authenticated;
drop trigger if exists work_items_enforce_hierarchy on public.work_items;
create trigger work_items_enforce_hierarchy
before insert or update on public.work_items
for each row execute function public.enforce_work_item_hierarchy();

drop function public.save_work_template(uuid, uuid, jsonb, jsonb, uuid[]);

create function public.save_work_template(
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
      assignee_employee_id, color, created_by
    ) values (
      p_tenant_id,
      p_parent_id,
      coalesce(p_sort_order, 0),
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
    set parent_id = p_parent_id,
        sort_order = coalesce(p_sort_order, 0),
        code = btrim(p_payload->>'code'),
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
        color, created_by
      ) values (
        p_tenant_id, v_work_item_id, v_child.id, v_child.name, v_child.description,
        'todo'::public.work_item_status, v_child.priority,
        v_child.assignee_employee_id, v_child.sort_order,
        time '00:00', time '00:00', v_child.color, auth.uid()
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

create or replace function public.delete_work_templates(
  p_tenant_id uuid,
  p_template_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_template_ids uuid[];
  v_subject_ids uuid[];
  v_deleted_count integer;
begin
  if auth.uid() is null
     or not coalesce(public.is_tenant_member(p_tenant_id), false) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;

  select coalesce(array_agg(requested.id order by requested.id), '{}'::uuid[])
  into v_template_ids
  from (
    select distinct requested.id
    from unnest(coalesce(p_template_ids, '{}'::uuid[])) requested(id)
    where requested.id is not null
  ) requested;

  if cardinality(v_template_ids) = 0 then
    return 0;
  end if;

  if exists (
    select 1
    from unnest(v_template_ids) requested(id)
    where not exists (
      select 1
      from public.work_templates template
      where template.tenant_id = p_tenant_id
        and template.id = requested.id
    )
  ) then
    raise exception 'Work template not found for tenant' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(subject.id), '{}'::uuid[])
  into v_subject_ids
  from public.work_templates subject
  where subject.tenant_id = p_tenant_id
    and (
      subject.id = any(v_template_ids)
      or subject.parent_id = any(v_template_ids)
    );

  if exists (
    select 1 from public.file_links link
    where link.tenant_id = p_tenant_id
      and link.subject_type = 'work_template'
      and link.subject_id = any(v_subject_ids)
  ) then
    raise exception 'Remove work template attachments before deleting templates'
      using errcode = '23514';
  end if;

  delete from public.tag_assignments assignment
  where assignment.tenant_id = p_tenant_id
    and assignment.subject_type = 'work_template'
    and assignment.subject_id = any(v_subject_ids);

  delete from public.work_templates template
  where template.tenant_id = p_tenant_id
    and template.id = any(v_template_ids);
  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$function$;

revoke all on function public.delete_work_templates(uuid, uuid[])
  from public, anon;
grant execute on function public.delete_work_templates(uuid, uuid[])
  to authenticated;

drop table public.work_template_items;

notify pgrst, 'reload schema';
