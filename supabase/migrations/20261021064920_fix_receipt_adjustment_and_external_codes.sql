-- Fix receipt adjustment eligibility, warehouse recipient rejection, and material model alias synchronization.
-- Validate aliases before insert/update, then persist them after the parent model row exists.
drop trigger if exists material_models_sync_external_codes on public.material_models;
drop function if exists private.sync_material_model_external_codes();

create or replace function private.validate_material_model_external_codes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_normalized text;
begin
  if new.external_codes is null then
    raise exception 'External codes must be a text array' using errcode='22023';
  end if;
  if exists (
    select 1 from unnest(new.external_codes) as supplied(code)
    where nullif(btrim(supplied.code), '') is null
  ) then
    raise exception 'External codes cannot be blank' using errcode='22023';
  end if;
  new.external_codes := coalesce((
    select array_agg(btrim(code) order by ordinality)
    from unnest(new.external_codes) with ordinality as supplied(code, ordinality)
  ), '{}'::text[]);
  if exists (
    select lower(code) from unnest(new.external_codes) as supplied(code)
    group by lower(code) having count(*) > 1
  ) then
    raise exception 'External codes must be unique ignoring letter case' using errcode='23505';
  end if;

  for v_normalized in
    select distinct lower(btrim(candidate.code))
    from (
      select new.code as code
      union all
      select unnest(new.external_codes)
    ) candidate
    order by lower(btrim(candidate.code))
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_normalized, 0));
  end loop;

  if exists (
    select 1 from public.material_models other_model
    where other_model.id <> new.id and lower(btrim(other_model.code)) = lower(btrim(new.code))
  ) then
    raise exception 'Material model codes must be unique ignoring letter case' using errcode='23505';
  end if;
  if exists (
    select 1 from public.material_model_external_codes x
    where x.normalized_code = lower(btrim(new.code)) and x.model_id <> new.id
  ) then
    raise exception 'A material model code cannot equal another model external code' using errcode='23505';
  end if;

  foreach v_code in array new.external_codes loop
    v_normalized := lower(v_code);
    if v_normalized = lower(btrim(new.code)) then
      raise exception 'An external code cannot equal its material model code' using errcode='23505';
    end if;
    if exists (
      select 1 from public.material_models other_model
      where other_model.id <> new.id and lower(btrim(other_model.code)) = v_normalized
    ) then
      raise exception 'An external code cannot equal another model code' using errcode='23505';
    end if;
    if exists (
      select 1 from public.material_model_external_codes x
      where x.normalized_code = v_normalized and x.model_id <> new.id
    ) then
      raise exception 'External codes must be unique ignoring letter case' using errcode='23505';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.validate_material_model_external_codes() from public, anon, authenticated;
create trigger material_models_validate_external_codes
before insert or update of code, external_codes on public.material_models
for each row execute function private.validate_material_model_external_codes();

create or replace function private.sync_material_model_external_codes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_index integer := 0;
begin
  delete from public.material_model_external_codes where model_id = new.id;
  for v_code in
    select code from unnest(new.external_codes) with ordinality as supplied(code, ordinality)
    order by ordinality
  loop
    insert into public.material_model_external_codes(normalized_code, display_code, model_id, sort_order)
    values(lower(v_code), v_code, new.id, v_index);
    v_index := v_index + 1;
  end loop;
  return new;
end $$;
revoke all on function private.sync_material_model_external_codes() from public, anon, authenticated;
create trigger material_models_sync_external_codes
 after insert or update of code, external_codes on public.material_models
 for each row execute function private.sync_material_model_external_codes();
