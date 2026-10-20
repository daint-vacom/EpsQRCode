-- Consolidate sender/receiver condition notes into the shared handover-item note.
alter table public.material_handover_items drop constraint if exists handover_sender_damage_note;
alter table public.material_handover_items drop constraint if exists handover_receiver_damage_note;
alter table public.material_handover_items add column if not exists note text;
update public.material_handover_items
set note = case
  when nullif(btrim(sender_condition_note),'') is null then nullif(btrim(receiver_condition_note),'')
  when nullif(btrim(receiver_condition_note),'') is null then nullif(btrim(sender_condition_note),'')
  when btrim(sender_condition_note)=btrim(receiver_condition_note) then btrim(sender_condition_note)
  else btrim(sender_condition_note)||E'\n'||btrim(receiver_condition_note)
end
where note is null;
alter table public.material_handover_items drop column sender_condition_note;
alter table public.material_handover_items drop column receiver_condition_note;

create or replace function public.handover_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',h.id,'code',h.code,'type',h.type,'status',h.status,
    'senderParty',h.sender_party_snapshot,'recipientParty',h.recipient_party_snapshot,
    'senderRepresentative',h.sender_representative_snapshot,'recipientRepresentative',h.recipient_representative_snapshot,
    'plannedDate',h.planned_date,'dueDate',h.due_date,'note',h.note,'version',h.version,
    'createdBy',h.created_by,'confirmedBy',h.confirmed_by,'createdAt',h.created_at,'completedAt',h.completed_at,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'materialId',i.material_id,'materialCode',i.material_snapshot->>'code',
      'materialName',coalesce(nullif(i.material_snapshot->>'nameOverride',''),i.material_snapshot#>>'{modelSnapshot,name}'),
      'modelCode',i.material_snapshot#>>'{modelSnapshot,code}',
      'modelName',i.material_snapshot#>>'{modelSnapshot,name}',
      'serialNumber',i.material_snapshot->>'serialNumber','condition',coalesce(i.receiver_condition,i.sender_condition),
      'note',i.note,
      'senderCondition',i.sender_condition
    ) order by i.sort_order,i.id) from public.material_handover_items i where i.handover_id=h.id),'[]'::jsonb),
    'attachments',h.attachments
  ) from public.material_handovers h where h.id=p_id
$$;

