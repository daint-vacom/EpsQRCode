-- This migration is intended for the isolated EpsQRCode development project.

create table public.material_images (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  storage_bucket text,
  storage_path text,
  external_url text,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint material_images_source_check check (
    (storage_bucket is not null
      and storage_bucket in ('material-images', 'material-model-images')
      and storage_path is not null and length(btrim(storage_path)) > 0
      and external_url is null)
    or (storage_bucket is null and storage_path is null
      and external_url is not null and length(btrim(external_url)) > 0
      and external_url ~* '^https?://')
  ),
  constraint material_images_sort_order_check check (sort_order >= 0)
);

create index material_images_order_idx
  on public.material_images (material_id, sort_order, id);

create unique index material_images_one_cover_uidx
  on public.material_images (material_id)
  where is_cover;

-- Preserve the model gallery and existing single-image override when migrating.
insert into public.material_images (
  material_id, storage_bucket, storage_path, external_url, sort_order, is_cover
)
select
  m.id,
  case
    when m.image_url_override is not null and image.ordinality = 1 then null
    when nullif(image.value->>'storagePath', '') is not null
      then 'material-model-images'
    else null
  end,
  case
    when m.image_url_override is not null and image.ordinality = 1 then null
    else nullif(image.value->>'storagePath', '')
  end,
  case
    when m.image_url_override is not null and image.ordinality = 1
      then m.image_url_override
    else nullif(image.value->>'externalUrl', '')
  end,
  (image.ordinality - 1)::integer,
  case
    when m.image_url_override is not null and image.ordinality = 1 then true
    when m.image_url_override is not null then false
    else coalesce((image.value->>'isCover')::boolean, false)
  end
from public.materials m
cross join lateral jsonb_array_elements(
  coalesce(m.model_snapshot->'images', '[]'::jsonb)
) with ordinality as image(value, ordinality)
where nullif(image.value->>'storagePath', '') is not null
   or nullif(image.value->>'externalUrl', '') is not null
   or (m.image_url_override is not null and image.ordinality = 1);

insert into public.material_images (
  material_id, external_url, sort_order, is_cover
)
select m.id, m.image_url_override, 0, true
from public.materials m
where m.image_url_override is not null
  and jsonb_array_length(coalesce(m.model_snapshot->'images', '[]'::jsonb)) = 0;

alter table public.material_images enable row level security;
revoke all privileges on public.material_images from anon, authenticated;
grant select on public.material_images to authenticated;

create policy material_images_select_with_permission
on public.material_images for select to authenticated
using (
  public.has_permission('materials:material:view')
  or public.has_permission('materials:material:manage')
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'material-images',
  'material-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists material_images_storage_select on storage.objects;
create policy material_images_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'material-images'
  and (
    public.has_permission('materials:material:view')
    or public.has_permission('materials:material:manage')
  )
);

drop policy if exists material_images_storage_insert on storage.objects;
create policy material_images_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'material-images'
  and public.has_permission('materials:material:manage')
);

drop policy if exists material_images_storage_update on storage.objects;
create policy material_images_storage_update
on storage.objects for update to authenticated
using (
  bucket_id = 'material-images'
  and public.has_permission('materials:material:manage')
)
with check (
  bucket_id = 'material-images'
  and public.has_permission('materials:material:manage')
);

drop policy if exists material_images_storage_delete on storage.objects;
create policy material_images_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'material-images'
  and public.has_permission('materials:material:manage')
);

drop policy if exists material_model_images_storage_select on storage.objects;
create policy material_model_images_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'material-model-images'
  and (
    public.has_permission('material_catalog:material_model:view')
    or public.has_permission('material_catalog:material_model:manage')
    or public.has_permission('materials:material:view')
    or public.has_permission('materials:material:manage')
  )
);

drop policy if exists material_model_images_select_with_permission
  on public.material_model_images;
create policy material_model_images_select_with_permission
on public.material_model_images for select to authenticated
using (
  public.has_permission('material_catalog:material_model:view')
  or public.has_permission('material_catalog:material_model:manage')
  or public.has_permission('materials:material:view')
  or public.has_permission('materials:material:manage')
);

create or replace function public.validate_material_image_gallery()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_material_id uuid;
  v_image_count integer;
  v_cover_count integer;
