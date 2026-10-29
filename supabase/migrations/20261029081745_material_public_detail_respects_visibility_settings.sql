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
        where coalesce(
          material.public_specification_settings ->> (specification.value ->> 'id'),
          specification.value ->> 'isPublic'
        ) = 'true'
      ), '[]'::jsonb)
      else null end
  ) into v_result
  from public.materials material
  where material.id = p_id
    and (
      material.public_display_settings ->> 'basicInfo' = 'true'
      or material.public_display_settings ->> 'specifications' = 'true'
    );

  return v_result;
end;
$$;

revoke all on function public.get_material_public_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_material_public_detail(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
