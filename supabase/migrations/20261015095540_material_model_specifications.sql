alter table public.material_models
  add column if not exists specifications jsonb not null default '[]'::jsonb;

alter table public.material_models
  add constraint material_models_specifications_is_array
  check (pg_catalog.jsonb_typeof(specifications) = 'array');

drop function if exists public.save_material_model(
  uuid, text, text, text, uuid, boolean, jsonb
);

create function public.save_material_model(
  p_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_group_id uuid,
  p_requires_inspection boolean,
  p_specifications jsonb,
  p_images jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_model_id uuid;
  v_image jsonb;
  v_specification jsonb;
  v_image_count integer;
  v_cover_count integer;
  v_sort_order integer := 0;
  v_storage_path text;
  v_external_url text;
begin
  if not public.has_permission('material_catalog:material_model:manage') then
    raise exception 'Permission denied to manage material models'
      using errcode = '42501';
  end if;

  if p_group_id is null then
    raise exception 'A material group is required'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_specifications) is distinct from 'array' then
    raise exception 'Specifications must be a JSON array'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_specifications) as item(value)
    where pg_catalog.jsonb_typeof(item.value) is distinct from 'object'
       or nullif(pg_catalog.btrim(item.value ->> 'id'), '') is null
       or nullif(pg_catalog.btrim(item.value ->> 'name'), '') is null
       or item.value ->> 'dataType' not in (
         'text', 'number', 'boolean', 'date', 'color', 'length', 'weight'
       )
       or pg_catalog.jsonb_typeof(item.value -> 'values') is distinct from 'array'
       or pg_catalog.jsonb_array_length(item.value -> 'values') = 0
  ) then
    raise exception 'Each specification needs an id, type, name, and values'
      using errcode = '22023';
  end if;

  for v_specification in
    select item.value from pg_catalog.jsonb_array_elements(p_specifications) as item(value)
  loop
    if nullif(pg_catalog.btrim(v_specification ->> 'id'), '') is null then
      raise exception 'Each specification needs an id'
        using errcode = '22023';
    end if;

    perform (v_specification ->> 'id')::uuid;

    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(v_specification -> 'values') as item(value)
      where pg_catalog.jsonb_typeof(item.value) is distinct from 'string'
         or nullif(pg_catalog.btrim(item.value #>> '{}'), '') is null
    ) then
      raise exception 'Specification values must be non-empty strings'
        using errcode = '22023';
    end if;

    if p_id is not null and exists (
      select 1
      from public.material_models as model
      cross join lateral pg_catalog.jsonb_array_elements(model.specifications) as old_item(value)
      where model.id = p_id
        and old_item.value ->> 'id' = v_specification ->> 'id'
        and old_item.value ->> 'dataType' is distinct from v_specification ->> 'dataType'
    ) then
      raise exception 'A specification type cannot be changed after creation'
        using errcode = '22023';
    end if;
  end loop;

  if (
    select pg_catalog.count(*)
    from (
      select item.value ->> 'id'
      from pg_catalog.jsonb_array_elements(p_specifications) as item(value)
      group by item.value ->> 'id'
      having pg_catalog.count(*) > 1
    ) as duplicates
  ) > 0 then
    raise exception 'Specification ids must be unique'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_images) is distinct from 'array' then
    raise exception 'Images must be a JSON array'
      using errcode = '22023';
  end if;

  v_image_count := pg_catalog.jsonb_array_length(p_images);
  if v_image_count > 10 then
    raise exception 'A material model can have at most 10 images'
      using errcode = '22023';
  end if;

  select pg_catalog.count(*)::integer
  into v_cover_count
  from pg_catalog.jsonb_array_elements(p_images) as image(value)
  where coalesce((image.value ->> 'is_cover')::boolean, false);

  if (v_image_count = 0 and v_cover_count <> 0)
     or (v_image_count > 0 and v_cover_count <> 1) then
    raise exception 'Select exactly one cover image when images are present'
      using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.material_models (
      code, name, description, group_id, requires_inspection, specifications
    ) values (
      nullif(pg_catalog.btrim(p_code), ''),
      pg_catalog.btrim(p_name),
      nullif(pg_catalog.btrim(p_description), ''),
      p_group_id,
      p_requires_inspection,
      p_specifications
    )
    returning id into v_model_id;
  else
    update public.material_models
    set code = pg_catalog.btrim(p_code),
        name = pg_catalog.btrim(p_name),
        description = nullif(pg_catalog.btrim(p_description), ''),
        group_id = p_group_id,
        requires_inspection = p_requires_inspection,
        specifications = p_specifications
    where id = p_id
    returning id into v_model_id;

    if v_model_id is null then
      raise exception 'Material model not found'
        using errcode = 'P0002';
    end if;
  end if;

  delete from public.material_model_images where model_id = v_model_id;

  for v_image in
    select value from pg_catalog.jsonb_array_elements(p_images)
  loop
    v_storage_path := nullif(pg_catalog.btrim(v_image ->> 'storage_path'), '');
    v_external_url := nullif(pg_catalog.btrim(v_image ->> 'external_url'), '');

    if (v_storage_path is null) = (v_external_url is null) then
      raise exception 'Each image must contain exactly one storage path or external URL'
        using errcode = '22023';
    end if;

    insert into public.material_model_images (
      model_id, storage_path, external_url, sort_order, is_cover
    ) values (
      v_model_id,
      v_storage_path,
      v_external_url,
      v_sort_order,
      coalesce((v_image ->> 'is_cover')::boolean, false)
    );
    v_sort_order := v_sort_order + 1;
  end loop;

  return v_model_id;
end;
$$;

revoke all on function public.save_material_model(
  uuid, text, text, text, uuid, boolean, jsonb, jsonb
) from public, anon;
grant execute on function public.save_material_model(
  uuid, text, text, text, uuid, boolean, jsonb, jsonb
) to authenticated;

notify pgrst, 'reload schema';
