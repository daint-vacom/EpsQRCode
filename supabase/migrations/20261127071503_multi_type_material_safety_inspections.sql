-- Stable type identities with nullable field overrides. Inheritance is resolved
-- from group to model to material, independently for each configuration field.
create table public.material_safety_inspection_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.material_safety_inspection_type_configs (
  scope_kind text not null check (scope_kind in ('group', 'model', 'material')),
  scope_id uuid not null,
  type_id uuid not null references public.material_safety_inspection_types(id) on delete restrict,
  name_override text check (name_override is null or length(btrim(name_override)) > 0),
  checklist jsonb check (
    checklist is null or private.safety_inspection_checklist_is_valid(checklist)
  ),
  checklist_mode text not null default 'replace'
    check (checklist_mode in ('replace', 'append')),
  interval_value integer check (interval_value is null or interval_value > 0),
  interval_unit text check (interval_unit is null or interval_unit in ('day', 'month', 'quarter')),
  enabled boolean,
  starts_on date,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (scope_kind, scope_id, type_id),
  constraint material_safety_inspection_type_config_interval_valid check (
    (interval_value is null and interval_unit is null)
    or (interval_value is not null and interval_unit is not null)
  )
);

create index material_safety_inspection_type_configs_type_idx
  on public.material_safety_inspection_type_configs (type_id, scope_kind, scope_id);
create index material_safety_inspection_type_configs_scope_idx
  on public.material_safety_inspection_type_configs (scope_kind, scope_id, enabled);

alter table public.material_safety_inspection_types enable row level security;
alter table public.material_safety_inspection_type_configs enable row level security;
revoke all on public.material_safety_inspection_types,
  public.material_safety_inspection_type_configs from anon, authenticated;
grant select on public.material_safety_inspection_types to authenticated;
grant select on public.material_safety_inspection_type_configs
  to authenticated;

create policy material_safety_inspection_type_configs_select_with_permission
on public.material_safety_inspection_type_configs for select to authenticated
using (
  (scope_kind = 'group' and (
    public.has_permission('material_catalog:material_group:view')
    or public.has_permission('material_catalog:material_group:manage')
  ))
  or (scope_kind = 'model' and (
    public.has_permission('material_catalog:material_model:view')
    or public.has_permission('material_catalog:material_model:manage')
    or public.has_permission('materials:receipt:view')
    or public.has_permission('materials:receipt:manage')
  ))
  or (scope_kind = 'material' and public.can_view_material_current(scope_id))
);
create policy material_safety_inspection_types_select_with_permission
on public.material_safety_inspection_types for select to authenticated
using (exists (
  select 1 from public.material_safety_inspection_type_configs config
  where config.type_id = id
));
create table public.material_safety_inspection_schedules (
  material_id uuid not null references public.materials(id) on delete restrict,
  type_id uuid not null references public.material_safety_inspection_types(id) on delete restrict,
  anchor_date date not null,
  due_date date not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (material_id, type_id)
);
create index material_safety_inspection_schedules_due_idx
  on public.material_safety_inspection_schedules (due_date, material_id, type_id);
alter table public.material_safety_inspection_schedules enable row level security;
revoke all on public.material_safety_inspection_schedules from anon, authenticated;
grant select on public.material_safety_inspection_schedules to authenticated;
create policy material_safety_inspection_schedules_select_with_permission
on public.material_safety_inspection_schedules for select to authenticated
using (public.can_view_material_current(material_id));

create or replace function private.add_safety_inspection_interval(
  p_date date,
  p_value integer,
  p_unit text
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_date is null or p_value is null or p_value < 1
    or p_unit not in ('day', 'month', 'quarter') then
    raise exception 'Invalid safety inspection interval' using errcode = '22023';
  end if;
  if p_unit = 'day' then
    return p_date + p_value;
  elsif p_unit = 'month' then
    return (p_date + pg_catalog.make_interval(months => p_value))::date;
  end if;
  return (
    pg_catalog.date_trunc('quarter', p_date::timestamp)
    + pg_catalog.make_interval(months => 3 * (p_value + 1))
    - interval '1 day'
  )::date;
end;
$$;
revoke all on function private.add_safety_inspection_interval(date, integer, text)
  from public, anon, authenticated;

create or replace function private.effective_material_safety_inspection_types(
  p_material_id uuid
)
returns table (
  type_id uuid,
  name text,
  checklist jsonb,
  interval_value integer,
  interval_unit text,
  enabled boolean,
  starts_on date,
  source_kind text,
  source_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive target as (
    select material.id as material_id, material.model_id, model.group_id
    from public.materials material
    join public.material_models model on model.id = material.model_id
    where material.id = p_material_id
  ), group_chain(id, priority) as (
    select target.group_id, 0 from target where target.group_id is not null
    union all
    select parent.id, group_chain.priority - 1
    from group_chain
    join public.material_groups child on child.id = group_chain.id
    join public.material_groups parent on parent.id = child.parent_id
  ), scoped as (
    select config.*, group_chain.priority
    from group_chain
    join public.material_safety_inspection_type_configs config
      on config.scope_kind = 'group' and config.scope_id = group_chain.id
    union all
    select config.*, 2 as priority
    from target
    join public.material_safety_inspection_type_configs config
      on config.scope_kind = 'model' and config.scope_id = target.model_id
    union all
    select config.*, 3 as priority
    from target
    join public.material_safety_inspection_type_configs config
      on config.scope_kind = 'material' and config.scope_id = target.material_id
  ), type_ids as (
    select distinct scoped.type_id from scoped
  )
  select type_ids.type_id,
    coalesce((select config.name_override from scoped config
      where config.type_id = type_ids.type_id and config.name_override is not null
      order by config.priority desc limit 1), type_row.name),
    (select case
        when config.checklist_mode = 'append' and config.scope_kind = 'model' then
          coalesce((select parent_config.checklist from scoped parent_config
            where parent_config.type_id = config.type_id
              and parent_config.scope_kind = 'group'
              and parent_config.checklist is not null
            order by parent_config.priority desc limit 1), '[]'::jsonb)
          || config.checklist
        else config.checklist
      end from scoped config
      where config.type_id = type_ids.type_id and config.checklist is not null
      order by config.priority desc limit 1),
    (select config.interval_value from scoped config
      where config.type_id = type_ids.type_id and config.interval_value is not null
      order by config.priority desc limit 1),
    (select config.interval_unit from scoped config
      where config.type_id = type_ids.type_id and config.interval_unit is not null
      order by config.priority desc limit 1),
    coalesce((select config.enabled from scoped config
      where config.type_id = type_ids.type_id and config.enabled is not null
      order by config.priority desc limit 1), false),
    (select config.starts_on from scoped config
      where config.type_id = type_ids.type_id and config.starts_on is not null
      order by config.priority desc limit 1),
    (select config.scope_kind from scoped config
      where config.type_id = type_ids.type_id
      order by config.priority desc limit 1),
    (select config.scope_id from scoped config
      where config.type_id = type_ids.type_id
      order by config.priority desc limit 1)
  from type_ids
  join public.material_safety_inspection_types type_row
    on type_row.id = type_ids.type_id
  where type_row.archived_at is null
$$;
revoke all on function private.effective_material_safety_inspection_types(uuid)
  from public, anon, authenticated;

create or replace function public.list_material_safety_inspection_types_for_material(
  p_material_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if (select auth.uid()) is null
    or not public.can_view_material_current(p_material_id) then
    raise exception 'Permission denied to view material inspection types'
      using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'typeId', config.type_id,
    'typeName', config.name,
    'checklist', coalesce(config.checklist, '[]'::jsonb),
    'intervalValue', config.interval_value,
    'intervalUnit', config.interval_unit,
    'enabled', config.enabled,
    'startsOn', config.starts_on,
    'sourceKind', config.source_kind,
    'sourceId', config.source_id,
    'dueDate', schedule.due_date,
    'lastInspectedAt', latest.inspected_at,
    'activeInspectionId', active.id,
    'daysRemaining', case when config.enabled and schedule.due_date is not null
      then schedule.due_date - v_today else null end,
    'status', case
      when active.id is not null then 'in_progress'
      when not config.enabled or schedule.due_date is null then null
      when schedule.due_date <= v_today then 'due'
      else 'upcoming' end
  ) order by config.name, config.type_id), '[]'::jsonb)
  into v_result
  from private.effective_material_safety_inspection_types(p_material_id) config
  left join public.material_safety_inspection_schedules schedule
    on schedule.material_id = p_material_id and schedule.type_id = config.type_id
  left join lateral (
    select inspection.inspected_at
    from public.material_safety_inspections inspection
    where inspection.material_id = p_material_id
      and inspection.inspection_type_id = config.type_id
      and inspection.status = 'completed'
    order by inspection.inspected_at desc, inspection.id desc limit 1
  ) latest on true
  left join lateral (
    select inspection.id
    from public.material_safety_inspections inspection
    where inspection.material_id = p_material_id
      and inspection.inspection_type_id = config.type_id
      and inspection.status = 'in_progress'
    order by inspection.created_at, inspection.id limit 1
  ) active on true;
  return v_result;
