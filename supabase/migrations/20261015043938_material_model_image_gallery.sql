create table if not exists public.material_model_images (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.material_models(id) on delete cascade,
  storage_path text,
  external_url text,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  constraint material_model_images_source_check check (
    (storage_path is not null and length(btrim(storage_path)) > 0 and external_url is null)
    or (external_url is not null and length(btrim(external_url)) > 0 and storage_path is null)
  ),
  constraint material_model_images_sort_order_check check (sort_order >= 0)
);

create index if not exists material_model_images_model_order_idx
  on public.material_model_images (model_id, sort_order, id);

create unique index if not exists material_model_images_one_cover_uidx
  on public.material_model_images (model_id)
  where is_cover;

insert into public.material_model_images (
  model_id, external_url, sort_order, is_cover
)
select id, image_url, 0, true
from public.material_models
where image_url is not null and length(btrim(image_url)) > 0;

alter table public.material_models
  drop constraint if exists material_models_image_url_not_blank,
  drop column if exists image_url;

alter table public.material_model_images enable row level security;
revoke all privileges on public.material_model_images from anon, authenticated;
grant select, insert, update, delete on public.material_model_images to authenticated;

drop policy if exists material_model_images_select_with_permission
  on public.material_model_images;
create policy material_model_images_select_with_permission
on public.material_model_images for select to authenticated
using (
  public.has_permission('material_catalog:material_model:view')
  or public.has_permission('material_catalog:material_model:manage')
);

drop policy if exists material_model_images_insert_with_permission
  on public.material_model_images;
create policy material_model_images_insert_with_permission
on public.material_model_images for insert to authenticated
with check (public.has_permission('material_catalog:material_model:manage'));

drop policy if exists material_model_images_update_with_permission
  on public.material_model_images;
create policy material_model_images_update_with_permission
on public.material_model_images for update to authenticated
using (public.has_permission('material_catalog:material_model:manage'))
with check (public.has_permission('material_catalog:material_model:manage'));

drop policy if exists material_model_images_delete_with_permission
  on public.material_model_images;
create policy material_model_images_delete_with_permission
on public.material_model_images for delete to authenticated
using (public.has_permission('material_catalog:material_model:manage'));

create or replace function public.validate_material_model_image_gallery()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_model_id uuid;
  v_image_count integer;
  v_cover_count integer;
begin
  if tg_op = 'UPDATE' and old.model_id is distinct from new.model_id then
    raise exception 'An image cannot be moved to another material model'
      using errcode = '22023';
  end if;

  v_model_id := case when tg_op = 'DELETE' then old.model_id else new.model_id end;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (where is_cover)::integer
  into v_image_count, v_cover_count
  from public.material_model_images
  where model_id = v_model_id;

  if v_image_count > 10
     or (v_image_count > 0 and v_cover_count <> 1) then
    raise exception 'A material model must have at most 10 images and one cover image'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on function public.validate_material_model_image_gallery()
  from public, anon, authenticated;

drop trigger if exists material_model_images_validate_gallery
  on public.material_model_images;
create constraint trigger material_model_images_validate_gallery
after insert or update or delete on public.material_model_images
deferrable initially deferred
for each row execute function public.validate_material_model_image_gallery();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'material-model-images',
  'material-model-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists material_model_images_storage_select
  on storage.objects;
create policy material_model_images_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'material-model-images'
  and (
    public.has_permission('material_catalog:material_model:view')
    or public.has_permission('material_catalog:material_model:manage')
  )
);

drop policy if exists material_model_images_storage_insert
  on storage.objects;
create policy material_model_images_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'material-model-images'
  and public.has_permission('material_catalog:material_model:manage')
);

drop policy if exists material_model_images_storage_update
  on storage.objects;
create policy material_model_images_storage_update
on storage.objects for update to authenticated
using (
  bucket_id = 'material-model-images'
  and public.has_permission('material_catalog:material_model:manage')
)
with check (
  bucket_id = 'material-model-images'
  and public.has_permission('material_catalog:material_model:manage')
);

drop policy if exists material_model_images_storage_delete
  on storage.objects;
create policy material_model_images_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'material-model-images'
  and public.has_permission('material_catalog:material_model:manage')
);

create or replace function public.save_material_model(
  p_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_images jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_model_id uuid;
  v_image jsonb;
  v_image_count integer;
  v_cover_count integer;
  v_sort_order integer := 0;
  v_storage_path text;
  v_external_url text;
begin
  if not public.has_permission('material_catalog:material_model:manage') then
    raise exception 'Permission denied to manage material models'
      using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(p_images) is distinct from 'array' then
    raise exception 'Images must be a JSON array'
      using errcode = '22023';
  end if;

  v_image_count := pg_catalog.jsonb_array_length(p_images);
  if v_image_count > 10 then
    raise exception 'A material model can have at most 10 images'
      using errcode = '22023';
  end if;

  select pg_catalog.count(*)::integer
  into v_cover_count
  from pg_catalog.jsonb_array_elements(p_images) as image(value)
  where coalesce((image.value ->> 'is_cover')::boolean, false);

  if (v_image_count = 0 and v_cover_count <> 0)
     or (v_image_count > 0 and v_cover_count <> 1) then
    raise exception 'Select exactly one cover image when images are present'
      using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.material_models (code, name, description)
    values (nullif(pg_catalog.btrim(p_code), ''), pg_catalog.btrim(p_name), nullif(pg_catalog.btrim(p_description), ''))
    returning id into v_model_id;
  else
    update public.material_models
    set code = pg_catalog.btrim(p_code),
        name = pg_catalog.btrim(p_name),
        description = nullif(pg_catalog.btrim(p_description), '')
    where id = p_id
    returning id into v_model_id;

    if v_model_id is null then
      raise exception 'Material model not found'
        using errcode = 'P0002';
    end if;
  end if;

  delete from public.material_model_images where model_id = v_model_id;

  for v_image in
    select value from pg_catalog.jsonb_array_elements(p_images)
  loop
    v_storage_path := nullif(pg_catalog.btrim(v_image ->> 'storage_path'), '');
    v_external_url := nullif(pg_catalog.btrim(v_image ->> 'external_url'), '');

    if (v_storage_path is null) = (v_external_url is null) then
      raise exception 'Each image must contain exactly one storage path or external URL'
        using errcode = '22023';
    end if;

    insert into public.material_model_images (
      model_id, storage_path, external_url, sort_order, is_cover
    ) values (
      v_model_id,
      v_storage_path,
      v_external_url,
      v_sort_order,
      coalesce((v_image ->> 'is_cover')::boolean, false)
    );
    v_sort_order := v_sort_order + 1;
  end loop;

  return v_model_id;
end;
$$;

revoke all on function public.save_material_model(uuid, text, text, text, jsonb)
  from public, anon;
grant execute on function public.save_material_model(uuid, text, text, text, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