begin
  if tg_op = 'UPDATE' and old.material_id is distinct from new.material_id then
    raise exception 'An image cannot be moved to another material'
      using errcode = '22023';
  end if;

  if tg_op = 'DELETE' then
    v_material_id := old.material_id;
  else
    v_material_id := new.material_id;
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (where is_cover)::integer
  into v_image_count, v_cover_count
  from public.material_images
  where material_id = v_material_id;

  if v_image_count > 10
     or (v_image_count > 0 and v_cover_count <> 1) then
    raise exception 'A material must have at most 10 images and one cover image'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on function public.validate_material_image_gallery()
  from public, anon, authenticated;

create constraint trigger material_images_validate_gallery
after insert or update or delete on public.material_images
deferrable initially deferred
for each row execute function public.validate_material_image_gallery();

create or replace function public.material_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',m.id,'code',m.code,'modelId',m.model_id,'modelSnapshot',m.model_snapshot,
    'nameOverride',m.name_override,'descriptionOverride',m.description_override,
    'images',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'storageBucket',i.storage_bucket,'storagePath',i.storage_path,
      'externalUrl',i.external_url,'sortOrder',i.sort_order,'isCover',i.is_cover
    ) order by i.sort_order,i.id) from public.material_images i where i.material_id=m.id),'[]'::jsonb),
    'specificationOverrides',m.specification_overrides,
    'serialNumber',m.serial_number,'ownerPartyId',m.owner_party_id,'borrowerPartyId',m.borrower_party_id,
    'condition',m.condition,'conditionNote',m.condition_note,'status',m.status,
    'activeLoanHandoverId',m.active_loan_handover_id,'reservedHandoverId',m.reserved_handover_id,
    'reservationStatus',m.reservation_status,'version',m.version,
    'createdAt',m.created_at,'updatedAt',m.updated_at
  ) from public.materials m where m.id=p_id
$$;

