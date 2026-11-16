-- Receipt lines hold a single editable representative profile. The existing
-- receipt items remain the unit rows created from that profile at confirmation.
create unique index material_receipt_lines_id_receipt_uidx
  on public.material_receipt_lines(id, receipt_id);

create table public.material_receipt_representatives (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.material_receipts(id) on delete cascade,
  line_id uuid not null unique,
  model_id uuid references public.material_models(id) on delete restrict,
  material_values jsonb not null default '{}'::jsonb
    check (jsonb_typeof(material_values) = 'object'),
  images jsonb not null default '[]'::jsonb
    check (jsonb_typeof(images) = 'array'),
  public_display_settings jsonb not null default '{"basicInfo":false,"specifications":false}'::jsonb
    check (jsonb_typeof(public_display_settings) = 'object'),
  public_specification_settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(public_specification_settings) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint material_receipt_representative_line_receipt_fk
    foreign key (line_id, receipt_id)
    references public.material_receipt_lines(id, receipt_id) on delete cascade,
  constraint material_receipt_representative_identity_uq
    unique (id, line_id, receipt_id)
);

alter table public.material_receipt_items
  add column representative_id uuid,
  add constraint material_receipt_item_representative_fk
    foreign key (representative_id, line_id, receipt_id)
    references public.material_receipt_representatives(id, line_id, receipt_id)
    on delete cascade;

create index material_receipt_items_representative_idx
  on public.material_receipt_items(representative_id, status, sort_order, id)
  where representative_id is not null;

alter table public.material_receipt_representatives enable row level security;
revoke all on public.material_receipt_representatives from public, anon, authenticated;

-- Backfill the best available profile from existing generated inventory.
insert into public.material_receipt_representatives (
  receipt_id, line_id, model_id, material_values, images,
  public_display_settings, public_specification_settings
)
select
  line.receipt_id,
  line.id,
  line.model_id,
  jsonb_build_object(
    'code', 'REPRESENTATIVE',
    'modelId', line.model_id,
    'nameOverride', coalesce(material_json ->> 'nameOverride', ''),
    'descriptionOverride', coalesce(material_json ->> 'descriptionOverride', ''),
    'serialNumber', '',
    'placedIntoServiceDate', coalesce(material_json ->> 'placedIntoServiceDate', ''),
    'capitalSourceId', coalesce(material_json ->> 'capitalSourceId', ''),
    'unitPriceOverride', material_json -> 'unitPriceOverride',
    'ownerPartyId', receipt.warehouse_id,
    'ownerSnapshot', coalesce(material_json -> 'ownerSnapshot', '{}'::jsonb),
    'condition', 'good',
    'note', '',
    'specificationOverrides', coalesce(material_json -> 'specificationOverrides', line.specification_overrides, '{}'::jsonb),
    'specificationOverrideLabels', coalesce(material_json -> 'specificationOverrideLabels', line.specification_override_labels, '{}'::jsonb),
    'inspectionSettingsOverrideEnabled', coalesce((material_json ->> 'inspectionSettingsOverrideEnabled')::boolean, false),
    'requiresInspectionOverride', material_json -> 'requiresInspectionOverride',
    'inspectionIntervalValueOverride', material_json -> 'inspectionIntervalValueOverride',
    'inspectionIntervalUnitOverride', material_json -> 'inspectionIntervalUnitOverride',
    'safetyInspectionChecklistOverrideEnabled', coalesce((material_json ->> 'safetyInspectionChecklistOverrideEnabled')::boolean, false),
    'safetyInspectionChecklistOverride', coalesce(material_json -> 'safetyInspectionChecklistOverride', '[]'::jsonb),
    'hiddenSpecificationIds', coalesce(material_json -> 'modelSnapshot' -> 'hiddenSpecificationIds', '[]'::jsonb)
  ),
  coalesce(material_json -> 'images', '[]'::jsonb),
  coalesce(material_json -> 'publicDisplaySettings', '{"basicInfo":false,"specifications":false}'::jsonb),
  coalesce(material_json -> 'publicSpecificationSettings', '{}'::jsonb)
from public.material_receipt_lines line
join public.material_receipts receipt on receipt.id = line.receipt_id
left join lateral (
  select public.material_json(item.material_id) as material_json
  from public.material_receipt_items item
  where item.line_id = line.id and item.material_id is not null
  order by item.sort_order, item.id
  limit 1
) existing on true
on conflict (line_id) do nothing;

