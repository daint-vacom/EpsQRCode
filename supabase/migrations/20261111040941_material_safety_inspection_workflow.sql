alter table public.material_safety_inspections
  add column status text not null default 'completed',
  alter column overall_result drop not null,
  add constraint material_safety_inspections_status_valid
    check (status in ('in_progress', 'completed')),
  add constraint material_safety_inspections_completed_result_required
    check (
      (status = 'in_progress' and overall_result is null)
      or (
        status = 'completed'
        and overall_result is not null
        and overall_result in ('passed', 'failed')
      )
    ),
  add constraint material_safety_inspections_checklist_snapshot_valid
    check (
      pg_catalog.jsonb_array_length(checklist_result) > 0
      and private.safety_inspection_checklist_is_valid(checklist_result)
    );

create unique index material_safety_inspections_one_open_per_material_idx
  on public.material_safety_inspections (material_id)
  where status = 'in_progress';
create index material_safety_inspections_status_date_idx
  on public.material_safety_inspections (status, inspected_at desc, id desc);

create or replace function private.safety_inspection_checklist_snapshot(
  p_result jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', inspection_group.value -> 'id',
      'name', inspection_group.value -> 'name',
      'criteria', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', criterion.value -> 'id',
            'content', criterion.value -> 'content'
          ) order by criterion.ordinality
        )
        from pg_catalog.jsonb_array_elements(inspection_group.value -> 'criteria')
          with ordinality as criterion(value, ordinality)
      ), '[]'::jsonb)
    ) order by inspection_group.ordinality
  ), '[]'::jsonb)
  from pg_catalog.jsonb_array_elements(p_result)
    with ordinality as inspection_group(value, ordinality)
$$;

create or replace function private.guard_material_safety_inspection_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'in_progress' then
    raise exception 'Only in-progress safety inspections can be updated'
      using errcode = '55000';
  end if;

  if new.id is distinct from old.id
     or new.material_id is distinct from old.material_id
     or new.inspected_by is distinct from old.inspected_by
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Safety inspection identity fields cannot be changed'
      using errcode = '55000';
  end if;

  if private.safety_inspection_checklist_snapshot(new.checklist_result)
      is distinct from private.safety_inspection_checklist_snapshot(old.checklist_result) then
    raise exception 'Safety inspection checklist snapshots cannot be changed'
      using errcode = '55000';
  end if;

  if new.status = 'completed' and exists (
    select 1
    from pg_catalog.jsonb_array_elements(new.checklist_result) as inspection_group(value)
    cross join lateral pg_catalog.jsonb_array_elements(
      inspection_group.value -> 'criteria'
    ) as criterion(value)
    where pg_catalog.jsonb_typeof(criterion.value -> 'passed') is distinct from 'boolean'
  ) then
    raise exception 'Every safety inspection checklist item must be assessed'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.safety_inspection_checklist_snapshot(jsonb)
  from public, anon;
revoke all on function private.guard_material_safety_inspection_update()
  from public, anon, authenticated;
grant execute on function private.safety_inspection_checklist_snapshot(jsonb)
  to authenticated;
create trigger material_safety_inspections_guard_update
before update on public.material_safety_inspections
for each row execute function private.guard_material_safety_inspection_update();

grant update on public.material_safety_inspections to authenticated;
drop policy material_safety_inspections_insert_with_permission
  on public.material_safety_inspections;
create policy material_safety_inspections_insert_with_permission
on public.material_safety_inspections for insert to authenticated
with check (
  status = 'in_progress'
  and inspected_by = (select auth.uid())
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.materials material
    where material.id = material_id
      and (
        public.has_scoped_permission('materials:material:manage', material.owner_party_id)
        or (material.borrower_party_id is not null and
            public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
      )
  )
);

