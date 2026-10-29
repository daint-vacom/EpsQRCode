create or replace function private.can_view_public_material_image(
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.material_images image
    join public.materials material on material.id = image.material_id
    where image.storage_bucket = p_bucket
      and image.storage_path = p_path
      and material.is_active
      and material.public_display_settings ->> 'basicInfo' = 'true'
  )
$$;

revoke all on function private.can_view_public_material_image(text, text)
  from public, anon, authenticated;
grant execute on function private.can_view_public_material_image(text, text)
  to anon, authenticated;

drop policy if exists material_public_images_storage_select on storage.objects;
create policy material_public_images_storage_select
on storage.objects for select to anon, authenticated
using (
  bucket_id in ('material-images', 'material-model-images')
  and private.can_view_public_material_image(bucket_id, name)
);
grant select on storage.objects to anon, authenticated;

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
        'condition', material.condition,
        'status', material.status,
        'note', material.note,
        'groupName', (
          select material_group.name
          from public.material_groups material_group
          where material_group.id = nullif(material.model_snapshot ->> 'groupId', '')::uuid
        ),
        'ownerName', nullif(material.owner_snapshot ->> 'name', ''),
        'representativeName', nullif(material.owner_snapshot ->> 'representativeName', ''),
        'images', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', image.id,
            'storageBucket', image.storage_bucket,
            'storagePath', image.storage_path,
            'externalUrl', image.external_url,
            'sortOrder', image.sort_order,
            'isCover', image.is_cover
          ) order by image.sort_order, image.id)
          from public.material_images image
          where image.material_id = material.id
        ), '[]'::jsonb),
        'lastPrintedLabel', (
          select jsonb_build_object(
            'widthMm', preference.template_snapshot -> 'widthMm',
            'heightMm', preference.template_snapshot -> 'heightMm',
            'previewSvg', preference.preview_svg
          )
          from public.material_last_label_templates preference
          where preference.material_id = material.id
            and preference.preview_svg is not null
            and preference.template_snapshot ? 'widthMm'
            and preference.template_snapshot ? 'heightMm'
        )
      )
      else null end,
    'specifications', case
      when material.public_display_settings ->> 'basicInfo' = 'true'
        and material.public_display_settings ->> 'specifications' = 'true' then
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
    and material.is_active;

  return v_result;
end;
$$;

revoke all on function public.get_material_public_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_material_public_detail(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