end;
$$;
revoke all on function public.list_material_safety_inspection_types_for_material(uuid)
  from public, anon;
grant execute on function public.list_material_safety_inspection_types_for_material(uuid)
  to authenticated;

create or replace function public.start_material_safety_inspection_draft(
  p_material_id uuid,
  p_inspection_type_id uuid,
  p_inspector_name text,
  p_inspected_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_config record;
  v_existing_id uuid;
  v_inspection_id uuid := gen_random_uuid();
  v_checklist_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_inspector_name), '') is null or p_inspected_at is null then
    raise exception 'Inspector name and inspection date are required'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.materials material
    where material.id = p_material_id
      and material.is_active
      and (
        public.has_scoped_permission('materials:material:manage', material.owner_party_id)
        or (material.borrower_party_id is not null and
            public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
      )
  ) then
    raise exception 'Permission denied to manage material safety inspections'
      using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended(p_inspection_type_id::text, 1)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_material_id::text || ':' || p_inspection_type_id::text, 0)
  );
  select * into v_config
  from private.effective_material_safety_inspection_types(p_material_id) config
  where config.type_id = p_inspection_type_id and config.enabled
    and config.interval_value is not null and config.interval_unit is not null;
  if not found then
    raise exception 'Inspection type is not enabled for this material'
      using errcode = '22023';
  end if;
  if coalesce(jsonb_array_length(v_config.checklist), 0) = 0 then
    raise exception 'Inspection type has no checklist'
      using errcode = '22023';
  end if;
  select inspection.id into v_existing_id
  from public.material_safety_inspections inspection
  where inspection.material_id = p_material_id
    and inspection.inspection_type_id = p_inspection_type_id
    and inspection.status = 'in_progress'
  order by inspection.created_at, inspection.id
  limit 1;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', checklist_group.value -> 'id',
    'name', checklist_group.value -> 'name',
    'criteria', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', criterion.value -> 'id',
        'content', criterion.value -> 'content',
        'passed', null,
        'note', ''
      ) order by criterion.ordinality), '[]'::jsonb)
      from jsonb_array_elements(checklist_group.value -> 'criteria')
        with ordinality as criterion(value, ordinality)
    )
  ) order by checklist_group.ordinality), '[]'::jsonb)
  into v_checklist_result
  from jsonb_array_elements(v_config.checklist)
    with ordinality as checklist_group(value, ordinality);

  insert into public.material_safety_inspections (
    id, material_id, inspection_type_id, inspection_type_name_snapshot,
    inspected_at, inspected_by, inspector_name, checklist_result,
    overall_note, overall_result, status, attachments, created_by
  ) values (
    v_inspection_id, p_material_id, p_inspection_type_id, v_config.name,
    p_inspected_at, v_user_id, btrim(p_inspector_name), v_checklist_result,
    '', null, 'in_progress', '[]'::jsonb, v_user_id
  );
  return v_inspection_id;
end;
$$;
revoke all on function public.start_material_safety_inspection_draft(uuid, uuid, text, timestamptz)
  from public, anon;
grant execute on function public.start_material_safety_inspection_draft(uuid, uuid, text, timestamptz)
  to authenticated;

revoke insert on public.material_safety_inspections from anon, authenticated;

