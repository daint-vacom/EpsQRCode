alter table public.materials rename column condition_note to note;
alter table public.materials drop constraint materials_damage_note;

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
  v_note:=nullif(btrim(p_values->>'note'),'');
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
      specification_overrides,serial_number,owner_party_id,condition,note)
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
      specification_overrides=v_overrides,serial_number=nullif(btrim(p_values->>'serialNumber'),''),note=v_note,
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

create or replace function public.act_on_handover(p_id uuid,p_action text,p_expected_version integer,p_note text default null,p_item_conditions jsonb default '[]'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_h public.material_handovers%rowtype;
  v_item record;
  v_before jsonb;
  v_to text;
  v_material_before jsonb;
  v_condition text;
  v_condition_note text;
begin
  if auth.uid() is null or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to manage handovers' using errcode='42501';
  end if;
  select * into v_h from public.material_handovers where id=p_id for update;
  if not found then raise exception 'Handover not found' using errcode='P0002'; end if;
  if (p_action='confirm' and v_h.status='completed') or (p_action='reject' and v_h.status='rejected')
    or (p_action='cancel' and v_h.status='cancelled') or (p_action='send' and v_h.status='pending') then
    return p_id;
  end if;
  if v_h.version is distinct from p_expected_version then
    raise exception 'Handover changed; reload before acting' using errcode='40001';
  end if;
  if p_action not in ('send','confirm','reject','cancel') then
    raise exception 'Unknown handover action' using errcode='22023';
  end if;
  if p_action='confirm' and jsonb_typeof(p_item_conditions) is distinct from 'array' then
    raise exception 'Receiver conditions must be an array' using errcode='22023';
  end if;

  if p_action='send' then
    if v_h.status<>'draft' or not public.material_can_represent(v_h.sender_party_id) then
      raise exception 'Only the represented sender can send a draft handover' using errcode='42501';
    end if;
    if not exists(select 1 from public.material_custodians c where c.id in (v_h.sender_party_id,v_h.recipient_party_id) and c.is_active having count(*)=2) then
      raise exception 'Both parties must be active to send a handover' using errcode='22023';
    end if;
    if not exists(select 1 from public.material_handover_items where handover_id=p_id) then
      raise exception 'Handover has no materials' using errcode='22023';
    end if;
    v_to:='pending';
  elsif p_action='cancel' then
    if v_h.status not in ('draft','pending') or not public.material_can_represent(v_h.sender_party_id) then
      raise exception 'Only the represented sender can cancel an open handover' using errcode='42501';
    end if;
    if nullif(btrim(p_note),'') is null then raise exception 'A cancellation reason is required' using errcode='22023'; end if;
    v_to:='cancelled';
  elsif p_action='reject' then
    if v_h.status<>'pending' or not public.material_can_represent(v_h.recipient_party_id) then
      raise exception 'Only the represented receiver can reject a pending handover' using errcode='42501';
    end if;
    if nullif(btrim(p_note),'') is null then raise exception 'A rejection reason is required' using errcode='22023'; end if;
    v_to:='rejected';
  else
    if v_h.status<>'pending' or not public.material_can_represent(v_h.recipient_party_id) then
      raise exception 'Only the represented receiver can confirm a pending handover' using errcode='42501';
    end if;
    if not exists(select 1 from public.material_custodians c where c.id in (v_h.sender_party_id,v_h.recipient_party_id) and c.is_active having count(*)=2) then
      raise exception 'Both parties must be active to confirm a handover' using errcode='22023';
    end if;
    v_to:='completed';
  end if;

  v_before:=public.handover_json(p_id);
  if p_action='send' then
    update public.material_handovers set status='pending',version=version+1 where id=p_id;
    update public.materials set reservation_status='pending' where reserved_handover_id=p_id;
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
      values(p_id,auth.uid(),'sent',v_h.status,'pending',nullif(btrim(p_note),''));
  elsif p_action='confirm' then
    for v_item in
      select i.*,m.id as material_row_id from public.material_handover_items i
      join public.materials m on m.id=i.material_id where i.handover_id=p_id order by m.id for update of m
    loop
      v_material_before:=public.material_json(v_item.material_id);
      if not exists(select 1 from public.materials m where m.id=v_item.material_id and m.reserved_handover_id=p_id) then
        raise exception 'A handover material is no longer reserved by this document' using errcode='55000';
      end if;
      if v_h.type in ('transfer','loan') and not exists(select 1 from public.materials m where m.id=v_item.material_id
        and m.owner_party_id=v_h.sender_party_id and m.status='available' and m.borrower_party_id is null and m.active_loan_handover_id is null) then
        raise exception 'Current material custody no longer matches the handover sender' using errcode='55000';
      end if;
      if v_h.type='return' and not exists(select 1 from public.materials m where m.id=v_item.material_id
        and m.owner_party_id=v_h.recipient_party_id and m.borrower_party_id=v_h.sender_party_id
        and m.status='loaned' and m.active_loan_handover_id is not null) then
        raise exception 'Current loan no longer matches the return parties' using errcode='55000';
      end if;
      v_condition:=v_item.sender_condition;
      v_condition_note:=v_item.sender_condition_note;
      if jsonb_array_length(p_item_conditions)>0 then
        select x.value->>'condition',nullif(btrim(x.value->>'conditionNote'),'') into v_condition,v_condition_note
          from jsonb_array_elements(p_item_conditions) x(value) where x.value->>'materialId'=v_item.material_id::text;
        if v_condition is null or v_condition not in ('good','damaged') or (v_condition='damaged' and v_condition_note is null) then
          raise exception 'Receiver condition is invalid; damaged materials require a note' using errcode='22023';
        end if;
        if (select count(*) from jsonb_array_elements(p_item_conditions)) <>
          (select count(*) from public.material_handover_items where handover_id=p_id)
          or (select count(distinct x.value->>'materialId') from jsonb_array_elements(p_item_conditions) x(value)) <>
          (select count(*) from jsonb_array_elements(p_item_conditions)) then
          raise exception 'Provide exactly one receiver condition for every material' using errcode='22023';
        end if;
        update public.material_handover_items i
          set receiver_condition=x.value->>'condition',receiver_condition_note=nullif(btrim(x.value->>'conditionNote'),'')
          from jsonb_array_elements(p_item_conditions) x(value)
          where i.handover_id=p_id and i.material_id=(x.value->>'materialId')::uuid;
      end if;
      if v_h.type='transfer' then
        update public.materials set owner_party_id=v_h.recipient_party_id,condition=v_condition,
          reserved_handover_id=null,reservation_status=null,version=version+1,updated_at=timezone('utc',now()) where id=v_item.material_id;
      elsif v_h.type='loan' then
        update public.materials set borrower_party_id=v_h.recipient_party_id,status='loaned',active_loan_handover_id=p_id,
          condition=v_condition,reserved_handover_id=null,reservation_status=null,
          version=version+1,updated_at=timezone('utc',now()) where id=v_item.material_id;
      else
        update public.materials set borrower_party_id=null,status='available',active_loan_handover_id=null,
          condition=v_condition,reserved_handover_id=null,reservation_status=null,
          version=version+1,updated_at=timezone('utc',now()) where id=v_item.material_id;
      end if;
      insert into public.material_history(material_id,actor_user_id,action,note,from_state,to_state)
        values(v_item.material_id,auth.uid(),'handover',v_h.code,v_material_before,public.material_json(v_item.material_id));
    end loop;
    update public.material_handovers set status='completed',confirmed_by=auth.uid(),completed_at=timezone('utc',now()),version=version+1 where id=p_id;
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
      values(p_id,auth.uid(),'confirmed',v_h.status,'completed',nullif(btrim(p_note),''));
  else
    update public.material_handovers set status=v_to,version=version+1 where id=p_id;
    update public.materials set reserved_handover_id=null,reservation_status=null where reserved_handover_id=p_id;
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
      values(p_id,auth.uid(),case when p_action='reject' then 'rejected' else 'cancelled' end,v_h.status,v_to,nullif(btrim(p_note),''));
  end if;
  return p_id;
end;
$$;

notify pgrst, 'reload schema';
