alter table public.materials
  add column safety_inspection_checklist_override_enabled boolean not null default false;

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
    'modelSafetyInspectionConfig', jsonb_build_object(
      'requiresInspection', model_config.snapshot -> 'requiresInspection',
      'inspectionIntervalValue', model_config.snapshot -> 'inspectionIntervalValue',
      'inspectionIntervalUnit', model_config.snapshot -> 'inspectionIntervalUnit',
      'skipInitialInspection', model_config.snapshot -> 'skipInitialInspection',
      'safetyInspectionChecklist', coalesce(
        model_config.snapshot -> 'safetyInspectionChecklist', '[]'::jsonb
      )
    ),
    'inspectionSettingsOverrideEnabled', material.inspection_settings_override_enabled,
    'requiresInspectionOverride', material.requires_inspection_override,
    'inspectionIntervalValueOverride', material.inspection_interval_value_override,
    'inspectionIntervalUnitOverride', material.inspection_interval_unit_override,
    'safetyInspectionChecklistOverrideEnabled',
      material.safety_inspection_checklist_override_enabled,
    'safetyInspectionChecklistOverride', case
      when material.safety_inspection_checklist_override_enabled
        then coalesce(material_checklist.checklist, '[]'::jsonb)
      else null
    end,
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
  )
  from public.materials material
  left join lateral (
    select public.material_model_snapshot(material.model_id) as snapshot
  ) model_config on true
  left join public.material_safety_checklists material_checklist
    on material_checklist.material_id = material.id
  where material.id = p_id
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
  v_checklist_override_enabled boolean := false;
  v_checklist_override jsonb;
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

  if p_values ? 'safetyInspectionChecklistOverrideEnabled' then
    if jsonb_typeof(p_values -> 'safetyInspectionChecklistOverrideEnabled') <> 'boolean' then
      raise exception 'Invalid material safety checklist override setting'
        using errcode = '22023';
    end if;
    v_checklist_override_enabled :=
      (p_values ->> 'safetyInspectionChecklistOverrideEnabled')::boolean;
  end if;

  if v_checklist_override_enabled then
    v_checklist_override := p_values -> 'safetyInspectionChecklistOverride';
    if jsonb_typeof(v_checklist_override) is distinct from 'array'
      or not private.safety_inspection_checklist_is_valid(v_checklist_override) then
      raise exception 'Invalid material safety inspection checklist override'
        using errcode = '22023';
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
      inspection_interval_unit_override = case when v_override_enabled then v_interval_unit end,
      safety_inspection_checklist_override_enabled = v_checklist_override_enabled
  where id = v_material_id;

  if v_checklist_override_enabled then
    insert into public.material_safety_checklists (material_id, checklist)
    values (v_material_id, v_checklist_override)
    on conflict (material_id) do update
      set checklist = excluded.checklist,
          updated_at = timezone('utc', now());
  else
    delete from public.material_safety_checklists
    where material_id = v_material_id;
  end if;

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

notify pgrst, 'reload schema';
