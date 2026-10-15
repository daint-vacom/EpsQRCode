-- Length and weight units belong to an optional default measurement value,
-- not to the specification definition itself.
create or replace function private.validate_material_specification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.jsonb_typeof(new.options) <> 'array' then
    raise exception 'Suggested values must be an array'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(new.options) as option_row(option_value)
    where pg_catalog.jsonb_typeof(option_row.option_value) <> 'object'
      or coalesce(option_row.option_value ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or length(pg_catalog.btrim(coalesce(option_row.option_value ->> 'label', ''))) = 0
  ) then
    raise exception 'Each suggested value must include a UUID and value'
      using errcode = '22023';
  end if;

  if exists (
    select pg_catalog.lower(pg_catalog.btrim(option_row.option_value ->> 'label'))
    from pg_catalog.jsonb_array_elements(new.options) as option_row(option_value)
    group by pg_catalog.lower(pg_catalog.btrim(option_row.option_value ->> 'label'))
    having count(*) > 1
  ) then
    raise exception 'Suggested values must be unique within a specification'
      using errcode = '23505';
  end if;

  if new.data_type = 'color' and exists (
    select 1
    from pg_catalog.jsonb_array_elements(new.options) as option_row(option_value)
    where coalesce(option_row.option_value ->> 'label', '')
      !~* '^#([0-9a-f]{3}|[0-9a-f]{6})$'
  ) then
    raise exception 'Color suggested values must be valid HEX colors'
      using errcode = '22023';
  end if;

  if new.data_type = 'boolean' and exists (
    select 1
    from pg_catalog.jsonb_array_elements(new.options) as option_row(option_value)
    where option_row.option_value ->> 'label' not in ('true', 'false')
  ) then
    raise exception 'Boolean suggested values must be true or false'
      using errcode = '22023';
  end if;

  if new.data_type in ('number', 'length', 'weight') and exists (
    select 1
    from pg_catalog.jsonb_array_elements(new.options) as option_row(option_value)
    where coalesce(option_row.option_value ->> 'label', '')
      !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
  ) then
    raise exception 'Numeric suggested values must be valid numbers'
      using errcode = '22023';
  end if;

  if new.data_type in ('length', 'weight') then
    new.unit := null;
  elsif new.data_type not in ('number') then
    new.unit := null;
  end if;

  return new;
end;
$$;

-- Preserve a former definition-level unit as part of an existing default value.
update public.material_specifications
set default_value = pg_catalog.jsonb_set(
      default_value,
      '{unit}',
      pg_catalog.to_jsonb(unit),
      true
    ),
    unit = null
where data_type in ('length', 'weight')
  and unit is not null
  and pg_catalog.jsonb_typeof(default_value) = 'object'
  and default_value ? 'amount'
  and not (default_value ? 'unit');

update public.material_specifications
set unit = null
where data_type in ('length', 'weight')
  and unit is not null;
