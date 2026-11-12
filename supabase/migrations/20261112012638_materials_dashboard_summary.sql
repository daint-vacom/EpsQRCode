create or replace function public.get_material_dashboard_summary(
  p_end_month date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_end_month date := pg_catalog.date_trunc(
    'month',
    coalesce(
      p_end_month,
      (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date
    )
  )::date;
  v_start_month date;
  v_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('materials:material:view') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  v_start_month := (v_end_month - interval '5 months')::date;

  with month_series as (
    select month_start::date as month_start
    from pg_catalog.generate_series(
      v_start_month::timestamp,
      v_end_month::timestamp,
      interval '1 month'
    ) as months(month_start)
  ), visible_materials as materialized (
    select
      material.id,
      material.model_id,
      material.status,
      material.created_at,
      material.owner_snapshot,
      material.inspection_settings_override_enabled,
      material.requires_inspection_override,
      material.inspection_interval_value_override,
      material.inspection_interval_unit_override
    from public.materials material
    where material.is_active
      and public.can_view_material_current(material.id)
  ), model_ids as (
    select distinct model_id
    from visible_materials
  ), model_configurations as materialized (
    select
      model_ids.model_id,
      public.material_model_snapshot(model_ids.model_id) as model_config
    from model_ids
  ), material_settings as materialized (
    select
      material.*,
      case
        when material.inspection_settings_override_enabled
          then coalesce(material.requires_inspection_override, false)
        else coalesce((model_configurations.model_config ->> 'requiresInspection')::boolean, false)
      end as requires_inspection,
      case
        when material.inspection_settings_override_enabled
          and material.requires_inspection_override
          then coalesce(
            material.inspection_interval_value_override,
            (model_configurations.model_config ->> 'inspectionIntervalValue')::integer
          )
        else (model_configurations.model_config ->> 'inspectionIntervalValue')::integer
      end as interval_value,
      case
        when material.inspection_settings_override_enabled
          and material.requires_inspection_override
          then coalesce(
            material.inspection_interval_unit_override,
            model_configurations.model_config ->> 'inspectionIntervalUnit'
          )
        else model_configurations.model_config ->> 'inspectionIntervalUnit'
      end as interval_unit,
      coalesce(
        (model_configurations.model_config ->> 'skipInitialInspection')::boolean,
        false
      ) as skip_initial_inspection
    from visible_materials material
    join model_configurations using (model_id)
  ), inspection_schedule as materialized (
    select
      material_settings.id,
      material_settings.status,
      material_settings.owner_snapshot,
      material_settings.requires_inspection,
      active_inspection.id as active_inspection_id,
      case
        when not material_settings.requires_inspection then null
        when latest_inspection.inspected_at is not null then
          ((latest_inspection.inspected_at at time zone 'Asia/Ho_Chi_Minh')::date
            + case material_settings.interval_unit
                when 'day' then material_settings.interval_value * interval '1 day'
                else material_settings.interval_value * interval '1 month'
              end)::date
        else
          ((material_settings.created_at at time zone 'Asia/Ho_Chi_Minh')::date
            + case
                when material_settings.skip_initial_inspection then
                  case material_settings.interval_unit
                    when 'day' then material_settings.interval_value * interval '1 day'
                    else material_settings.interval_value * interval '1 month'
                  end
                else interval '0 days'
              end)::date
      end as next_due_date
    from material_settings
    left join lateral (
      select inspection.inspected_at
      from public.material_safety_inspections inspection
      where inspection.material_id = material_settings.id
        and inspection.status = 'completed'
      order by inspection.inspected_at desc, inspection.id desc
      limit 1
    ) latest_inspection on true
    left join lateral (
      select inspection.id
      from public.material_safety_inspections inspection
      where inspection.material_id = material_settings.id
        and inspection.status = 'in_progress'
      limit 1
    ) active_inspection on true
  ), classified_materials as materialized (
    select
      inspection_schedule.*,
      (
        inspection_schedule.requires_inspection
        and (
          inspection_schedule.active_inspection_id is not null
          or inspection_schedule.next_due_date <= v_today
        )
      ) as needs_inspection
    from inspection_schedule
  ), receipt_monthly as (
    select
      pg_catalog.date_trunc(
        'month',
        receipt.completed_at at time zone 'Asia/Ho_Chi_Minh'
      )::date as month_start,
      pg_catalog.count(receipt_item.id)::integer as item_count
    from public.material_receipts receipt
    join public.material_receipt_items receipt_item
      on receipt_item.receipt_id = receipt.id
    where receipt.status = 'completed'
      and receipt.completed_at >= (v_start_month::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and receipt.completed_at < ((v_end_month + interval '1 month')::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and receipt_item.material_id is not null
      and receipt_item.voided_at is null
    group by 1
  ), handover_monthly as (
    select
      pg_catalog.date_trunc(
        'month',
        handover.completed_at at time zone 'Asia/Ho_Chi_Minh'
      )::date as month_start,
      pg_catalog.count(handover_item.id)::integer as item_count
    from public.material_handovers handover
    join public.material_handover_items handover_item
      on handover_item.handover_id = handover.id
    where handover.status = 'completed'
      and handover.completed_at >= (v_start_month::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and handover.completed_at < ((v_end_month + interval '1 month')::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and (
        handover.mode = 'standard'
        or handover_item.receiver_outcome = 'received'
      )
    group by 1
  ), inspection_monthly as (
    select
      pg_catalog.date_trunc(
        'month',
        (case
          when inspection.status = 'completed' then inspection.inspected_at
          else inspection.created_at
        end) at time zone 'Asia/Ho_Chi_Minh'
      )::date as month_start,
      pg_catalog.count(*) filter (
        where inspection.status = 'completed'
          and inspection.overall_result = 'passed'
      )::integer as passed_count,
      pg_catalog.count(*) filter (
        where inspection.status = 'completed'
          and inspection.overall_result = 'failed'
      )::integer as failed_count,
      pg_catalog.count(*) filter (
        where inspection.status = 'in_progress'
      )::integer as in_progress_count
    from public.material_safety_inspections inspection
    where inspection.status in ('completed', 'in_progress')
      and (case
        when inspection.status = 'completed' then inspection.inspected_at
        else inspection.created_at
      end) >= (v_end_month::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and (case
        when inspection.status = 'completed' then inspection.inspected_at
        else inspection.created_at
      end) < ((v_end_month + interval '1 month')::timestamp at time zone 'Asia/Ho_Chi_Minh')
    group by 1
  ), eps_unit_counts as (
    select
      coalesce(
        nullif(material.owner_snapshot ->> 'teamId', ''),
        nullif(material.owner_snapshot ->> 'departmentId', ''),
        'unassigned'
      ) as unit_id,
      coalesce(
        nullif(pg_catalog.btrim(material.owner_snapshot ->> 'teamName'), ''),
        nullif(pg_catalog.btrim(material.owner_snapshot ->> 'departmentName'), ''),
        'Chưa xác định đơn vị EPS'
      ) as unit_name,
      pg_catalog.count(*) filter (where not material.needs_inspection)::integer as checked_count,
      pg_catalog.count(*) filter (where material.needs_inspection)::integer as needs_inspection_count,
      pg_catalog.count(*)::integer as total_count
    from classified_materials material
    where material.owner_snapshot ->> 'kind' = 'eps'
    group by 1, 2
  )
  select pg_catalog.jsonb_build_object(
    'totalMaterials', (select pg_catalog.count(*)::integer from visible_materials),
    'availableMaterials', (
      select pg_catalog.count(*)::integer
      from visible_materials
      where status = 'available'
    ),
    'loanedMaterials', (
      select pg_catalog.count(*)::integer
      from visible_materials
      where status = 'loaned'
    ),
    'materialsToInspect', (
      select pg_catalog.count(*)::integer
      from classified_materials
      where needs_inspection
    ),
    'monthlyReceipts', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'month', pg_catalog.to_char(month_series.month_start, 'YYYY-MM'),
          'count', coalesce(receipt_monthly.item_count, 0)
        ) order by month_series.month_start
      )
      from month_series
      left join receipt_monthly using (month_start)
    ), '[]'::jsonb),
    'monthlyHandovers', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'month', pg_catalog.to_char(month_series.month_start, 'YYYY-MM'),
          'count', coalesce(handover_monthly.item_count, 0)
        ) order by month_series.month_start
      )
      from month_series
      left join handover_monthly using (month_start)
    ), '[]'::jsonb),
    'inspectionResults', pg_catalog.jsonb_build_object(
      'passed', coalesce((
        select passed_count from inspection_monthly where month_start = v_end_month
      ), 0),
      'failed', coalesce((
        select failed_count from inspection_monthly where month_start = v_end_month
      ), 0),
      'inProgress', coalesce((
        select in_progress_count from inspection_monthly where month_start = v_end_month
      ), 0)
    ),
    'materialsByEpsUnit', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'unitId', eps_unit_counts.unit_id,
          'unitName', eps_unit_counts.unit_name,
          'checkedCount', eps_unit_counts.checked_count,
          'needsInspectionCount', eps_unit_counts.needs_inspection_count,
          'total', eps_unit_counts.total_count
        ) order by eps_unit_counts.total_count desc, eps_unit_counts.unit_name asc
      )
      from eps_unit_counts
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_material_dashboard_summary(date) from public, anon;
grant execute on function public.get_material_dashboard_summary(date) to authenticated;