create or replace function public.act_on_warehouse_handover(
  p_id uuid,p_action text,p_expected_version integer,p_note text default null,p_item_results jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_h public.material_handovers%rowtype; v_item record; v_before jsonb; v_to text;
  v_receipt_id uuid; v_result jsonb; v_outcome text; v_condition text; v_material_before jsonb;
begin
  if auth.uid() is null or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to manage handovers' using errcode='42501';
  end if;
  select receipt_id into v_receipt_id from public.material_handovers where id=p_id;
  if v_receipt_id is not null then perform 1 from public.material_receipts where id=v_receipt_id for update; end if;
  select * into v_h from public.material_handovers where id=p_id for update;
  if not found then raise exception 'Handover not found' using errcode='P0002'; end if;
  if v_h.mode not in ('warehouse_allocation','warehouse_request') then raise exception 'This is not a warehouse handover' using errcode='22023'; end if;
  if (p_action='confirm' and v_h.status='completed') or (p_action='reject' and v_h.status='rejected')
    or (p_action='cancel' and v_h.status='cancelled')
    or (p_action='send' and v_h.status in ('pending','awaiting_warehouse_approval'))
    or (p_action='approve' and v_h.status='pending') then return p_id; end if;
  if v_h.version is distinct from p_expected_version then raise exception 'Handover changed; reload before acting' using errcode='40001'; end if;
  if p_action not in ('send','approve','reject','confirm','cancel') then raise exception 'Unknown warehouse handover action' using errcode='22023'; end if;
  if p_action='send' then
    if v_h.status<>'draft' then raise exception 'Only a draft warehouse handover can be sent' using errcode='55000'; end if;
    if v_h.mode='warehouse_allocation' and not public.material_can_represent(v_h.sender_party_id)
      or v_h.mode='warehouse_request' and not public.material_can_represent(v_h.recipient_party_id) then
      raise exception 'Only the represented request owner can send a draft' using errcode='42501';
    end if;
    if not exists(select 1 from public.material_handover_items where handover_id=p_id) then raise exception 'Handover has no materials' using errcode='22023'; end if;
    v_to:=case when v_h.mode='warehouse_request' then 'awaiting_warehouse_approval' else 'pending' end;
  elsif p_action='approve' then
    if v_h.status<>'awaiting_warehouse_approval' or v_h.mode<>'warehouse_request'
      or not public.material_can_represent(v_h.sender_party_id) then
      raise exception 'Only a represented warehouse can approve a request' using errcode='42501';
    end if;
    v_to:='pending';
  elsif p_action='reject' then
    if v_h.status='awaiting_warehouse_approval' and v_h.mode='warehouse_request'
      and public.material_can_represent(v_h.sender_party_id) then
      v_to:='rejected';
    elsif v_h.status='pending' and public.material_can_represent(v_h.recipient_party_id) then
      v_to:='rejected';
    else
      raise exception 'Only the represented warehouse can reject a request or the receiving unit can refuse a pending handover' using errcode='42501';
    end if;
  elsif p_action='cancel' then
    if v_h.status='draft' then
      if v_h.mode='warehouse_request' and not public.material_can_represent(v_h.recipient_party_id)
        or v_h.mode='warehouse_allocation' and not public.material_can_represent(v_h.sender_party_id) then
        raise exception 'Only the represented request owner can cancel a draft' using errcode='42501';
      end if;
    elsif v_h.status='pending' then
      if not public.material_can_represent(v_h.sender_party_id) then
        raise exception 'The warehouse can cancel only an approved handover before receipt confirmation' using errcode='42501';
      end if;
    else
      raise exception 'This warehouse handover cannot be cancelled in its current status' using errcode='55000';
    end if;
    if nullif(btrim(p_note),'') is null then raise exception 'A cancellation reason is required' using errcode='22023'; end if;
    v_to:='cancelled';
  else
    if v_h.status<>'pending' or not public.material_can_represent(v_h.recipient_party_id) then
      raise exception 'Only the represented receiving unit can confirm a pending handover' using errcode='42501';
    end if;
    if jsonb_typeof(p_item_results) is distinct from 'array' then raise exception 'Item receipt results must be an array' using errcode='22023'; end if;
    if jsonb_array_length(p_item_results)<>(select count(*) from public.material_handover_items where handover_id=p_id)
      or (select count(distinct x.value->>'materialId') from jsonb_array_elements(p_item_results) x(value))<>jsonb_array_length(p_item_results) then
      raise exception 'Provide one receipt result for every material' using errcode='22023'; end if;
    v_to:='completed';
  end if;
  if p_action in ('reject','cancel') and nullif(btrim(p_note),'') is null then raise exception 'A reason is required' using errcode='22023'; end if;
  v_before:=public.handover_json(p_id);
  perform set_config('app.materials_warehouse_transition','true',true);
  if p_action='send' then
    update public.material_handovers set status=v_to,version=version+1 where id=p_id;
    update public.materials set reservation_status='pending' where reserved_handover_id=p_id;
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
      values(p_id,auth.uid(),'sent',v_h.status,v_to,nullif(btrim(p_note),''));
  elsif p_action='approve' then
    update public.material_handovers set status='pending',version=version+1 where id=p_id;
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
      values(p_id,auth.uid(),'warehouse_approved',v_h.status,'pending',nullif(btrim(p_note),''));
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
        note=coalesce(nullif(btrim(v_result->>'note'),''),note)
        where id=v_item.id;
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
end $$;

create or replace function public.preview_material_receipt_adjustment(
  p_id uuid,p_expected_version integer,p_lines jsonb
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_receipt public.material_receipts%rowtype;
  v_desired_ids uuid[];
  v_removed_ids uuid[];
  v_touched_ids uuid[];
  v_handover_ids uuid[];
  v_blocked jsonb;
  v_removed jsonb;
  v_added_count integer;
  v_state jsonb;
  v_token text;
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to adjust material receipts' using errcode='42501';
  end if;
  select * into v_receipt from public.material_receipts where id=p_id;
  if not found then raise exception 'Material receipt not found' using errcode='P0002'; end if;
  if v_receipt.version is distinct from p_expected_version then raise exception 'Receipt changed; reload before previewing' using errcode='40001'; end if;
  if v_receipt.status<>'handover' then raise exception 'Reopen a completed receipt before adjusting it' using errcode='55000'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Receipt lines must be an array' using errcode='22023'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_lines) l(value)
    where jsonb_typeof(coalesce(l.value->'items','[]'::jsonb)) is distinct from 'array'
  ) then raise exception 'Receipt item details must be arrays' using errcode='22023'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_lines) l(value)
    cross join lateral jsonb_array_elements(coalesce(l.value->'items','[]'::jsonb)) i(value)
    where nullif(i.value->>'receiptItemId','') is not null
      and jsonb_typeof(i.value->'receiptItemId') is distinct from 'string'
  ) then raise exception 'Receipt item IDs must be strings' using errcode='22023'; end if;
  select coalesce(array_agg(distinct (i.value->>'receiptItemId')::uuid order by (i.value->>'receiptItemId')::uuid),'{}'::uuid[])
  into v_desired_ids
  from jsonb_array_elements(p_lines) l(value)
  cross join lateral jsonb_array_elements(coalesce(l.value->'items','[]'::jsonb)) i(value)
  where nullif(i.value->>'receiptItemId','') is not null;
  if (
    select count(*) from jsonb_array_elements(p_lines) l(value)
    cross join lateral jsonb_array_elements(coalesce(l.value->'items','[]'::jsonb)) i(value)
    where nullif(i.value->>'receiptItemId','') is not null
  ) <> cardinality(v_desired_ids) then raise exception 'An existing receipt item can appear only once' using errcode='23505'; end if;
  if exists(select 1 from unnest(v_desired_ids) d(id) where not exists(
    select 1 from public.material_receipt_items i where i.id=d.id and i.receipt_id=p_id and i.status='active'
  )) then raise exception 'A selected receipt item no longer belongs to this receipt' using errcode='55000'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_lines) line(value)
    cross join lateral jsonb_array_elements(coalesce(line.value->'items','[]'::jsonb)) desired(value)
    join public.material_receipt_items ri on ri.id=(desired.value->>'receiptItemId')::uuid
    where nullif(desired.value->>'receiptItemId','') is not null
      and (nullif(line.value->>'lineId','') is null or (line.value->>'lineId')::uuid<>ri.line_id)
  ) then raise exception 'An existing receipt item cannot be moved to another line' using errcode='55000'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_lines) line(value)
    join public.material_receipt_lines existing_line on existing_line.id=(line.value->>'lineId')::uuid
    where nullif(line.value->>'lineId','') is not null
      and (line.value ? 'newModel' or (nullif(line.value->>'modelId','') is not null and (line.value->>'modelId')::uuid<>existing_line.model_id))
  ) then raise exception 'Change a material model by removing the old item and adding a replacement' using errcode='55000'; end if;
  select coalesce(array_agg(i.id order by i.id),'{}'::uuid[]) into v_removed_ids
  from public.material_receipt_items i where i.receipt_id=p_id and i.status='active'
    and not (i.id=any(v_desired_ids));
  select coalesce(array_agg(distinct touched.id order by touched.id),'{}'::uuid[]) into v_touched_ids
  from (
    select unnest(v_removed_ids) as id
    union
    select ri.id
    from public.material_receipt_items ri
    join lateral (
      select item.value from jsonb_array_elements(p_lines) line(value)
      cross join lateral jsonb_array_elements(coalesce(line.value->'items','[]'::jsonb)) item(value)
      where item.value->>'receiptItemId'=ri.id::text
      limit 1
    ) desired on true
    where ri.receipt_id=p_id and ri.status='active' and (
      ri.serial_number is distinct from nullif(btrim(desired.value->>'serialNumber'),'')
      or ri.condition is distinct from coalesce(desired.value->>'condition','good')
      or ri.condition_note is distinct from nullif(btrim(desired.value->>'conditionNote'),'')
      or ri.note is distinct from btrim(coalesce(desired.value->>'note',''))
    )
  ) touched;
  select count(*) into v_added_count
  from jsonb_array_elements(p_lines) l(value)
  cross join lateral jsonb_array_elements(coalesce(l.value->'items','[]'::jsonb)) i(value)
  where nullif(i.value->>'receiptItemId','') is null;
  select coalesce(array_agg(distinct h.id order by h.id),'{}'::uuid[]) into v_handover_ids
  from public.material_handovers h join public.material_handover_items hi on hi.handover_id=h.id
  join public.material_receipt_items ri on ri.material_id=hi.material_id
  where ri.id=any(v_touched_ids) and h.status in ('draft','pending','awaiting_warehouse_approval');

  select coalesce(jsonb_agg(jsonb_build_object(
    'receiptItemId',ri.id,'materialId',m.id,'code',m.code,
    'reason',case
      when m.is_active is false then 'Vật tư đã bị vô hiệu trước đó'
      when m.status<>'available' or m.owner_party_id<>v_receipt.warehouse_id
        or m.active_loan_handover_id is not null then 'Vật tư không còn thuộc kho hoặc đang được mượn'
      when exists(select 1 from public.material_handover_items hi join public.material_handovers h on h.id=hi.handover_id
        where hi.material_id=m.id and hi.receiver_outcome='received' and h.status='completed') then 'Vật tư đã được nhận bàn giao hoàn tất'
      else null end
  ) order by ri.id) filter (where m.id is not null and (
    m.is_active is false or m.status<>'available' or m.owner_party_id<>v_receipt.warehouse_id
    or m.active_loan_handover_id is not null or exists(select 1 from public.material_handover_items hi
      join public.material_handovers h on h.id=hi.handover_id where hi.material_id=m.id and hi.receiver_outcome='received' and h.status='completed')
  )), '[]'::jsonb)
  into v_blocked
  from public.material_receipt_items ri left join public.materials m on m.id=ri.material_id
  where ri.id=any(v_touched_ids);

  select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'code',h.code,'status',h.status,'version',h.version)
    order by h.created_at desc,h.id),'[]'::jsonb)
  into v_removed
  from public.material_handovers h where h.id=any(v_handover_ids);

  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_array(i.id,i.status,i.material_id,m.version,m.is_active,
      m.owner_party_id,m.status,m.reserved_handover_id,m.reservation_status) order by i.id)
      from public.material_receipt_items i left join public.materials m on m.id=i.material_id where i.receipt_id=p_id),'[]'::jsonb),
    'handovers',coalesce((select jsonb_agg(jsonb_build_array(h.id,h.status,h.version) order by h.id)
      from public.material_handovers h where h.receipt_id=p_id or exists(
        select 1 from public.material_handover_items hi join public.material_receipt_items ri on ri.material_id=hi.material_id
        where hi.handover_id=h.id and ri.receipt_id=p_id)),'[]'::jsonb)
  ) into v_state;
  v_token:=md5(p_id::text||':'||v_receipt.version::text||':'||p_lines::text||':'||v_state::text);
  return jsonb_build_object(
    'receiptId',p_id,'receiptVersion',v_receipt.version,'previewToken',v_token,
    'addCount',v_added_count,'removeCount',cardinality(v_removed_ids),
    'removedItems',coalesce((select jsonb_agg(jsonb_build_object('id',ri.id,'materialId',ri.material_id,'code',m.code) order by ri.id)
      from public.material_receipt_items ri left join public.materials m on m.id=ri.material_id where ri.id=any(v_removed_ids)),'[]'::jsonb),
    'affectedHandovers',v_removed,'blockedItems',v_blocked
  );
