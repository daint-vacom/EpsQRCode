alter table public.material_groups
  add column specifications jsonb not null default '[]'::jsonb,
  add constraint material_groups_specifications_array
    check (pg_catalog.jsonb_typeof(specifications) = 'array');

create or replace function private.validate_material_group_specifications()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_specification jsonb;
  v_old_specification jsonb;
begin
  if not public.material_model_specifications_are_valid(new.specifications) then
    raise exception 'Invalid material group specifications'
      using errcode = '22023';
  end if;

  for v_specification in
    select item.value
    from pg_catalog.jsonb_array_elements(new.specifications) as item(value)
  loop
    if coalesce(v_specification ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or nullif(pg_catalog.btrim(v_specification ->> 'name'), '') is null
       or coalesce(v_specification ->> 'dataType', '') not in (
         'text', 'number', 'boolean', 'date', 'color', 'length', 'weight'
       )
       or pg_catalog.jsonb_typeof(v_specification -> 'valueLabels') is distinct from 'array'
       or exists (
         select 1
         from pg_catalog.jsonb_array_elements(v_specification -> 'valueLabels') as label(value)
         where pg_catalog.jsonb_typeof(label.value) is distinct from 'string'
       ) then
      raise exception 'Each material group specification needs a UUID, name, type, and value labels'
        using errcode = '22023';
    end if;

    if tg_op = 'UPDATE' then
      select old_item.value into v_old_specification
      from pg_catalog.jsonb_array_elements(old.specifications) as old_item(value)
      where (old_item.value ->> 'id')::uuid = (v_specification ->> 'id')::uuid;

      if v_old_specification is not null
         and v_old_specification ->> 'dataType' is distinct from v_specification ->> 'dataType' then
        raise exception 'A group specification type cannot be changed after creation'
          using errcode = '22023';
      end if;

      v_old_specification := null;
    end if;
  end loop;

  if exists (
    select (item.value ->> 'id')::uuid
    from pg_catalog.jsonb_array_elements(new.specifications) as item(value)
    group by (item.value ->> 'id')::uuid
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'Material group specification ids must be unique'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_material_group_specifications()
  from public, anon, authenticated;

create trigger material_groups_validate_specifications
before insert or update on public.material_groups
for each row execute function private.validate_material_group_specifications();

create or replace function private.bump_material_models_after_group_specifications_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.specifications is distinct from old.specifications then
    update public.material_models
    set updated_at = timezone('utc', now())
    where group_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.bump_material_models_after_group_specifications_change()
  from public, anon, authenticated;

create trigger material_groups_bump_models_after_specifications_change
after update of specifications on public.material_groups
for each row execute function private.bump_material_models_after_group_specifications_change();

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
    'specifications', coalesce(group_row.specifications, '[]'::jsonb)
      || coalesce(model.specifications, '[]'::jsonb),
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
  where model.id = p_model_id
$$;

notify pgrst, 'reload schema';
