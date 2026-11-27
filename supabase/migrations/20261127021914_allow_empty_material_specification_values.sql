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
    if not v_is_list and v_value_count > 1 then
      return false;
    end if;

    for v_value in
      select item.value
      from pg_catalog.jsonb_array_elements(v_specification -> 'values') as item(value)
    loop
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'string' then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

create or replace function public.save_material_model(
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
  v_core_specifications jsonb;
begin
  if jsonb_typeof(p_public_display_settings) is distinct from 'object'
      or jsonb_typeof(p_public_display_settings -> 'basicInfo') is distinct from 'boolean'
      or jsonb_typeof(p_public_display_settings -> 'specifications') is distinct from 'boolean' then
    raise exception 'Invalid public material model display settings' using errcode = '22023';
  end if;
  if jsonb_typeof(p_specifications) is distinct from 'array' then
    raise exception 'Specifications must be a JSON array' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_set(
        specification.value,
        '{values}',
        coalesce(
          (
            select jsonb_agg(value_item.value order by value_item.ordinality)
            from jsonb_array_elements(specification.value -> 'values')
              with ordinality as value_item(value, ordinality)
            where jsonb_typeof(value_item.value) = 'string'
              and nullif(btrim(value_item.value #>> '{}'), '') is not null
          ),
          '["__empty_specification_value__"]'::jsonb
        ),
        false
      ) order by specification.ordinality
    ),
    '[]'::jsonb
  )
  into v_core_specifications
  from jsonb_array_elements(p_specifications) with ordinality
    as specification(value, ordinality);

  v_id := public.save_material_model_core(
    p_id, p_code, p_name, p_description, p_group_id, p_requires_inspection,
    v_core_specifications, p_images
  );

  update public.material_models
  set specifications = p_specifications,
      external_codes = coalesce(p_external_codes, '{}'::text[]),
      public_display_settings = p_public_display_settings
  where id = v_id;

  return v_id;
end;
$$;

create or replace function public.material_spec_override_is_valid(
  p_spec jsonb,
  p_values jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value jsonb;
  v_text text;
  v_type text;
  v_is_list boolean;
begin
  if p_spec is null or jsonb_typeof(p_values) is distinct from 'array' then
    return false;
  end if;

  v_type := p_spec ->> 'dataType';
  v_is_list := coalesce((p_spec ->> 'isList')::boolean, false);
  if not v_is_list and jsonb_array_length(p_values) > 1 then
    return false;
  end if;

  for v_value in select item.value from jsonb_array_elements(p_values) as item(value) loop
    if jsonb_typeof(v_value) is distinct from 'string' then
      return false;
    end if;

    v_text := v_value #>> '{}';
    if nullif(btrim(v_text), '') is null then
      continue;
    end if;
    if v_type = 'number' and v_text !~ '^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$' then return false; end if;
    if v_type = 'boolean' and lower(v_text) not in ('true', 'false') then return false; end if;
    if v_type = 'date' and (v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(v_text::date, 'YYYY-MM-DD') <> v_text) then return false; end if;
    if v_type = 'color' and v_text !~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$' then return false; end if;
    if v_type = 'length' and v_text !~ '^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)\s*(mm|cm|m|km)?$' then return false; end if;
    if v_type = 'weight' and v_text !~ '^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)\s*(mg|g|kg|t)?$' then return false; end if;
  end loop;

  return true;
end;
$$;

notify pgrst, 'reload schema';
