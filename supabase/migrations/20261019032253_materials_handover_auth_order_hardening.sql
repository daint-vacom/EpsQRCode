-- Keep development demo parties independently usable without ever attaching an
-- EPS record. Existing DEV codes alone are eligible for representative seeding.
do $$
declare v_admin uuid;
begin
  select ur.user_id into v_admin
  from public.user_roles ur
  join public.roles r on r.id=ur.role_id
  join public.user_profiles p on p.id=ur.user_id and p.status='active'
  where r.is_active and r.is_system and r.grant_all_permissions
  order by ur.created_at,ur.user_id limit 1;

  insert into public.material_custodians(type,code,name,is_active,representative_user_id) values
    ('person','DEV-PERSON','Người dùng thử nghiệm',true,v_admin),
    ('department','DEV-OPS','Phòng Vận hành',true,v_admin),
    ('team','DEV-MAINT','Tổ Bảo trì',true,v_admin),
    ('external','DEV-PARTNER','Đối tác thiết bị',true,v_admin)
  on conflict(code) do update
    set representative_user_id=coalesce(public.material_custodians.representative_user_id,excluded.representative_user_id);
end;
$$;

-- Representation remains available for recovery actions on inactive parties;
-- send/confirm perform explicit active-party checks below.
create or replace function public.material_can_represent(p_party_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.material_custodians party
    join public.user_profiles profile on profile.id = auth.uid()
    where party.id = p_party_id
      and profile.status = 'active'
      and (party.account_user_id = auth.uid() or party.representative_user_id = auth.uid())
  );
$$;
revoke all on function public.material_can_represent(uuid) from public, anon, authenticated;

-- Entity lists have a business ordering: available materials, then loaned ones,
-- then localized name and stable UUID. The same order selects and returns pages.
create or replace function public.list_materials(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page int := greatest(coalesce((p_filters->>'page')::int,1),1);
  v_size int := least(greatest(coalesce((p_filters->>'pageSize')::int,20),1),100);
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode='42501';
  end if;

  return (
    with filtered as (
      select m.id,m.status,m.name_override,m.model_snapshot
      from public.materials m
      where (nullif(p_filters->>'modelId','') is null or m.model_id=(p_filters->>'modelId')::uuid)
        and (nullif(p_filters->>'groupId','') is null or m.model_snapshot->>'groupId'=p_filters->>'groupId')
        and (nullif(p_filters->>'ownerPartyId','') is null or m.owner_party_id=(p_filters->>'ownerPartyId')::uuid)
        and (nullif(p_filters->>'borrowerPartyId','') is null or m.borrower_party_id=(p_filters->>'borrowerPartyId')::uuid)
        and (nullif(p_filters->>'status','') is null or m.status=p_filters->>'status')
        and (nullif(p_filters->>'condition','') is null or m.condition=p_filters->>'condition')
        and (nullif(p_filters->>'search','') is null or concat_ws(' ',m.code,m.serial_number,m.name_override,m.model_snapshot->>'name') ilike '%'||btrim(p_filters->>'search')||'%')
        and (nullif(p_filters->>'updatedFrom','') is null or m.updated_at >= (p_filters->>'updatedFrom')::timestamptz)
        and (nullif(p_filters->>'updatedTo','') is null or m.updated_at < (p_filters->>'updatedTo')::timestamptz + interval '1 day')
    )
    select jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(public.material_json(page.id) order by
        case page.status when 'available' then 0 when 'loaned' then 1 else 2 end,
        lower(coalesce(nullif(btrim(page.name_override),''),page.model_snapshot->>'name','')) collate "vi-x-icu",
        page.id)
      from (
        select f.id,f.status,f.name_override,f.model_snapshot
        from filtered f
        order by case f.status when 'available' then 0 when 'loaned' then 1 else 2 end,
          lower(coalesce(nullif(btrim(f.name_override),''),f.model_snapshot->>'name','')) collate "vi-x-icu",
          f.id
        offset (v_page-1)*v_size limit v_size
      ) page
    ),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',v_page,'pageSize',v_size
    )
  );
end;
$$;
revoke all on function public.list_materials(jsonb) from public,anon;
grant execute on function public.list_materials(jsonb) to authenticated;

-- Ensure current party activity is rechecked on transitions that commit custody.
-- Cancellation and rejection intentionally remain possible for inactive parties.
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
        update public.materials set owner_party_id=v_h.recipient_party_id,condition=v_condition,condition_note=v_condition_note,
          reserved_handover_id=null,reservation_status=null,version=version+1,updated_at=timezone('utc',now()) where id=v_item.material_id;
      elsif v_h.type='loan' then
        update public.materials set borrower_party_id=v_h.recipient_party_id,status='loaned',active_loan_handover_id=p_id,
          condition=v_condition,condition_note=v_condition_note,reserved_handover_id=null,reservation_status=null,
          version=version+1,updated_at=timezone('utc',now()) where id=v_item.material_id;
      else
        update public.materials set borrower_party_id=null,status='available',active_loan_handover_id=null,
          condition=v_condition,condition_note=v_condition_note,reserved_handover_id=null,reservation_status=null,
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
revoke all on function public.act_on_handover(uuid,text,integer,text,jsonb) from public,anon;
grant execute on function public.act_on_handover(uuid,text,integer,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
