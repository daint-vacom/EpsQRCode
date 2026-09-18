do $$
begin
  if not exists (
    select 1 from pg_type
    where typnamespace = 'public'::regnamespace and typname = 'work_item_status'
  ) then
    create type public.work_item_status as enum (
      'draft', 'todo', 'in_progress', 'paused', 'completed', 'cancelled'
    );
  end if;

  if not exists (
    select 1 from pg_type
    where typnamespace = 'public'::regnamespace and typname = 'work_item_priority'
  ) then
    create type public.work_item_priority as enum ('low', 'normal', 'high', 'urgent');
  end if;
end;
$$;

create table if not exists public.work_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null default ('MVT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint work_templates_tenant_code_unique unique (tenant_id, code),
  constraint work_templates_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.work_template_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  template_id uuid not null references public.work_templates(id) on delete cascade,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  planned_days integer not null default 0,
  is_required boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint work_template_steps_title_not_blank check (length(btrim(title)) > 0),
  constraint work_template_steps_sort_order_check check (sort_order >= 0),
  constraint work_template_steps_planned_days_check check (planned_days >= 0),
  constraint work_template_steps_template_fk
    foreign key (template_id)
    references public.work_templates(id)
    on delete cascade
);

create unique index if not exists work_templates_tenant_code_idx
  on public.work_templates(tenant_id, code);
create index if not exists work_template_steps_template_order_idx
  on public.work_template_steps(tenant_id, template_id, sort_order, id);

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null default ('CV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  parent_id uuid references public.work_items(id) on delete cascade,
  template_id uuid references public.work_templates(id) on delete set null,
  title text not null,
  description text not null default '',
  status public.work_item_status not null default 'todo',
  priority public.work_item_priority not null default 'normal',
  assignee_employee_id uuid references public.employees(id) on delete set null,
  sort_order integer not null default 0,
  planned_start_date date,
  planned_end_date date,
  actual_started_at timestamptz,
  actual_completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint work_items_tenant_code_unique unique (tenant_id, code),
  constraint work_items_title_not_blank check (length(btrim(title)) > 0),
  constraint work_items_date_range_check check (
    planned_end_date is null
    or planned_start_date is null
    or planned_end_date >= planned_start_date
  ),
  constraint work_items_parent_fk
    foreign key (parent_id)
    references public.work_items(id)
    on delete cascade,
  constraint work_items_template_fk
    foreign key (template_id)
    references public.work_templates(id)
    on delete set null,
  constraint work_items_sort_order_check check (sort_order >= 0)
);

create index if not exists work_items_tenant_status_idx
  on public.work_items(tenant_id, status, planned_end_date);
create index if not exists work_items_tenant_assignee_idx
  on public.work_items(tenant_id, assignee_employee_id, status, planned_end_date);
create index if not exists work_items_tenant_parent_idx
  on public.work_items(tenant_id, parent_id, sort_order);

create table if not exists public.work_item_customers (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  work_item_id uuid not null,
  customer_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, work_item_id, customer_id),
  constraint work_item_customers_work_fk
    foreign key (work_item_id)
    references public.work_items(id)
    on delete cascade,
  constraint work_item_customers_customer_fk
    foreign key (customer_id)
    references public.customers(id)
    on delete restrict
);

create table if not exists public.work_item_contracts (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  work_item_id uuid not null,
  contract_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, work_item_id, contract_id),
  constraint work_item_contracts_work_fk
    foreign key (work_item_id)
    references public.work_items(id)
    on delete cascade,
  constraint work_item_contracts_contract_fk
    foreign key (contract_id)
    references public.contracts(id)
    on delete restrict
);

create index if not exists work_item_customers_customer_idx
  on public.work_item_customers(tenant_id, customer_id, work_item_id);
create index if not exists work_item_contracts_contract_idx
  on public.work_item_contracts(tenant_id, contract_id, work_item_id);

create trigger work_templates_set_updated_at
before update on public.work_templates
for each row execute function public.set_updated_at();

create trigger work_template_steps_set_updated_at
before update on public.work_template_steps
for each row execute function public.set_updated_at();

create trigger work_items_set_updated_at
before update on public.work_items
for each row execute function public.set_updated_at();

create or replace function public.apply_work_item_actual_dates()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'in_progress' and old.status <> 'in_progress' and new.actual_started_at is null then
    new.actual_started_at := timezone('utc', now());
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    new.actual_completed_at := timezone('utc', now());
  elsif new.status <> 'completed' then
    new.actual_completed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists work_items_apply_actual_dates on public.work_items;
