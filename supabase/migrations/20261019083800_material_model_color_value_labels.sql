update public.material_models as model
set specifications = (
  select coalesce(
    jsonb_agg(
      case
        when specification.value ->> 'dataType' = 'color' then
          jsonb_set(
            specification.value,
            '{valueLabels}',
            case
              when jsonb_typeof(specification.value -> 'valueLabels') = 'array'
                and jsonb_array_length(specification.value -> 'valueLabels') =
                  jsonb_array_length(specification.value -> 'values')
                then specification.value -> 'valueLabels'
              else (
                select coalesce(jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
                from jsonb_array_elements(specification.value -> 'values')
                  with ordinality as item(value, ordinality)
              )
            end,
            true
          )
        else jsonb_set(specification.value, '{valueLabels}', '[]'::jsonb, true)
      end
      order by specification.ordinality
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(model.specifications)
    with ordinality as specification(value, ordinality)
)
where jsonb_typeof(model.specifications) = 'array';

update public.materials as material
set model_snapshot = jsonb_set(
  material.model_snapshot,
  '{specifications}',
  (
    select coalesce(
      jsonb_agg(
        case
          when specification.value ->> 'dataType' = 'color' then
            jsonb_set(
              specification.value,
              '{valueLabels}',
              case
                when jsonb_typeof(specification.value -> 'valueLabels') = 'array'
                  and jsonb_array_length(specification.value -> 'valueLabels') =
                    jsonb_array_length(specification.value -> 'values')
                  then specification.value -> 'valueLabels'
                else (
                  select coalesce(jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
                  from jsonb_array_elements(specification.value -> 'values')
                    with ordinality as item(value, ordinality)
                )
              end,
              true
            )
          else jsonb_set(specification.value, '{valueLabels}', '[]'::jsonb, true)
        end
        order by specification.ordinality
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(material.model_snapshot -> 'specifications')
      with ordinality as specification(value, ordinality)
  ),
  true
)
where jsonb_typeof(material.model_snapshot -> 'specifications') = 'array';