create or replace function public.save_handover(p_id uuid,p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_row public.material_handovers%rowtype; v_type text; v_sender uuid; v_recipient uuid;
  v_item jsonb; v_material public.materials%rowtype; v_file_id uuid; v_files jsonb;
  v_rep_sender uuid; v_rep_recipient uuid; v_note text; v_before jsonb; v_old_status text;
  v_items jsonb; v_index integer:=0; v_snapshot jsonb; v_rep_snapshot jsonb;
begin
  if auth.uid() is null or not public.has_permission('materials:handover:manage') then raise exception 'Permission denied to manage handovers' using errcode='42501'; end if;
  v_type:=p_values->>'type'; v_sender:=nullif(p_values->>'senderPartyId','')::uuid; v_recipient:=nullif(p_values->>'recipientPartyId','')::uuid;
  v_rep_sender:=nullif(p_values->>'senderRepresentativeUserId','')::uuid; v_rep_recipient:=nullif(p_values->>'recipientRepresentativeUserId','')::uuid;
  v_items:=coalesce(p_values->'items','[]'::jsonb); v_files:=coalesce(p_values->'attachmentFileIds','[]'::jsonb);
  if v_type not in ('transfer','loan','return') or v_sender is null or v_recipient is null or v_sender=v_recipient then raise exception 'Invalid handover parties or type' using errcode='22023'; end if;
  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items)=0 then raise exception 'A handover needs at least one material' using errcode='22023'; end if;
  if (select count(*) from jsonb_array_elements(v_items)) <>
     (select count(distinct x.value->>'materialId') from jsonb_array_elements(v_items) x(value)) then
    raise exception 'A material can appear only once in a handover' using errcode='22023'; end if;
  if jsonb_typeof(v_files) is distinct from 'array' then raise exception 'Attachments must be an array of file IDs' using errcode='22023'; end if;
  if v_type='loan' and nullif(p_values->>'dueDate','') is null then raise exception 'A due date is required for a loan' using errcode='22023'; end if;
  if v_rep_sender is not null and not exists(select 1 from public.material_custodians c where c.id=v_sender and v_rep_sender in (c.account_user_id,c.representative_user_id)) then raise exception 'Sender representative is not assigned to this party' using errcode='42501'; end if;
  if v_rep_recipient is not null and not exists(select 1 from public.material_custodians c where c.id=v_recipient and v_rep_recipient in (c.account_user_id,c.representative_user_id)) then raise exception 'Recipient representative is not assigned to this party' using errcode='42501'; end if;
  if not public.material_can_represent(v_sender) then raise exception 'You must represent the sender party' using errcode='42501'; end if;
  if not exists(select 1 from public.material_custodians c where c.id=v_sender and c.is_active)
    or not exists(select 1 from public.material_custodians c where c.id=v_recipient and c.is_active and (c.account_user_id is not null or c.representative_user_id is not null)) then
    raise exception 'Both parties must be active and the receiver must have an assigned account or representative' using errcode='22023';
  end if;
  if p_id is null then
    insert into public.material_handovers(code,type,sender_party_id,recipient_party_id,status,planned_date,due_date,note)
    values('BG-'||to_char(current_date,'YYYYMMDD')||'-'||nextval('public.material_handover_code_seq')::text,
      v_type,v_sender,v_recipient,'draft',nullif(p_values->>'plannedDate','')::date,
      nullif(p_values->>'dueDate','')::date,nullif(btrim(p_values->>'note'),'')) returning id into v_id;
  else
    select * into v_row from public.material_handovers where id=p_id for update;
    if not found then raise exception 'Handover not found' using errcode='P0002'; end if;
    if v_row.status<>'draft' then raise exception 'Only draft handovers can be edited' using errcode='55000'; end if;
    if (p_values->>'expectedVersion')::int is distinct from v_row.version then raise exception 'Handover changed; reload before saving' using errcode='40001'; end if;
    if not public.material_can_represent(v_row.sender_party_id) then raise exception 'You must represent the sender party' using errcode='42501'; end if;
    v_before:=public.handover_json(p_id); v_old_status:=v_row.status; v_id:=p_id;
    update public.material_handovers set type=v_type,sender_party_id=v_sender,recipient_party_id=v_recipient,
      sender_representative_user_id=v_rep_sender,recipient_representative_user_id=v_rep_recipient,
      planned_date=nullif(p_values->>'plannedDate','')::date,due_date=nullif(p_values->>'dueDate','')::date,
      note=nullif(btrim(p_values->>'note'),''),version=version+1 where id=v_id;
  end if;
  if p_id is null then
    update public.material_handovers set sender_representative_user_id=v_rep_sender,recipient_representative_user_id=v_rep_recipient,
      planned_date=nullif(p_values->>'plannedDate','')::date,due_date=nullif(p_values->>'dueDate','')::date,
      note=nullif(btrim(p_values->>'note'),'') where id=v_id;
  end if;
  update public.material_handovers h set
    sender_party_snapshot=public.material_party_json(v_sender),recipient_party_snapshot=public.material_party_json(v_recipient),
    sender_representative_snapshot=case when v_rep_sender is null then null else (
      select jsonb_build_object('userId',p.id,'displayName',coalesce(nullif(btrim(p.display_name),''),nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''))) from public.user_profiles p where p.id=v_rep_sender) end,
    recipient_representative_snapshot=case when v_rep_recipient is null then null else (
      select jsonb_build_object('userId',p.id,'displayName',coalesce(nullif(btrim(p.display_name),''),nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''))) from public.user_profiles p where p.id=v_rep_recipient) end
    where h.id=v_id;
  if exists(select 1 from jsonb_array_elements(v_files) f where jsonb_typeof(f.value) is distinct from 'string') then raise exception 'Attachment IDs must be strings' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements_text(v_files) f where not exists(select 1 from public.files file where file.id=f.value::uuid and file.status='active' and file.deleted_at is null)) then
    raise exception 'Every attachment must reference an active workspace file' using errcode='22023'; end if;
  update public.material_handovers set attachments=coalesce((select jsonb_agg(jsonb_build_object('fileId',f.id,'fileName',f.file_name,'mimeType',f.mime_type,'sizeBytes',f.size_bytes) order by input.ordinality)
    from jsonb_array_elements_text(v_files) with ordinality input(value,ordinality) join public.files f on f.id=input.value::uuid),'[]'::jsonb) where id=v_id;

  -- Lock removed and newly selected assets together in UUID order before changing reservations.
  for v_material in
    select m.* from public.materials m
    where m.reserved_handover_id=v_id
      or m.id in (select (x.value->>'materialId')::uuid from jsonb_array_elements(v_items) x(value))
    order by m.id for update
  loop
    null;
  end loop;
  for v_item in select value from jsonb_array_elements(v_items) order by (value->>'materialId')::uuid loop
    if nullif(v_item->>'materialId','') is null then raise exception 'Each line needs a material ID' using errcode='22023'; end if;
  end loop;
  for v_item in select value from jsonb_array_elements(v_items) loop
    select * into v_material from public.materials where id=(v_item->>'materialId')::uuid;
    if not found then raise exception 'A selected material no longer exists' using errcode='P0002'; end if;
    if v_material.reserved_handover_id is not null and v_material.reserved_handover_id<>v_id then raise exception 'A selected material is reserved by another open handover' using errcode='55000'; end if;
    if ((v_item->>'condition') is distinct from 'good' and (v_item->>'condition') is distinct from 'damaged')
      then raise exception 'Material condition is invalid' using errcode='22023'; end if;
    if v_type in ('transfer','loan') then
      if v_material.owner_party_id<>v_sender or v_material.status<>'available' then raise exception 'Transfer and loan require an available material owned by the sender' using errcode='55000'; end if;
    else
      if v_material.status<>'loaned' or v_material.borrower_party_id<>v_sender or v_material.owner_party_id<>v_recipient then raise exception 'Return must come from the current borrower to the owner' using errcode='55000'; end if;
    end if;
    v_snapshot:=public.material_json(v_material.id);
    insert into public.material_handover_items(handover_id,material_id,material_snapshot,sender_condition,note,sort_order)
      values(v_id,v_material.id,v_snapshot,v_item->>'condition',nullif(btrim(v_item->>'note'),''),v_index)
      on conflict(handover_id,material_id) do update set material_snapshot=excluded.material_snapshot,
        sender_condition=excluded.sender_condition,note=excluded.note,sort_order=excluded.sort_order;
    update public.materials set reserved_handover_id=v_id,reservation_status='draft' where id=v_material.id;
    v_index:=v_index+1;
  end loop;
  delete from public.material_handover_items i where i.handover_id=v_id and not exists(
    select 1 from jsonb_array_elements(v_items) x where (x.value->>'materialId')::uuid=i.material_id);
  update public.materials m set reserved_handover_id=null,reservation_status=null
    where m.reserved_handover_id=v_id and not exists(select 1 from jsonb_array_elements(v_items) x where (x.value->>'materialId')::uuid=m.id);
  if p_id is null then
    insert into public.material_handover_history(handover_id,action,to_status,note) values(v_id,'created','draft',nullif(btrim(p_values->>'note'),''));
  else
    insert into public.material_handover_history(handover_id,action,from_status,to_status,note) values(v_id,'updated',v_old_status,'draft',nullif(btrim(p_values->>'note'),''));
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
      if jsonb_array_length(p_item_conditions)>0 then
        select x.value->>'condition' into v_condition
          from jsonb_array_elements(p_item_conditions) x(value) where x.value->>'materialId'=v_item.material_id::text;
        if v_condition is null or v_condition not in ('good','damaged') then
          raise exception 'Receiver condition is invalid' using errcode='22023';
        end if;
        if (select count(*) from jsonb_array_elements(p_item_conditions)) <>
          (select count(*) from public.material_handover_items where handover_id=p_id)
          or (select count(distinct x.value->>'materialId') from jsonb_array_elements(p_item_conditions) x(value)) <>
          (select count(*) from jsonb_array_elements(p_item_conditions)) then
          raise exception 'Provide exactly one receiver condition for every material' using errcode='22023';
        end if;
        update public.material_handover_items i
          set receiver_condition=x.value->>'condition',note=nullif(btrim(x.value->>'note'),'')
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