create policy material_safety_inspections_update_with_permission
on public.material_safety_inspections for update to authenticated
using (
  status = 'in_progress'
  and exists (
    select 1
    from public.materials material
    where material.id = material_id
      and (
        public.has_scoped_permission('materials:material:manage', material.owner_party_id)
        or (material.borrower_party_id is not null and
            public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
      )
  )
)
with check (
  status in ('in_progress', 'completed')
  and exists (
    select 1
    from public.materials material
    where material.id = material_id
      and (
        public.has_scoped_permission('materials:material:manage', material.owner_party_id)
        or (material.borrower_party_id is not null and
            public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
      )
  )
);

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
  v_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  with current_models as (
    select
      material.id,
      material.code,
      coalesce(
        nullif(pg_catalog.btrim(material.name_override), ''),
        nullif(material.model_snapshot ->> 'name', ''),
        material.code
      ) as name,
      material.created_at,
      material.inspection_settings_override_enabled,
      material.requires_inspection_override,
      material.inspection_interval_value_override,
      material.inspection_interval_unit_override,
      material.safety_inspection_checklist_override_enabled,
      model_snapshot.snapshot as model_config,
      material_checklist.checklist as checklist_override
    from public.materials material
    cross join lateral (
      select public.material_model_snapshot(material.model_id) as snapshot
    ) model_snapshot
    left join public.material_safety_checklists material_checklist
      on material_checklist.material_id = material.id
    where material.is_active
      and public.can_view_material_current(material.id)
  ), effective_settings as (
    select
      current_models.*,
      case
        when inspection_settings_override_enabled
          then coalesce(requires_inspection_override, false)
        else coalesce((model_config ->> 'requiresInspection')::boolean, false)
      end as requires_inspection,
      case
        when inspection_settings_override_enabled and requires_inspection_override
          then coalesce(inspection_interval_value_override,
            (model_config ->> 'inspectionIntervalValue')::integer)
        else (model_config ->> 'inspectionIntervalValue')::integer
      end as interval_value,
      case
        when inspection_settings_override_enabled and requires_inspection_override
          then coalesce(inspection_interval_unit_override,
            model_config ->> 'inspectionIntervalUnit')
        else model_config ->> 'inspectionIntervalUnit'
      end as interval_unit,
      coalesce((model_config ->> 'skipInitialInspection')::boolean, false)
        as skip_initial_inspection,
      case
        when safety_inspection_checklist_override_enabled
          then coalesce(checklist_override, '[]'::jsonb)
        else coalesce(model_config -> 'safetyInspectionChecklist', '[]'::jsonb)
      end as effective_checklist
    from current_models
  ), scheduled as (
    select
      effective_settings.id,
      effective_settings.code,
      effective_settings.name,
      effective_settings.created_at,
      effective_settings.interval_value,
      effective_settings.interval_unit,
      effective_settings.skip_initial_inspection,
      effective_settings.effective_checklist,
      latest.inspected_at as last_inspected_at,
      active.id as active_inspection_id,
      case
        when latest.inspected_at is not null then
          ((latest.inspected_at at time zone 'Asia/Ho_Chi_Minh')::date
          + case effective_settings.interval_unit
              when 'day' then effective_settings.interval_value * interval '1 day'
              else effective_settings.interval_value * interval '1 month'
            end)::date
        else
          ((effective_settings.created_at at time zone 'Asia/Ho_Chi_Minh')::date
          + case
              when effective_settings.skip_initial_inspection then
                case effective_settings.interval_unit
                  when 'day' then effective_settings.interval_value * interval '1 day'
                  else effective_settings.interval_value * interval '1 month'
                end
              else interval '0 days'
            end)::date
      end as next_due_date
    from effective_settings
    left join lateral (
      select inspection.inspected_at
      from public.material_safety_inspections inspection
      where inspection.material_id = effective_settings.id
        and inspection.status = 'completed'
      order by inspection.inspected_at desc, inspection.id desc
      limit 1
    ) latest on true
    left join lateral (
      select inspection.id
      from public.material_safety_inspections inspection
      where inspection.material_id = effective_settings.id
        and inspection.status = 'in_progress'
      limit 1
    ) active on true
    where effective_settings.requires_inspection
  ), filtered as (
    select
      scheduled.*,
      case
        when active_inspection_id is not null then 'in_progress'
        when next_due_date <= v_today then 'due'
        else 'upcoming'
      end as status
    from scheduled
    where (
      v_search is null
      or code ilike '%' || v_search || '%'
      or name ilike '%' || v_search || '%'
    )
  ), status_filtered as (
    select *
    from filtered
    where v_status is null or status = v_status
  ), page_items as (
    select *
    from status_filtered
    order by
      case status when 'due' then 0 when 'in_progress' then 1 else 2 end,
      next_due_date asc,
      code asc,
      id asc
    offset (v_page - 1) * v_page_size
    limit v_page_size
  )
  select pg_catalog.jsonb_build_object(
    'items', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'lastInspectedAt', last_inspected_at,
        'nextDueDate', next_due_date,
        'daysRemaining', next_due_date - v_today,
        'status', status,
        'activeInspectionId', active_inspection_id,
        'hasChecklist', pg_catalog.jsonb_array_length(effective_checklist) > 0
      ) order by
        case status when 'due' then 0 when 'in_progress' then 1 else 2 end,
        next_due_date asc, code asc, id asc)
      from page_items
    ), '[]'::jsonb),
    'total', (select pg_catalog.count(*) from status_filtered),
    'page', v_page,
    'pageSize', v_page_size
  ) into v_result;

  return v_result;
