update public.material_models as model
set specifications = coalesce(
  (
    select pg_catalog.jsonb_agg(
      item.value || pg_catalog.jsonb_build_object(
        'isList',
        case
          when pg_catalog.jsonb_typeof(item.value -> 'isList') = 'boolean'
            then item.value -> 'isList'
          else pg_catalog.to_jsonb(
            pg_catalog.jsonb_array_length(item.value -> 'values') > 1
          )
        end
      )
      order by item.ordinality
    )
    from pg_catalog.jsonb_array_elements(model.specifications)
      with ordinality as item(value, ordinality)
  ),
  '[]'::jsonb
)
where pg_catalog.jsonb_typeof(model.specifications) = 'array';

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

revoke all on function public.material_model_specifications_are_valid(jsonb)
  from public, anon;
grant execute on function public.material_model_specifications_are_valid(jsonb)
  to authenticated;

alter table public.material_models
  drop constraint if exists material_models_specifications_list_mode_valid;
alter table public.material_models
  add constraint material_models_specifications_list_mode_valid
  check (public.material_model_specifications_are_valid(specifications));

notify pgrst, 'reload schema';