insert into public.material_safety_inspection_types (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Kiểm tra an toàn');

insert into public.material_safety_inspection_type_configs (
  scope_kind, scope_id, type_id, checklist, enabled, starts_on
)
select 'group', material_group.id,
  '00000000-0000-4000-8000-000000000001'::uuid,
  material_group.safety_inspection_checklist,
  null,
  (material_group.created_at at time zone 'Asia/Ho_Chi_Minh')::date
from public.material_groups material_group
where jsonb_array_length(material_group.safety_inspection_checklist) > 0;

insert into public.material_safety_inspection_type_configs (
  scope_kind, scope_id, type_id, checklist, checklist_mode, interval_value, interval_unit,
  enabled, starts_on
)
select 'model', model.id,
  '00000000-0000-4000-8000-000000000001'::uuid,
  coalesce(model_checklist.checklist, '[]'::jsonb),
  case
    when model.use_group_safety_inspection_checklist and exists (
      select 1 from public.material_safety_inspection_type_configs group_config
      where group_config.scope_kind = 'group' and group_config.scope_id = model.group_id
        and group_config.type_id = '00000000-0000-4000-8000-000000000001'::uuid
    ) then 'append'
    else 'replace'
  end,
  model.inspection_interval_value,
  model.inspection_interval_unit,
  model.requires_inspection,
  (model.created_at at time zone 'Asia/Ho_Chi_Minh')::date
from public.material_models model
left join public.material_model_safety_checklists model_checklist
  on model_checklist.model_id = model.id;

insert into public.material_safety_inspection_type_configs (
  scope_kind, scope_id, type_id, checklist, interval_value, interval_unit,
  enabled, starts_on
)
select 'material', material.id,
  '00000000-0000-4000-8000-000000000001'::uuid,
  case when material.safety_inspection_checklist_override_enabled
    then coalesce(checklist.checklist, '[]'::jsonb) end,
  case when material.inspection_settings_override_enabled
    and material.requires_inspection_override
    then material.inspection_interval_value_override end,
  case when material.inspection_settings_override_enabled
    and material.requires_inspection_override
    then material.inspection_interval_unit_override end,
  case when material.inspection_settings_override_enabled
    then material.requires_inspection_override end,
  coalesce(material.placed_into_service_date,
    (material.created_at at time zone 'Asia/Ho_Chi_Minh')::date)
from public.materials material
left join public.material_safety_checklists checklist
  on checklist.material_id = material.id
where material.inspection_settings_override_enabled
  or material.safety_inspection_checklist_override_enabled;

alter table public.material_safety_inspections
  add column inspection_type_id uuid,
  add column inspection_type_name_snapshot text;
alter table public.material_safety_inspections
  disable trigger material_safety_inspections_guard_update;
update public.material_safety_inspections
set inspection_type_id = '00000000-0000-4000-8000-000000000001',
    inspection_type_name_snapshot = 'Kiểm tra an toàn';
alter table public.material_safety_inspections
  enable trigger material_safety_inspections_guard_update;
alter table public.material_safety_inspections
  alter column inspection_type_id set not null,
  alter column inspection_type_id set default '00000000-0000-4000-8000-000000000001',
  alter column inspection_type_name_snapshot set not null,
  alter column inspection_type_name_snapshot set default 'Kiểm tra an toàn',
  add constraint material_safety_inspections_type_fk
    foreign key (inspection_type_id)
    references public.material_safety_inspection_types(id) on delete restrict;

create index material_safety_inspections_type_date_idx
  on public.material_safety_inspections (inspection_type_id, inspected_at desc, id desc);
drop index public.material_safety_inspections_one_open_per_material_idx;
create unique index material_safety_inspections_one_open_type_idx
  on public.material_safety_inspections (material_id, inspection_type_id)
  where status = 'in_progress';

create or replace function private.guard_material_safety_inspection_type_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.inspection_type_id is distinct from old.inspection_type_id
    or new.inspection_type_name_snapshot is distinct from old.inspection_type_name_snapshot then
    raise exception 'Safety inspection type snapshots cannot be changed'
      using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_material_safety_inspection_type_identity()
  from public, anon, authenticated;
create trigger material_safety_inspections_type_identity_guard
before update on public.material_safety_inspections
for each row execute function private.guard_material_safety_inspection_type_identity();

insert into public.material_safety_inspection_schedules (
  material_id, type_id, anchor_date, due_date
)
select material.id,
  config.type_id,
  coalesce(
    (latest.inspected_at at time zone 'Asia/Ho_Chi_Minh')::date,
    config.starts_on,
    (material.created_at at time zone 'Asia/Ho_Chi_Minh')::date
  ),
  coalesce(
    case when latest.inspected_at is not null then private.add_safety_inspection_interval(
      (latest.inspected_at at time zone 'Asia/Ho_Chi_Minh')::date,
      config.interval_value, config.interval_unit
    ) end,
    case
      when not coalesce((material.model_snapshot ->> 'skipInitialInspection')::boolean, false)
        then (material.created_at at time zone 'Asia/Ho_Chi_Minh')::date
      when config.interval_unit = 'quarter' then private.add_safety_inspection_interval(
        (material.created_at at time zone 'Asia/Ho_Chi_Minh')::date,
        config.interval_value, config.interval_unit
      )
      when config.interval_unit = 'month' then
        ((material.created_at at time zone 'Asia/Ho_Chi_Minh')::date
          + config.interval_value * interval '1 month')::date
      else (material.created_at at time zone 'Asia/Ho_Chi_Minh')::date
        + config.interval_value
    end
  )::date
from public.materials material
cross join lateral private.effective_material_safety_inspection_types(material.id) config
left join lateral (
  select inspection.inspected_at
  from public.material_safety_inspections inspection
  where inspection.material_id = material.id
    and inspection.inspection_type_id = config.type_id
    and inspection.status = 'completed'
  order by inspection.inspected_at desc, inspection.id desc
  limit 1
) latest on true
where material.is_active
  and config.enabled
  and config.interval_value is not null
  and config.interval_unit is not null;

create or replace function private.advance_material_safety_inspection_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config record;
  v_completed_date date;
  v_due_date date;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended(new.inspection_type_id::text, 1)
  );
  v_completed_date := (new.inspected_at at time zone 'Asia/Ho_Chi_Minh')::date;
  select * into v_config
  from private.effective_material_safety_inspection_types(new.material_id) config
  where config.type_id = new.inspection_type_id and config.enabled;
  if not found or v_config.interval_value is null or v_config.interval_unit is null then
    return new;
  end if;
  v_due_date := private.add_safety_inspection_interval(
    v_completed_date, v_config.interval_value, v_config.interval_unit
  );
  if v_config.interval_unit = 'quarter' then
    v_due_date := greatest(v_due_date, coalesce((
      select schedule.due_date
      from public.material_safety_inspection_schedules schedule
      where schedule.material_id = new.material_id
        and schedule.type_id = new.inspection_type_id
    ), v_due_date));
  end if;
  insert into public.material_safety_inspection_schedules (
    material_id, type_id, anchor_date, due_date, updated_at
  ) values (
    new.material_id, new.inspection_type_id, v_completed_date, v_due_date,
    timezone('utc', now())
  ) on conflict (material_id, type_id) do update
    set anchor_date = excluded.anchor_date,
        due_date = excluded.due_date,
        updated_at = excluded.updated_at;
  return new;
end;
$$;
revoke all on function private.advance_material_safety_inspection_schedule()
  from public, anon, authenticated;
create trigger material_safety_inspections_advance_type_schedule
after update of status on public.material_safety_inspections
for each row execute function private.advance_material_safety_inspection_schedule();

create or replace function private.list_materials_requiring_safety_inspection(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(nullif(p_filters ->> 'page', '')::integer, 1), 1);
  v_page_size integer := least(greatest(coalesce(nullif(p_filters ->> 'pageSize', '')::integer, 25), 1), 100);
  v_search text := nullif(pg_catalog.btrim(p_filters ->> 'search'), '');
  v_status text := nullif(p_filters ->> 'status', '');
  v_owner_party_id uuid := nullif(p_filters ->> 'ownerPartyId', '')::uuid;
  v_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_account_type text;
  v_external_organization_id uuid;
  v_current_department_id text;
  v_current_team_id text;
  v_department_id uuid;
  v_team_id uuid;
  v_access_scopes text[] := '{}'::text[];
  v_owner_filter_types text[] := '{}'::text[];
  v_result jsonb;
