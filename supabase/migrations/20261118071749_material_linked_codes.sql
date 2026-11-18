alter table public.material_models
  add column linked_codes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(linked_codes) = 'array');

alter table public.materials
  add column linked_codes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(linked_codes) = 'array');

update public.material_models model
set linked_codes = coalesce((
  select jsonb_agg(jsonb_build_object('label', 'Mã liên kết', 'value', codes.code)
    order by codes.ordinality)
  from unnest(model.external_codes) with ordinality as codes(code, ordinality)
), '[]'::jsonb);

create or replace function public.set_material_model_linked_codes(
  p_id uuid,
  p_linked_codes jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codes text[];
begin
  if auth.uid() is null
    or not public.has_permission('material_catalog:material_model:manage') then
    raise exception 'Permission denied to manage material models'
      using errcode = '42501';
  end if;
  if jsonb_typeof(p_linked_codes) is distinct from 'array'
    or exists (
      select 1
      from jsonb_array_elements(p_linked_codes) as item(value)
      where jsonb_typeof(item.value) is distinct from 'object'
        or nullif(btrim(item.value ->> 'label'), '') is null
        or nullif(btrim(item.value ->> 'value'), '') is null
    ) then
    raise exception 'Linked codes require a label and a value'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(btrim(item.value ->> 'value') order by item.ordinality), '{}'::text[])
  into v_codes
  from jsonb_array_elements(p_linked_codes) with ordinality as item(value, ordinality);

  update public.material_models
  set linked_codes = coalesce(p_linked_codes, '[]'::jsonb),
      external_codes = v_codes,
      updated_at = timezone('utc', now())
  where id = p_id;
  if not found then
    raise exception 'Material model not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.set_material_model_linked_codes(uuid, jsonb) from public, anon;
grant execute on function public.set_material_model_linked_codes(uuid, jsonb) to authenticated;

create or replace function public.set_material_linked_codes(
  p_id uuid,
  p_linked_codes jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials'
      using errcode = '42501';
  end if;
  if jsonb_typeof(p_linked_codes) is distinct from 'array'
    or exists (
      select 1
      from jsonb_array_elements(p_linked_codes) as item(value)
      where jsonb_typeof(item.value) is distinct from 'object'
        or nullif(btrim(item.value ->> 'label'), '') is null
        or nullif(btrim(item.value ->> 'value'), '') is null
    ) then
    raise exception 'Linked codes require a label and a value'
      using errcode = '22023';
  end if;
  update public.materials
  set linked_codes = coalesce(p_linked_codes, '[]'::jsonb),
      version = version + 1,
      updated_at = timezone('utc', now())
  where id = p_id and reserved_handover_id is null;
  if not found then
    raise exception 'Material not found or is reserved for handover'
      using errcode = 'P0002';
  end if;

  update public.material_history history
  set to_state = public.material_json(p_id)
  where history.id = (
    select latest.id from public.material_history latest
    where latest.material_id = p_id
    order by latest.created_at desc, latest.id desc limit 1
  );
end;
$$;
revoke all on function public.set_material_linked_codes(uuid, jsonb) from public, anon;
grant execute on function public.set_material_linked_codes(uuid, jsonb) to authenticated;

create or replace function public.material_model_snapshot(p_model_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', model.id,
    'code', model.code,
    'name', model.name,
    'groupId', model.group_id,
    'description', coalesce(model.description, ''),
    'manufacturer', coalesce(model.manufacturer, ''),
    'unit', coalesce(model.unit, ''),
    'unitPriceDefault', model.unit_price_default,
    'requiresInspection', model.requires_inspection,
    'inspectionIntervalValue', model.inspection_interval_value,
    'inspectionIntervalUnit', model.inspection_interval_unit,
    'skipInitialInspection', model.skip_initial_inspection,
    'useGroupSafetyInspectionChecklist', model.use_group_safety_inspection_checklist,
    'specifications', coalesce(group_row.specifications, '[]'::jsonb)
      || coalesce(model.specifications, '[]'::jsonb),
    'safetyInspectionChecklist',
      (case when model.use_group_safety_inspection_checklist
        then coalesce(group_row.safety_inspection_checklist, '[]'::jsonb)
        else '[]'::jsonb
      end)
      || coalesce(model_checklist.checklist, '[]'::jsonb),
    'customSpecifications', '[]'::jsonb,
    'externalCodes', model.external_codes,
    'linkedCodes', model.linked_codes,
    'capturedAt', timezone('utc', now()),
    'images', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', image.id,
        'storagePath', image.storage_path,
        'externalUrl', image.external_url,
        'sortOrder', image.sort_order,
        'isCover', image.is_cover
      ) order by image.sort_order, image.id)
      from public.material_model_images image
      where image.model_id = model.id
    ), '[]'::jsonb)
  )
  from public.material_models model
  left join public.material_groups group_row on group_row.id = model.group_id
  left join public.material_model_safety_checklists model_checklist
    on model_checklist.model_id = model.id
  where model.id = p_model_id
