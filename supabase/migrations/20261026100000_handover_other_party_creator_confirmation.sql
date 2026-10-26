-- For handovers involving a free-form Other party, only the account that created
-- the document may confirm. Keep offline completion unavailable for these records.
create or replace function public.act_on_handover(
  p_id uuid, p_action text, p_expected_version integer,
  p_note text default null, p_item_conditions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_h public.material_handovers%rowtype;
  v_item record;
  v_material_before jsonb;
  v_condition text;
  v_result jsonb;
  v_actor_party uuid;
  v_to text;
begin
  if auth.uid() is null or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to manage handovers' using errcode = '42501';
  end if;
  select * into v_h from public.material_handovers where id = p_id for update;
  if not found then raise exception 'Handover not found' using errcode = 'P0002'; end if;
  if v_h.mode <> 'standard' or v_h.receipt_id is not null then
    raise exception 'Use the warehouse handover actions for this document' using errcode = '22023';
  end if;
  if (p_action = 'confirm' and v_h.status = 'completed')
    or (p_action = 'reject' and v_h.status = 'rejected')
    or (p_action = 'cancel' and v_h.status = 'cancelled')
    or (p_action = 'send' and v_h.status = 'pending') then
    return p_id;
  end if;
  if v_h.version is distinct from p_expected_version then
    raise exception 'Handover changed; reload before acting' using errcode = '40001';
  end if;
  if p_action not in ('send', 'confirm', 'reject', 'cancel') then
    raise exception 'Unknown handover action' using errcode = '22023';
  end if;
  if p_action = 'confirm' and jsonb_typeof(p_item_conditions) is distinct from 'array' then
    raise exception 'Receiver conditions must be an array' using errcode = '22023';
  end if;
  if p_action in ('send', 'cancel') then
    v_actor_party := v_h.sender_party_id;
    if not public.has_scoped_permission('materials:handover:manage', v_actor_party)
      or not public.material_can_represent(v_actor_party) then
      raise exception 'Only a represented sender with handover scope can do this action' using errcode = '42501';
    end if;
  elsif p_action = 'confirm' and exists (
    select 1 from public.material_custodians party
    where party.id in (v_h.sender_party_id, v_h.recipient_party_id)
      and party.is_handover_custom
  ) then
    if v_h.created_by is distinct from auth.uid() then
      raise exception 'Only the handover creator can confirm a handover with an Other party'
        using errcode = '42501';
    end if;
    v_actor_party := v_h.sender_party_id;
    if not public.has_scoped_permission('materials:handover:manage', v_actor_party)
      or not public.material_can_represent(v_actor_party) then
      v_actor_party := v_h.recipient_party_id;
    end if;
    if not public.has_scoped_permission('materials:handover:manage', v_actor_party)
      or not public.material_can_represent(v_actor_party) then
      raise exception 'The handover creator must still represent one of its parties'
        using errcode = '42501';
    end if;
  else
    v_actor_party := v_h.recipient_party_id;
    if not public.has_scoped_permission('materials:handover:manage', v_actor_party)
      or not public.material_can_represent(v_actor_party) then
      raise exception 'Only a represented receiver with handover scope can do this action' using errcode = '42501';
    end if;
  end if;

  if p_action = 'send' then
    if v_h.status <> 'draft' then raise exception 'Only a draft handover can be sent' using errcode = '55000'; end if;
    if not exists (
      select 1 from public.material_custodians party
      where party.id in (v_h.sender_party_id, v_h.recipient_party_id)
        and party.is_active having count(*) = 2
    ) then raise exception 'Both parties must be active to send a handover' using errcode = '22023'; end if;
    if not exists (select 1 from public.material_handover_items item where item.handover_id = p_id) then
      raise exception 'Handover has no materials' using errcode = '22023';
    end if;
    v_to := 'pending';
  elsif p_action = 'cancel' then
    if v_h.status not in ('draft', 'pending') then
      raise exception 'Only an open handover can be cancelled' using errcode = '55000';
    end if;
    if nullif(btrim(p_note), '') is null then
      raise exception 'A cancellation reason is required' using errcode = '22023';
    end if;
    v_to := 'cancelled';
  elsif p_action = 'reject' then
    if v_h.status <> 'pending' then raise exception 'Only a pending handover can be rejected' using errcode = '55000'; end if;
    if nullif(btrim(p_note), '') is null then
      raise exception 'A rejection reason is required' using errcode = '22023';
    end if;
    v_to := 'rejected';
  else
    if v_h.status <> 'pending' then raise exception 'Only a pending handover can be confirmed' using errcode = '55000'; end if;
    if not exists (
      select 1 from public.material_custodians party
      where party.id in (v_h.sender_party_id, v_h.recipient_party_id)
        and party.is_active having count(*) = 2
    ) then raise exception 'Both parties must be active to confirm a handover' using errcode = '22023'; end if;
    if jsonb_array_length(p_item_conditions) > 0 and (
      jsonb_array_length(p_item_conditions) <>
        (select count(*) from public.material_handover_items item where item.handover_id = p_id)
      or (select count(distinct item.value->>'materialId')
        from jsonb_array_elements(p_item_conditions) item(value)) <> jsonb_array_length(p_item_conditions)
    ) then
      raise exception 'Provide exactly one receiver condition for every material' using errcode = '22023';
    end if;
    v_to := 'completed';
  end if;

  perform set_config('app.materials_handover_actor_party_id', v_actor_party::text, true);
  perform set_config('app.materials_handover_transition', 'true', true);
  if p_action = 'send' then
    update public.material_handovers set status = 'pending', version = version + 1 where id = p_id;
    update public.materials set reservation_status = 'pending' where reserved_handover_id = p_id;
    insert into public.material_handover_history(
      handover_id, actor_user_id, action, from_status, to_status, note
    ) values (p_id, auth.uid(), 'sent', v_h.status, 'pending', nullif(btrim(p_note), ''));
  elsif p_action = 'confirm' then
    for v_item in
      select item.*, material.id as material_row_id
      from public.material_handover_items item
      join public.materials material on material.id = item.material_id
      where item.handover_id = p_id order by material.id for update of material
    loop
      v_material_before := public.material_json(v_item.material_id);
      if not exists (select 1 from public.materials material
        where material.id = v_item.material_id and material.reserved_handover_id = p_id) then
        raise exception 'A handover material is no longer reserved by this document' using errcode = '55000';
      end if;
      if v_h.type in ('transfer', 'loan') and not exists (
        select 1 from public.materials material where material.id = v_item.material_id
          and material.owner_party_id = v_h.sender_party_id and material.status = 'available'
          and material.borrower_party_id is null and material.active_loan_handover_id is null
      ) then
        raise exception 'Current material custody no longer matches the handover sender' using errcode = '55000';
      end if;
      if v_h.type = 'return' and not exists (
        select 1 from public.materials material where material.id = v_item.material_id
          and material.owner_party_id = v_h.recipient_party_id
          and material.borrower_party_id = v_h.sender_party_id
          and material.status = 'loaned' and material.active_loan_handover_id is not null
      ) then
        raise exception 'Current loan no longer matches the return parties' using errcode = '55000';
      end if;
      v_condition := v_item.sender_condition;
      if jsonb_array_length(p_item_conditions) > 0 then
        select selected.value into v_result
        from jsonb_array_elements(p_item_conditions) selected(value)
        where selected.value->>'materialId' = v_item.material_id::text;
        if v_result is null then raise exception 'Receiver conditions do not match the handover items' using errcode = '22023'; end if;
        v_condition := v_result->>'condition';
        if v_condition not in ('good', 'damaged') then
          raise exception 'Receiver condition is invalid' using errcode = '22023';
        end if;
        if v_condition = 'damaged' and nullif(btrim(v_result->>'note'), '') is null then
          raise exception 'A damaged received item needs a note' using errcode = '22023';
        end if;
        update public.material_handover_items set receiver_condition = v_condition,
          note = nullif(btrim(v_result->>'note'), '') where id = v_item.id;
      else
        update public.material_handover_items set receiver_condition = v_condition where id = v_item.id;
      end if;
      if v_h.type = 'transfer' then
        update public.materials set owner_party_id = v_h.recipient_party_id,
          condition = v_condition, reserved_handover_id = null, reservation_status = null,
          version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
      elsif v_h.type = 'loan' then
        update public.materials set borrower_party_id = v_h.recipient_party_id,
          status = 'loaned', active_loan_handover_id = p_id, condition = v_condition,
          reserved_handover_id = null, reservation_status = null,
          version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
      else
        update public.materials set borrower_party_id = null, status = 'available',
          active_loan_handover_id = null, condition = v_condition,
          reserved_handover_id = null, reservation_status = null,
          version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
      end if;
      insert into public.material_history(material_id, actor_user_id, action, note, from_state, to_state)
      values (v_item.material_id, auth.uid(), 'handover', v_h.code,
        v_material_before, public.material_json(v_item.material_id));
    end loop;
    update public.material_handovers set status = 'completed', confirmed_by = auth.uid(),
      completed_at = timezone('utc', now()), version = version + 1 where id = p_id;
    insert into public.material_handover_history(
      handover_id, actor_user_id, action, from_status, to_status, note
    ) values (p_id, auth.uid(), 'confirmed', v_h.status, 'completed', nullif(btrim(p_note), ''));
  else
    update public.material_handovers set status = v_to, version = version + 1 where id = p_id;
    update public.materials set reserved_handover_id = null, reservation_status = null
      where reserved_handover_id = p_id;
    insert into public.material_handover_history(
      handover_id, actor_user_id, action, from_status, to_status, note
    ) values (p_id, auth.uid(), case when p_action = 'reject' then 'rejected' else 'cancelled' end,
      v_h.status, v_to, nullif(btrim(p_note), ''));
  end if;
  return p_id;
end;
$$;

create or replace function public.complete_handover_offline(
  p_id uuid, p_expected_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_h public.material_handovers%rowtype;
  v_item record;
  v_before jsonb;
begin
  if auth.uid() is null or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to manage handovers' using errcode = '42501';
  end if;
  select * into v_h from public.material_handovers where id = p_id for update;
  if not found then raise exception 'Handover not found' using errcode = 'P0002'; end if;
  if v_h.mode <> 'standard' or v_h.receipt_id is not null then
    raise exception 'Offline completion is available only for standard handovers' using errcode = '22023';
  end if;
  if v_h.status = 'completed' then return p_id; end if;
  if v_h.status <> 'pending' then raise exception 'Only a pending handover can be completed offline' using errcode = '55000'; end if;
if exists (
    select 1 from public.material_custodians party
    where party.id in (v_h.sender_party_id, v_h.recipient_party_id)
      and party.is_handover_custom
  ) then
    raise exception 'Other-party handovers must use the creator confirmation action'
      using errcode = '55000';
  end if;
  if v_h.version is distinct from p_expected_version then
    raise exception 'Handover changed; reload before acting' using errcode = '40001';
  end if;
  if not public.has_scoped_permission('materials:handover:manage', v_h.sender_party_id)
    or not public.material_can_represent(v_h.sender_party_id) then
    raise exception 'Only a represented sender with handover scope can complete offline' using errcode = '42501';
  end if;
  if private.party_has_qrcode_account(v_h.recipient_party_id) then
    raise exception 'The receiving party has a QRCode account and must confirm the handover' using errcode = '55000';
  end if;
  if not exists (select 1 from public.material_custodians party
    where party.id in (v_h.sender_party_id, v_h.recipient_party_id)
      and party.is_active having count(*) = 2) then
    raise exception 'Both parties must be active to complete a handover' using errcode = '22023';
  end if;
  perform set_config('app.materials_handover_actor_party_id', v_h.sender_party_id::text, true);
  perform set_config('app.materials_handover_transition', 'true', true);
  for v_item in
    select item.* from public.material_handover_items item
    join public.materials material on material.id = item.material_id
    where item.handover_id = p_id order by material.id for update of material
  loop
    if not exists (select 1 from public.materials material
      where material.id = v_item.material_id and material.reserved_handover_id = p_id) then
      raise exception 'A handover material is no longer reserved by this document' using errcode = '55000';
    end if;
    if v_h.type in ('transfer', 'loan') and not exists (
      select 1 from public.materials material where material.id = v_item.material_id
        and material.owner_party_id = v_h.sender_party_id and material.status = 'available'
        and material.borrower_party_id is null and material.active_loan_handover_id is null
    ) then
      raise exception 'Current material custody no longer matches the handover sender' using errcode = '55000';
    end if;
    if v_h.type = 'return' and not exists (
      select 1 from public.materials material where material.id = v_item.material_id
        and material.owner_party_id = v_h.recipient_party_id
        and material.borrower_party_id = v_h.sender_party_id
        and material.status = 'loaned' and material.active_loan_handover_id is not null
    ) then
      raise exception 'Current loan no longer matches the return parties' using errcode = '55000';
    end if;
    v_before := public.material_json(v_item.material_id);
    update public.material_handover_items set receiver_condition = sender_condition
    where id = v_item.id;
    if v_h.type = 'transfer' then
      update public.materials set owner_party_id = v_h.recipient_party_id,
        condition = v_item.sender_condition, reserved_handover_id = null, reservation_status = null,
        version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
    elsif v_h.type = 'loan' then
      update public.materials set borrower_party_id = v_h.recipient_party_id,
        status = 'loaned', active_loan_handover_id = p_id, condition = v_item.sender_condition,
        reserved_handover_id = null, reservation_status = null,
        version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
    else
      update public.materials set borrower_party_id = null, status = 'available',
        active_loan_handover_id = null, condition = v_item.sender_condition,
        reserved_handover_id = null, reservation_status = null,
        version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
    end if;
    insert into public.material_history(material_id, actor_user_id, action, note, from_state, to_state)
    values (v_item.material_id, auth.uid(), 'handover', v_h.code,
      v_before, public.material_json(v_item.material_id));
  end loop;
  update public.material_handovers set status = 'completed', confirmed_by = auth.uid(),
    completed_at = timezone('utc', now()), version = version + 1 where id = p_id;
  insert into public.material_handover_history(
    handover_id, actor_user_id, action, from_status, to_status, note
  ) values (
    p_id, auth.uid(), 'confirmed_offline', 'pending', 'completed',
    'Bên giao xác nhận đã bàn giao trực tiếp; bên nhận chưa có tài khoản QRCode.'
  );
  return p_id;
end;
$$;
