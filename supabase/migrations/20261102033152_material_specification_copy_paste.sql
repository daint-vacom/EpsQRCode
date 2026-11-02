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
    'requiresInspection', model.requires_inspection,
    'specifications', model.specifications,
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
  where model.id = p_model_id
$$;

create or replace function public.save_material_with_public_display_settings(
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
  v_id uuid;
  v_snapshot jsonb;
  v_source_snapshot jsonb;
  v_base_specifications jsonb;
  v_custom_specifications jsonb;
  v_incoming_custom_specifications jsonb;
  v_all_specifications jsonb;
  v_values_for_save jsonb;
  v_incoming_overrides jsonb;
  v_incoming_labels jsonb;
  v_base_overrides jsonb := '{}'::jsonb;
  v_custom_overrides jsonb := '{}'::jsonb;
  v_base_labels jsonb := '{}'::jsonb;
  v_custom_labels jsonb := '{}'::jsonb;
  v_specification jsonb;
  v_entry record;
  v_label jsonb;
  v_is_base boolean;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode = '42501';
  end if;

  if jsonb_typeof(p_public_display_settings) is distinct from 'object'
      or jsonb_typeof(p_public_display_settings -> 'basicInfo') is distinct from 'boolean'
      or jsonb_typeof(p_public_display_settings -> 'specifications') is distinct from 'boolean' then
    raise exception 'Invalid public material display settings' using errcode = '22023';
  end if;

  if jsonb_typeof(p_public_specification_settings) is distinct from 'object' then
    raise exception 'Invalid public material specification settings' using errcode = '22023';
  end if;

  if p_id is null then
    v_source_snapshot := public.material_model_snapshot(
      nullif(p_values ->> 'modelId', '')::uuid
    );
  else
    select material.model_snapshot into v_source_snapshot
    from public.materials material
    where material.id = p_id;
  end if;
  if v_source_snapshot is null then
    raise exception 'Material model snapshot not found' using errcode = 'P0002';
  end if;

  v_base_specifications := coalesce(v_source_snapshot -> 'specifications', '[]'::jsonb);
  v_custom_specifications := coalesce(v_source_snapshot -> 'customSpecifications', '[]'::jsonb);
  v_incoming_custom_specifications := coalesce(p_values -> 'customSpecifications', '[]'::jsonb);
  if jsonb_typeof(v_custom_specifications) is distinct from 'array'
      or jsonb_typeof(v_incoming_custom_specifications) is distinct from 'array'
      or not public.material_model_specifications_are_valid(v_incoming_custom_specifications) then
    raise exception 'Invalid custom material specifications' using errcode = '22023';
  end if;

  for v_specification in
    select item.value
    from jsonb_array_elements(v_incoming_custom_specifications) as item(value)
  loop
    if jsonb_typeof(v_specification -> 'id') is distinct from 'string'
        or (v_specification ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or nullif(btrim(v_specification ->> 'name'), '') is null
        or v_specification ->> 'dataType' not in ('text', 'number', 'boolean', 'date', 'color', 'length', 'weight')
        or jsonb_typeof(v_specification -> 'valueLabels') is distinct from 'array'
        or jsonb_array_length(v_specification -> 'valueLabels') not in (
          0,
          jsonb_array_length(v_specification -> 'values')
        ) then
      raise exception 'Invalid custom material specification definition' using errcode = '22023';
    end if;

    for v_label in
      select item.value
      from jsonb_array_elements(v_specification -> 'valueLabels') as item(value)
    loop
      if jsonb_typeof(v_label) is distinct from 'string' then
        raise exception 'Custom specification labels must be text' using errcode = '22023';
      end if;
    end loop;

    if exists (
      select 1
      from jsonb_array_elements(v_base_specifications || v_custom_specifications) as existing(value)
      where existing.value ->> 'id' = v_specification ->> 'id'
    ) then
      continue;
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_base_specifications || v_custom_specifications) as existing(value)
      where lower(btrim(existing.value ->> 'name')) = lower(btrim(v_specification ->> 'name'))
    ) then
      raise exception 'Custom material specification names must be unique' using errcode = '22023';
    end if;

    v_custom_specifications := v_custom_specifications || jsonb_build_array(v_specification);
  end loop;

  v_all_specifications := v_base_specifications || v_custom_specifications;
  v_incoming_overrides := coalesce(p_values -> 'specificationOverrides', '{}'::jsonb);
  v_incoming_labels := coalesce(p_values -> 'specificationOverrideLabels', '{}'::jsonb);
  if jsonb_typeof(v_incoming_overrides) is distinct from 'object'
      or jsonb_typeof(v_incoming_labels) is distinct from 'object' then
    raise exception 'Invalid material specification overrides' using errcode = '22023';
  end if;

  for v_entry in select item.key, item.value from jsonb_each(v_incoming_overrides) as item(key, value)
  loop
    select specification.value into v_specification
    from jsonb_array_elements(v_all_specifications) as specification(value)
    where specification.value ->> 'id' = v_entry.key;
    if v_specification is null
        or not public.material_spec_override_is_valid(v_specification, v_entry.value) then
      raise exception 'Override must use an existing specification and its list rules' using errcode = '22023';
    end if;

    v_is_base := exists (
      select 1
      from jsonb_array_elements(v_base_specifications) as specification(value)
      where specification.value ->> 'id' = v_entry.key
    );
    if v_is_base then
      v_base_overrides := v_base_overrides || jsonb_build_object(v_entry.key, v_entry.value);
    else
      v_custom_overrides := v_custom_overrides || jsonb_build_object(v_entry.key, v_entry.value);
    end if;
  end loop;

  for v_entry in select item.key, item.value from jsonb_each(v_incoming_labels) as item(key, value)
  loop
    if not (v_incoming_overrides ? v_entry.key)
        or jsonb_typeof(v_entry.value) is distinct from 'array'
        or jsonb_array_length(v_entry.value) <> jsonb_array_length(v_incoming_overrides -> v_entry.key) then
      raise exception 'Specification labels must align with overridden values' using errcode = '22023';
    end if;

    select specification.value into v_specification
    from jsonb_array_elements(v_all_specifications) as specification(value)
    where specification.value ->> 'id' = v_entry.key;
    if v_specification is null or v_specification ->> 'dataType' is distinct from 'color' then
      raise exception 'Labels can only be set for color specifications' using errcode = '22023';
    end if;

    for v_label in select item.value from jsonb_array_elements(v_entry.value) as item(value)
    loop
      if jsonb_typeof(v_label) is distinct from 'string' then
        raise exception 'Specification labels must be text' using errcode = '22023';
      end if;
    end loop;

    v_is_base := exists (
      select 1
      from jsonb_array_elements(v_base_specifications) as specification(value)
      where specification.value ->> 'id' = v_entry.key
    );
    if v_is_base then
      v_base_labels := v_base_labels || jsonb_build_object(v_entry.key, v_entry.value);
    else
      v_custom_labels := v_custom_labels || jsonb_build_object(v_entry.key, v_entry.value);
    end if;
  end loop;

  v_values_for_save := jsonb_set(
    jsonb_set(p_values, '{specificationOverrides}', v_base_overrides, true),
    '{specificationOverrideLabels}', v_base_labels, true
  );
  v_id := public.save_material(p_id, p_expected_version, v_values_for_save);

  update public.materials
  set model_snapshot = model_snapshot || jsonb_build_object('customSpecifications', v_custom_specifications),
      specification_overrides = v_base_overrides || v_custom_overrides,
      specification_override_labels = v_base_labels || v_custom_labels
  where id = v_id
  returning model_snapshot into v_snapshot;

  for v_entry in select item.key, item.value from jsonb_each(p_public_specification_settings) as item(key, value)
  loop
    if jsonb_typeof(v_entry.value) is distinct from 'boolean'
        or not exists (
          select 1
          from jsonb_array_elements(
            coalesce(v_snapshot -> 'specifications', '[]'::jsonb)
            || coalesce(v_snapshot -> 'customSpecifications', '[]'::jsonb)
          ) as specification(value)
          where specification.value ->> 'id' = v_entry.key
        ) then
      raise exception 'Invalid public material specification setting' using errcode = '22023';
    end if;
  end loop;

  update public.materials
  set public_display_settings = p_public_display_settings,
      public_specification_settings = p_public_specification_settings
  where id = v_id;

  update public.material_history history
  set to_state = public.material_json(v_id)
  where history.id = (
    select latest.id
    from public.material_history latest
    where latest.material_id = v_id
    order by latest.created_at desc, latest.id desc
    limit 1
  );

  return v_id;
