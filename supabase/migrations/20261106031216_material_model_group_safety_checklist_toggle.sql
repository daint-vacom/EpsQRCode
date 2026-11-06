alter table public.material_models
  add column use_group_safety_inspection_checklist boolean not null default true;

create or replace function private.bump_models_after_group_safety_checklist_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.safety_inspection_checklist is distinct from old.safety_inspection_checklist then
    update public.material_models
    set updated_at = timezone('utc', now())
    where group_id = new.id
      and use_group_safety_inspection_checklist;
  end if;
  return new;
end;
$$;

drop function public.save_material_model_with_safety_checklist(
  uuid, text, text, uuid, text, boolean, jsonb, jsonb, jsonb, text[], jsonb
);

create function public.save_material_model_with_safety_checklist(
  p_id uuid,
  p_code text,
  p_name text,
  p_group_id uuid,
  p_description text,
  p_requires_inspection boolean,
  p_use_group_safety_inspection_checklist boolean,
  p_specifications jsonb,
  p_images jsonb,
  p_public_display_settings jsonb,
  p_external_codes text[],
  p_safety_inspection_checklist jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_model_id uuid;
begin
  if not private.safety_inspection_checklist_is_valid(p_safety_inspection_checklist) then
    raise exception 'Invalid material model safety inspection checklist'
      using errcode = '22023';
  end if;

  v_model_id := public.save_material_model(
    p_id,
    p_code,
    p_name,
    p_group_id,
    p_description,
    p_requires_inspection,
    p_specifications,
    p_images,
    p_public_display_settings,
    p_external_codes
  );

  update public.material_models
  set use_group_safety_inspection_checklist = p_use_group_safety_inspection_checklist,
      updated_at = timezone('utc', now())
  where id = v_model_id;

  insert into public.material_model_safety_checklists (model_id, checklist)
  values (v_model_id, p_safety_inspection_checklist)
  on conflict (model_id) do update
    set checklist = excluded.checklist,
        updated_at = timezone('utc', now());

  return v_model_id;
end;
$$;

revoke all on function public.save_material_model_with_safety_checklist(
  uuid, text, text, uuid, text, boolean, boolean, jsonb, jsonb, jsonb, text[], jsonb
) from public, anon;
grant execute on function public.save_material_model_with_safety_checklist(
  uuid, text, text, uuid, text, boolean, boolean, jsonb, jsonb, jsonb, text[], jsonb
) to authenticated;

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
    'useGroupSafetyInspectionChecklist', model.use_group_safety_inspection_checklist,
    'specifications', coalesce(group_row.specifications, '[]'::jsonb)
      || coalesce(model.specifications, '[]'::jsonb),
    'safetyInspectionChecklist',
      (case when model.use_group_safety_inspection_checklist
        then coalesce(group_row.safety_inspection_checklist, '[]'::jsonb)
        else '[]'::jsonb
      end)
      || coalesce(model_checklist.checklist, '[]'::jsonb),
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
  left join public.material_model_safety_checklists model_checklist
    on model_checklist.model_id = model.id
  where model.id = p_model_id
$$;

create or replace function public.preview_material_model_sync(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.materials%rowtype;
  v_new jsonb;
  v_owner_scope uuid;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode = '42501';
  end if;
  select * into v_row from public.materials where id = p_id;
  if not found then raise exception 'Material not found' using errcode = 'P0002'; end if;
  v_owner_scope := coalesce(v_row.owner_party_id,
    nullif(v_row.owner_snapshot->>'scopePartyId', '')::uuid);
  if not public.material_can_represent(v_owner_scope) then
    raise exception 'You must represent the owner party' using errcode = '42501';
  end if;
  v_new := public.material_model_snapshot(v_row.model_id)
    || jsonb_build_object(
      'customSpecifications', coalesce(v_row.model_snapshot -> 'customSpecifications', '[]'::jsonb),
      'hiddenSpecificationIds', coalesce(v_row.model_snapshot -> 'hiddenSpecificationIds', '[]'::jsonb)
    );
  return jsonb_build_object(
    'materialId', v_row.id,
    'currentSnapshot', v_row.model_snapshot,
    'proposedSnapshot', v_new,
    'modelUpdatedAt', (select model.updated_at from public.material_models model where model.id = v_row.model_id),
    'preservedOverrides', coalesce((select jsonb_agg(key) from jsonb_object_keys(v_row.specification_overrides) key), '[]'::jsonb),
    'changedFields', coalesce((select jsonb_agg(field.name) from (values
      ('code', v_row.model_snapshot->'code', v_new->'code'),
      ('name', v_row.model_snapshot->'name', v_new->'name'),
      ('groupId', v_row.model_snapshot->'groupId', v_new->'groupId'),
      ('description', v_row.model_snapshot->'description', v_new->'description'),
      ('requiresInspection', v_row.model_snapshot->'requiresInspection', v_new->'requiresInspection'),
      ('useGroupSafetyInspectionChecklist', v_row.model_snapshot->'useGroupSafetyInspectionChecklist', v_new->'useGroupSafetyInspectionChecklist'),
      ('specifications', v_row.model_snapshot->'specifications', v_new->'specifications'),
      ('safetyInspectionChecklist', v_row.model_snapshot->'safetyInspectionChecklist', v_new->'safetyInspectionChecklist'),
      ('images', v_row.model_snapshot->'images', v_new->'images')
    ) field(name, old_value, new_value) where field.old_value is distinct from field.new_value), '[]'::jsonb)
  );
end;
$$;