end $$;

create or replace function public.apply_material_receipt_adjustment(
  p_id uuid,
  p_expected_version integer,
  p_preview_token text,
  p_lines jsonb,
  p_reason text,
  p_cancel_handover_ids jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_receipt public.material_receipts%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_preview jsonb;
  v_line jsonb;
  v_item jsonb;
  v_line_id uuid;
  v_model_id uuid;
  v_item_id uuid;
  v_material_id uuid;
  v_item_row public.material_receipt_items%rowtype;
  v_material public.materials%rowtype;
  v_old_material jsonb;
  v_new_material jsonb;
  v_condition text;
  v_condition_note text;
  v_cancel_ids uuid[];
  v_expected_ids uuid[];
  v_code text;
  v_snapshot jsonb;
  v_sort integer:=0;
  v_item_sort integer;
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to adjust material receipts' using errcode='42501';
  end if;
  select * into v_receipt from public.material_receipts where id=p_id for update;
  if not found then raise exception 'Material receipt not found' using errcode='P0002'; end if;
  if v_receipt.version is distinct from p_expected_version then raise exception 'Receipt changed; reload before applying' using errcode='40001'; end if;
  if v_receipt.status<>'handover' then raise exception 'Reopen a completed receipt before adjusting it' using errcode='55000'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'An adjustment reason is required' using errcode='22023'; end if;
  if jsonb_typeof(p_cancel_handover_ids) is distinct from 'array' then raise exception 'Handover confirmations must be an array' using errcode='22023'; end if;

  -- Lock all material and handover rows touched by the receipt before recomputing the preview token.
  perform 1 from public.materials m where m.id in (
    select i.material_id from public.material_receipt_items i where i.receipt_id=p_id and i.material_id is not null
  ) order by m.id for update;
  perform 1 from public.material_handovers h where h.id in (
    select hi.handover_id from public.material_handover_items hi
    join public.material_receipt_items ri on ri.material_id=hi.material_id where ri.receipt_id=p_id
    union select h2.id from public.material_handovers h2 where h2.receipt_id=p_id
  ) order by h.id for update;
  v_preview:=public.preview_material_receipt_adjustment(p_id,p_expected_version,p_lines);
  if v_preview->>'previewToken' is distinct from p_preview_token then
    raise exception 'Receipt inventory or linked handovers changed; refresh the preview' using errcode='40001';
  end if;
  if jsonb_array_length(v_preview->'blockedItems')>0 then
    raise exception 'Some receipt items cannot be removed or changed; review the blocked items' using errcode='55000';
  end if;
  select coalesce(array_agg((x.value->>'id')::uuid order by (x.value->>'id')::uuid),'{}'::uuid[])
  into v_expected_ids from jsonb_array_elements(v_preview->'affectedHandovers') x(value);
  if exists(select 1 from jsonb_array_elements(p_cancel_handover_ids) x where jsonb_typeof(x.value) is distinct from 'string') then
    raise exception 'Handover IDs must be strings' using errcode='22023';
  end if;
  select coalesce(array_agg(x.value::uuid order by x.value::uuid),'{}'::uuid[])
  into v_cancel_ids from (select distinct value from jsonb_array_elements_text(p_cancel_handover_ids)) x;
  if v_cancel_ids is distinct from v_expected_ids then
    raise exception 'Confirm cancellation of every affected open handover before applying the adjustment' using errcode='55000';
  end if;
  v_before:=public.material_receipt_json(p_id);

  if cardinality(v_cancel_ids)>0 then
    perform set_config('app.materials_warehouse_transition','true',true);
    update public.material_handovers h set status='cancelled',version=version+1
      where h.id=any(v_cancel_ids) and h.status in ('draft','pending','awaiting_warehouse_approval');
    update public.materials m set reserved_handover_id=null,reservation_status=null,version=version+1,
      updated_at=timezone('utc',now()) where m.reserved_handover_id=any(v_cancel_ids);
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
      select (x.value->>'id')::uuid,auth.uid(),'cancelled',x.value->>'status','cancelled',
        'Hủy do điều chỉnh phiếu nhập: '||btrim(p_reason)
      from jsonb_array_elements(v_preview->'affectedHandovers') x(value);
  end if;

  for v_item_row in select i.* from public.material_receipt_items i
    where i.receipt_id=p_id and i.status='active'
      and not exists(
        select 1 from jsonb_array_elements(p_lines) l(value)
        cross join lateral jsonb_array_elements(coalesce(l.value->'items','[]'::jsonb)) x(value)
        where nullif(x.value->>'receiptItemId','')=i.id::text
      )
    order by i.material_id nulls last,i.id for update
  loop
    if v_item_row.material_id is not null then
      v_old_material:=public.material_json(v_item_row.material_id);
      update public.materials set is_active=false,version=version+1,updated_at=timezone('utc',now())
        where id=v_item_row.material_id returning * into v_material;
      v_new_material:=public.material_json(v_item_row.material_id);
      insert into public.material_history(material_id,actor_user_id,action,note,from_state,to_state)
        values(v_item_row.material_id,auth.uid(),'updated','Vô hiệu theo phiếu nhập '||v_receipt.code||': '||btrim(p_reason),v_old_material,v_new_material);
    end if;
    update public.material_receipt_items set status='voided',voided_at=timezone('utc',now()),
      voided_by=auth.uid(),void_reason=btrim(p_reason),updated_at=timezone('utc',now()) where id=v_item_row.id;
  end loop;

  for v_line in select value from jsonb_array_elements(p_lines) order by (value->>'sortOrder')::integer nulls last loop
    v_line_id:=nullif(v_line->>'lineId','')::uuid;
    if v_line_id is not null then
      perform 1 from public.material_receipt_lines l where l.id=v_line_id and l.receipt_id=p_id for update;
      if not found then raise exception 'A receipt line no longer belongs to this receipt' using errcode='55000'; end if;
      select model_id into v_model_id from public.material_receipt_lines where id=v_line_id;
      if nullif(v_line->>'modelId','') is not null and (v_line->>'modelId')::uuid<>v_model_id then
        raise exception 'Replace an item to change its material model; existing IDs cannot be rewritten' using errcode='55000';
      end if;
      if v_line ? 'newModel' then raise exception 'An existing receipt line cannot be changed to a new model' using errcode='55000'; end if;
      v_model_id:=private.resolve_material_receipt_model(v_model_id,nullif(v_line->'newModel','null'::jsonb),nullif(btrim(v_line->>'externalCode'),''));
      update public.material_receipt_lines set model_id=v_model_id,external_code=nullif(btrim(v_line->>'externalCode'),''),
        sort_order=v_sort,updated_at=timezone('utc',now()) where id=v_line_id;
    else
      if nullif(v_line->>'modelId','') is null and jsonb_typeof(v_line->'newModel') is distinct from 'object' then
        raise exception 'Each added receipt line needs a material model' using errcode='22023';
      end if;
      if nullif(v_line->>'modelId','') is not null and v_line ? 'newModel' then
        raise exception 'A receipt line cannot select both an existing and a new model' using errcode='22023';
      end if;
      v_model_id:=private.resolve_material_receipt_model(nullif(v_line->>'modelId','')::uuid,v_line->'newModel',nullif(btrim(v_line->>'externalCode'),''));
      insert into public.material_receipt_lines(receipt_id,model_id,external_code,quantity,sort_order)
      values(p_id,v_model_id,nullif(btrim(v_line->>'externalCode'),''),0,v_sort) returning id into v_line_id;
    end if;
    if jsonb_typeof(coalesce(v_line->'items','[]'::jsonb)) is distinct from 'array' then raise exception 'Unit details must be an array' using errcode='22023'; end if;
    v_item_sort:=0;
    for v_item in select value from jsonb_array_elements(coalesce(v_line->'items','[]'::jsonb)) loop
      v_condition:=coalesce(v_item->>'condition','good');
      v_condition_note:=nullif(btrim(v_item->>'conditionNote'),'');
      if v_condition not in ('good','damaged') then raise exception 'Material condition is invalid' using errcode='22023'; end if;
      if v_condition='damaged' and v_condition_note is null then raise exception 'A damaged item needs a condition note' using errcode='22023'; end if;
      v_item_id:=nullif(v_item->>'receiptItemId','')::uuid;
      if v_item_id is not null then
        select * into v_item_row from public.material_receipt_items where id=v_item_id and receipt_id=p_id and status='active' for update;
        if not found or v_item_row.line_id<>v_line_id then raise exception 'An item cannot be moved between receipt lines' using errcode='55000'; end if;
        if v_item_row.material_id is not null then
          select * into v_material from public.materials where id=v_item_row.material_id for update;
          if v_material.model_id<>v_model_id then raise exception 'An item model cannot change in place' using errcode='55000'; end if;
          if (v_item_row.serial_number is distinct from nullif(btrim(v_item->>'serialNumber'),''))
            or v_item_row.condition is distinct from v_condition
            or v_item_row.condition_note is distinct from v_condition_note
            or v_item_row.note is distinct from btrim(coalesce(v_item->>'note','')) then
            if exists(select 1 from public.material_handover_items hi join public.material_handovers h on h.id=hi.handover_id
              where hi.material_id=v_item_row.material_id and hi.receiver_outcome='received' and h.status='completed') then
              raise exception 'An item with completed handover history cannot be rewritten' using errcode='55000';
            end if;
            v_old_material:=public.material_json(v_item_row.material_id);
            update public.materials set serial_number=nullif(btrim(v_item->>'serialNumber'),''),condition=v_condition,
              note=coalesce(v_condition_note,nullif(btrim(v_item->>'note'),'')),version=version+1,updated_at=timezone('utc',now())
              where id=v_item_row.material_id;
            v_new_material:=public.material_json(v_item_row.material_id);
            insert into public.material_history(material_id,actor_user_id,action,note,from_state,to_state)
              values(v_item_row.material_id,auth.uid(),'updated','Điều chỉnh theo phiếu nhập '||v_receipt.code||': '||btrim(p_reason),v_old_material,v_new_material);
          end if;
        end if;
        update public.material_receipt_items set serial_number=nullif(btrim(v_item->>'serialNumber'),''),
          condition=v_condition,condition_note=v_condition_note,note=btrim(coalesce(v_item->>'note','')),
          sort_order=v_item_sort,updated_at=timezone('utc',now()) where id=v_item_id;
      else
        insert into public.material_receipt_items(receipt_id,line_id,serial_number,condition,condition_note,note,sort_order)
        values(p_id,v_line_id,nullif(btrim(v_item->>'serialNumber'),''),v_condition,v_condition_note,
          btrim(coalesce(v_item->>'note','')),v_item_sort) returning id into v_item_id;
        v_snapshot:=public.material_model_snapshot(v_model_id);
        insert into public.materials(code,model_id,model_snapshot,serial_number,owner_party_id,condition,note)
        values(private.generate_receipt_material_code(),v_model_id,v_snapshot,nullif(btrim(v_item->>'serialNumber'),''),
          v_receipt.warehouse_id,v_condition,coalesce(v_condition_note,nullif(btrim(v_item->>'note'),'')))
        returning id into v_material_id;
        update public.material_receipt_items set material_id=v_material_id,material_snapshot=public.material_json(v_material_id)
          where id=v_item_id;
        insert into public.material_history(material_id,actor_user_id,action,note,to_state)
          values(v_material_id,auth.uid(),'created','Bổ sung từ phiếu nhập '||v_receipt.code||': '||btrim(p_reason),public.material_json(v_material_id));
      end if;
      v_item_sort:=v_item_sort+1;
    end loop;
    update public.material_receipt_lines l set quantity=(select count(*) from public.material_receipt_items i
      where i.line_id=l.id and i.status='active'),updated_at=timezone('utc',now()) where l.id=v_line_id;
    v_sort:=v_sort+1;
  end loop;
  update public.material_receipt_lines l set quantity=(select count(*) from public.material_receipt_items i
    where i.line_id=l.id and i.status='active'),updated_at=timezone('utc',now()) where l.receipt_id=p_id;
  update public.material_receipts set version=version+1,updated_at=timezone('utc',now()) where id=p_id;
  v_after:=public.material_receipt_json(p_id);
  insert into public.material_receipt_history(receipt_id,actor_user_id,action,reason,from_status,to_status,before_state,after_state)
  values(p_id,auth.uid(),'adjusted',btrim(p_reason),'handover','handover',v_before,v_after);
  return p_id;
end $$;

revoke all on function public.act_on_warehouse_handover(uuid,text,integer,text,jsonb) from public, anon;
grant execute on function public.act_on_warehouse_handover(uuid,text,integer,text,jsonb) to authenticated;
revoke all on function public.preview_material_receipt_adjustment(uuid,integer,jsonb) from public, anon;
grant execute on function public.preview_material_receipt_adjustment(uuid,integer,jsonb) to authenticated;
revoke all on function public.apply_material_receipt_adjustment(uuid,integer,text,jsonb,text,jsonb) from public, anon;
grant execute on function public.apply_material_receipt_adjustment(uuid,integer,text,jsonb,text,jsonb) to authenticated;