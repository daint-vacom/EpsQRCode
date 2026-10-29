alter table public.material_last_label_templates
  add column template_snapshot jsonb,
  add column preview_svg text,
  add constraint material_last_label_templates_template_snapshot_object
    check (template_snapshot is null or jsonb_typeof(template_snapshot) = 'object');

drop function public.save_material_label_template_preferences(uuid[], uuid);

create or replace function public.save_material_label_template_preferences(
  p_material_ids uuid[],
  p_template_id uuid,
  p_template_snapshot jsonb,
  p_material_previews jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception using errcode = '42501', message = 'Bạn không có quyền lưu mẫu nhãn đã chọn.';
  end if;
  if not exists (
    select 1 from public.material_label_templates
    where id = p_template_id and is_active
  ) then
    raise exception using errcode = 'P0002', message = 'Mẫu nhãn không còn hoạt động.';
  end if;
  if jsonb_typeof(p_template_snapshot) is distinct from 'object'
      or p_template_snapshot ->> 'id' is distinct from p_template_id::text
      or jsonb_typeof(p_material_previews) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Dữ liệu bản in nhãn không hợp lệ.';
  end if;
  if exists (
    select 1
    from (select distinct requested.id from unnest(coalesce(p_material_ids, '{}'::uuid[])) as requested(id)) ids
    left join public.materials material on material.id = ids.id
    where material.id is null
       or jsonb_typeof(p_material_previews -> ids.id::text) is distinct from 'string'
       or length(btrim(p_material_previews ->> ids.id::text)) = 0
  ) then
    raise exception using errcode = '22023', message = 'Thiếu ảnh xem trước cho vật tư được chọn.';
  end if;

  insert into public.material_last_label_templates
    (material_id, template_id, template_snapshot, preview_svg, last_printed_at, updated_by, updated_at)
  select distinct material.id,
      p_template_id,
      p_template_snapshot,
      p_material_previews ->> material.id::text,
      timezone('utc', now()),
      auth.uid(),
      timezone('utc', now())
  from unnest(coalesce(p_material_ids, '{}'::uuid[])) as requested(id)
  join public.materials material on material.id = requested.id
  on conflict (material_id) do update
    set template_id = excluded.template_id,
        template_snapshot = excluded.template_snapshot,
        preview_svg = excluded.preview_svg,
        last_printed_at = excluded.last_printed_at,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  return true;
end;
$$;

create or replace function public.get_material_last_label_print(p_material_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception using errcode = '42501', message = 'Bạn không có quyền xem nhãn vật tư.';
  end if;

  select jsonb_build_object(
    'materialId', preference.material_id,
    'templateId', preference.template_id,
    'templateSnapshot', preference.template_snapshot,
    'previewSvg', preference.preview_svg,
    'lastPrintedAt', preference.last_printed_at
  )
  into v_result
  from public.material_last_label_templates preference
  where preference.material_id = p_material_id;

  return v_result;
end;
$$;

revoke all on function public.save_material_label_template_preferences(uuid[], uuid, jsonb, jsonb) from public, anon;
revoke all on function public.get_material_last_label_print(uuid) from public, anon;
grant execute on function public.save_material_label_template_preferences(uuid[], uuid, jsonb, jsonb) to authenticated;
grant execute on function public.get_material_last_label_print(uuid) to authenticated;
