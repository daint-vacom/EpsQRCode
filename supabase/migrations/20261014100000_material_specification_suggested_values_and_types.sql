alter table public.material_specifications
  drop constraint if exists material_specifications_data_type_check,
  drop constraint if exists material_specifications_list_options_check;

drop trigger if exists material_specifications_validate
  on public.material_specifications;

update public.material_specifications
set data_type = case
  when data_type = 'list'
    and (code = 'TS-00008' or lower(name) in ('màu sắc', 'mau sac'))
    then 'color'
  when data_type = 'list' then 'text'
  when data_type = 'number'
    and lower(btrim(coalesce(unit, ''))) in ('mm', 'cm', 'dm', 'm', 'km')
    then 'length'
  when data_type = 'number'
    and lower(btrim(coalesce(unit, ''))) in ('mg', 'g', 'kg', 't')
    then 'weight'
  else data_type
end;

update public.material_specifications
set unit = lower(btrim(unit))
where data_type in ('length', 'weight') and unit is not null;

update public.material_specifications as specification
set options = (
  select coalesce(
    jsonb_agg(
      jsonb_set(
        option_row.option_value,
        '{label}',
        to_jsonb(
          case lower(btrim(option_row.option_value ->> 'label'))
            when 'trắng' then '#ffffff'
            when 'đen' then '#000000'
            when 'xám' then '#9e9e9e'
            when 'bạc' then '#c0c0c0'
            when 'xanh dương' then '#2196f3'
            else lower(btrim(option_row.option_value ->> 'label'))
          end
        )
      ) order by option_row.ordinality
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(specification.options)
    with ordinality as option_row(option_value, ordinality)
)
where specification.data_type = 'color';

update public.material_specifications
set default_value = to_jsonb(
  case lower(btrim(default_value #>> '{}'))
    when 'trắng' then '#ffffff'
    when 'đen' then '#000000'
    when 'xám' then '#9e9e9e'
    when 'bạc' then '#c0c0c0'
    when 'xanh dương' then '#2196f3'
    else lower(btrim(default_value #>> '{}'))
  end
)
where data_type = 'color'
  and jsonb_typeof(default_value) = 'string';

alter table public.material_specifications
  add constraint material_specifications_data_type_check
    check (data_type in (
      'text', 'number', 'boolean', 'date', 'color', 'length', 'weight'
    ));

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

  if new.data_type = 'length'
    and (new.unit is null or new.unit not in ('mm', 'cm', 'dm', 'm', 'km')) then
    raise exception 'Length specifications require a supported unit'
      using errcode = '22023';
  end if;

  if new.data_type = 'weight'
    and (new.unit is null or new.unit not in ('mg', 'g', 'kg', 't')) then
    raise exception 'Weight specifications require a supported unit'
      using errcode = '22023';
  end if;

  if new.data_type not in ('number', 'length', 'weight') then
    new.unit := null;
  end if;

  return new;
end;
$$;

create trigger material_specifications_validate
before insert or update on public.material_specifications
for each row execute function private.validate_material_specification();
