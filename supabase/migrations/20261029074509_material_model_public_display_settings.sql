alter table public.material_models
  add column public_display_settings jsonb not null
    default '{"basicInfo": false, "specifications": false}'::jsonb,
  add constraint material_models_public_display_settings_valid check (
    jsonb_typeof(public_display_settings) = 'object'
    and jsonb_typeof(public_display_settings -> 'basicInfo') = 'boolean'
    and jsonb_typeof(public_display_settings -> 'specifications') = 'boolean'
  );

alter table public.materials
  add column public_specification_settings jsonb not null default '{}'::jsonb,
  add constraint materials_public_specification_settings_valid check (
    jsonb_typeof(public_specification_settings) = 'object'
  );

alter table public.material_models disable trigger material_models_set_updated_at;

update public.material_models as model
set specifications = coalesce(
  (
    select jsonb_agg(
      specification.value || jsonb_build_object(
        'isPublic', case
          when jsonb_typeof(specification.value -> 'isPublic') = 'boolean'
            then specification.value -> 'isPublic'
          else 'false'::jsonb
        end
      ) order by specification.ordinality
    )
    from jsonb_array_elements(model.specifications)
      with ordinality as specification(value, ordinality)
  ),
  '[]'::jsonb
);
alter table public.material_models enable trigger material_models_set_updated_at;

alter table public.materials disable trigger materials_scope_guard;

update public.materials as material
set model_snapshot = jsonb_set(
  material.model_snapshot,
  '{specifications}',
  coalesce(
    (
      select jsonb_agg(
        specification.value || jsonb_build_object(
          'isPublic', case
            when jsonb_typeof(specification.value -> 'isPublic') = 'boolean'
              then specification.value -> 'isPublic'
            else 'false'::jsonb
          end
        ) order by specification.ordinality
      )
      from jsonb_array_elements(
        coalesce(material.model_snapshot -> 'specifications', '[]'::jsonb)
      ) with ordinality as specification(value, ordinality)
    ),
    '[]'::jsonb
  )
);

update public.materials as material
set public_specification_settings = coalesce(
  (
    select jsonb_object_agg(
      specification.value ->> 'id', specification.value -> 'isPublic'
    )
    from jsonb_array_elements(
      coalesce(material.model_snapshot -> 'specifications', '[]'::jsonb)
    ) as specification(value)
  ),
  '{}'::jsonb
);

alter table public.materials enable trigger materials_scope_guard;

create or replace function public.material_model_specifications_are_valid(
  p_specifications jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_specification jsonb;
  v_value jsonb;
  v_is_list boolean;
  v_value_count integer;
begin
  if pg_catalog.jsonb_typeof(p_specifications) is distinct from 'array' then
    return false;
  end if;

  for v_specification in
    select item.value
    from pg_catalog.jsonb_array_elements(p_specifications) as item(value)
  loop
    if pg_catalog.jsonb_typeof(v_specification) is distinct from 'object'
       or pg_catalog.jsonb_typeof(v_specification -> 'isList') is distinct from 'boolean'
       or pg_catalog.jsonb_typeof(v_specification -> 'isPublic') is distinct from 'boolean'
       or pg_catalog.jsonb_typeof(v_specification -> 'values') is distinct from 'array' then
      return false;
    end if;

    v_is_list := (v_specification ->> 'isList')::boolean;
    v_value_count := pg_catalog.jsonb_array_length(v_specification -> 'values');
    if v_value_count = 0 or (not v_is_list and v_value_count > 1) then
      return false;
    end if;

    for v_value in
      select item.value
      from pg_catalog.jsonb_array_elements(v_specification -> 'values') as item(value)
    loop
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'string'
         or nullif(pg_catalog.btrim(v_value #>> '{}'), '') is null then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

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

drop function public.save_material_model(
  uuid, text, text, uuid, text, boolean, jsonb, jsonb, text[]
);

create function public.save_material_model(
  p_id uuid,
  p_code text,
  p_name text,
  p_group_id uuid,
  p_description text,
  p_requires_inspection boolean,
  p_specifications jsonb,
  p_images jsonb,
  p_public_display_settings jsonb,
  p_external_codes text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(p_public_display_settings) is distinct from 'object'
      or jsonb_typeof(p_public_display_settings -> 'basicInfo') is distinct from 'boolean'
      or jsonb_typeof(p_public_display_settings -> 'specifications') is distinct from 'boolean' then
    raise exception 'Invalid public material model display settings' using errcode = '22023';
  end if;

  v_id := public.save_material_model_core(
    p_id, p_code, p_name, p_description, p_group_id, p_requires_inspection,
    p_specifications, p_images
  );

  update public.material_models
  set external_codes = coalesce(p_external_codes, '{}'::text[]),
      public_display_settings = p_public_display_settings
  where id = v_id;

  return v_id;
end;
$$;
revoke all on function public.save_material_model(
  uuid, text, text, uuid, text, boolean, jsonb, jsonb, jsonb, text[]
) from public, anon;
grant execute on function public.save_material_model(
  uuid, text, text, uuid, text, boolean, jsonb, jsonb, jsonb, text[]
) to authenticated;

create or replace function public.material_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', material.id, 'code', material.code, 'modelId', material.model_id,
    'modelSnapshot', material.model_snapshot, 'nameOverride', material.name_override,
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

drop function public.save_material_with_public_display_settings(
  uuid, integer, jsonb, jsonb
);

create function public.save_material_with_public_display_settings(
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
  v_specification record;
begin
  if jsonb_typeof(p_public_display_settings) is distinct from 'object'
      or jsonb_typeof(p_public_display_settings -> 'basicInfo') is distinct from 'boolean'
      or jsonb_typeof(p_public_display_settings -> 'specifications') is distinct from 'boolean' then
    raise exception 'Invalid public material display settings' using errcode = '22023';
  end if;

  if jsonb_typeof(p_public_specification_settings) is distinct from 'object' then
    raise exception 'Invalid public material specification settings' using errcode = '22023';
  end if;

  v_id := public.save_material(p_id, p_expected_version, p_values);
  select material.model_snapshot into v_snapshot
  from public.materials material
  where material.id = v_id;

  for v_specification in
    select setting.key, setting.value
    from jsonb_each(p_public_specification_settings) as setting(key, value)
  loop
    if jsonb_typeof(v_specification.value) is distinct from 'boolean'
       or not exists (
         select 1
         from jsonb_array_elements(coalesce(v_snapshot -> 'specifications', '[]'::jsonb))
           as specification(value)
         where specification.value ->> 'id' = v_specification.key
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
        'condition', material.condition
      )
      else null end,
    'specifications', case when material.public_display_settings ->> 'specifications' = 'true' then
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
        from jsonb_array_elements(coalesce(material.model_snapshot -> 'specifications', '[]'::jsonb))
          with ordinality as specification(value, ordinality)
        where coalesce(
          material.public_specification_settings ->> (specification.value ->> 'id'),
          specification.value ->> 'isPublic'
        ) = 'true'
      ), '[]'::jsonb)
      else null end
  ) into v_result
  from public.materials material
  where material.id = p_id
    and material.is_active
    and (
      material.public_display_settings ->> 'basicInfo' = 'true'
      or material.public_display_settings ->> 'specifications' = 'true'
    );

  return v_result;
end;
$$;
revoke all on function public.get_material_public_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_material_public_detail(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