$$;
revoke all on function public.material_model_snapshot(uuid) from public, anon, authenticated;

create or replace function public.material_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', material.id, 'code', material.code, 'modelId', material.model_id,
    'modelSnapshot', jsonb_set(
      material.model_snapshot,
      '{linkedCodes}',
      coalesce(model_config.snapshot -> 'linkedCodes', '[]'::jsonb),
      true
    ),
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
    'safetyInspectionChecklistOverrideEnabled', material.safety_inspection_checklist_override_enabled,
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
    'serialNumber', material.serial_number,
    'linkedCodes', material.linked_codes,
    'ownerPartyId', material.owner_party_id,
    'ownerSnapshot', material.owner_snapshot, 'borrowerPartyId', material.borrower_party_id,
    'borrowerSnapshot', nullif(material.borrower_snapshot, '{}'::jsonb),
    'condition', material.condition, 'note', material.note, 'status', material.status,
    'isActive', material.is_active, 'activeLoanHandoverId', material.active_loan_handover_id,
    'reservedHandoverId', material.reserved_handover_id,
    'reservationStatus', material.reservation_status, 'version', material.version,
    'createdAt', material.created_at, 'updatedAt', material.updated_at,
    'publicDisplaySettings', material.public_display_settings,
    'placedIntoServiceDate', material.placed_into_service_date,
    'capitalSourceId', material.capital_source_id,
    'capitalSourceName', capital_source.name,
    'unitPriceOverride', material.unit_price_override
  )
  from public.materials material
  left join lateral (
    select public.material_model_snapshot(material.model_id) as snapshot
  ) model_config on true
  left join public.material_safety_checklists material_checklist
    on material_checklist.material_id = material.id
  left join public.material_capital_sources capital_source
    on capital_source.id = material.capital_source_id
  where material.id = p_id
$$;
revoke all on function public.material_json(uuid) from public, anon, authenticated;

create or replace function public.create_materials_bulk(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_row_number integer := 0;
  v_id uuid;
  v_code text;
  v_error text;
  v_capital_source_id uuid;
  v_results jsonb := '[]'::jsonb;
begin
  if auth.uid() is null
    or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials'
      using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'A batch can contain at most 100 materials'
      using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_row_number := v_row_number + 1;
    v_code := coalesce(v_item->>'code', '');
    begin
      v_capital_source_id := nullif(v_item->>'capitalSourceId', '')::uuid;
      if v_capital_source_id is not null and not exists (
        select 1 from public.material_capital_sources source
        where source.id = v_capital_source_id and source.is_active
      ) then
        raise exception 'Invalid material capital source' using errcode = '22023';
      end if;
      if nullif(v_item->>'unitPriceOverride', '') is not null
        and (v_item->>'unitPriceOverride')::numeric < 0 then
        raise exception 'Material unit price must be nonnegative' using errcode = '22023';
      end if;
      if v_item ? 'isActive' and jsonb_typeof(v_item->'isActive') is distinct from 'boolean' then
        raise exception 'Invalid material availability' using errcode = '22023';
      end if;

      v_id := public.save_material(null, null, v_item);
      update public.materials
      set placed_into_service_date = nullif(v_item->>'placedIntoServiceDate', '')::date,
          capital_source_id = v_capital_source_id,
          unit_price_override = nullif(v_item->>'unitPriceOverride', '')::numeric,
          is_active = coalesce((v_item->>'isActive')::boolean, true)
      where id = v_id;
      perform public.set_material_linked_codes(
        v_id,
        coalesce(v_item->'linkedCodes', '[]'::jsonb)
      );
      update public.material_history history
      set to_state = public.material_json(v_id)
      where history.id = (
        select latest.id from public.material_history latest
        where latest.material_id = v_id
        order by latest.created_at desc, latest.id desc limit 1
      );

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'rowNumber', v_row_number,
        'code', v_code,
        'success', true,
        'id', v_id,
        'error', null
      ));
    exception when others then
      get stacked diagnostics v_error = message_text;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'rowNumber', v_row_number,
        'code', v_code,
        'success', false,
        'id', null,
        'error', v_error
      ));
    end;
  end loop;
  return v_results;
end;
$$;

revoke all on function public.create_materials_bulk(jsonb) from public, anon;
grant execute on function public.create_materials_bulk(jsonb) to authenticated;

notify pgrst, 'reload schema';