alter table public.material_receipt_items disable trigger material_receipt_items_scope_guard;
update public.material_receipt_items item
set representative_id = representative.id
from public.material_receipt_representatives representative
where representative.line_id = item.line_id
  and representative.receipt_id = item.receipt_id;
alter table public.material_receipt_items enable trigger material_receipt_items_scope_guard;

create or replace function private.apply_material_receipt_representative(
  p_representative_id uuid,
  p_material_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rep public.material_receipt_representatives%rowtype;
  v_values jsonb;
  v_image jsonb;
  v_checklist jsonb;
begin
  select * into v_rep
  from public.material_receipt_representatives
  where id = p_representative_id;
  if not found then return; end if;
  v_values := v_rep.material_values;

  update public.materials material set
    name_override = nullif(btrim(coalesce(v_values ->> 'nameOverride', '')), ''),
    description_override = nullif(btrim(coalesce(v_values ->> 'descriptionOverride', '')), ''),
    specification_overrides = coalesce(v_values -> 'specificationOverrides', '{}'::jsonb),
    specification_override_labels = coalesce(v_values -> 'specificationOverrideLabels', '{}'::jsonb),
    public_display_settings = coalesce(v_rep.public_display_settings, '{"basicInfo":false,"specifications":false}'::jsonb),
    public_specification_settings = coalesce(v_rep.public_specification_settings, '{}'::jsonb),
    model_snapshot = jsonb_set(
      material.model_snapshot,
      '{hiddenSpecificationIds}',
      coalesce(v_values -> 'hiddenSpecificationIds', '[]'::jsonb),
      true
    ),
    placed_into_service_date = nullif(v_values ->> 'placedIntoServiceDate', '')::date,
    capital_source_id = nullif(v_values ->> 'capitalSourceId', '')::uuid,
    unit_price_override = nullif(v_values ->> 'unitPriceOverride', '')::numeric,
    inspection_settings_override_enabled = coalesce((v_values ->> 'inspectionSettingsOverrideEnabled')::boolean, false),
    requires_inspection_override = case when coalesce((v_values ->> 'inspectionSettingsOverrideEnabled')::boolean, false)
      then coalesce((v_values ->> 'requiresInspectionOverride')::boolean, false) else null end,
    inspection_interval_value_override = case when coalesce((v_values ->> 'inspectionSettingsOverrideEnabled')::boolean, false)
      and coalesce((v_values ->> 'requiresInspectionOverride')::boolean, false)
      then nullif(v_values ->> 'inspectionIntervalValueOverride', '')::integer else null end,
    inspection_interval_unit_override = case when coalesce((v_values ->> 'inspectionSettingsOverrideEnabled')::boolean, false)
      and coalesce((v_values ->> 'requiresInspectionOverride')::boolean, false)
      then nullif(v_values ->> 'inspectionIntervalUnitOverride', '') else null end,
    safety_inspection_checklist_override_enabled = coalesce((v_values ->> 'safetyInspectionChecklistOverrideEnabled')::boolean, false),
    version = material.version + 1,
    updated_at = timezone('utc', now())
  where material.id = p_material_id;

  if coalesce((v_values ->> 'safetyInspectionChecklistOverrideEnabled')::boolean, false) then
    v_checklist := coalesce(v_values -> 'safetyInspectionChecklistOverride', '[]'::jsonb);
    insert into public.material_safety_checklists(material_id, checklist, updated_at)
    values (p_material_id, v_checklist, timezone('utc', now()))
    on conflict (material_id) do update
      set checklist = excluded.checklist, updated_at = excluded.updated_at;
  else
    delete from public.material_safety_checklists where material_id = p_material_id;
  end if;

  delete from public.material_images where material_id = p_material_id;
  for v_image in select value from jsonb_array_elements(coalesce(v_rep.images, '[]'::jsonb)) loop
    insert into public.material_images(
      material_id, storage_bucket, storage_path, external_url, sort_order, is_cover
    ) values (
      p_material_id,
      nullif(v_image ->> 'storageBucket', ''),
      nullif(v_image ->> 'storagePath', ''),
      nullif(v_image ->> 'externalUrl', ''),
      coalesce((v_image ->> 'sortOrder')::integer, 0),
      coalesce((v_image ->> 'isCover')::boolean, false)
    );
  end loop;
end;
$$;
revoke all on function private.apply_material_receipt_representative(uuid, uuid) from public, anon, authenticated;

create or replace function private.sync_material_receipt_item_representative()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.material_id is not null and new.representative_id is not null
    and (tg_op = 'INSERT' or old.material_id is distinct from new.material_id
      or old.representative_id is distinct from new.representative_id) then
    perform private.apply_material_receipt_representative(new.representative_id, new.material_id);
    update public.material_receipt_items
    set material_snapshot = public.material_json(new.material_id)
    where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_material_receipt_item_representative() from public, anon, authenticated;

create trigger material_receipt_item_apply_representative
after insert or update of material_id, representative_id on public.material_receipt_items
for each row execute function private.sync_material_receipt_item_representative();

create or replace function private.sync_material_receipt_representative()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_before jsonb;
begin
  if tg_op = 'INSERT' then return new; end if;
  if new.material_values is not distinct from old.material_values
    and new.images is not distinct from old.images
    and new.public_display_settings is not distinct from old.public_display_settings
    and new.public_specification_settings is not distinct from old.public_specification_settings then
    return new;
  end if;
  for v_item in
    select item.id, item.material_id, receipt.code
    from public.material_receipt_items item
    join public.material_receipts receipt on receipt.id = item.receipt_id
    where item.representative_id = new.id and item.material_id is not null
      and not exists (
        select 1 from public.material_handover_items handover_item
        join public.material_handovers handover on handover.id = handover_item.handover_id
        where handover_item.material_id = item.material_id and handover.status = 'completed'
      )
    order by item.id
    for update of item
  loop
    v_before := public.material_json(v_item.material_id);
    perform private.apply_material_receipt_representative(new.id, v_item.material_id);
    update public.material_receipt_items
    set material_snapshot = public.material_json(v_item.material_id)
    where id = v_item.id;
    insert into public.material_history(material_id, actor_user_id, action, note, from_state, to_state)
    values (
      v_item.material_id, auth.uid(), 'updated',
      'Cập nhật theo hồ sơ đại diện của phiếu nhập ' || v_item.code,
      v_before, public.material_json(v_item.material_id)
    );
  end loop;
  return new;
end;
$$;
revoke all on function private.sync_material_receipt_representative() from public, anon, authenticated;

create trigger material_receipt_representative_sync_materials
after update of material_values, images, public_display_settings, public_specification_settings
on public.material_receipt_representatives
for each row execute function private.sync_material_receipt_representative();

create or replace function private.create_material_receipt_representative()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_warehouse_id uuid;
begin
  select warehouse_id into v_warehouse_id
  from public.material_receipts where id = new.receipt_id;
  insert into public.material_receipt_representatives(
    receipt_id, line_id, model_id, material_values
  )
  values (
    new.receipt_id, new.id, new.model_id,
    jsonb_build_object(
      'code', 'REPRESENTATIVE', 'modelId', new.model_id,
      'ownerPartyId', v_warehouse_id,
      'specificationOverrides', new.specification_overrides,
      'specificationOverrideLabels', new.specification_override_labels
    )
  )
  on conflict (line_id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_material_receipt_representative() from public, anon, authenticated;

create trigger material_receipt_line_create_representative
after insert on public.material_receipt_lines
for each row execute function private.create_material_receipt_representative();

create or replace function private.attach_material_receipt_representative()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.representative_id is null then
    select representative.id into new.representative_id
    from public.material_receipt_representatives representative
    where representative.line_id = new.line_id
      and representative.receipt_id = new.receipt_id;
  end if;
  return new;
end;
$$;
revoke all on function private.attach_material_receipt_representative() from public, anon, authenticated;

create trigger material_receipt_item_attach_representative
before insert on public.material_receipt_items
for each row execute function private.attach_material_receipt_representative();

create or replace function public.save_material_receipt_representative(
  p_receipt_id uuid,
  p_line_id uuid,
  p_expected_version integer,
  p_material_values jsonb,
  p_images jsonb,
  p_public_display_settings jsonb,
  p_public_specification_settings jsonb,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.material_receipts%rowtype;
  v_rep_id uuid;
  v_before jsonb;
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to manage material receipts' using errcode = '42501';
  end if;
  select * into v_receipt from public.material_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Material receipt not found' using errcode = 'P0002'; end if;
  if v_receipt.version is distinct from p_expected_version then
    raise exception 'Receipt changed; reload before saving' using errcode = '40001';
  end if;
  if v_receipt.status not in ('draft', 'handover') then
    raise exception 'Only draft or handover receipts can edit representative materials' using errcode = '55000';
  end if;
  if v_receipt.status = 'handover' and nullif(btrim(p_reason), '') is null then
    raise exception 'A reason is required to update materials in handover' using errcode = '22023';
  end if;
  if v_receipt.status = 'handover' then
    v_before := public.material_receipt_json(p_receipt_id);
  end if;
  if jsonb_typeof(p_material_values) is distinct from 'object'
    or jsonb_typeof(p_images) is distinct from 'array'
    or jsonb_typeof(p_public_display_settings) is distinct from 'object'
    or jsonb_typeof(p_public_specification_settings) is distinct from 'object' then
    raise exception 'Representative material data is invalid' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_images) image(value)
    where jsonb_typeof(image.value) is distinct from 'object'
      or (
        not (
          image.value ->> 'storageBucket' in ('material-images', 'material-model-images')
          and nullif(btrim(image.value ->> 'storagePath'), '') is not null
          and nullif(image.value ->> 'externalUrl', '') is null
        )
        and not (
          nullif(image.value ->> 'storageBucket', '') is null
          and nullif(image.value ->> 'storagePath', '') is null
          and coalesce(image.value ->> 'externalUrl', '') ~* '^https?://'
        )
      )
  ) then
    raise exception 'Representative images are invalid' using errcode = '22023';
  end if;
  if jsonb_array_length(p_images) > 0 and (
    (select count(*) from jsonb_array_elements(p_images) image(value)
      where coalesce((image.value ->> 'isCover')::boolean, false)) <> 1
    or exists (select 1 from jsonb_array_elements(p_images) image(value)
      where coalesce((image.value ->> 'sortOrder')::integer, 0) < 0)
  ) then
    raise exception 'Representative image gallery needs one cover image and valid ordering' using errcode = '22023';
  end if;
  if (p_material_values ->> 'modelId') is distinct from (
      select coalesce(line.model_id::text, line.proposed_model ->> 'id')
      from public.material_receipt_lines line
      where line.id = p_line_id and line.receipt_id = p_receipt_id
    ) then
    raise exception 'Representative model cannot differ from the receipt line' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_material_values -> 'specificationOverrides', '{}'::jsonb)) is distinct from 'object'
    or jsonb_typeof(coalesce(p_material_values -> 'specificationOverrideLabels', '{}'::jsonb)) is distinct from 'object'
    or not private.receipt_line_specification_overrides_valid(
      (select line.model_id from public.material_receipt_lines line where line.id = p_line_id),
      coalesce(p_material_values -> 'specificationOverrides', '{}'::jsonb)
    )
    or not private.receipt_line_specification_override_labels_valid(
      (select line.model_id from public.material_receipt_lines line where line.id = p_line_id),
      coalesce(p_material_values -> 'specificationOverrides', '{}'::jsonb),
      coalesce(p_material_values -> 'specificationOverrideLabels', '{}'::jsonb)
    ) then
    raise exception 'Representative specifications are invalid' using errcode = '22023';
  end if;
  if nullif(p_material_values ->> 'capitalSourceId', '') is not null
    and not exists (select 1 from public.material_capital_sources source
      where source.id = (p_material_values ->> 'capitalSourceId')::uuid and source.is_active) then
    raise exception 'Representative capital source is invalid' using errcode = '22023';
  end if;
  if nullif(p_material_values ->> 'unitPriceOverride', '') is not null
    and (p_material_values ->> 'unitPriceOverride')::numeric < 0 then
    raise exception 'Representative unit price must be nonnegative' using errcode = '22023';
  end if;
  if coalesce((p_material_values ->> 'safetyInspectionChecklistOverrideEnabled')::boolean, false)
    and (jsonb_typeof(p_material_values -> 'safetyInspectionChecklistOverride') is distinct from 'array'
      or not private.safety_inspection_checklist_is_valid(p_material_values -> 'safetyInspectionChecklistOverride')) then
    raise exception 'Representative safety checklist is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.material_receipt_lines line
    where line.id = p_line_id and line.receipt_id = p_receipt_id
      and exists (select 1 from public.material_receipt_items item
        where item.line_id = line.id and item.status = 'active')
  ) then raise exception 'Receipt line not found or inactive' using errcode = 'P0002'; end if;

  update public.material_receipt_representatives
  set material_values = p_material_values,
      images = p_images,
      public_display_settings = p_public_display_settings,
      public_specification_settings = p_public_specification_settings,
      updated_at = timezone('utc', now())
  where line_id = p_line_id and receipt_id = p_receipt_id
  returning id into v_rep_id;
  if v_rep_id is null then
    raise exception 'Representative profile not found' using errcode = 'P0002';
  end if;
  update public.material_receipt_lines
  set specification_overrides = coalesce(p_material_values -> 'specificationOverrides', '{}'::jsonb),
      specification_override_labels = coalesce(p_material_values -> 'specificationOverrideLabels', '{}'::jsonb),
      updated_at = timezone('utc', now())
  where id = p_line_id;
  if v_receipt.status = 'handover' then
    insert into public.material_receipt_history(
      receipt_id, actor_user_id, action, from_status, to_status, reason,
      before_state, after_state
    ) values (
      p_receipt_id, auth.uid(), 'updated', 'handover', 'handover', btrim(p_reason),
      v_before, public.material_receipt_json(p_receipt_id)
    );
  end if;
  return v_rep_id;
