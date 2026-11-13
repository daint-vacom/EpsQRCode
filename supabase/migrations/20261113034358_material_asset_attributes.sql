create table public.material_capital_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint material_capital_sources_code_not_blank check (length(btrim(code)) > 0),
  constraint material_capital_sources_name_not_blank check (length(btrim(name)) > 0),
  constraint material_capital_sources_sort_order_nonnegative check (sort_order >= 0)
);

create unique index material_capital_sources_code_ci_uidx
  on public.material_capital_sources (lower(btrim(code)));
create unique index material_capital_sources_name_ci_uidx
  on public.material_capital_sources (lower(btrim(name)));

alter table public.material_capital_sources enable row level security;
revoke all on public.material_capital_sources from public, anon, authenticated;
grant select, insert, update, delete on public.material_capital_sources to authenticated;

create policy material_capital_sources_select_with_permission
on public.material_capital_sources for select to authenticated
using (
  public.has_permission('materials:material:view')
  or public.has_permission('materials:material:manage')
  or public.has_permission('material_catalog:material_model:view')
  or public.has_permission('materials:receipt:view')
  or public.has_permission('materials:receipt:manage')
);

create policy material_capital_sources_insert_with_permission
on public.material_capital_sources for insert to authenticated
with check (public.has_permission('material_catalog:material_model:manage'));

create policy material_capital_sources_update_with_permission
on public.material_capital_sources for update to authenticated
using (public.has_permission('material_catalog:material_model:manage'))
with check (public.has_permission('material_catalog:material_model:manage'));

create policy material_capital_sources_delete_with_permission
on public.material_capital_sources for delete to authenticated
using (public.has_permission('material_catalog:material_model:manage'));

insert into public.material_capital_sources (code, name, sort_order)
values
  ('khcb-cong-ty', 'KHCB Công ty', 10),
  ('khcb-tct', 'KHCB TCT', 20),
  ('khcb-don-vi', 'KHCB đơn vị', 30),
  ('tbs-cong-ty', 'TBS - Công ty', 40)
on conflict (lower(btrim(code))) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = timezone('utc', now());

alter table public.material_models
  add column manufacturer text,
  add column unit text,
  add column unit_price_default numeric(18, 2),
  add constraint material_models_unit_price_default_nonnegative
    check (unit_price_default is null or unit_price_default >= 0);

alter table public.materials
  add column placed_into_service_date date,
  add column capital_source_id uuid references public.material_capital_sources(id) on delete set null,
  add column unit_price_override numeric(18, 2),
  add constraint materials_unit_price_override_nonnegative
    check (unit_price_override is null or unit_price_override >= 0);

drop function public.save_material_model_with_safety_checklist(
  uuid, text, text, uuid, text, boolean, integer, text, boolean, boolean,
  jsonb, jsonb, jsonb, text[], jsonb
);

