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
      and (
        v_owner_party_id is null
        or material.owner_party_id = v_owner_party_id
        or material.owner_snapshot ->> 'departmentId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'teamId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'employeeId' = v_owner_party_id::text
      )
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
    'summary', pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*)::integer from filtered),
      'due', (select pg_catalog.count(*)::integer from filtered where status = 'due'),
      'upcoming', (select pg_catalog.count(*)::integer from filtered where status = 'upcoming'),
      'inProgress', (select pg_catalog.count(*)::integer from filtered where status = 'in_progress')
    ),
    'total', (select pg_catalog.count(*) from status_filtered),
    'page', v_page,
    'pageSize', v_page_size
  ) into v_result;

  return v_result;
end;
$$;