end;
$$;
revoke all on function public.save_material_receipt_representative(uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.save_material_receipt_representative(uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb, text) to authenticated;

create or replace function public.material_receipt_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',r.id,'code',r.code,'status',r.status,'warehouse',public.material_party_json(r.warehouse_id),
    'warehouseId',r.warehouse_id,'note',r.note,'version',r.version,
    'createdBy',r.created_by,'confirmedBy',r.confirmed_by,'completedBy',r.completed_by,
    'createdAt',r.created_at,'confirmedAt',r.confirmed_at,'completedAt',r.completed_at,
    'updatedAt',r.updated_at,
    'totalItems',(select count(*) from public.material_receipt_items i where i.receipt_id=r.id and i.status='active'),
    'receivedItems',(select count(distinct i.material_id) from public.material_receipt_items i
      join public.material_handover_items hi on hi.material_id=i.material_id
      join public.material_handovers h on h.id=hi.handover_id and h.receipt_id=r.id and h.status='completed'
      where i.receipt_id=r.id and i.status='active' and hi.receiver_outcome='received'),
    'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'id',l.id,'modelId',l.model_id,'model',case when l.model_id is null then l.proposed_model else jsonb_build_object(
        'id',m.id,'code',m.code,'name',m.name,'groupId',m.group_id,
        'requiresInspection',m.requires_inspection,'externalCodes',m.external_codes,
        'specifications',m.specifications) end,
      'externalCode',l.external_code,'quantity',l.quantity,'sortOrder',l.sort_order,
      'specificationOverrides',l.specification_overrides,
      'specificationOverrideLabels',l.specification_override_labels,
      'representative',case when representative.id is null then null else jsonb_build_object(
        'id',representative.id,'materialValues',representative.material_values,
        'images',representative.images,
        'publicDisplaySettings',representative.public_display_settings,
        'publicSpecificationSettings',representative.public_specification_settings) end,
      'items',coalesce((select jsonb_agg(jsonb_build_object(
        'id',i.id,'materialId',i.material_id,'representativeId',i.representative_id,'serialNumber',i.serial_number,
        'condition',i.condition,'conditionNote',i.condition_note,'note',i.note,
        'status',i.status,'voidReason',i.void_reason,'material',i.material_snapshot,
        'currentSpecificationOverrides',case when i.material_id is null then null else (
          select material.specification_overrides from public.materials material where material.id=i.material_id
        ) end,
        'currentSpecificationOverrideLabels',case when i.material_id is null then null else (
          select material.specification_override_labels from public.materials material where material.id=i.material_id
        ) end
      ) order by i.sort_order,i.id) from public.material_receipt_items i where i.line_id=l.id),'[]'::jsonb)
    ) order by l.sort_order,l.id) from public.material_receipt_lines l
      left join public.material_models m on m.id=l.model_id
      left join public.material_receipt_representatives representative on representative.line_id=l.id
      where l.receipt_id=r.id),'[]'::jsonb)
  ) from public.material_receipts r where r.id=p_id
$$;
revoke all on function public.material_receipt_json(uuid) from public,anon,authenticated;
