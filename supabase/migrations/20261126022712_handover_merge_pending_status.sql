-- A warehouse request now remains in `pending` throughout both signature steps.
-- The warehouse_approved history event records the handoff between signers.
alter table public.material_handovers
  disable trigger material_handovers_scope_guard;
alter table public.material_handovers
  disable trigger material_handovers_guard_warehouse;

update public.material_handovers
set status = 'pending'
where status = 'awaiting_warehouse_approval';

update public.material_handover_history
set from_status = case when from_status = 'awaiting_warehouse_approval' then 'pending' else from_status end,
    to_status = case when to_status = 'awaiting_warehouse_approval' then 'pending' else to_status end
where from_status = 'awaiting_warehouse_approval'
   or to_status = 'awaiting_warehouse_approval';

alter table public.material_handovers
  enable trigger material_handovers_guard_warehouse;
alter table public.material_handovers
  enable trigger material_handovers_scope_guard;

alter table public.material_handovers
  drop constraint if exists material_handovers_status_check;
alter table public.material_handovers
  add constraint material_handovers_status_check
  check (status in ('draft', 'pending', 'completed', 'rejected', 'cancelled'));

create or replace function private.guard_handover_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_party_id uuid;
  actor_setting text;
  new_sender_scope uuid;
  new_recipient_scope uuid;
  old_sender_scope uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if current_setting('app.materials_temp_party_mapping', true) is distinct from 'true' then
    if new.sender_party_snapshot->>'type' = 'other' then new.sender_party_id := null; end if;
    if new.recipient_party_snapshot->>'type' = 'other' then new.recipient_party_id := null; end if;
  end if;
  new_sender_scope := coalesce(new.sender_party_id,
    nullif(new.sender_party_snapshot->>'scopePartyId', '')::uuid,
    nullif(new.sender_party_snapshot->>'handoverScopePartyId', '')::uuid);
  new_recipient_scope := coalesce(new.recipient_party_id,
    nullif(new.recipient_party_snapshot->>'scopePartyId', '')::uuid,
    nullif(new.recipient_party_snapshot->>'handoverScopePartyId', '')::uuid);

  if new.mode in ('warehouse_allocation','warehouse_request')
    and current_setting('app.materials_warehouse_transition', true) = 'true' then
    actor_setting := nullif(current_setting('app.materials_warehouse_transition_party_id', true), '');
    if actor_setting is not null then actor_party_id := actor_setting::uuid;
    elsif tg_op = 'INSERT' then
      actor_party_id := case when new.mode='warehouse_request' then new_recipient_scope else new_sender_scope end;
    elsif new.status = 'completed' or (new.status='rejected' and new.mode<>'warehouse_request') then
      actor_party_id := new_recipient_scope;
    elsif new.status = 'cancelled' then
      actor_party_id := case when new.mode='warehouse_request' and old.status='draft'
        then new_recipient_scope else new_sender_scope end;
    elsif new.status = 'pending' and old.status = 'draft' and new.mode = 'warehouse_request' then
      actor_party_id := new_recipient_scope;
    else
      actor_party_id := new_sender_scope;
    end if;
  else
    actor_setting := nullif(current_setting('app.materials_handover_actor_party_id', true), '');
    if actor_setting is not null then actor_party_id := actor_setting::uuid; end if;
    if actor_party_id is null then
      actor_party_id := case when new.mode='warehouse_request' then new_recipient_scope else new_sender_scope end;
    end if;
  end if;

  if actor_party_id is distinct from new_sender_scope
    and actor_party_id is distinct from new_recipient_scope then
    raise exception 'Handover is outside the represented management scope' using errcode='42501';
  end if;
  if not public.has_scoped_permission('materials:handover:manage', actor_party_id)
    or not public.material_can_represent(actor_party_id) then
    if current_setting('app.materials_warehouse_transition', true) = 'true'
      and new.receipt_id is not null and exists (
        select 1 from public.material_receipts receipt where receipt.id=new.receipt_id
          and public.has_scoped_permission('materials:receipt:manage',receipt.warehouse_id)
      ) then return new; end if;
    raise exception 'Handover is outside the represented management scope' using errcode='42501';
  end if;
  if tg_op='UPDATE' and old.status='draft' and new.status='draft' then
    old_sender_scope := coalesce(old.sender_party_id,
      nullif(old.sender_party_snapshot->>'scopePartyId','')::uuid,
      nullif(old.sender_party_snapshot->>'handoverScopePartyId','')::uuid);
    if old_sender_scope is distinct from new_sender_scope
      and (not public.has_scoped_permission('materials:handover:manage',old_sender_scope)
        or not public.material_can_represent(old_sender_scope)) then
      raise exception 'The previous sender is outside the represented management scope' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_handover_scope() from public, anon, authenticated;

