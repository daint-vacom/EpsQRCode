alter table public.material_models
  add column if not exists group_id uuid
  references public.material_groups(id) on delete set null;

create index if not exists material_models_group_id_idx
  on public.material_models (group_id);

drop function if exists public.save_material_model(
  uuid, text, text, text, boolean, jsonb
);
drop function if exists public.save_material_model(
  uuid, text, text, text, jsonb
);

create function public.save_material_model(
  p_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_group_id uuid,
  p_requires_inspection boolean,
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
      code, name, description, group_id, requires_inspection
    ) values (
      nullif(pg_catalog.btrim(p_code), ''),
      pg_catalog.btrim(p_name),
      nullif(pg_catalog.btrim(p_description), ''),
      p_group_id,
      p_requires_inspection
    )
    returning id into v_model_id;
  else
    update public.material_models
    set code = pg_catalog.btrim(p_code),
        name = pg_catalog.btrim(p_name),
        description = nullif(pg_catalog.btrim(p_description), ''),
        group_id = p_group_id,
        requires_inspection = p_requires_inspection
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
  uuid, text, text, text, uuid, boolean, jsonb
) from public, anon;
grant execute on function public.save_material_model(
  uuid, text, text, text, uuid, boolean, jsonb
) to authenticated;

notify pgrst, 'reload schema';
