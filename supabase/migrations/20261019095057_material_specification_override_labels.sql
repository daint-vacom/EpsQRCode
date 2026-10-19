alter table public.materials
  add column specification_override_labels jsonb not null default '{}'::jsonb
  check (jsonb_typeof(specification_override_labels) = 'object');

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
    'specificationOverrideLabels',m.specification_override_labels,
    'serialNumber',m.serial_number,'ownerPartyId',m.owner_party_id,'borrowerPartyId',m.borrower_party_id,
    'condition',m.condition,'note',m.note,'status',m.status,
    'activeLoanHandoverId',m.active_loan_handover_id,'reservedHandoverId',m.reserved_handover_id,
    'reservationStatus',m.reservation_status,'version',m.version,
    'createdAt',m.created_at,'updatedAt',m.updated_at
  ) from public.materials m where m.id=p_id
$$;

create or replace function public.save_material(p_id uuid,p_expected_version integer,p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_row public.materials%rowtype; v_id uuid; v_model_id uuid; v_owner uuid;
  v_snapshot jsonb; v_overrides jsonb; v_override_labels jsonb;
  v_images jsonb; v_image jsonb; v_override record; v_label_override record;
  v_spec jsonb; v_label_spec jsonb; v_label jsonb; v_source_model public.material_models%rowtype;
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
  v_note:=nullif(btrim(p_values->>'note'),'');
  v_overrides:=coalesce(p_values->'specificationOverrides','{}'::jsonb);
  v_override_labels:=coalesce(p_values->'specificationOverrideLabels','{}'::jsonb);
  v_images:=coalesce(p_values->'images','[]'::jsonb);
  if jsonb_typeof(v_overrides) is distinct from 'object' then
    raise exception 'Specification overrides must be an object' using errcode='22023';
  end if;
  if jsonb_typeof(v_override_labels) is distinct from 'object' then
    raise exception 'Specification override labels must be an object' using errcode='22023';
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
      select s.value into v_spec from public.materials m,
        jsonb_array_elements(m.model_snapshot->'specifications') s(value)
        where m.id=p_id and s.value->>'id'=v_override.key;
    else
      select s.value into v_spec from jsonb_array_elements(v_source_model.specifications) s(value)
        where s.value->>'id'=v_override.key;
    end if;
    if v_spec is null or not public.material_spec_override_is_valid(v_spec,v_override.value) then
      raise exception 'Override must use an existing specification and its list rules' using errcode='22023';
    end if;
  end loop;
  for v_label_override in select key,value from jsonb_each(v_override_labels) loop
    if not exists (
      select 1 from jsonb_each(v_overrides) override_entry
      where override_entry.key=v_label_override.key
    ) then
      raise exception 'Specification labels must align with overridden values' using errcode='22023';
    end if;
    if jsonb_typeof(v_label_override.value) is distinct from 'array' then
      raise exception 'Specification labels must be an array' using errcode='22023';
    end if;
    if jsonb_array_length(v_label_override.value)<>jsonb_array_length(v_overrides->v_label_override.key) then
      raise exception 'Specification labels must align with overridden values' using errcode='22023';
    end if;
    if p_id is not null then
      select s.value into v_label_spec from public.materials m,
        jsonb_array_elements(m.model_snapshot->'specifications') s(value)
        where m.id=p_id and s.value->>'id'=v_label_override.key;
    else
      select s.value into v_label_spec from jsonb_array_elements(v_source_model.specifications) s(value)
        where s.value->>'id'=v_label_override.key;
    end if;
    if v_label_spec is null or v_label_spec->>'dataType' is distinct from 'color' then
      raise exception 'Labels can only be set for color specifications' using errcode='22023';
    end if;
    for v_label in select value from jsonb_array_elements(v_label_override.value) value loop
      if jsonb_typeof(v_label) is distinct from 'string' then
        raise exception 'Specification labels must be text' using errcode='22023';
      end if;
    end loop;
  end loop;
  v_snapshot:=public.material_model_snapshot(v_model_id);
  if v_snapshot is null then raise exception 'Material model not found' using errcode='P0002'; end if;
  if p_id is null then
    insert into public.materials(code,model_id,model_snapshot,name_override,description_override,
      specification_overrides,specification_override_labels,serial_number,owner_party_id,condition,note)
    values(btrim(p_values->>'code'),v_model_id,v_snapshot,nullif(btrim(p_values->>'nameOverride'),''),
      nullif(btrim(p_values->>'descriptionOverride'),''),v_overrides,v_override_labels,
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
      specification_overrides=v_overrides,specification_override_labels=v_override_labels,
      serial_number=nullif(btrim(p_values->>'serialNumber'),''),note=v_note,
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