create trigger work_items_apply_actual_dates
before update on public.work_items
for each row execute function public.apply_work_item_actual_dates();

grant select, insert, update, delete
  on public.work_templates, public.work_template_steps, public.work_items,
     public.work_item_customers, public.work_item_contracts
  to authenticated;

alter table public.work_templates enable row level security;
alter table public.work_template_steps enable row level security;
alter table public.work_items enable row level security;
alter table public.work_item_customers enable row level security;
alter table public.work_item_contracts enable row level security;

create policy "Tenant members can view work templates"
on public.work_templates for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage work templates"
on public.work_templates for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy "Tenant members can view work template steps"
on public.work_template_steps for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage work template steps"
on public.work_template_steps for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (
  public.is_tenant_member(tenant_id)
  and exists (
    select 1 from public.work_templates template
    where template.id = work_template_steps.template_id
      and template.tenant_id = work_template_steps.tenant_id
  )
);

create or replace function public.work_item_parent_belongs_to_tenant(
  p_parent_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_parent_id is null
    or exists (
      select 1
      from public.work_items parent
      where parent.id = p_parent_id
        and parent.tenant_id = p_tenant_id
    );
$$;

revoke all on function public.work_item_parent_belongs_to_tenant(uuid, uuid) from public, anon;
grant execute on function public.work_item_parent_belongs_to_tenant(uuid, uuid) to authenticated;

create policy "Tenant members can view work items"
on public.work_items for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage work items"
on public.work_items for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (
  public.is_tenant_member(tenant_id)
  and public.work_item_parent_belongs_to_tenant(work_items.parent_id, work_items.tenant_id)
  and (
    work_items.template_id is null
    or exists (
      select 1 from public.work_templates template
      where template.id = work_items.template_id
        and template.tenant_id = work_items.tenant_id
    )
  )
  and (
    work_items.assignee_employee_id is null
    or exists (
      select 1 from public.employees employee
      where employee.id = work_items.assignee_employee_id
        and employee.tenant_id = work_items.tenant_id
    )
  )
);

create policy "Tenant members can view work item customers"
on public.work_item_customers for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage work item customers"
on public.work_item_customers for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (
  public.is_tenant_member(tenant_id)
  and exists (
    select 1 from public.work_items work_item
    where work_item.id = work_item_customers.work_item_id
      and work_item.tenant_id = work_item_customers.tenant_id
  )
  and exists (
    select 1 from public.customers customer
    where customer.id = work_item_customers.customer_id
      and customer.tenant_id = work_item_customers.tenant_id
  )
);

create policy "Tenant members can view work item contracts"
on public.work_item_contracts for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage work item contracts"
on public.work_item_contracts for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (
  public.is_tenant_member(tenant_id)
  and exists (
    select 1 from public.work_items work_item
    where work_item.id = work_item_contracts.work_item_id
      and work_item.tenant_id = work_item_contracts.tenant_id
  )
  and exists (
    select 1 from public.contracts contract
    where contract.id = work_item_contracts.contract_id
      and contract.tenant_id = work_item_contracts.tenant_id
  )
);

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

  -- A template is a snapshot source: changing the template later does not
  -- change this work item or its generated child items.
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
      order by work_item.planned_end_date nulls last, work_item.created_at desc, work_item.id
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
            ) order by row.planned_end_date nulls last, row.created_at desc, row.id
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

create or replace function public.create_work_template(
  p_tenant_id uuid,
  p_payload jsonb,
  p_steps jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
  v_step jsonb;
  v_order integer := 0;
begin
  if auth.uid() is null or not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;

  insert into public.work_templates (
    tenant_id, code, name, description, is_active, created_by
  )
  values (
    p_tenant_id,
    coalesce(nullif(btrim(p_payload->>'code'), ''), 'MVT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
    btrim(p_payload->>'name'),
    coalesce(p_payload->>'description', ''),
    coalesce((p_payload->>'isActive')::boolean, true),
    auth.uid()
  )
  returning id into v_template_id;

  for v_step in select value from jsonb_array_elements(p_steps)
  loop
    insert into public.work_template_steps (
      tenant_id, template_id, title, description, sort_order, planned_days, is_required
    )
    values (
      p_tenant_id,
      v_template_id,
      btrim(v_step->>'title'),
      coalesce(v_step->>'description', ''),
      v_order,
      greatest(coalesce((v_step->>'plannedDays')::integer, 0), 0),
      coalesce((v_step->>'isRequired')::boolean, true)
    );
    v_order := v_order + 1;
  end loop;

  return v_template_id;
end;
$$;

revoke execute on function public.create_work_template(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_work_template(uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