end;
$$;

create or replace function private.list_material_safety_inspections(
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
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  with filtered as (
    select
      inspection.id,
      inspection.material_id,
      inspection.inspected_at,
      inspection.inspector_name,
      inspection.status,
      inspection.overall_result,
      material.code as material_code,
      coalesce(
        nullif(pg_catalog.btrim(material.name_override), ''),
        nullif(material.model_snapshot ->> 'name', ''),
        material.code
      ) as material_name
    from public.material_safety_inspections inspection
    join public.materials material on material.id = inspection.material_id
    where public.can_view_material_current(material.id)
      and (v_status is null or inspection.status = v_status)
      and (
        v_search is null
        or material.code ilike '%' || v_search || '%'
        or material.name_override ilike '%' || v_search || '%'
        or material.model_snapshot ->> 'name' ilike '%' || v_search || '%'
        or inspection.inspector_name ilike '%' || v_search || '%'
      )
  ), page_items as (
    select *
    from filtered
    order by inspected_at desc, id desc
    offset (v_page - 1) * v_page_size
    limit v_page_size
  )
  select pg_catalog.jsonb_build_object(
    'items', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', id,
        'materialId', material_id,
        'materialCode', material_code,
        'materialName', material_name,
        'inspectedAt', inspected_at,
        'inspectorName', inspector_name,
        'status', status,
        'overallResult', overall_result
      ) order by inspected_at desc, id desc)
      from page_items
    ), '[]'::jsonb),
    'total', (select pg_catalog.count(*) from filtered),
    'page', v_page,
    'pageSize', v_page_size
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function private.list_materials_requiring_safety_inspection(jsonb)
  from public, anon, authenticated;
revoke all on function private.list_material_safety_inspections(jsonb)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.list_materials_requiring_safety_inspection(jsonb)
  to authenticated;
grant execute on function private.list_material_safety_inspections(jsonb)
  to authenticated;

create or replace function public.list_materials_requiring_safety_inspection(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.list_materials_requiring_safety_inspection(p_filters)
$$;

create or replace function public.list_material_safety_inspections(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.list_material_safety_inspections(p_filters)
$$;

revoke all on function public.list_materials_requiring_safety_inspection(jsonb)
  from public, anon;
revoke all on function public.list_material_safety_inspections(jsonb)
  from public, anon;
grant execute on function public.list_materials_requiring_safety_inspection(jsonb)
  to authenticated;
grant execute on function public.list_material_safety_inspections(jsonb)
  to authenticated;

notify pgrst, 'reload schema';
