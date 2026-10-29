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
    'publicDisplaySettings', model.public_display_settings,
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

create or replace function private.initialize_material_public_display_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.public_display_settings := coalesce(
    new.model_snapshot -> 'publicDisplaySettings',
    '{"basicInfo": false, "specifications": false}'::jsonb
  );

  select coalesce(
    jsonb_object_agg(
      specification.value ->> 'id',
      case
        when jsonb_typeof(specification.value -> 'isPublic') = 'boolean'
          then specification.value -> 'isPublic'
        else 'false'::jsonb
      end
    ),
    '{}'::jsonb
  )
  into new.public_specification_settings
  from jsonb_array_elements(
    coalesce(new.model_snapshot -> 'specifications', '[]'::jsonb)
  ) as specification(value);

  return new;
end;
$$;
revoke all on function private.initialize_material_public_display_settings()
  from public, anon, authenticated;

drop trigger if exists materials_public_display_settings_defaults on public.materials;
create trigger materials_public_display_settings_defaults
before insert on public.materials
for each row
execute function private.initialize_material_public_display_settings();

notify pgrst, 'reload schema';
