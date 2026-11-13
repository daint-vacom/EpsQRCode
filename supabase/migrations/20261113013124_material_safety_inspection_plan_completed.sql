create or replace function private.get_material_safety_inspection_plan(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_search text := nullif(pg_catalog.btrim(p_filters ->> 'search'), '');
  v_owner_party_id uuid := nullif(p_filters ->> 'ownerPartyId', '')::uuid;
  v_year integer := coalesce(
    nullif(p_filters ->> 'year', '')::integer,
    pg_catalog.date_part(
      'year',
      pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
    )::integer
  );
  v_start date;
  v_end date;
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
  v_end := pg_catalog.make_date(v_year + 1, 1, 1);

  with current_models as materialized (
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
      model_snapshot.snapshot as model_config
    from public.materials material
    cross join lateral (
      select public.material_model_snapshot(material.model_id) as snapshot
    ) model_snapshot
    where material.is_active
      and public.can_view_material_current(material.id)
      and (
        v_owner_party_id is null
        or material.owner_party_id = v_owner_party_id
        or material.owner_snapshot ->> 'departmentId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'teamId' = v_owner_party_id::text
        or material.owner_snapshot ->> 'employeeId' = v_owner_party_id::text
      )
  ), effective_settings as materialized (
    select
      current_models.*,
      case
        when inspection_settings_override_enabled
          then coalesce(requires_inspection_override, false)
        else coalesce((model_config ->> 'requiresInspection')::boolean, false)
      end as requires_inspection,
      case
        when inspection_settings_override_enabled
          and requires_inspection_override
          then coalesce(
            inspection_interval_value_override,
            (model_config ->> 'inspectionIntervalValue')::integer
          )
        else (model_config ->> 'inspectionIntervalValue')::integer
      end as interval_value,
      case
        when inspection_settings_override_enabled
          and requires_inspection_override
          then coalesce(
            inspection_interval_unit_override,
            model_config ->> 'inspectionIntervalUnit'
          )
        else model_config ->> 'inspectionIntervalUnit'
      end as interval_unit,
      coalesce((model_config ->> 'skipInitialInspection')::boolean, false)
        as skip_initial_inspection
    from current_models
  ), scheduled as materialized (
    select
      effective_settings.id,
      effective_settings.code,
      effective_settings.name,
      active_inspection.id as active_inspection_id,
      case
        when latest_inspection.inspected_at is not null then
          ((latest_inspection.inspected_at at time zone 'Asia/Ho_Chi_Minh')::date
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
    ) latest_inspection on true
    left join lateral (
      select inspection.id
      from public.material_safety_inspections inspection
      where inspection.material_id = effective_settings.id
        and inspection.status = 'in_progress'
      limit 1
    ) active_inspection on true
    where effective_settings.requires_inspection
  ), filtered as (
    select scheduled.*
    from scheduled
    where v_search is null
      or code ilike '%' || v_search || '%'
      or name ilike '%' || v_search || '%'
  ), months as (
    select pg_catalog.make_date(v_year, month_series.month_number, 1) as month_start
    from pg_catalog.generate_series(1, 12) as month_series(month_number)
  ), monthly_counts as (
    select
      pg_catalog.date_trunc('month', filtered.next_due_date)::date as month_start,
      pg_catalog.count(*) filter (
        where filtered.active_inspection_id is null
      )::integer as not_inspected,
      pg_catalog.count(*) filter (
        where filtered.active_inspection_id is not null
      )::integer as in_progress
    from filtered
    where filtered.next_due_date >= v_start
      and filtered.next_due_date < v_end
    group by 1
  ), completed_counts as (
    select
      pg_catalog.date_trunc(
        'month',
        inspection.inspected_at at time zone 'Asia/Ho_Chi_Minh'
      )::date as month_start,
      pg_catalog.count(distinct inspection.material_id)::integer as completed
    from public.material_safety_inspections inspection
    join filtered on filtered.id = inspection.material_id
    where inspection.status = 'completed'
      and (inspection.inspected_at at time zone 'Asia/Ho_Chi_Minh')::date >= v_start
      and (inspection.inspected_at at time zone 'Asia/Ho_Chi_Minh')::date < v_end
    group by 1
  )
  select pg_catalog.jsonb_build_object(
    'year', v_year,
    'items', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'month', pg_catalog.date_part('month', months.month_start)::integer,
          'notInspected', coalesce(monthly_counts.not_inspected, 0),
          'inProgress', coalesce(monthly_counts.in_progress, 0),
          'completed', coalesce(completed_counts.completed, 0)
        ) order by months.month_start
      )
      from months
      left join monthly_counts using (month_start)
      left join completed_counts using (month_start)
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function private.get_material_safety_inspection_plan(jsonb)
  from public, anon;
grant execute on function private.get_material_safety_inspection_plan(jsonb)
  to authenticated;

create or replace function public.get_material_safety_inspection_plan(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_material_safety_inspection_plan(p_filters)
$function$;

revoke all on function public.get_material_safety_inspection_plan(jsonb)
  from public, anon;
grant execute on function public.get_material_safety_inspection_plan(jsonb)
  to authenticated;