create or replace function public.save_material(p_id uuid,p_expected_version integer,p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_row public.materials%rowtype; v_id uuid; v_model_id uuid; v_owner uuid;
  v_snapshot jsonb; v_overrides jsonb; v_images jsonb; v_image jsonb;
  v_override record; v_spec jsonb; v_source_model public.material_models%rowtype;
  v_condition text; v_note text; v_before jsonb; v_cover_count integer;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode='42501';
  end if;
  if p_id is not null then
    select * into v_row from public.materials where id=p_id for update;
    if not found then raise exception 'Material not found' using errcode='P0002'; end if;
  end if;
  v_model_id:=nullif(p_values->>'modelId','')::uuid;
  v_owner:=nullif(p_values->>'ownerPartyId','')::uuid;
  v_condition:=coalesce(p_values->>'condition','good');
  v_note:=nullif(btrim(p_values->>'conditionNote'),'');
  v_overrides:=coalesce(p_values->'specificationOverrides','{}'::jsonb);
  v_images:=coalesce(p_values->'images','[]'::jsonb);
  if jsonb_typeof(v_overrides) is distinct from 'object' then
    raise exception 'Specification overrides must be an object' using errcode='22023';
  end if;
  if jsonb_typeof(v_images) is distinct from 'array' then
    raise exception 'Material images must be an array' using errcode='22023';
  end if;
  if jsonb_array_length(v_images)>10 then
    raise exception 'A material can have at most 10 images' using errcode='22023';
  end if;
  select count(*) filter (where coalesce((image->>'is_cover')::boolean,false))::integer
  into v_cover_count from jsonb_array_elements(v_images) image;
  if jsonb_array_length(v_images)>0 and v_cover_count<>1 then
    raise exception 'A material must have one cover image' using errcode='22023';
  end if;
  for v_image in select value from jsonb_array_elements(v_images) value loop
    if nullif(v_image->>'storage_path','') is not null then
      if v_image->>'storage_bucket' is null
         or v_image->>'storage_bucket' not in ('material-images','material-model-images')
         or nullif(v_image->>'external_url','') is not null then
        raise exception 'Invalid material image storage source' using errcode='22023';
      end if;
    elsif v_image->>'storage_bucket' is not null
       or coalesce(v_image->>'external_url','') !~* '^https?://' then
      raise exception 'Invalid material image URL source' using errcode='22023';
    end if;
  end loop;
  if v_condition not in ('good','damaged') or (v_condition='damaged' and v_note is null) then
    raise exception 'Damaged materials require a condition note' using errcode='22023';
  end if;
  if v_model_id is null then raise exception 'Material model not found' using errcode='P0002'; end if;
  select * into v_source_model from public.material_models where id=v_model_id;
  if not found then raise exception 'Material model not found' using errcode='P0002'; end if;
  if p_id is null and not v_source_model.is_active then
    raise exception 'Only active models can be used for new materials' using errcode='22023';
  end if;
  if v_owner is null or not exists(select 1 from public.material_custodians where id=v_owner and is_active) then
    raise exception 'An active owner party is required' using errcode='22023';
  end if;
  if not public.material_can_represent(v_owner) then
    raise exception 'You must represent the owner party' using errcode='42501';
  end if;
  for v_override in select key,value from jsonb_each(v_overrides) loop
    if p_id is not null then
      select * into v_row from public.materials where id=p_id;
      select s.value into v_spec from jsonb_array_elements(v_row.model_snapshot->'specifications') s(value)
        where s.value->>'id'=v_override.key;
    else
      select s.value into v_spec from jsonb_array_elements(v_source_model.specifications) s(value)
        where s.value->>'id'=v_override.key;
    end if;
    if v_spec is null or not public.material_spec_override_is_valid(v_spec,v_override.value) then
      raise exception 'Override must use an existing specification and its list rules' using errcode='22023';
    end if;
  end loop;
  v_snapshot:=public.material_model_snapshot(v_model_id);
  if v_snapshot is null then raise exception 'Material model not found' using errcode='P0002'; end if;
  if p_id is null then
    insert into public.materials(code,model_id,model_snapshot,name_override,description_override,
      specification_overrides,serial_number,owner_party_id,condition,condition_note)
    values(btrim(p_values->>'code'),v_model_id,v_snapshot,nullif(btrim(p_values->>'nameOverride'),''),
      nullif(btrim(p_values->>'descriptionOverride'),''),v_overrides,
      nullif(btrim(p_values->>'serialNumber'),''),v_owner,v_condition,v_note)
    returning id into v_id;
  else
    if v_row.version is distinct from p_expected_version then
      raise exception 'Material changed; reload before saving' using errcode='40001';
    end if;
    if v_row.code is distinct from btrim(p_values->>'code') then
      raise exception 'Material code is immutable' using errcode='22023';
    end if;
    if v_row.model_id<>v_model_id or v_row.owner_party_id<>v_owner or v_row.condition<>v_condition
       or v_row.borrower_party_id is not null or v_row.active_loan_handover_id is not null
       or v_row.reserved_handover_id is not null then
      raise exception 'Model, owner, condition and handover state cannot be edited directly' using errcode='22023';
    end if;
    v_before:=public.material_json(p_id);
    update public.materials set name_override=nullif(btrim(p_values->>'nameOverride'),''),
      description_override=nullif(btrim(p_values->>'descriptionOverride'),''),
      specification_overrides=v_overrides,serial_number=nullif(btrim(p_values->>'serialNumber'),''),
      version=version+1,updated_at=timezone('utc',now())
    where id=p_id returning id into v_id;
  end if;
  delete from public.material_images where material_id=v_id;
  insert into public.material_images(
    material_id,storage_bucket,storage_path,external_url,sort_order,is_cover
  )
  select v_id,nullif(image->>'storage_bucket',''),nullif(image->>'storage_path',''),
    nullif(image->>'external_url',''),coalesce((image->>'sort_order')::integer,ordinality-1),
    coalesce((image->>'is_cover')::boolean,false)
  from jsonb_array_elements(v_images) with ordinality as item(image,ordinality);
  if p_id is null then
    insert into public.material_history(material_id,action,to_state)
    values(v_id,'created',public.material_json(v_id));
  else
    insert into public.material_history(material_id,action,from_state,to_state)
    values(v_id,'updated',v_before,public.material_json(v_id));
  end if;
  return v_id;
end $$;

alter table public.materials drop column image_url_override;

revoke all on function public.validate_material_image_gallery()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