create or replace function public.act_on_warehouse_handover(
  p_id uuid, p_action text, p_expected_version integer,
  p_note text default null, p_item_results jsonb default '[]'::jsonb
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
  v_to text;
  v_receipt_id uuid;
  v_result jsonb;
  v_outcome text;
  v_condition text;
  v_material_before jsonb;
  v_actor_party uuid;
  v_warehouse_approved boolean;
begin
  if auth.uid() is null or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to manage handovers' using errcode='42501';
  end if;
  select receipt_id into v_receipt_id from public.material_handovers where id=p_id;
  if v_receipt_id is not null then perform 1 from public.material_receipts where id=v_receipt_id for update; end if;
  select * into v_h from public.material_handovers where id=p_id for update;
  if not found then raise exception 'Handover not found' using errcode='P0002'; end if;
  if v_h.mode not in ('warehouse_allocation','warehouse_request') then
    raise exception 'This is not a warehouse handover' using errcode='22023';
  end if;
  select exists (
    select 1 from public.material_handover_history history
    where history.handover_id=p_id and history.action='warehouse_approved'
  ) into v_warehouse_approved;
  if (p_action='confirm' and v_h.status='completed')
    or (p_action='reject' and v_h.status='rejected')
    or (p_action='cancel' and v_h.status='cancelled')
    or (p_action='send' and v_h.status='pending')
    or (p_action='approve' and v_warehouse_approved) then return p_id; end if;
  if v_h.version is distinct from p_expected_version then
    raise exception 'Handover changed; reload before acting' using errcode='40001';
  end if;
  if p_action not in ('send','approve','reject','confirm','cancel') then
    raise exception 'Unknown warehouse handover action' using errcode='22023';
  end if;

  if p_action='send' then
    if v_h.status<>'draft' then raise exception 'Only a draft warehouse handover can be sent' using errcode='55000'; end if;
    if (v_h.mode='warehouse_allocation' and not public.material_can_represent(v_h.sender_party_id))
      or (v_h.mode='warehouse_request' and not public.material_can_represent(v_h.recipient_party_id)) then
      raise exception 'Only the represented request owner can send a draft' using errcode='42501';
    end if;
    if not exists(select 1 from public.material_handover_items where handover_id=p_id) then
      raise exception 'Handover has no materials' using errcode='22023';
    end if;
    v_to:='pending';
    v_actor_party:=case when v_h.mode='warehouse_request' then v_h.recipient_party_id else v_h.sender_party_id end;
  elsif p_action='approve' then
    if v_h.status<>'pending' or v_h.mode<>'warehouse_request' or v_warehouse_approved
      or not public.material_can_represent(v_h.sender_party_id) then
      raise exception 'Only a represented warehouse can approve a request awaiting its signature' using errcode='42501';
    end if;
    v_to:='pending';
    v_actor_party:=v_h.sender_party_id;
  elsif p_action='reject' then
    if v_h.status='pending' and v_h.mode='warehouse_request' and not v_warehouse_approved
      and public.material_can_represent(v_h.sender_party_id) then
      v_actor_party:=v_h.sender_party_id;
      v_to:='rejected';
    elsif v_h.status='pending'
      and (v_h.mode<>'warehouse_request' or v_warehouse_approved)
      and public.material_can_represent(v_h.recipient_party_id) then
      v_actor_party:=v_h.recipient_party_id;
      v_to:='rejected';
    else
      raise exception 'Only the warehouse awaiting its signature or the receiving unit after approval can reject this handover' using errcode='42501';
    end if;
  elsif p_action='cancel' then
    if v_h.status='draft' then
      if (v_h.mode='warehouse_request' and not public.material_can_represent(v_h.recipient_party_id))
        or (v_h.mode='warehouse_allocation' and not public.material_can_represent(v_h.sender_party_id)) then
        raise exception 'Only the represented request owner can cancel a draft' using errcode='42501';
      end if;
      v_actor_party:=case when v_h.mode='warehouse_request' then v_h.recipient_party_id else v_h.sender_party_id end;
    elsif v_h.status='pending' and (v_h.mode<>'warehouse_request' or v_warehouse_approved) then
      if not public.material_can_represent(v_h.sender_party_id) then
        raise exception 'The warehouse can cancel only an approved handover before receipt confirmation' using errcode='42501';
      end if;
      v_actor_party:=v_h.sender_party_id;
    else
      raise exception 'This warehouse handover cannot be cancelled in its current status' using errcode='55000';
    end if;
    if nullif(btrim(p_note),'') is null then raise exception 'A cancellation reason is required' using errcode='22023'; end if;
    v_to:='cancelled';
  else
    if v_h.status<>'pending' or not public.material_can_represent(v_h.recipient_party_id)
      or (v_h.mode='warehouse_request' and not v_warehouse_approved) then
      raise exception 'Only the represented receiving unit can confirm after the warehouse has signed' using errcode='42501';
    end if;
    if jsonb_typeof(p_item_results) is distinct from 'array' then raise exception 'Item receipt results must be an array' using errcode='22023'; end if;
    if jsonb_array_length(p_item_results)<>(select count(*) from public.material_handover_items where handover_id=p_id)
      or (select count(distinct x.value->>'materialId') from jsonb_array_elements(p_item_results) x(value))<>jsonb_array_length(p_item_results) then
      raise exception 'Provide one receipt result for every material' using errcode='22023';
    end if;
    v_to:='completed';
    v_actor_party:=v_h.recipient_party_id;
  end if;
  if p_action in ('reject','cancel') and nullif(btrim(p_note),'') is null then
    raise exception 'A reason is required' using errcode='22023';
  end if;
  v_before:=public.handover_json(p_id);
  perform set_config('app.materials_warehouse_transition','true',true);
  perform set_config('app.materials_warehouse_transition_party_id',v_actor_party::text,true);

  if p_action='send' then
    update public.material_handovers set status=v_to,version=version+1 where id=p_id;
    update public.materials set reservation_status='pending' where reserved_handover_id=p_id;
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
      values(p_id,auth.uid(),'sent',v_h.status,v_to,nullif(btrim(p_note),''));
  elsif p_action='approve' then
    update public.material_handovers set version=version+1 where id=p_id;
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
      values(p_id,auth.uid(),'warehouse_approved','pending','pending',nullif(btrim(p_note),''));
  elsif p_action='confirm' then
    for v_item in select i.*,m.id as material_row_id from public.material_handover_items i
      join public.materials m on m.id=i.material_id where i.handover_id=p_id order by m.id for update of m
    loop
      if not exists(select 1 from public.materials m where m.id=v_item.material_id and m.reserved_handover_id=p_id
        and m.owner_party_id=v_h.sender_party_id and m.status='available' and m.is_active) then
        raise exception 'A selected material is no longer available from this warehouse' using errcode='55000';
      end if;
      select x.value into v_result from jsonb_array_elements(p_item_results) x(value)
        where x.value->>'materialId'=v_item.material_id::text;
      if v_result is null then raise exception 'Receipt results do not match the handover items' using errcode='22023'; end if;
      v_outcome:=v_result->>'outcome';
      if v_outcome not in ('received','not_received') then raise exception 'Receipt outcome is invalid' using errcode='22023'; end if;
      v_condition:=coalesce(v_result->>'condition',v_item.sender_condition);
      if v_outcome='received' and v_condition not in ('good','damaged') then raise exception 'Material condition is invalid' using errcode='22023'; end if;
      if v_outcome='received' and v_condition='damaged' and nullif(btrim(v_result->>'note'),'') is null then
        raise exception 'A damaged received item needs a note' using errcode='22023'; end if;
      v_material_before:=public.material_json(v_item.material_id);
      update public.material_handover_items set receiver_outcome=v_outcome,
        receiver_condition=case when v_outcome='received' then v_condition else null end,
        note=coalesce(nullif(btrim(v_result->>'note'),''),note) where id=v_item.id;
      if v_outcome='received' then
        update public.materials set owner_party_id=v_h.recipient_party_id,condition=v_condition,
          note=coalesce(nullif(btrim(v_result->>'note'),''),note),reserved_handover_id=null,reservation_status=null,
          version=version+1,updated_at=timezone('utc',now()) where id=v_item.material_id;
      else
        update public.materials set reserved_handover_id=null,reservation_status=null,
          version=version+1,updated_at=timezone('utc',now()) where id=v_item.material_id;
      end if;
      insert into public.material_history(material_id,actor_user_id,action,note,from_state,to_state)
        values(v_item.material_id,auth.uid(),'handover',v_h.code||case when v_outcome='received' then '' else ' (không nhận)' end,
          v_material_before,public.material_json(v_item.material_id));
    end loop;
    update public.material_handovers set status='completed',confirmed_by=auth.uid(),completed_at=timezone('utc',now()),version=version+1 where id=p_id;
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
      values(p_id,auth.uid(),'confirmed',v_h.status,'completed',nullif(btrim(p_note),''));
  else
    update public.material_handovers set status=v_to,version=version+1 where id=p_id;
    update public.materials set reserved_handover_id=null,reservation_status=null,
      version=version+1,updated_at=timezone('utc',now()) where reserved_handover_id=p_id;
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
      values(p_id,auth.uid(),case when p_action='reject' then 'rejected' else 'cancelled' end,
        v_h.status,v_to,nullif(btrim(p_note),''));
  end if;
  return p_id;
end;
$$;
revoke all on function public.act_on_warehouse_handover(uuid,text,integer,text,jsonb) from public, anon;
grant execute on function public.act_on_warehouse_handover(uuid,text,integer,text,jsonb) to authenticated;

create or replace function private.scoped_handover_json(target_handover_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  result := public.handover_json(target_handover_id);
  if result is null then return null; end if;
  result := jsonb_set(result, '{senderParty}',
    coalesce(result->'senderParty', '{}'::jsonb)
      - array['parentId', 'accountUserId', 'accountUserIds', 'representativeUserId', 'isActive'], true);
  result := jsonb_set(result, '{recipientParty}',
    coalesce(result->'recipientParty', '{}'::jsonb)
      - array['parentId', 'accountUserId', 'accountUserIds', 'representativeUserId', 'isActive'], true);
  if jsonb_typeof(result->'senderRepresentative') = 'object' then
    result := jsonb_set(result, '{senderRepresentative}', (result->'senderRepresentative') - 'userId', true);
  end if;
  if jsonb_typeof(result->'recipientRepresentative') = 'object' then
    result := jsonb_set(result, '{recipientRepresentative}', (result->'recipientRepresentative') - 'userId', true);
  end if;
  return result || jsonb_build_object(
    'recipientHasQrAccount', private.party_has_qrcode_account((result->'recipientParty'->>'id')::uuid),
    'warehouseApproved', exists (
      select 1 from public.material_handover_history history
      where history.handover_id=target_handover_id and history.action='warehouse_approved'
    )
  );
end;
$$;
revoke all on function private.scoped_handover_json(uuid) from public, anon, authenticated;

create or replace function public.list_handovers(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page int := greatest(coalesce((p_filters->>'page')::int, 1), 1);
  v_size int := least(greatest(coalesce((p_filters->>'pageSize')::int, 20), 1), 100);
begin
  if auth.uid() is null or not public.has_permission('materials:handover:view') then
    raise exception 'Permission denied to view handovers' using errcode = '42501';
  end if;
  return (
    with filtered as (
      select handover.id, handover.created_at
      from public.material_handovers handover
      where public.can_view_handover(handover.id)
        and (nullif(p_filters->>'search', '') is null or handover.code ilike '%' || btrim(p_filters->>'search') || '%')
        and (nullif(p_filters->>'status', '') is null or handover.status = p_filters->>'status')
        and (nullif(p_filters->>'type', '') is null or handover.type = p_filters->>'type')
        and (nullif(p_filters->>'senderPartyId', '') is null or handover.sender_party_id = (p_filters->>'senderPartyId')::uuid)
        and (nullif(p_filters->>'recipientPartyId', '') is null or handover.recipient_party_id = (p_filters->>'recipientPartyId')::uuid)
        and (nullif(p_filters->>'receiptId', '') is null or handover.receipt_id = (p_filters->>'receiptId')::uuid)
        and (nullif(p_filters->>'materialId', '') is null or exists (
          select 1 from public.material_handover_items item
          where item.handover_id = handover.id and item.material_id = (p_filters->>'materialId')::uuid
        ))
        and (nullif(p_filters->>'dateFrom', '') is null or handover.created_at >= (p_filters->>'dateFrom')::date)
        and (nullif(p_filters->>'dateTo', '') is null or handover.created_at < (p_filters->>'dateTo')::date + 1)
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(private.scoped_handover_json(page.id) order by page.created_at desc, page.id)
        from (select * from filtered order by created_at desc, id offset (v_page - 1) * v_size limit v_size) page), '[]'::jsonb),
      'total', (select count(*) from filtered), 'page', v_page, 'pageSize', v_size
    )
  );
end;
$$;
revoke all on function public.list_handovers(jsonb) from public, anon;
grant execute on function public.list_handovers(jsonb) to authenticated;

create or replace function public.get_handover_filter_summary(p_search text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_search text := nullif(btrim(p_search), '');
begin
  if auth.uid() is null or not public.has_permission('materials:handover:view') then
    raise exception 'Permission denied to view handovers' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'draft', count(*) filter (where handover.status = 'draft')::integer,
      'pending', count(*) filter (where handover.status = 'pending')::integer,
      'completed', count(*) filter (where handover.status = 'completed')::integer,
      'rejected', count(*) filter (where handover.status = 'rejected')::integer,
      'cancelled', count(*) filter (where handover.status = 'cancelled')::integer,
      'transfer', count(*) filter (where handover.type = 'transfer')::integer,
      'loan', count(*) filter (where handover.type = 'loan')::integer,
      'return', count(*) filter (where handover.type = 'return')::integer
    )
    from public.material_handovers handover
    where public.can_view_handover(handover.id)
      and (v_search is null or handover.code ilike '%' || v_search || '%')
  );
end;
$$;
revoke all on function public.get_handover_filter_summary(text) from public, anon;
grant execute on function public.get_handover_filter_summary(text) to authenticated;

notify pgrst, 'reload schema';
