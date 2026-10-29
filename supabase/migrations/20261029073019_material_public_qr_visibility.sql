alter table public.materials
  add column public_display_settings jsonb not null
    default '{"basicInfo": false, "specifications": false}'::jsonb,
  add constraint materials_public_display_settings_valid check (
    jsonb_typeof(public_display_settings) = 'object'
    and jsonb_typeof(public_display_settings -> 'basicInfo') = 'boolean'
    and jsonb_typeof(public_display_settings -> 'specifications') = 'boolean'
  );

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

create or replace function public.save_material_with_public_display_settings(
  p_id uuid,
  p_expected_version integer,
  p_values jsonb,
  p_public_display_settings jsonb
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
    raise exception 'Invalid public material display settings' using errcode = '22023';
  end if;

  v_id := public.save_material(p_id, p_expected_version, p_values);
  update public.materials
  set public_display_settings = p_public_display_settings
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
revoke all on function public.save_material_with_public_display_settings(uuid, integer, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_material_with_public_display_settings(uuid, integer, jsonb, jsonb)
  to authenticated;

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