end;
$$;
revoke all on function public.save_material_with_public_display_settings(
  uuid, integer, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.save_material_with_public_display_settings(
  uuid, integer, jsonb, jsonb, jsonb
) to authenticated;

create or replace function public.preview_material_model_sync(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.materials%rowtype;
  v_new jsonb;
  v_owner_scope uuid;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode = '42501';
  end if;
  select * into v_row from public.materials where id = p_id;
  if not found then raise exception 'Material not found' using errcode = 'P0002'; end if;
  v_owner_scope := coalesce(v_row.owner_party_id,
    nullif(v_row.owner_snapshot->>'scopePartyId', '')::uuid);
  if not public.material_can_represent(v_owner_scope) then
    raise exception 'You must represent the owner party' using errcode = '42501';
  end if;
  v_new := public.material_model_snapshot(v_row.model_id)
    || jsonb_build_object(
      'customSpecifications', coalesce(v_row.model_snapshot -> 'customSpecifications', '[]'::jsonb)
    );
  return jsonb_build_object(
    'materialId', v_row.id,
    'currentSnapshot', v_row.model_snapshot,
    'proposedSnapshot', v_new,
    'modelUpdatedAt', (select model.updated_at from public.material_models model where model.id = v_row.model_id),
    'preservedOverrides', coalesce((select jsonb_agg(key) from jsonb_object_keys(v_row.specification_overrides) key), '[]'::jsonb),
    'changedFields', coalesce((select jsonb_agg(field.name) from (values
      ('code', v_row.model_snapshot->'code', v_new->'code'),
      ('name', v_row.model_snapshot->'name', v_new->'name'),
      ('groupId', v_row.model_snapshot->'groupId', v_new->'groupId'),
      ('description', v_row.model_snapshot->'description', v_new->'description'),
      ('requiresInspection', v_row.model_snapshot->'requiresInspection', v_new->'requiresInspection'),
      ('specifications', v_row.model_snapshot->'specifications', v_new->'specifications'),
      ('images', v_row.model_snapshot->'images', v_new->'images')
    ) field(name, old_value, new_value) where field.old_value is distinct from field.new_value), '[]'::jsonb)
  );
end;
$$;

create or replace function public.apply_material_model_sync(
  p_id uuid,
  p_expected_version integer,
  p_expected_model_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.materials%rowtype;
  v_before jsonb;
  v_new jsonb;
  v_all_specifications jsonb;
  v_new_overrides jsonb := '{}'::jsonb;
  v_key text;
  v_specification jsonb;
  v_owner_scope uuid;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode = '42501';
  end if;
  select * into v_row from public.materials where id = p_id for update;
  if not found then raise exception 'Material not found' using errcode = 'P0002'; end if;
  if v_row.version is distinct from p_expected_version then
    raise exception 'Material changed; reload before syncing' using errcode = '40001';
  end if;
  if p_expected_model_updated_at is null
    or (select model.updated_at from public.material_models model where model.id = v_row.model_id)
      is distinct from p_expected_model_updated_at then
    raise exception 'Model changed after preview; reload the sync preview' using errcode = '40001';
  end if;
  v_owner_scope := coalesce(v_row.owner_party_id,
    nullif(v_row.owner_snapshot->>'scopePartyId', '')::uuid);
  if not public.material_can_represent(v_owner_scope) then
    raise exception 'You must represent the owner party' using errcode = '42501';
  end if;
  if v_row.reserved_handover_id is not null then
    raise exception 'Material is reserved by an open handover' using errcode = '55000';
  end if;
  v_before := public.material_json(p_id);
  v_new := public.material_model_snapshot(v_row.model_id)
    || jsonb_build_object(
      'customSpecifications', coalesce(v_row.model_snapshot -> 'customSpecifications', '[]'::jsonb)
    );
  v_all_specifications := coalesce(v_new -> 'specifications', '[]'::jsonb)
    || coalesce(v_new -> 'customSpecifications', '[]'::jsonb);
  for v_key in select jsonb_object_keys(v_row.specification_overrides) loop
    select specification.value into v_specification
    from jsonb_array_elements(v_all_specifications) specification(value)
    where specification.value->>'id' = v_key;
    if v_specification is null or not public.material_spec_override_is_valid(v_specification, v_row.specification_overrides->v_key) then
      raise exception 'The model removed or changed an overridden specification; resolve overrides before syncing' using errcode = '22023';
    end if;
    v_new_overrides := v_new_overrides || jsonb_build_object(v_key, v_row.specification_overrides->v_key);
  end loop;
  update public.materials set model_snapshot = v_new, specification_overrides = v_new_overrides,
    version = version + 1, updated_at = timezone('utc', now()) where id = p_id;
  insert into public.material_history(material_id, action, note, from_state, to_state)
  values (p_id, 'model_synced', 'Đồng bộ phiên bản mẫu vật tư', v_before, public.material_json(p_id));
  return p_id;
end;
$$;

create or replace function public.get_material_public_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'basicInfo', case when material.public_display_settings ->> 'basicInfo' = 'true' then
      jsonb_build_object(
        'code', material.code,
        'name', coalesce(nullif(btrim(material.name_override), ''), material.model_snapshot ->> 'name'),
        'description', coalesce(nullif(btrim(material.description_override), ''), material.model_snapshot ->> 'description', ''),
        'condition', material.condition,
        'status', material.status,
        'note', material.note,
        'groupName', (
          select material_group.name
          from public.material_groups material_group
          where material_group.id = nullif(material.model_snapshot ->> 'groupId', '')::uuid
        ),
        'ownerName', nullif(material.owner_snapshot ->> 'name', ''),
        'representativeName', nullif(material.owner_snapshot ->> 'representativeName', ''),
        'images', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', image.id,
            'storageBucket', image.storage_bucket,
            'storagePath', image.storage_path,
            'externalUrl', image.external_url,
            'sortOrder', image.sort_order,
            'isCover', image.is_cover
          ) order by image.sort_order, image.id)
          from public.material_images image
          where image.material_id = material.id
        ), '[]'::jsonb),
        'lastPrintedLabel', (
          select jsonb_build_object(
            'widthMm', preference.template_snapshot -> 'widthMm',
            'heightMm', preference.template_snapshot -> 'heightMm',
            'previewSvg', preference.preview_svg
          )
          from public.material_last_label_templates preference
          where preference.material_id = material.id
            and preference.preview_svg is not null
            and preference.template_snapshot ? 'widthMm'
            and preference.template_snapshot ? 'heightMm'
        )
      )
      else null end,
    'specifications', case
      when material.public_display_settings ->> 'basicInfo' = 'true'
        and material.public_display_settings ->> 'specifications' = 'true' then
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', specification.value -> 'id',
          'name', specification.value -> 'name',
          'dataType', specification.value -> 'dataType',
          'isList', specification.value -> 'isList',
          'values', coalesce(
            material.specification_overrides -> (specification.value ->> 'id'),
            specification.value -> 'values', '[]'::jsonb
          ),
          'valueLabels', coalesce(
            material.specification_override_labels -> (specification.value ->> 'id'),
            specification.value -> 'valueLabels', '[]'::jsonb
          )
        ) order by specification.ordinality)
        from jsonb_array_elements(
          coalesce(material.model_snapshot -> 'specifications', '[]'::jsonb)
          || coalesce(material.model_snapshot -> 'customSpecifications', '[]'::jsonb)
        ) with ordinality as specification(value, ordinality)
        where coalesce(
          material.public_specification_settings ->> (specification.value ->> 'id'),
          specification.value ->> 'isPublic'
        ) = 'true'
      ), '[]'::jsonb)
      else null end
  ) into v_result
  from public.materials material
  where material.id = p_id
    and material.is_active;

  return v_result;
end;
$$;
revoke all on function public.get_material_public_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_material_public_detail(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
