create or replace function private.safety_inspection_checklist_is_valid(
  p_checklist jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_group jsonb;
  v_criterion jsonb;
begin
  if pg_catalog.jsonb_typeof(p_checklist) is distinct from 'array' then
    return false;
  end if;

  for v_group in
    select item.value from pg_catalog.jsonb_array_elements(p_checklist) item(value)
  loop
    if pg_catalog.jsonb_typeof(v_group) is distinct from 'object'
       or coalesce(v_group ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or nullif(pg_catalog.btrim(v_group ->> 'name'), '') is null then
      return false;
    end if;

    if pg_catalog.jsonb_typeof(v_group -> 'criteria') is distinct from 'array' then
      return false;
    end if;

    if pg_catalog.jsonb_array_length(v_group -> 'criteria') = 0 then
      return false;
    end if;

    for v_criterion in
      select item.value
      from pg_catalog.jsonb_array_elements(v_group -> 'criteria') item(value)
    loop
      if pg_catalog.jsonb_typeof(v_criterion) is distinct from 'object'
         or coalesce(v_criterion ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or nullif(pg_catalog.btrim(v_criterion ->> 'content'), '') is null then
        return false;
      end if;
    end loop;
  end loop;

  if exists (
    select item.value ->> 'id'
    from pg_catalog.jsonb_array_elements(p_checklist) item(value)
    group by item.value ->> 'id'
    having pg_catalog.count(*) > 1
  ) or exists (
    select criterion.value ->> 'id'
    from pg_catalog.jsonb_array_elements(p_checklist) item(value)
    cross join lateral pg_catalog.jsonb_array_elements(item.value -> 'criteria') criterion(value)
    group by criterion.value ->> 'id'
    having pg_catalog.count(*) > 1
  ) then
    return false;
  end if;

  return true;
end;
$$;

grant usage on schema private to authenticated;
grant execute on function private.safety_inspection_checklist_is_valid(jsonb)
  to authenticated;

alter table public.material_groups
  add column safety_inspection_checklist jsonb not null default '[]'::jsonb;
alter table public.material_groups
  add constraint material_groups_safety_inspection_checklist_valid
  check (private.safety_inspection_checklist_is_valid(safety_inspection_checklist));

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
    where group_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.bump_models_after_group_safety_checklist_change()
  from public, anon, authenticated;
create trigger material_groups_bump_models_after_safety_checklist
after update of safety_inspection_checklist on public.material_groups
for each row execute function private.bump_models_after_group_safety_checklist_change();

create table public.material_model_safety_checklists (
  model_id uuid primary key references public.material_models(id) on delete cascade,
  checklist jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint material_model_safety_checklists_valid
    check (private.safety_inspection_checklist_is_valid(checklist))
);

create or replace function private.bump_model_after_safety_checklist_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.material_models
  set updated_at = timezone('utc', now())
  where id = coalesce(new.model_id, old.model_id);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function private.bump_model_after_safety_checklist_change()
  from public, anon, authenticated;
create trigger material_model_safety_checklists_bump_model
after insert or update or delete on public.material_model_safety_checklists
for each row execute function private.bump_model_after_safety_checklist_change();

alter table public.material_model_safety_checklists enable row level security;
revoke all on public.material_model_safety_checklists from anon, authenticated;
grant select, insert, update, delete on public.material_model_safety_checklists
  to authenticated;

create policy material_model_safety_checklists_select_with_permission
on public.material_model_safety_checklists for select to authenticated
using (
  public.has_permission('material_catalog:material_model:view')
  or public.has_permission('material_catalog:material_model:manage')
  or public.has_permission('materials:receipt:view')
  or public.has_permission('materials:receipt:manage')
);
create policy material_model_safety_checklists_insert_with_permission
on public.material_model_safety_checklists for insert to authenticated
with check (public.has_permission('material_catalog:material_model:manage'));
create policy material_model_safety_checklists_update_with_permission
on public.material_model_safety_checklists for update to authenticated
using (public.has_permission('material_catalog:material_model:manage'))
with check (public.has_permission('material_catalog:material_model:manage'));
create policy material_model_safety_checklists_delete_with_permission
on public.material_model_safety_checklists for delete to authenticated
using (public.has_permission('material_catalog:material_model:manage'));

create or replace function public.save_material_model_with_safety_checklist(
  p_id uuid,
  p_code text,
  p_name text,
  p_group_id uuid,
  p_description text,
  p_requires_inspection boolean,
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

  insert into public.material_model_safety_checklists (model_id, checklist)
  values (v_model_id, p_safety_inspection_checklist)
  on conflict (model_id) do update
    set checklist = excluded.checklist,
        updated_at = timezone('utc', now());

  return v_model_id;
end;
$$;

revoke all on function public.save_material_model_with_safety_checklist(
  uuid, text, text, uuid, text, boolean, jsonb, jsonb, jsonb, text[], jsonb
) from public, anon;
grant execute on function public.save_material_model_with_safety_checklist(
  uuid, text, text, uuid, text, boolean, jsonb, jsonb, jsonb, text[], jsonb
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
    'specifications', coalesce(group_row.specifications, '[]'::jsonb)
      || coalesce(model.specifications, '[]'::jsonb),
    'safetyInspectionChecklist',
      coalesce(group_row.safety_inspection_checklist, '[]'::jsonb)
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
      ('specifications', v_row.model_snapshot->'specifications', v_new->'specifications'),
      ('safetyInspectionChecklist', v_row.model_snapshot->'safetyInspectionChecklist', v_new->'safetyInspectionChecklist'),
      ('images', v_row.model_snapshot->'images', v_new->'images')
    ) field(name, old_value, new_value) where field.old_value is distinct from field.new_value), '[]'::jsonb)
  );
end;
$$;

create or replace function public.apply_material_model_sync(
  p_id uuid,
  p_expected_version integer,
  p_expected_model_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.materials%rowtype;
  v_before jsonb;
  v_new jsonb;
  v_all_specifications jsonb;
  v_new_overrides jsonb := '{}'::jsonb;
  v_key text;
  v_specification jsonb;
  v_owner_scope uuid;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode = '42501';
  end if;
  select * into v_row from public.materials where id = p_id for update;
  if not found then raise exception 'Material not found' using errcode = 'P0002'; end if;
  if v_row.version is distinct from p_expected_version then
    raise exception 'Material changed; reload before syncing' using errcode = '40001';
  end if;
  if p_expected_model_updated_at is null
    or (select model.updated_at from public.material_models model where model.id = v_row.model_id)
      is distinct from p_expected_model_updated_at then
    raise exception 'Model changed after preview; reload the sync preview' using errcode = '40001';
  end if;
  v_owner_scope := coalesce(v_row.owner_party_id,
    nullif(v_row.owner_snapshot->>'scopePartyId', '')::uuid);
  if not public.material_can_represent(v_owner_scope) then
    raise exception 'You must represent the owner party' using errcode = '42501';
  end if;
  if v_row.reserved_handover_id is not null then
    raise exception 'Material is reserved by an open handover' using errcode = '55000';
  end if;
  v_before := public.material_json(p_id);
  v_new := public.material_model_snapshot(v_row.model_id)
    || jsonb_build_object(
      'customSpecifications', coalesce(v_row.model_snapshot -> 'customSpecifications', '[]'::jsonb),
      'hiddenSpecificationIds', coalesce(v_row.model_snapshot -> 'hiddenSpecificationIds', '[]'::jsonb)
    );
  v_all_specifications := coalesce(v_new -> 'specifications', '[]'::jsonb)
    || coalesce(v_new -> 'customSpecifications', '[]'::jsonb);
  for v_key in select jsonb_object_keys(v_row.specification_overrides) loop
    select specification.value into v_specification
    from jsonb_array_elements(v_all_specifications) specification(value)
    where specification.value->>'id' = v_key;
    if v_specification is null or not public.material_spec_override_is_valid(v_specification, v_row.specification_overrides->v_key) then
      raise exception 'The model removed or changed an overridden specification; resolve overrides before syncing' using errcode = '22023';
    end if;
    v_new_overrides := v_new_overrides || jsonb_build_object(v_key, v_row.specification_overrides->v_key);
  end loop;
  update public.materials set model_snapshot = v_new, specification_overrides = v_new_overrides,
    version = version + 1, updated_at = timezone('utc', now()) where id = p_id;
  insert into public.material_history(material_id, action, note, from_state, to_state)
  values (p_id, 'model_synced', 'Đồng bộ phiên bản mẫu vật tư', v_before, public.material_json(p_id));
  return p_id;
end;
$$;

create table public.material_safety_checklists (
  material_id uuid primary key references public.materials(id) on delete cascade,
  checklist jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint material_safety_checklists_valid
    check (private.safety_inspection_checklist_is_valid(checklist))
);

alter table public.material_safety_checklists enable row level security;
revoke all on public.material_safety_checklists from anon, authenticated;
grant select, insert, update, delete on public.material_safety_checklists to authenticated;

create policy material_safety_checklists_select_with_permission
on public.material_safety_checklists for select to authenticated
using (public.can_view_material_current(material_id));
create policy material_safety_checklists_insert_with_permission
on public.material_safety_checklists for insert to authenticated
with check (
  exists (
    select 1
    from public.materials material
    where material.id = material_id
      and (
        public.has_scoped_permission('materials:material:manage', material.owner_party_id)
        or (material.borrower_party_id is not null and
            public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
      )
  )
);
create policy material_safety_checklists_update_with_permission
on public.material_safety_checklists for update to authenticated
using (
  exists (
    select 1
    from public.materials material
    where material.id = material_id
      and (
        public.has_scoped_permission('materials:material:manage', material.owner_party_id)
        or (material.borrower_party_id is not null and
            public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
      )
  )
)
with check (
  exists (
    select 1
    from public.materials material
    where material.id = material_id
      and (
        public.has_scoped_permission('materials:material:manage', material.owner_party_id)
        or (material.borrower_party_id is not null and
            public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
      )
  )
);
create policy material_safety_checklists_delete_with_permission
on public.material_safety_checklists for delete to authenticated
using (
  exists (
    select 1
    from public.materials material
    where material.id = material_id
      and (
        public.has_scoped_permission('materials:material:manage', material.owner_party_id)
        or (material.borrower_party_id is not null and
            public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
      )
  )
);

create or replace function public.save_material_with_safety_checklist(
  p_id uuid,
  p_expected_version integer,
  p_values jsonb,
  p_public_display_settings jsonb,
  p_public_specification_settings jsonb,
  p_safety_inspection_checklist jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_material_id uuid;
begin
  if not private.safety_inspection_checklist_is_valid(p_safety_inspection_checklist) then
    raise exception 'Invalid material safety inspection checklist'
      using errcode = '22023';
  end if;

  v_material_id := public.save_material_with_public_display_settings(
    p_id,
    p_expected_version,
    p_values,
    p_public_display_settings,
    p_public_specification_settings
  );

  insert into public.material_safety_checklists (material_id, checklist)
  values (v_material_id, p_safety_inspection_checklist)
  on conflict (material_id) do update
    set checklist = excluded.checklist,
        updated_at = timezone('utc', now());

  return v_material_id;
end;
$$;

revoke all on function public.save_material_with_safety_checklist(
  uuid, integer, jsonb, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.save_material_with_safety_checklist(
  uuid, integer, jsonb, jsonb, jsonb, jsonb
) to authenticated;

create table public.material_safety_inspections (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete restrict,
  inspected_at timestamptz not null,
  inspected_by uuid not null default auth.uid()
    references public.user_profiles(id) on delete restrict,
  inspector_name text not null,
  checklist_result jsonb not null,
  overall_note text not null default '',
  overall_result text not null
    check (overall_result in ('passed', 'failed')),
  attachments jsonb not null default '[]'::jsonb,
  created_by uuid not null default auth.uid()
    references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint material_safety_inspections_inspector_name_not_blank
    check (length(btrim(inspector_name)) > 0),
  constraint material_safety_inspections_result_is_array
    check (jsonb_typeof(checklist_result) = 'array'),
  constraint material_safety_inspections_attachments_are_array
    check (jsonb_typeof(attachments) = 'array')
);

create index material_safety_inspections_material_date_idx
  on public.material_safety_inspections (material_id, inspected_at desc, id desc);

create or replace function public.delete_material(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material public.materials%rowtype;
begin
  if auth.uid() is null
    or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode = '42501';
  end if;

  select * into v_material
  from public.materials
  where id = p_id
  for update;
  if not found then
    raise exception 'Material not found' using errcode = 'P0002';
  end if;

  if v_material.reserved_handover_id is not null
    or v_material.active_loan_handover_id is not null
    or exists (
      select 1
      from public.material_handover_items
      where material_id = p_id
    ) then
    raise exception 'Không thể xóa vật tư đã phát sinh phiếu bàn giao'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.material_safety_inspections
    where material_id = p_id
  ) then
    raise exception 'Không thể xóa vật tư đã có phiếu kiểm định an toàn'
      using errcode = '55000';
  end if;

  delete from public.material_history where material_id = p_id;
  delete from public.materials where id = p_id;
end;
$$;

revoke all on function public.delete_material(uuid) from public, anon;
grant execute on function public.delete_material(uuid) to authenticated;

alter table public.material_safety_inspections enable row level security;
revoke all on public.material_safety_inspections from anon, authenticated;
grant select, insert on public.material_safety_inspections to authenticated;

create policy material_safety_inspections_select_with_permission
on public.material_safety_inspections for select to authenticated
using (public.can_view_material_current(material_id));
create policy material_safety_inspections_insert_with_permission
on public.material_safety_inspections for insert to authenticated
with check (
  inspected_by = (select auth.uid())
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.materials material
    where material.id = material_id
      and (
        public.has_scoped_permission('materials:material:manage', material.owner_party_id)
        or (material.borrower_party_id is not null and
            public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
      )
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'material-safety-inspections',
  'material-safety-inspections',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png', 'image/jpeg', 'image/webp'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy material_safety_inspection_files_select
on storage.objects for select to authenticated
using (
  bucket_id = 'material-safety-inspections'
  and exists (
    select 1
    from public.materials material
    where material.id::text = (storage.foldername(name))[1]
      and public.can_view_material_current(material.id)
  )
);
create policy material_safety_inspection_files_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'material-safety-inspections'
  and exists (
    select 1
    from public.materials material
    where material.id::text = (storage.foldername(name))[1]
      and (
        public.has_scoped_permission('materials:material:manage', material.owner_party_id)
        or (material.borrower_party_id is not null and
            public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
      )
  )
);
create policy material_safety_inspection_files_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'material-safety-inspections'
  and exists (
    select 1
    from public.materials material
    where material.id::text = (storage.foldername(name))[1]
      and (
        public.has_scoped_permission('materials:material:manage', material.owner_party_id)
        or (material.borrower_party_id is not null and
            public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
      )
  )
);

notify pgrst, 'reload schema';