begin
  if (select auth.uid()) is null
    or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view material safety inspections'
      using errcode = '42501';
  end if;

  select profile.account_type, profile.external_organization_id
  into v_account_type, v_external_organization_id
  from public.user_profiles profile
  where profile.id = (select auth.uid());

  select current_employee.department_id, current_employee.team_id
  into v_current_department_id, v_current_team_id
  from private.current_account_eps_employee() current_employee;

  if v_current_department_id is not null then
    select party.id into v_department_id
    from public.material_custodians party
    where party.type = 'department'
      and party.source_type = 'eps_department'
      and party.source_id = v_current_department_id
      and party.is_active
    limit 1;
  end if;

  if v_current_team_id is not null then
    select party.id into v_team_id
    from public.material_custodians party
    where party.type = 'team'
      and party.source_type = 'eps_team'
      and party.source_id = v_current_team_id
      and party.is_active
    limit 1;
  end if;

  select coalesce(
    array_agg(distinct role_permission.scope)
      filter (where role_permission.scope is not null),
    '{}'::text[]
  )
  into v_access_scopes
  from public.user_roles assignment
  join public.roles role_record
    on role_record.id = assignment.role_id and role_record.is_active
  join public.role_permissions role_permission
    on role_permission.role_id = role_record.id
   and role_permission.permission_code = 'materials:material:view'
  join public.permission_definitions definition
    on definition.code = role_permission.permission_code
   and definition.is_active
  where assignment.user_id = (select auth.uid());

  if v_account_type = 'eps' and 'all' = any(v_access_scopes) then
    v_owner_filter_types := v_owner_filter_types || array['department', 'person']::text[];
  end if;

  if 'department' = any(v_access_scopes)
    and not ('all' = any(v_access_scopes))
  then
    if v_account_type = 'external' and v_external_organization_id is not null then
      v_owner_filter_types := v_owner_filter_types || array['external']::text[];
    elsif v_account_type = 'eps' and v_department_id is not null then
      v_owner_filter_types := v_owner_filter_types || array['person', 'team']::text[];
    end if;
  end if;

  if v_account_type = 'eps'
    and 'team' = any(v_access_scopes)
    and not ('all' = any(v_access_scopes))
    and not ('department' = any(v_access_scopes))
    and v_team_id is not null
  then
    v_owner_filter_types := v_owner_filter_types || array['person']::text[];
  end if;

  if 'assigned_warehouses' = any(v_access_scopes) then
    v_owner_filter_types := v_owner_filter_types || array['warehouse']::text[];
  end if;

  select coalesce(array_agg(distinct owner_type), '{}'::text[])
  into v_owner_filter_types
  from pg_catalog.unnest(v_owner_filter_types) as owner_types(owner_type);
  with recursive visibility_context as materialized (
    select * from private.current_material_visibility_context()
  ), visible_pairs as materialized (
    select
      material.id,
      config.type_id,
      config.name as type_name,
      config.checklist,
      config.interval_value,
      config.interval_unit,
      material.code,
      coalesce(nullif(pg_catalog.btrim(material.name_override), ''),
        nullif(material.model_snapshot ->> 'name', ''), material.code) as name,
      material.model_id,
      model.group_id,
      material.owner_snapshot,
      schedule.anchor_date,
      schedule.due_date,
      latest.inspected_at as last_inspected_at,
      active.id as active_inspection_id
    from public.materials material
    join public.material_models model on model.id = material.model_id
    cross join visibility_context visibility
    join lateral private.effective_material_safety_inspection_types(material.id) config
      on config.enabled and config.interval_value is not null
      and config.interval_unit is not null
    join public.material_safety_inspection_schedules schedule
      on schedule.material_id = material.id and schedule.type_id = config.type_id
    left join lateral (
      select inspection.inspected_at
      from public.material_safety_inspections inspection
      where inspection.material_id = material.id
        and inspection.inspection_type_id = config.type_id
        and inspection.status = 'completed'
      order by inspection.inspected_at desc, inspection.id desc
      limit 1
    ) latest on true
    left join lateral (
      select inspection.id
      from public.material_safety_inspections inspection
      where inspection.material_id = material.id
        and inspection.inspection_type_id = config.type_id
        and inspection.status = 'in_progress'
      order by inspection.created_at, inspection.id
      limit 1
    ) active on true
    where material.is_active
      and (
        visibility.can_view_all
        or coalesce(material.owner_party_id, nullif(material.owner_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids)
        or (material.status = 'loaned' and coalesce(material.borrower_party_id,
          nullif(material.borrower_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids))
      )
      and (v_owner_party_id is null
        or material.owner_party_id = v_owner_party_id
        or material.owner_snapshot ->> 'departmentId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'teamId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'employeeId' = v_owner_party_id::text)
  ), calculated as (
    select visible_pairs.*,
      case when active_inspection_id is not null then 'in_progress'
        when due_date <= v_today then 'due' else 'upcoming' end as status
    from visible_pairs
    where (v_search is null or code ilike '%' || v_search || '%'
      or name ilike '%' || v_search || '%')
  ), group_filtered as (
    select * from calculated
    where p_filters -> 'groupIds' is null or exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(
          case when pg_catalog.jsonb_typeof(p_filters -> 'groupIds') = 'array'
            then p_filters -> 'groupIds' else '[]'::jsonb end
        ) selected(group_id)
        where selected.group_id = calculated.group_id::text
      )
  ), group_ancestors as (
    select group_row.id as descendant_id, group_row.id as ancestor_id
    from public.material_groups group_row
    union all
    select child.id, ancestor.ancestor_id
    from group_ancestors ancestor
    join public.material_groups child on child.parent_id = ancestor.descendant_id
  ), group_counts as (
    select ancestor.ancestor_id as group_id, count(pair.id)::integer as count
    from group_ancestors ancestor
    left join calculated pair on pair.group_id = ancestor.descendant_id
    group by ancestor.ancestor_id
  ), status_filtered as (
    select * from group_filtered where v_status is null or status = v_status
  ), page_items as (
    select * from status_filtered
    order by case status when 'due' then 0 when 'in_progress' then 1 else 2 end,
      due_date, code, id, type_id
    offset (v_page - 1) * v_page_size limit v_page_size
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id,
      'typeId', type_id,
      'typeName', type_name,
      'code', code,
      'name', name,
      'lastInspectedAt', last_inspected_at,
      'nextDueDate', due_date,
      'daysRemaining', due_date - v_today,
      'status', status,
      'activeInspectionId', active_inspection_id,
      'hasChecklist', coalesce(jsonb_array_length(checklist), 0) > 0
    ) order by case status when 'due' then 0 when 'in_progress' then 1 else 2 end,
      due_date, code, id, type_id) from page_items), '[]'::jsonb),
    'total', (select count(*)::integer from status_filtered),
    'page', v_page,
    'pageSize', v_page_size,
    'groupCounts', coalesce((select jsonb_object_agg(group_id::text, count) from group_counts), '{}'::jsonb),
    'groupCountsTotal', (select count(*)::integer from calculated),
    'ownerFilter', pg_catalog.jsonb_build_object(
      'types', pg_catalog.to_jsonb(v_owner_filter_types),
      'departmentId', case
        when v_account_type = 'eps'
          and 'all' <> all(v_access_scopes)
          and 'department' = any(v_access_scopes)
          then v_department_id
        else null
      end,
      'teamId', case
        when v_account_type = 'eps'
          and 'all' <> all(v_access_scopes)
          and 'department' <> all(v_access_scopes)
          and 'team' = any(v_access_scopes)
          then v_team_id
        else null
      end
    ),
    'summary', jsonb_build_object(
      'total', (select count(*)::integer from group_filtered),
      'due', (select count(*)::integer from group_filtered where status = 'due'),
      'upcoming', (select count(*)::integer from group_filtered where status = 'upcoming'),
      'inProgress', (select count(*)::integer from group_filtered where status = 'in_progress')
    )
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.list_materials_requiring_safety_inspection(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.list_materials_requiring_safety_inspection(p_filters)
$$;

create or replace function private.get_material_safety_inspection_plan(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(pg_catalog.btrim(p_filters ->> 'search'), '');
  v_owner_party_id uuid := nullif(p_filters ->> 'ownerPartyId', '')::uuid;
  v_year integer := coalesce(nullif(p_filters ->> 'year', '')::integer,
    pg_catalog.date_part('year', pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::integer);
  v_start date;
  v_result jsonb;
begin
  if (select auth.uid()) is null
    or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view material inspection plans'
      using errcode = '42501';
  end if;
  if v_year < 1 or v_year > 9998 then
    raise exception 'Invalid inspection plan year' using errcode = '22023';
  end if;
  v_start := pg_catalog.make_date(v_year, 1, 1);

  with visibility_context as materialized (
    select * from private.current_material_visibility_context()
  ), visible_materials as materialized (
    select material.id
    from public.materials material
    join public.material_models model on model.id = material.model_id
    cross join visibility_context visibility
    where material.is_active
      and (
        visibility.can_view_all
        or coalesce(material.owner_party_id, nullif(material.owner_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids)
        or (material.status = 'loaned' and coalesce(material.borrower_party_id,
          nullif(material.borrower_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids))
      )
      and (v_owner_party_id is null
        or material.owner_party_id = v_owner_party_id
        or material.owner_snapshot ->> 'departmentId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'teamId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'employeeId' = v_owner_party_id::text)
      and (v_search is null or material.code ilike '%' || v_search || '%'
        or material.name_override ilike '%' || v_search || '%'
        or material.model_snapshot ->> 'name' ilike '%' || v_search || '%')
      and (p_filters -> 'groupIds' is null or exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(
          case when pg_catalog.jsonb_typeof(p_filters -> 'groupIds') = 'array'
            then p_filters -> 'groupIds' else '[]'::jsonb end
        ) selected(group_id)
        where selected.group_id = model.group_id::text
      ))
  ), visible_pairs as materialized (
    select material.id, config.type_id, schedule.due_date,
      active.id as active_inspection_id
    from visible_materials material
    join lateral private.effective_material_safety_inspection_types(material.id) config
      on config.enabled and config.interval_value is not null
      and config.interval_unit is not null
    join public.material_safety_inspection_schedules schedule
      on schedule.material_id = material.id and schedule.type_id = config.type_id
    left join lateral (
      select inspection.id
      from public.material_safety_inspections inspection
      where inspection.material_id = material.id
        and inspection.inspection_type_id = config.type_id
        and inspection.status = 'in_progress'
      order by inspection.created_at, inspection.id limit 1
    ) active on true
  ), months as (
    select pg_catalog.make_date(v_year, series.month_number, 1) as month_start
    from pg_catalog.generate_series(1, 12) series(month_number)
  ), due_counts as (
    select pg_catalog.date_trunc('month', pair.due_date)::date as month_start,
      count(*) filter (where pair.active_inspection_id is null)::integer as not_inspected,
      count(*) filter (where pair.active_inspection_id is not null)::integer as in_progress
    from visible_pairs pair
    where pair.due_date >= v_start
      and pair.due_date < pg_catalog.make_date(v_year + 1, 1, 1)
    group by 1
  ), completed_counts as (
    select pg_catalog.date_trunc('month',
        inspection.inspected_at at time zone 'Asia/Ho_Chi_Minh')::date as month_start,
      count(*)::integer as inspection_visits,
      count(distinct inspection.material_id)::integer as materials
    from public.material_safety_inspections inspection
    join visible_materials material on material.id = inspection.material_id
    where inspection.status = 'completed'
      and inspection.inspected_at >= (v_start::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and inspection.inspected_at < (pg_catalog.make_date(v_year + 1, 1, 1)::timestamp
        at time zone 'Asia/Ho_Chi_Minh')
    group by 1
  )
  select jsonb_build_object(
    'year', v_year,
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'month', pg_catalog.date_part('month', months.month_start)::integer,
      'notInspected', coalesce(due_counts.not_inspected, 0),
      'inProgress', coalesce(due_counts.in_progress, 0),
      'completed', coalesce(completed_counts.inspection_visits, 0),
      'inspectionVisits', coalesce(completed_counts.inspection_visits, 0),
      'materials', coalesce(completed_counts.materials, 0)
    ) order by months.month_start), '[]'::jsonb)
  ) into v_result
  from months
  left join due_counts using (month_start)
  left join completed_counts using (month_start);
  return v_result;
end;
$$;

create or replace function public.get_material_safety_inspection_plan(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_material_safety_inspection_plan(p_filters)
$$;

create or replace function private.preview_material_safety_inspection_due_dates(
  p_scope_kind text,
  p_scope_id uuid,
  p_type_id uuid,
  p_interval_value integer,
  p_interval_unit text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
  v_token text;
begin
  if p_scope_kind not in ('group', 'model', 'material')
    or p_scope_id is null or p_type_id is null
    or p_interval_value is null or p_interval_value < 1
    or p_interval_unit not in ('day', 'month', 'quarter') then
    raise exception 'Invalid safety inspection schedule preview'
      using errcode = '22023';
  end if;
  with recursive descendants(group_id) as (
    select p_scope_id where p_scope_kind = 'group'
    union all
    select child.id
    from public.material_groups child
    join descendants parent on child.parent_id = parent.group_id
  ), group_path(model_group_id, group_id) as (
    select descendants.group_id, descendants.group_id from descendants
    union all
    select group_path.model_group_id, child.parent_id
    from group_path
    join public.material_groups child on child.id = group_path.group_id
    where child.parent_id is not null and group_path.group_id <> p_scope_id
  ), visibility_context as materialized (
    select * from private.current_material_visibility_context()
  ), candidates as materialized (
    select material.id as material_id, material.code,
      coalesce(nullif(btrim(material.name_override), ''),
        nullif(material.model_snapshot ->> 'name', ''), material.code) as name,
      config.starts_on,
      schedule.due_date as old_due_date,
      schedule.anchor_date,
      latest.inspected_at as last_inspected_at,
      coalesce(
        (latest.inspected_at at time zone 'Asia/Ho_Chi_Minh')::date,
        schedule.anchor_date,
        config.starts_on,
        material.placed_into_service_date,
        (material.created_at at time zone 'Asia/Ho_Chi_Minh')::date
      ) as calculation_anchor
    from public.materials material
    join public.material_models model on model.id = material.model_id
    cross join visibility_context visibility
    join lateral private.effective_material_safety_inspection_types(material.id) config
      on config.type_id = p_type_id and config.enabled
    left join public.material_safety_inspection_schedules schedule
      on schedule.material_id = material.id and schedule.type_id = p_type_id
    left join lateral (
      select inspection.inspected_at
      from public.material_safety_inspections inspection
      where inspection.material_id = material.id
        and inspection.inspection_type_id = p_type_id
        and inspection.status = 'completed'
      order by inspection.inspected_at desc, inspection.id desc limit 1
    ) latest on true
    where material.is_active
      and (
        visibility.can_view_all
        or coalesce(material.owner_party_id, nullif(material.owner_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids)
        or (material.status = 'loaned' and coalesce(material.borrower_party_id,
          nullif(material.borrower_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids))
      )
      and case p_scope_kind
        when 'group' then model.group_id in (select group_id from descendants)
        when 'model' then model.id = p_scope_id
        else material.id = p_scope_id
      end
      and not (
        p_scope_kind = 'group' and (
          exists (
            select 1 from public.material_safety_inspection_type_configs child_group_config
            where child_group_config.type_id = p_type_id
              and child_group_config.scope_kind = 'group'
              and exists (
                select 1 from group_path
                where group_path.model_group_id = model.group_id
                  and group_path.group_id = child_group_config.scope_id
              )
              and child_group_config.scope_id <> p_scope_id
              and child_group_config.interval_value is not null
          )
          or exists (
            select 1 from public.material_safety_inspection_type_configs model_config
            where model_config.type_id = p_type_id
              and model_config.scope_kind = 'model'
              and model_config.scope_id = material.model_id
              and model_config.interval_value is not null
          )
          or exists (
            select 1 from public.material_safety_inspection_type_configs material_config
            where material_config.type_id = p_type_id
              and material_config.scope_kind = 'material'
              and material_config.scope_id = material.id
              and material_config.interval_value is not null
          )
        )
        or p_scope_kind = 'model' and exists (
          select 1 from public.material_safety_inspection_type_configs material_config
          where material_config.type_id = p_type_id
            and material_config.scope_kind = 'material'
            and material_config.scope_id = material.id
            and material_config.interval_value is not null
        )
      )
  ), proposed as (
    select candidates.*,
      private.add_safety_inspection_interval(
        calculation_anchor, p_interval_value, p_interval_unit
      ) as calculated_due_date
    from candidates
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'materialId', material_id,
    'code', code,
    'name', name,
    'anchorDate', calculation_anchor,
    'lastCompletedAt', last_inspected_at,
    'oldDueDate', old_due_date,
    'newDueDate', calculated_due_date
  ) order by name, code, material_id), '[]'::jsonb)
  into v_items
  from proposed;
  v_token := md5(jsonb_build_object(
    'scopeKind', p_scope_kind,
    'scopeId', p_scope_id,
    'typeId', p_type_id,
    'intervalValue', p_interval_value,
    'intervalUnit', p_interval_unit,
    'items', v_items
  )::text);
  return jsonb_build_object('token', v_token, 'total', jsonb_array_length(v_items), 'items', v_items);
end;
$$;
revoke all on function private.preview_material_safety_inspection_due_dates(text, uuid, uuid, integer, text)
  from public, anon, authenticated;

create or replace function public.preview_material_safety_inspection_due_dates(
  p_scope_kind text,
  p_scope_id uuid,
  p_type_id uuid,
  p_interval_value integer,
  p_interval_unit text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_scope_kind = 'group' then
    if not public.has_permission('material_catalog:material_group:manage') then
      raise exception 'Permission denied to preview safety inspection schedule'
        using errcode = '42501';
    end if;
  elsif p_scope_kind = 'model' then
    if not public.has_permission('material_catalog:material_model:manage') then
      raise exception 'Permission denied to preview safety inspection schedule'
        using errcode = '42501';
    end if;
  elsif p_scope_kind = 'material' then
    if not exists (
      select 1 from public.materials material where material.id = p_scope_id
        and (
          public.has_scoped_permission('materials:material:manage', material.owner_party_id)
          or (material.borrower_party_id is not null and
              public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
        )
    ) then
      raise exception 'Permission denied to preview safety inspection schedule'
        using errcode = '42501';
    end if;
  else
    raise exception 'Invalid safety inspection configuration scope'
      using errcode = '22023';
  end if;
  return private.preview_material_safety_inspection_due_dates(
    p_scope_kind, p_scope_id, p_type_id, p_interval_value, p_interval_unit
  );
end;
$$;
revoke all on function public.preview_material_safety_inspection_due_dates(text, uuid, uuid, integer, text)
  from public, anon;
grant execute on function public.preview_material_safety_inspection_due_dates(text, uuid, uuid, integer, text)
  to authenticated;

create or replace function public.save_material_safety_inspection_type_config(
  p_scope_kind text,
  p_scope_id uuid,
  p_type_id uuid,
  p_name text,
  p_checklist jsonb,
  p_checklist_mode text,
  p_interval_value integer,
  p_interval_unit text,
  p_enabled boolean,
  p_starts_on date,
  p_recalculate boolean default false,
  p_expected_preview_token text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_is_new_type boolean;
  v_previous_starts_on date;
  v_has_parent boolean;
  v_material_id uuid;
  v_material public.materials%rowtype;
  v_effective record;
  v_anchor_date date;
  v_preview jsonb;
  v_preview_item jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_scope_kind not in ('group', 'model', 'material')
    or p_scope_id is null or p_type_id is null
    or p_checklist_mode not in ('replace', 'append')
    or (p_checklist is not null
      and not private.safety_inspection_checklist_is_valid(p_checklist))
    or ((p_interval_value is null) <> (p_interval_unit is null))
    or (p_interval_value is not null and p_interval_value < 1)
    or (p_interval_unit is not null and p_interval_unit not in ('day', 'month', 'quarter')) then
    raise exception 'Invalid safety inspection type configuration'
      using errcode = '22023';
  end if;

  if p_scope_kind = 'group' then
    if not exists (select 1 from public.material_groups where id = p_scope_id)
      or not public.has_permission('material_catalog:material_group:manage') then
      raise exception 'Permission denied to manage safety inspection type'
        using errcode = '42501';
    end if;
  elsif p_scope_kind = 'model' then
    if not exists (select 1 from public.material_models where id = p_scope_id)
      or not public.has_permission('material_catalog:material_model:manage') then
      raise exception 'Permission denied to manage safety inspection type'
        using errcode = '42501';
    end if;
  else
    if not exists (
      select 1 from public.materials material
      where material.id = p_scope_id
        and (
          public.has_scoped_permission('materials:material:manage', material.owner_party_id)
          or (material.borrower_party_id is not null and
              public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
        )
    ) then
      raise exception 'Permission denied to manage safety inspection type'
        using errcode = '42501';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_type_id::text, 1)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_scope_kind || ':' || p_scope_id::text, 0)
  );
  select not exists (
    select 1 from public.material_safety_inspection_types type_row
    where type_row.id = p_type_id
  ) into v_is_new_type;
  select config.starts_on into v_previous_starts_on
  from public.material_safety_inspection_type_configs config
  where config.scope_kind = p_scope_kind and config.scope_id = p_scope_id
    and config.type_id = p_type_id;
  if p_scope_kind = 'group' then
    with recursive parents(id) as (
      select parent_id from public.material_groups where id = p_scope_id
      union all
      select group_row.parent_id from public.material_groups group_row
      join parents on group_row.id = parents.id where group_row.parent_id is not null
    )
    select exists (
      select 1 from public.material_safety_inspection_type_configs config
      where config.type_id = p_type_id and config.scope_kind = 'group'
        and config.scope_id in (select id from parents)
    ) into v_has_parent;
  elsif p_scope_kind = 'model' then
    with recursive parents(id) as (
      select model.group_id from public.material_models model where model.id = p_scope_id
      union all
      select group_row.parent_id from public.material_groups group_row
      join parents on group_row.id = parents.id where group_row.parent_id is not null
    )
    select exists (
      select 1 from public.material_safety_inspection_type_configs config
      where config.type_id = p_type_id and config.scope_kind = 'group'
        and config.scope_id in (select id from parents)
    ) into v_has_parent;
  else
    with recursive target as (
      select material.model_id, model.group_id
      from public.materials material
      join public.material_models model on model.id = material.model_id
      where material.id = p_scope_id
    ), recursive_parents(id) as (
      select target.group_id from target
      union all
      select group_row.parent_id from public.material_groups group_row
      join recursive_parents parent on group_row.id = parent.id
      where group_row.parent_id is not null
    )
    select exists (
      select 1 from public.material_safety_inspection_type_configs config, target
      where config.type_id = p_type_id and (
        (config.scope_kind = 'model' and config.scope_id = target.model_id)
        or (config.scope_kind = 'group' and config.scope_id in (select id from recursive_parents))
      )
    ) into v_has_parent;
  end if;
  if not v_is_new_type and not v_has_parent and not exists (
    select 1 from public.material_safety_inspection_type_configs config
    where config.type_id = p_type_id and config.scope_kind = p_scope_kind
      and config.scope_id = p_scope_id
  ) then
    raise exception 'Inspection type is not inherited in this scope'
      using errcode = '22023';
  end if;
  if p_scope_kind = 'material' and v_has_parent and p_checklist is not null
    and not exists (
      select 1 from public.material_safety_inspection_type_configs config
      where config.scope_kind = 'material' and config.scope_id = p_scope_id
        and config.type_id = p_type_id and config.checklist = p_checklist
    ) then
    raise exception 'An inherited checklist can be edited at its catalog scope'
      using errcode = '22023';
  end if;
  if v_is_new_type and nullif(btrim(p_name), '') is null then
    raise exception 'Inspection type name is required' using errcode = '22023';
  end if;
  if v_is_new_type and p_enabled is null then
    raise exception 'A new inspection type must have an enabled state'
      using errcode = '22023';
  end if;
  if v_is_new_type and (
    p_interval_value is null or p_interval_unit is null
    or coalesce(jsonb_array_length(p_checklist), 0) = 0
  ) then
    raise exception 'A new inspection type needs a checklist and interval'
      using errcode = '22023';
  end if;
  if p_recalculate then
    if p_enabled is false or v_is_new_type then
      raise exception 'Recalculation requires an existing enabled inspection type'
        using errcode = '22023';
    end if;
    if nullif(p_expected_preview_token, '') is null then
      raise exception 'Schedule preview is required before recalculation'
        using errcode = '22023';
    end if;
    v_preview := private.preview_material_safety_inspection_due_dates(
      p_scope_kind, p_scope_id, p_type_id, p_interval_value, p_interval_unit
    );
    if v_preview ->> 'token' is distinct from p_expected_preview_token then
      raise exception 'Inspection scope or dates changed after preview; review the preview again'
        using errcode = '40001';
    end if;
  end if;
  if v_is_new_type then
    insert into public.material_safety_inspection_types (id, name)
    values (p_type_id, btrim(p_name));
  end if;

  insert into public.material_safety_inspection_type_configs (
    scope_kind, scope_id, type_id, name_override, checklist, checklist_mode,
    interval_value, interval_unit, enabled, starts_on, updated_at
  ) values (
    p_scope_kind, p_scope_id, p_type_id,
    case when p_name is null then null
      when v_is_new_type then null else btrim(p_name) end,
    p_checklist, p_checklist_mode, p_interval_value, p_interval_unit,
    p_enabled, p_starts_on, timezone('utc', now())
  ) on conflict (scope_kind, scope_id, type_id) do update
    set name_override = excluded.name_override,
        checklist = excluded.checklist,
        checklist_mode = excluded.checklist_mode,
        interval_value = excluded.interval_value,
        interval_unit = excluded.interval_unit,
        enabled = excluded.enabled,
        starts_on = excluded.starts_on,
        updated_at = excluded.updated_at;

  for v_material_id in
    with recursive descendants(group_id) as (
      select p_scope_id where p_scope_kind = 'group'
      union all
      select child.id
      from public.material_groups child
      join descendants parent on child.parent_id = parent.group_id
    )
    select material.id
    from public.materials material
    join public.material_models model on model.id = material.model_id
    where material.is_active
      and case p_scope_kind
        when 'group' then model.group_id in (select group_id from descendants)
        when 'model' then model.id = p_scope_id
        else material.id = p_scope_id
      end
  loop
    select * into v_effective
    from private.effective_material_safety_inspection_types(v_material_id) config
    where config.type_id = p_type_id and config.enabled
      and config.interval_value is not null and config.interval_unit is not null;
    if found then
      select * into v_material from public.materials where id = v_material_id;
      v_anchor_date := coalesce(
        v_effective.starts_on,
        v_material.placed_into_service_date,
        (v_material.created_at at time zone 'Asia/Ho_Chi_Minh')::date
      );
      insert into public.material_safety_inspection_schedules (
        material_id, type_id, anchor_date, due_date
      ) values (v_material_id, p_type_id, v_anchor_date, v_anchor_date)
      on conflict (material_id, type_id) do nothing;
    end if;
  end loop;
  if p_recalculate then
    for v_preview_item in
      select item.value from jsonb_array_elements(v_preview -> 'items') item(value)
    loop
      update public.material_safety_inspection_schedules
      set anchor_date = (v_preview_item ->> 'anchorDate')::date,
          due_date = (v_preview_item ->> 'newDueDate')::date,
          updated_at = timezone('utc', now())
      where material_id = (v_preview_item ->> 'materialId')::uuid
        and type_id = p_type_id;
    end loop;
  elsif p_scope_kind = 'material' and p_starts_on is not null
    and p_starts_on is distinct from v_previous_starts_on
    and not exists (
      select 1 from public.material_safety_inspections inspection
      where inspection.material_id = p_scope_id
        and inspection.inspection_type_id = p_type_id and inspection.status = 'completed'
    ) then
    update public.material_safety_inspection_schedules schedule
    set anchor_date = p_starts_on, due_date = p_starts_on, updated_at = timezone('utc', now())
    where schedule.material_id = p_scope_id and schedule.type_id = p_type_id;
  end if;
  return p_type_id;
end;
$$;
revoke all on function public.save_material_safety_inspection_type_config(
  text, uuid, uuid, text, jsonb, text, integer, text, boolean, date, boolean, text
) from public, anon;
grant execute on function public.save_material_safety_inspection_type_config(
  text, uuid, uuid, text, jsonb, text, integer, text, boolean, date, boolean, text
) to authenticated;

create or replace function public.list_material_safety_inspection_type_configs_for_scope(
  p_scope_kind text,
  p_scope_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_group_id uuid;
  v_model_id uuid;
begin
  if (select auth.uid()) is null or p_scope_id is null
    or p_scope_kind not in ('group', 'model', 'material') then
    raise exception 'Invalid safety inspection configuration scope'
      using errcode = '22023';
  end if;
  if p_scope_kind = 'group' then
    if not exists (select 1 from public.material_groups where id = p_scope_id)
      or not (public.has_permission('material_catalog:material_group:view')
        or public.has_permission('material_catalog:material_group:manage')) then
      raise exception 'Permission denied to view safety inspection configuration'
        using errcode = '42501';
    end if;
    v_group_id := p_scope_id;
  elsif p_scope_kind = 'model' then
    select model.group_id into v_group_id
    from public.material_models model where model.id = p_scope_id;
    if not found or not (
      public.has_permission('material_catalog:material_model:view')
      or public.has_permission('material_catalog:material_model:manage')
      or public.has_permission('materials:receipt:view')
      or public.has_permission('materials:receipt:manage')
    ) then
      raise exception 'Permission denied to view safety inspection configuration'
        using errcode = '42501';
    end if;
    v_model_id := p_scope_id;
  else
    select material.model_id, model.group_id into v_model_id, v_group_id
    from public.materials material
    join public.material_models model on model.id = material.model_id
    where material.id = p_scope_id;
    if not found or not public.can_view_material_current(p_scope_id) then
      raise exception 'Permission denied to view safety inspection configuration'
        using errcode = '42501';
    end if;
  end if;

  with recursive group_chain(id, distance) as (
    select v_group_id, 0 where v_group_id is not null
    union all
    select parent.id, child_chain.distance + 1
    from public.material_groups child
    join group_chain child_chain on child.id = child_chain.id
    join public.material_groups parent on parent.id = child.parent_id
  ), scoped as (
    select config.*, (100 - group_chain.distance) as priority
    from group_chain
    join public.material_safety_inspection_type_configs config
      on config.scope_kind = 'group' and config.scope_id = group_chain.id
    union all
    select config.*, 200 as priority
    from public.material_safety_inspection_type_configs config
    where p_scope_kind in ('model', 'material')
      and config.scope_kind = 'model' and config.scope_id = v_model_id
    union all
    select config.*, 300 as priority
    from public.material_safety_inspection_type_configs config
    where p_scope_kind = 'material'
      and config.scope_kind = 'material' and config.scope_id = p_scope_id
  ), type_ids as (
    select distinct scoped.type_id from scoped
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'typeId', type_ids.type_id,
    'typeName', coalesce((select config.name_override from scoped config
      where config.type_id = type_ids.type_id and config.name_override is not null
      order by config.priority desc limit 1), type_row.name),
    'checklist', (select case
        when config.checklist_mode = 'append' and config.scope_kind = 'model' then
          coalesce((select parent_config.checklist from scoped parent_config
            where parent_config.type_id = config.type_id
              and parent_config.scope_kind = 'group'
              and parent_config.checklist is not null
            order by parent_config.priority desc limit 1), '[]'::jsonb)
          || config.checklist
        else config.checklist end
      from scoped config
      where config.type_id = type_ids.type_id and config.checklist is not null
      order by config.priority desc limit 1),
    'intervalValue', (select config.interval_value from scoped config
      where config.type_id = type_ids.type_id and config.interval_value is not null
      order by config.priority desc limit 1),
    'intervalUnit', (select config.interval_unit from scoped config
      where config.type_id = type_ids.type_id and config.interval_unit is not null
      order by config.priority desc limit 1),
    'enabled', coalesce((select config.enabled from scoped config
      where config.type_id = type_ids.type_id and config.enabled is not null
      order by config.priority desc limit 1), false),
    'startsOn', (select config.starts_on from scoped config
      where config.type_id = type_ids.type_id and config.starts_on is not null
      order by config.priority desc limit 1),
    'sourceKind', (select config.scope_kind from scoped config
      where config.type_id = type_ids.type_id
      order by config.priority desc limit 1),
    'sourceId', (select config.scope_id from scoped config
      where config.type_id = type_ids.type_id
      order by config.priority desc limit 1),
    'hasParent', exists (select 1 from scoped parent_config
      where parent_config.type_id = type_ids.type_id
        and (parent_config.scope_kind <> p_scope_kind
          or parent_config.scope_id <> p_scope_id)),
    'directConfig', (select jsonb_build_object(
      'nameOverride', direct.name_override,
      'checklist', direct.checklist,
      'checklistMode', direct.checklist_mode,
      'intervalValue', direct.interval_value,
      'intervalUnit', direct.interval_unit,
      'enabled', direct.enabled,
      'startsOn', direct.starts_on
    ) from public.material_safety_inspection_type_configs direct
      where direct.scope_kind = p_scope_kind
        and direct.scope_id = p_scope_id and direct.type_id = type_ids.type_id)
  ) order by type_row.name, type_ids.type_id), '[]'::jsonb)
  into v_result
  from type_ids
  join public.material_safety_inspection_types type_row on type_row.id = type_ids.type_id
  where type_row.archived_at is null;
  return v_result;
end;
$$;
revoke all on function public.list_material_safety_inspection_type_configs_for_scope(text, uuid)
  from public, anon;
grant execute on function public.list_material_safety_inspection_type_configs_for_scope(text, uuid)
  to authenticated;

create or replace function private.initialize_material_safety_inspection_schedules(
  p_material_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material public.materials%rowtype;
  v_config record;
  v_anchor date;
  v_scope_key text;
begin
  select * into v_material
  from public.materials material where material.id = p_material_id;
  if not found or not v_material.is_active then
    return;
  end if;
  -- Serialize creation against configuration saves for the scopes it inherits.
  for v_scope_key in
    with recursive group_chain(id) as (
      select model.group_id from public.material_models model
      where model.id = v_material.model_id and model.group_id is not null
      union all
      select parent.id
      from group_chain
      join public.material_groups child on child.id = group_chain.id
      join public.material_groups parent on parent.id = child.parent_id
    ), scopes(scope_key) as (
      select 'group:' || id::text from group_chain
      union all select 'model:' || v_material.model_id::text
      union all select 'material:' || p_material_id::text
    )
    select scope_key from scopes order by scope_key
  loop
    perform pg_catalog.pg_advisory_xact_lock_shared(
      pg_catalog.hashtextextended(v_scope_key, 0)
    );
  end loop;
  for v_config in
    select config.*
    from private.effective_material_safety_inspection_types(p_material_id) config
    where config.enabled and config.interval_value is not null
      and config.interval_unit is not null
  loop
    v_anchor := coalesce(v_config.starts_on, v_material.placed_into_service_date,
      (v_material.created_at at time zone 'Asia/Ho_Chi_Minh')::date);
    insert into public.material_safety_inspection_schedules (
      material_id, type_id, anchor_date, due_date
    ) values (p_material_id, v_config.type_id, v_anchor, v_anchor)
    on conflict (material_id, type_id) do nothing;
  end loop;
end;
$$;
revoke all on function private.initialize_material_safety_inspection_schedules(uuid)
  from public, anon, authenticated;

create or replace function private.initialize_material_schedules_after_material_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.initialize_material_safety_inspection_schedules(new.id);
  return new;
end;
$$;
revoke all on function private.initialize_material_schedules_after_material_change()
  from public, anon, authenticated;
create trigger materials_initialize_safety_inspection_schedules
after insert or update of model_id, is_active, placed_into_service_date
on public.materials
for each row execute function private.initialize_material_schedules_after_material_change();

create or replace function private.initialize_model_material_schedules_after_group_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material_id uuid;
begin
  if new.group_id is not distinct from old.group_id then
    return new;
  end if;
  for v_material_id in
    select material.id from public.materials material
    where material.model_id = new.id and material.is_active
  loop
    perform private.initialize_material_safety_inspection_schedules(v_material_id);
  end loop;
  return new;
end;
$$;
revoke all on function private.initialize_model_material_schedules_after_group_change()
  from public, anon, authenticated;
create trigger material_models_initialize_safety_inspection_schedules
after update of group_id on public.material_models
for each row execute function private.initialize_model_material_schedules_after_group_change();

notify pgrst, 'reload schema';