create function public.save_material_model_with_safety_checklist(
  p_id uuid,
  p_code text,
  p_name text,
  p_group_id uuid,
  p_description text,
  p_requires_inspection boolean,
  p_inspection_interval_value integer,
  p_inspection_interval_unit text,
  p_skip_initial_inspection boolean,
  p_use_group_safety_inspection_checklist boolean,
  p_specifications jsonb,
  p_images jsonb,
  p_public_display_settings jsonb,
  p_external_codes text[],
  p_safety_inspection_checklist jsonb,
  p_manufacturer text,
  p_unit text,
  p_unit_price_default numeric
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_model_id uuid;
begin
  if not private.safety_inspection_checklist_is_valid(p_safety_inspection_checklist) then
    raise exception 'Invalid material model safety inspection checklist'
      using errcode = '22023';
  end if;
  if p_unit_price_default is not null and p_unit_price_default < 0 then
    raise exception 'Material model unit price cannot be negative'
      using errcode = '22023';
  end if;

  v_model_id := public.save_material_model(
    p_id,
    p_code,
    p_name,
    p_group_id,
    p_description,
    p_requires_inspection,
    p_specifications,
    p_images,
    p_public_display_settings,
    p_external_codes
  );

  update public.material_models
  set use_group_safety_inspection_checklist = p_use_group_safety_inspection_checklist,
      inspection_interval_value = p_inspection_interval_value,
      inspection_interval_unit = p_inspection_interval_unit,
      skip_initial_inspection = p_skip_initial_inspection,
      manufacturer = nullif(btrim(p_manufacturer), ''),
      unit = nullif(btrim(p_unit), ''),
      unit_price_default = p_unit_price_default,
      updated_at = timezone('utc', now())
  where id = v_model_id;

  insert into public.material_model_safety_checklists (model_id, checklist)
  values (v_model_id, p_safety_inspection_checklist)
  on conflict (model_id) do update
    set checklist = excluded.checklist,
        updated_at = timezone('utc', now());

  return v_model_id;
end;
$$;

revoke all on function public.save_material_model_with_safety_checklist(
  uuid, text, text, uuid, text, boolean, integer, text, boolean, boolean,
  jsonb, jsonb, jsonb, text[], jsonb, text, text, numeric
) from public, anon;
grant execute on function public.save_material_model_with_safety_checklist(
  uuid, text, text, uuid, text, boolean, integer, text, boolean, boolean,
  jsonb, jsonb, jsonb, text[], jsonb, text, text, numeric
) to authenticated;

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
  v_capital_source_id uuid;
  v_unit_price_override numeric(18, 2);
  v_is_active boolean;
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

  if p_values ? 'capitalSourceId' then
    v_capital_source_id := nullif(p_values ->> 'capitalSourceId', '')::uuid;
    if v_capital_source_id is not null and not exists (
      select 1 from public.material_capital_sources source
      where source.id = v_capital_source_id and source.is_active
    ) then
      raise exception 'Invalid material capital source'
        using errcode = '22023';
    end if;
  end if;
  if p_values ? 'unitPriceOverride' then
    if p_values -> 'unitPriceOverride' is distinct from 'null'::jsonb
      and nullif(p_values ->> 'unitPriceOverride', '') is not null then
      if jsonb_typeof(p_values -> 'unitPriceOverride') is distinct from 'number'
        or (p_values ->> 'unitPriceOverride')::numeric < 0 then
        raise exception 'Material unit price must be a nonnegative number'
          using errcode = '22023';
      end if;
      v_unit_price_override := (p_values ->> 'unitPriceOverride')::numeric;
    end if;
  end if;
  if p_values ? 'isActive' then
    if jsonb_typeof(p_values -> 'isActive') is distinct from 'boolean' then
      raise exception 'Invalid material availability'
        using errcode = '22023';
    end if;
    v_is_active := (p_values ->> 'isActive')::boolean;
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
      safety_inspection_checklist_override_enabled = v_checklist_override_enabled,
      placed_into_service_date = case
        when p_values ? 'placedIntoServiceDate'
          then nullif(p_values ->> 'placedIntoServiceDate', '')::date
        else placed_into_service_date
      end,
      capital_source_id = case
        when p_values ? 'capitalSourceId' then v_capital_source_id
        else capital_source_id
      end,
      unit_price_override = case
        when p_values ? 'unitPriceOverride' then v_unit_price_override
        else unit_price_override
      end,
      is_active = case when p_values ? 'isActive' then v_is_active else is_active end
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

create or replace function public.create_material_models_bulk(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_row_number integer := 0;
  v_model_id uuid;
  v_code text;
  v_error text;
  v_external_codes text[];
  v_results jsonb := '[]'::jsonb;
begin
  if auth.uid() is null
    or not public.has_permission('material_catalog:material_model:manage') then
    raise exception 'Permission denied to manage material models'
      using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'A batch can contain at most 100 material models'
      using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_row_number := v_row_number + 1;
    v_code := coalesce(v_item->>'code', '');
    begin
      v_external_codes := case
        when jsonb_typeof(v_item->'externalCodes') = 'array'
          then array(select jsonb_array_elements_text(v_item->'externalCodes'))
        else '{}'::text[]
      end;
      v_model_id := public.save_material_model_with_safety_checklist(
        null,
        nullif(btrim(v_item->>'code'), ''),
        coalesce(v_item->>'name', ''),
        nullif(v_item->>'groupId', '')::uuid,
        nullif(btrim(v_item->>'description'), ''),
        coalesce((v_item->>'requiresInspection')::boolean, false),
        coalesce((v_item->>'inspectionIntervalValue')::integer, 1),
        coalesce(nullif(v_item->>'inspectionIntervalUnit', ''), 'month'),
        coalesce((v_item->>'skipInitialInspection')::boolean, false),
        coalesce((v_item->>'useGroupSafetyInspectionChecklist')::boolean, true),
        coalesce(v_item->'specifications', '[]'::jsonb),
        '[]'::jsonb,
        coalesce(v_item->'publicDisplaySettings', '{"basicInfo": true, "specifications": true}'::jsonb),
        v_external_codes,
        coalesce(v_item->'safetyInspectionChecklist', '[]'::jsonb),
        nullif(btrim(v_item->>'manufacturer'), ''),
        nullif(btrim(v_item->>'unit'), ''),
        nullif(v_item->>'unitPriceDefault', '')::numeric
      );
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'rowNumber', v_row_number,
        'code', v_code,
        'success', true,
        'id', v_model_id,
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
revoke all on function public.create_material_models_bulk(jsonb) from public, anon;
grant execute on function public.create_material_models_bulk(jsonb) to authenticated;

notify pgrst, 'reload schema';
