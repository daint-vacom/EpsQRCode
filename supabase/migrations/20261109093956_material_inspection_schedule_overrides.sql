alter table public.materials
  add column inspection_settings_override_enabled boolean not null default false,
  add column requires_inspection_override boolean,
  add column inspection_interval_value_override integer,
  add column inspection_interval_unit_override text,
  add constraint materials_inspection_settings_override_valid check (
    (
      not inspection_settings_override_enabled
      and requires_inspection_override is null
      and inspection_interval_value_override is null
      and inspection_interval_unit_override is null
    )
    or (
      inspection_settings_override_enabled
      and requires_inspection_override is not null
      and (
        (
          requires_inspection_override
          and inspection_interval_value_override is not null
          and inspection_interval_value_override > 0
          and inspection_interval_unit_override is not null
          and inspection_interval_unit_override in ('day', 'month')
        )
        or (
          not requires_inspection_override
          and inspection_interval_value_override is null
          and inspection_interval_unit_override is null
        )
      )
    )
  );

alter table public.materials disable trigger materials_scope_guard;

with model_snapshots as (
  select material.id, public.material_model_snapshot(material.model_id) as snapshot
  from public.materials material
)
update public.materials material
set model_snapshot = material.model_snapshot || jsonb_build_object(
  'inspectionIntervalValue', coalesce(
    nullif(material.model_snapshot -> 'inspectionIntervalValue', 'null'::jsonb),
    model_snapshots.snapshot -> 'inspectionIntervalValue'
  ),
  'inspectionIntervalUnit', coalesce(
    nullif(material.model_snapshot -> 'inspectionIntervalUnit', 'null'::jsonb),
    model_snapshots.snapshot -> 'inspectionIntervalUnit'
  ),
  'skipInitialInspection', coalesce(
    nullif(material.model_snapshot -> 'skipInitialInspection', 'null'::jsonb),
    model_snapshots.snapshot -> 'skipInitialInspection'
  ),
  'safetyInspectionChecklist', coalesce(
    nullif(material.model_snapshot -> 'safetyInspectionChecklist', 'null'::jsonb),
    model_snapshots.snapshot -> 'safetyInspectionChecklist'
  )
)
from model_snapshots
where material.id = model_snapshots.id
  and (
    not (material.model_snapshot ? 'inspectionIntervalValue')
    or not (material.model_snapshot ? 'inspectionIntervalUnit')
    or not (material.model_snapshot ? 'skipInitialInspection')
    or not (material.model_snapshot ? 'safetyInspectionChecklist')
  );

alter table public.materials enable trigger materials_scope_guard;

create or replace function public.material_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', material.id, 'code', material.code, 'modelId', material.model_id,
    'modelSnapshot', material.model_snapshot,
    'inspectionSettingsOverrideEnabled', material.inspection_settings_override_enabled,
    'requiresInspectionOverride', material.requires_inspection_override,
    'inspectionIntervalValueOverride', material.inspection_interval_value_override,
    'inspectionIntervalUnitOverride', material.inspection_interval_unit_override,
    'nameOverride', material.name_override,
    'descriptionOverride', material.description_override,
    'images', coalesce((select jsonb_agg(jsonb_build_object(
      'id', image.id, 'storageBucket', image.storage_bucket,
      'storagePath', image.storage_path, 'externalUrl', image.external_url,
      'sortOrder', image.sort_order, 'isCover', image.is_cover
    ) order by image.sort_order, image.id)
      from public.material_images image where image.material_id = material.id), '[]'::jsonb),
    'specificationOverrides', material.specification_overrides,
    'specificationOverrideLabels', material.specification_override_labels,
    'publicSpecificationSettings', material.public_specification_settings,
    'serialNumber', material.serial_number, 'ownerPartyId', material.owner_party_id,
    'ownerSnapshot', material.owner_snapshot, 'borrowerPartyId', material.borrower_party_id,
    'borrowerSnapshot', nullif(material.borrower_snapshot, '{}'::jsonb),
    'condition', material.condition, 'note', material.note, 'status', material.status,
    'isActive', material.is_active, 'activeLoanHandoverId', material.active_loan_handover_id,
    'reservedHandoverId', material.reserved_handover_id,
    'reservationStatus', material.reservation_status, 'version', material.version,
    'createdAt', material.created_at, 'updatedAt', material.updated_at,
    'publicDisplaySettings', material.public_display_settings
  ) from public.materials material where material.id = p_id
$$;
revoke all on function public.material_json(uuid) from public, anon, authenticated;

create or replace function public.save_material_with_inspection_settings(
  p_id uuid,
  p_expected_version integer,
  p_values jsonb,
  p_public_display_settings jsonb,
  p_public_specification_settings jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material_id uuid;
  v_override_enabled boolean := false;
  v_requires_inspection boolean;
  v_interval_value integer;
  v_interval_unit text;
begin
  if p_values ? 'inspectionSettingsOverrideEnabled' then
    if jsonb_typeof(p_values -> 'inspectionSettingsOverrideEnabled') <> 'boolean' then
      raise exception 'Invalid material inspection override setting'
        using errcode = '22023';
    end if;
    v_override_enabled := (p_values ->> 'inspectionSettingsOverrideEnabled')::boolean;
  end if;

  if v_override_enabled then
    if jsonb_typeof(p_values -> 'requiresInspectionOverride') is distinct from 'boolean' then
      raise exception 'Invalid material inspection requirement override'
        using errcode = '22023';
    end if;
    v_requires_inspection := (p_values ->> 'requiresInspectionOverride')::boolean;

    if v_requires_inspection then
      if jsonb_typeof(p_values -> 'inspectionIntervalValueOverride') is distinct from 'number'
        or coalesce(p_values ->> 'inspectionIntervalValueOverride', '') !~ '^[1-9][0-9]*$' then
        raise exception 'Material inspection interval must be a positive whole number'
          using errcode = '22023';
      end if;
      v_interval_value := (p_values ->> 'inspectionIntervalValueOverride')::integer;

      if jsonb_typeof(p_values -> 'inspectionIntervalUnitOverride') is distinct from 'string'
        or coalesce(p_values ->> 'inspectionIntervalUnitOverride', '') not in ('day', 'month') then
        raise exception 'Invalid material inspection interval unit'
          using errcode = '22023';
      end if;
      v_interval_unit := p_values ->> 'inspectionIntervalUnitOverride';
    end if;
  end if;

  v_material_id := public.save_material_with_public_display_settings(
    p_id,
    p_expected_version,
    p_values,
    p_public_display_settings,
    p_public_specification_settings
  );

  update public.materials
  set inspection_settings_override_enabled = v_override_enabled,
      requires_inspection_override = case when v_override_enabled then v_requires_inspection end,
      inspection_interval_value_override = case when v_override_enabled then v_interval_value end,
      inspection_interval_unit_override = case when v_override_enabled then v_interval_unit end
  where id = v_material_id;

  update public.material_history history
  set to_state = public.material_json(v_material_id)
  where history.id = (
    select latest.id
    from public.material_history latest
    where latest.material_id = v_material_id
    order by latest.created_at desc, latest.id desc
    limit 1
  );

  return v_material_id;
end;
$$;

revoke all on function public.save_material_with_inspection_settings(
  uuid, integer, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.save_material_with_inspection_settings(
  uuid, integer, jsonb, jsonb, jsonb
) to authenticated;

revoke all on function public.save_material_with_safety_checklist(
  uuid, integer, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;

notify pgrst, 'reload schema';
