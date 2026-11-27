create or replace function private.materials_with_safety_inspections_due(p_today date)
returns table (material_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with visibility_context as materialized (
    select * from private.current_material_visibility_context()
  ), visible_materials as materialized (
    select material.id
    from public.materials material
    cross join visibility_context visibility
    where material.is_active
      and material.owner_snapshot ->> 'kind' is distinct from 'warehouse'
      and (select auth.uid()) is not null
      and (
        visibility.can_view_all
        or coalesce(material.owner_party_id,
          nullif(material.owner_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids)
        or (material.status = 'loaned' and coalesce(material.borrower_party_id,
          nullif(material.borrower_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids))
      )
  )
  select visible_materials.id
  from visible_materials
  where exists (
    select 1
    from public.material_safety_inspection_schedules schedule
    join lateral private.effective_material_safety_inspection_types(visible_materials.id) config
      on config.type_id = schedule.type_id and config.enabled
    where schedule.material_id = visible_materials.id
      and (schedule.due_date <= p_today or exists (
        select 1 from public.material_safety_inspections inspection
        where inspection.material_id = schedule.material_id
          and inspection.inspection_type_id = schedule.type_id
          and inspection.status = 'in_progress'
      ))
  );
$$;

revoke all on function private.materials_with_safety_inspections_due(date) from public, anon;
grant execute on function private.materials_with_safety_inspections_due(date) to authenticated;

-- Preserve the dashboard's existing receipt, handover, and inspection-history queries.
do $migration$
declare
  v_definition text := pg_catalog.pg_get_functiondef(
    'public.get_material_dashboard_summary(date)'::pg_catalog.regprocedure
  );
  v_settings_start integer;
  v_settings_end integer;
begin
  v_settings_start := pg_catalog.strpos(v_definition, $sql$  ), model_configurations as materialized ($sql$);
  v_settings_end := pg_catalog.strpos(v_definition, $sql$  ), receipt_monthly as ($sql$);
  if v_settings_start = 0 or v_settings_end <= v_settings_start then
    raise exception 'Dashboard inspection settings query was not found';
  end if;

  v_definition := pg_catalog.overlay(
    v_definition,
    $sql$  ), materials_needing_inspection as materialized (
    select material_id from private.materials_with_safety_inspections_due(v_today)
  ), classified_materials as materialized (
    select material.*, (due.material_id is not null) as needs_inspection
    from visible_materials material
    left join materials_needing_inspection due on due.material_id = material.id
$sql$,
    v_settings_start,
    v_settings_end - v_settings_start
  );
  v_definition := pg_catalog.replace(v_definition, $sql$      material.owner_snapshot,
      material.inspection_settings_override_enabled,
      material.requires_inspection_override,
      material.inspection_interval_value_override,
      material.inspection_interval_unit_override$sql$, $sql$      material.owner_snapshot$sql$);
  execute v_definition;
end;
$migration$;
