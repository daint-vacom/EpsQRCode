-- Atomic Excel receipt import and allocation for the isolated development project.
alter table public.material_receipt_lines
  add column receiving_party_id uuid references public.material_custodians(id) on delete restrict;

create table public.material_receipt_import_requests (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  receipt_id uuid not null references public.material_receipts(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (actor_user_id, request_id)
);
alter table public.material_receipt_import_requests enable row level security;
revoke all on public.material_receipt_import_requests from public, anon, authenticated;

create table private.material_receipt_import_reserved_codes (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  code text not null check (length(btrim(code)) > 0),
  primary key (actor_user_id, request_id, code)
);
create unique index material_receipt_import_reserved_codes_ci_uidx
  on private.material_receipt_import_reserved_codes (lower(btrim(code)));
alter table private.material_receipt_import_reserved_codes enable row level security;
revoke all on private.material_receipt_import_reserved_codes from public, anon, authenticated;

-- Material codes generated for this import must skip explicit codes reserved by
-- that same transaction, including when an explicit code matches the next model
-- counter value. The materials unique index still handles concurrent writes.
create or replace function private.generate_material_code_from_model()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_model_code text;
  v_sequence bigint;
  v_code text;
begin
  if new.code is not null and length(btrim(new.code)) > 0 then return new; end if;
  select btrim(model.code) into v_model_code
  from public.material_models model where model.id = new.model_id;
  if v_model_code is null then raise exception 'Material model not found' using errcode='P0002'; end if;
  insert into private.material_code_generation_counters(model_id,last_value)
  values(new.model_id,0) on conflict(model_id) do nothing;
  loop
    update private.material_code_generation_counters counter
    set last_value=counter.last_value+1, updated_at=timezone('utc',now())
    where counter.model_id=new.model_id returning last_value into v_sequence;
    v_code:=v_model_code||'-'||lpad(v_sequence::text,greatest(3,length(v_sequence::text)),'0');
    exit when not exists(select 1 from public.materials material
      where lower(btrim(material.code))=lower(btrim(v_code)))
      and not exists(select 1 from private.material_receipt_import_reserved_codes reserved
        where lower(btrim(reserved.code))=lower(btrim(v_code)));
  end loop;
  new.code:=v_code;
  return new;
end;
$$;
revoke all on function private.generate_material_code_from_model() from public, anon, authenticated;

create or replace function private.generate_receipt_material_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sequence bigint;
  v_code text;
begin
  loop
    v_sequence := nextval('public.material_receipt_material_code_seq');
    v_code := 'VT-' || lpad(v_sequence::text, greatest(6, length(v_sequence::text)), '0');
    exit when not exists(select 1 from public.materials material
      where lower(btrim(material.code))=lower(btrim(v_code)))
      and not exists(select 1 from private.material_receipt_import_reserved_codes reserved
        where lower(btrim(reserved.code))=lower(btrim(v_code)));
  end loop;
  return v_code;
end;
$$;
revoke all on function private.generate_receipt_material_code() from public, anon, authenticated;

-- EPS-linked custodians are valid recipients without a direct QRCode account.
-- Their eventual confirmation is still gated by the existing scoped handover
-- permission and material transition guards.
create or replace function public.save_warehouse_handover(p_id uuid,p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_row public.material_handovers%rowtype; v_material public.materials%rowtype;
  v_mode text; v_warehouse uuid; v_recipient uuid; v_receipt_id uuid;
  v_actor_party uuid; v_actor_role text; v_items jsonb; v_item jsonb;
  v_before jsonb; v_condition text; v_index integer:=0;
begin
  if auth.uid() is null or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to manage handovers' using errcode='42501';
  end if;
  v_mode:=p_values->>'mode';
  v_warehouse:=nullif(p_values->>'warehouseId','')::uuid;
  v_recipient:=nullif(p_values->>'recipientPartyId','')::uuid;
  v_receipt_id:=nullif(p_values->>'receiptId','')::uuid;
  v_items:=coalesce(p_values->'items','[]'::jsonb);
  if v_mode not in ('warehouse_allocation','warehouse_request') or v_warehouse is null or v_recipient is null or v_warehouse=v_recipient then
    raise exception 'Choose a warehouse handover mode, warehouse and recipient' using errcode='22023';
  end if;
  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items)=0 then
    raise exception 'A warehouse handover needs at least one material' using errcode='22023';
  end if;
  if (select count(*) from jsonb_array_elements(v_items)) <>
    (select count(distinct x.value->>'materialId') from jsonb_array_elements(v_items) x(value)) then
    raise exception 'A material can appear only once in a handover' using errcode='23505';
  end if;
  if not exists(select 1 from public.material_custodians c join public.material_warehouses w on w.custodian_id=c.id
    where c.id=v_warehouse and c.type='warehouse' and c.is_active) then raise exception 'Choose an active warehouse' using errcode='22023'; end if;
  if not exists(select 1 from public.material_custodians c where c.id=v_recipient and c.is_active
    and c.type in ('department','team','person','external')) then
    raise exception 'The recipient must be an active non-warehouse custodian' using errcode='22023';
  end if;
  if v_mode='warehouse_allocation' then
    if not public.material_can_represent(v_warehouse) then raise exception 'You must represent the warehouse to allocate materials' using errcode='42501'; end if;
    v_actor_party:=v_warehouse; v_actor_role:='sender';
  else
    if not public.material_can_represent(v_recipient) then raise exception 'You must represent the requesting unit' using errcode='42501'; end if;
    v_actor_party:=v_recipient; v_actor_role:='recipient';
  end if;
  if v_receipt_id is not null then
    perform 1 from public.material_receipts r where r.id=v_receipt_id and r.status='handover'
      and r.warehouse_id=v_warehouse for update;
    if not found then raise exception 'The linked receipt must be open for handover at the selected warehouse' using errcode='55000'; end if;
  end if;
  if p_id is null then
    perform set_config('app.materials_warehouse_transition','true',true);
    insert into public.material_handovers(code,type,mode,receipt_id,sender_party_id,recipient_party_id,status,planned_date,note)
    values('BG-'||to_char(current_date,'YYYYMMDD')||'-'||nextval('public.material_handover_code_seq')::text,
      'transfer',v_mode,v_receipt_id,v_warehouse,v_recipient,'draft',nullif(p_values->>'plannedDate','')::date,
      nullif(btrim(p_values->>'note'),'')) returning id into v_id;
  else
    select * into v_row from public.material_handovers where id=p_id for update;
    if not found then raise exception 'Handover not found' using errcode='P0002'; end if;
    if v_row.mode not in ('warehouse_allocation','warehouse_request') or v_row.status<>'draft' then
      raise exception 'Only a draft warehouse handover can be edited' using errcode='55000'; end if;
    if (p_values->>'expectedVersion')::integer is distinct from v_row.version then raise exception 'Handover changed; reload before saving' using errcode='40001'; end if;
    if v_row.receipt_id is distinct from v_receipt_id then raise exception 'A saved handover cannot be moved to another receipt' using errcode='55000'; end if;
    if v_row.mode='warehouse_allocation' and not public.material_can_represent(v_row.sender_party_id)
      or v_row.mode='warehouse_request' and not public.material_can_represent(v_row.recipient_party_id) then
      raise exception 'You do not represent the party that created this request' using errcode='42501';
    end if;
    v_before:=public.handover_json(p_id); v_id:=p_id;
    perform set_config('app.materials_warehouse_transition','true',true);
    update public.material_handovers set mode=v_mode,receipt_id=v_receipt_id,sender_party_id=v_warehouse,
      recipient_party_id=v_recipient,planned_date=nullif(p_values->>'plannedDate','')::date,
      note=nullif(btrim(p_values->>'note'),''),version=version+1 where id=v_id;
  end if;
  perform set_config('app.materials_warehouse_transition','true',true);
  update public.material_handovers set sender_party_snapshot=public.material_party_json(v_warehouse),
    recipient_party_snapshot=public.material_party_json(v_recipient),
    sender_representative_user_id=case when v_actor_role='sender' then auth.uid() else null end,
    recipient_representative_user_id=case when v_actor_role='recipient' then auth.uid() else null end,
    sender_representative_snapshot=case when v_actor_role='sender' then (
      select jsonb_build_object('userId',p.id,'displayName',coalesce(nullif(btrim(p.display_name),''),nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'')))
      from public.user_profiles p where p.id=auth.uid()) else null end,
    recipient_representative_snapshot=case when v_actor_role='recipient' then (
      select jsonb_build_object('userId',p.id,'displayName',coalesce(nullif(btrim(p.display_name),''),nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'')))
      from public.user_profiles p where p.id=auth.uid()) else null end
  where id=v_id;
  if p_id is not null then
    update public.materials set reserved_handover_id=null,reservation_status=null
      where reserved_handover_id=v_id and not exists(select 1 from jsonb_array_elements(v_items) x(value)
        where (x.value->>'materialId')::uuid=materials.id);
    delete from public.material_handover_items i where i.handover_id=v_id and not exists(
      select 1 from jsonb_array_elements(v_items) x(value) where (x.value->>'materialId')::uuid=i.material_id);
  end if;
  perform 1 from public.materials m where m.id in
    (select (x.value->>'materialId')::uuid from jsonb_array_elements(v_items) x(value))
    or m.reserved_handover_id=v_id order by m.id for update;
  for v_item in select value from jsonb_array_elements(v_items) order by (value->>'materialId')::uuid loop
    if nullif(v_item->>'materialId','') is null then raise exception 'Each line needs a material ID' using errcode='22023'; end if;
    select * into v_material from public.materials where id=(v_item->>'materialId')::uuid;
    if not found then raise exception 'A selected material no longer exists' using errcode='P0002'; end if;
    if not v_material.is_active or v_material.status<>'available' or v_material.owner_party_id<>v_warehouse
      or v_material.borrower_party_id is not null or v_material.active_loan_handover_id is not null then
      raise exception 'Only active, available stock owned by the warehouse can be selected' using errcode='55000'; end if;
    if v_material.reserved_handover_id is not null and v_material.reserved_handover_id<>v_id then
      raise exception 'A selected material is reserved by another open handover' using errcode='55000'; end if;
    if v_receipt_id is not null and not exists(select 1 from public.material_receipt_items ri
      where ri.receipt_id=v_receipt_id and ri.material_id=v_material.id and ri.status='active') then
      raise exception 'A linked handover can only use active items from its receipt' using errcode='55000'; end if;
    v_condition:=coalesce(v_item->>'condition',v_material.condition);
    if v_condition not in ('good','damaged') then raise exception 'Material condition is invalid' using errcode='22023'; end if;
    insert into public.material_handover_items(handover_id,material_id,material_snapshot,sender_condition,note,sort_order)
    values(v_id,v_material.id,public.material_json(v_material.id),v_condition,nullif(btrim(v_item->>'note'),''),v_index)
    on conflict(handover_id,material_id) do update set material_snapshot=excluded.material_snapshot,
      sender_condition=excluded.sender_condition,note=excluded.note,sort_order=excluded.sort_order;
    update public.materials set reserved_handover_id=v_id,reservation_status='draft' where id=v_material.id;
    v_index:=v_index+1;
  end loop;
  if p_id is null then
    insert into public.material_handover_history(handover_id,actor_user_id,action,to_status,note)
    values(v_id,auth.uid(),'created','draft',nullif(btrim(p_values->>'note'),''));
  else
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
    values(v_id,auth.uid(),'updated','draft','draft',nullif(btrim(p_values->>'note'),''));
  end if;
  return v_id;
end $$;
revoke all on function public.save_warehouse_handover(uuid,jsonb) from public, anon;
grant execute on function public.save_warehouse_handover(uuid,jsonb) to authenticated;

-- Warehouse actions use explicit transaction context. Resolve their actor from
-- the actual warehouse handover transition instead of reusing any prior action's
-- actor GUC in the same transaction.
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
    if tg_op = 'INSERT' then
      actor_party_id := case when new.mode='warehouse_request' then new_recipient_scope else new_sender_scope end;
    elsif new.status = 'awaiting_warehouse_approval' then
      actor_party_id := new_recipient_scope;
    elsif new.status = 'completed' or (new.status='rejected' and old.status<>'awaiting_warehouse_approval') then
      actor_party_id := new_recipient_scope;
    elsif old.status = 'awaiting_warehouse_approval' and new.status in ('pending','rejected') then
      actor_party_id := new_sender_scope;
    elsif new.status = 'pending' then
      actor_party_id := new_sender_scope;
    elsif new.status = 'cancelled' then
      actor_party_id := case when new.mode='warehouse_request' and old.status='draft'
        then new_recipient_scope else new_sender_scope end;
    else
      actor_party_id := case when new.mode='warehouse_request' and new.status='draft'
        then new_recipient_scope else new_sender_scope end;
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

create or replace function public.import_material_receipt_from_excel(
  p_request_id uuid,
  p_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt_id uuid;
  v_version integer;
  v_line jsonb;
  v_item jsonb;
  v_line_id uuid;
  v_line_index integer := 0;
  v_item_index integer;
  v_material_id uuid;
  v_handover_id uuid;
  v_recipient uuid;
  v_items jsonb;
  v_group_items jsonb;
  v_linked_codes jsonb;
  v_image jsonb;
  v_request public.material_receipt_import_requests%rowtype;
  v_codes text[] := '{}';
  v_code text;
  v_has_recipients boolean;
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to manage material receipts' using errcode = '42501';
  end if;
  if p_request_id is null or jsonb_typeof(p_values) is distinct from 'object'
    or jsonb_typeof(p_values->'lines') is distinct from 'array' then
    raise exception 'Import request is invalid' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':' || p_request_id::text, 0)
  );
  select * into v_request from public.material_receipt_import_requests
  where actor_user_id = auth.uid() and request_id = p_request_id;
  if found then
    if v_request.payload is distinct from p_values then
      raise exception 'This import request ID was already used with different content' using errcode = '23505';
    end if;
    return v_request.receipt_id;
  end if;
  if nullif(p_values->>'warehouseId', '') is null
    or not public.has_scoped_permission('materials:receipt:manage', (p_values->>'warehouseId')::uuid)
    or not public.material_can_represent((p_values->>'warehouseId')::uuid) then
    raise exception 'You must represent the selected warehouse to import materials' using errcode = '42501';
  end if;
  select exists(select 1 from jsonb_array_elements(p_values->'lines') line(value)
    where nullif(line.value->>'receivingPartyId','') is not null) into v_has_recipients;
  if v_has_recipients and not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to create warehouse allocations' using errcode = '42501';
  end if;

  -- The established receipt save and confirm functions retain all model, material,
  -- history, and authorization rules. Any later failure rolls the whole transaction back.
  v_receipt_id := public.save_material_receipt(null, p_values);
  select version into v_version from public.material_receipts where id = v_receipt_id for update;

  for v_line in select value from jsonb_array_elements(p_values->'lines')
    order by (value->>'sortOrder')::integer nulls last
  loop
    v_line_index := v_line_index + 1;
    select id into v_line_id from public.material_receipt_lines
    where receipt_id = v_receipt_id and sort_order = v_line_index - 1 for update;
    if not found then
      raise exception 'Line % could not be matched while saving the receipt', v_line_index using errcode='40001';
    end if;
    v_recipient := nullif(v_line->>'receivingPartyId', '')::uuid;
    if v_recipient is not null and not exists (
      select 1 from public.material_custodians party
      where party.id = v_recipient and party.is_active
        and party.type in ('department','team','person','external')
    ) then
      raise exception 'Line % has an invalid or inactive receiving unit', v_line_index using errcode='22023';
    end if;
    if v_recipient is not null
      and (v_line#>>'{representative,materialValues,isActive}')::boolean is false then
      raise exception 'Line % is inactive and cannot be allocated', v_line_index using errcode='22023';
    end if;
    update public.material_receipt_lines set receiving_party_id = v_recipient where id = v_line_id;

    if jsonb_typeof(v_line->'representative') = 'object' then
      if jsonb_typeof(coalesce(v_line->'representative'->'images','[]'::jsonb)) is distinct from 'array' then
        raise exception 'Line % has invalid representative images', v_line_index using errcode='22023';
      end if;
      for v_image in select value from jsonb_array_elements(
        coalesce(v_line->'representative'->'images','[]'::jsonb)
      ) loop
        if v_image->>'storageBucket'='material-images'
          and nullif(v_image->>'storagePath','') is not null
          and v_image->>'storagePath' !~ (
            '^parties/' || (p_values->>'warehouseId')::uuid::text || '/objects/receipt-imports/'
            || auth.uid()::text || '/' || p_request_id::text || '/[^/]+$'
          ) then
          raise exception 'Line % image is outside this import request staging path',v_line_index
            using errcode='42501';
        end if;
        if v_image->>'storageBucket'='material-images'
          and nullif(v_image->>'storagePath','') is not null
          and not exists(select 1 from storage.objects object
            where object.bucket_id='material-images' and object.name=v_image->>'storagePath') then
          raise exception 'Line % image has not been uploaded to this import request',v_line_index
            using errcode='22023';
        end if;
      end loop;
      perform public.save_material_receipt_representative(
        v_receipt_id, v_line_id, v_version,
        v_line->'representative'->'materialValues',
        coalesce(v_line->'representative'->'images', '[]'::jsonb),
        coalesce(v_line->'representative'->'publicDisplaySettings', '{"basicInfo":false,"specifications":false}'::jsonb),
        coalesce(v_line->'representative'->'publicSpecificationSettings', '{}'::jsonb), null
      );
    end if;

    v_items := coalesce(v_line->'items', '[]'::jsonb);
    if jsonb_array_length(v_items) > 0 and jsonb_array_length(v_items) <> (v_line->>'quantity')::integer then
      raise exception 'Line % unit data does not match its quantity', v_line_index using errcode='22023';
    end if;
    for v_item_index in 0..(jsonb_array_length(v_items) - 1) loop
      v_item := v_items->v_item_index;
      -- A supplied internal code belongs to the representative unit only.
      v_code := case when v_item_index = 0 then nullif(btrim(v_item->>'code'), '') else null end;
      if v_code is not null then
        if lower(v_code) = any(v_codes) then
          raise exception 'Line % repeats internal code % in this file', v_line_index, v_code using errcode='23505';
        end if;
        if exists (select 1 from public.materials material where lower(btrim(material.code)) = lower(v_code)) then
          raise exception 'Line % internal code % already exists in the materials catalog', v_line_index, v_code using errcode='23505';
        end if;
        v_codes := array_append(v_codes, lower(v_code));
      end if;
      v_linked_codes := coalesce(v_item->'linkedCodes', '[]'::jsonb);
      if jsonb_typeof(v_linked_codes) is distinct from 'array' then
        raise exception 'Line % has invalid linked codes (expected an array)', v_line_index using errcode='22023';
      end if;
      if exists (
          select 1 from jsonb_array_elements(v_linked_codes) entry(value)
          where jsonb_typeof(entry.value) is distinct from 'object'
            or jsonb_typeof(entry.value->'label') is distinct from 'string'
            or jsonb_typeof(entry.value->'value') is distinct from 'string'
            or nullif(btrim(entry.value->>'label'),'') is null
            or nullif(btrim(entry.value->>'value'),'') is null
        ) or (select count(*) from jsonb_array_elements(v_linked_codes)) <>
          (select count(distinct lower(btrim(entry.value->>'value')))
            from jsonb_array_elements(v_linked_codes) entry(value)) then
        raise exception 'Line % has invalid linked codes (labels and values must be unique, non-empty text)', v_line_index
          using errcode='22023';
      end if;
    end loop;
  end loop;

  foreach v_code in array v_codes loop
    insert into private.material_receipt_import_reserved_codes(actor_user_id,request_id,code)
    values(auth.uid(),p_request_id,v_code);
  end loop;

  perform public.act_material_receipt(v_receipt_id, 'confirm', v_version, null);

  -- Apply inventory codes and the imported availability after stock generation.
  -- The unique materials code index remains the final concurrency guard.
  v_line_index := 0;
  for v_line in select value from jsonb_array_elements(p_values->'lines')
    order by (value->>'sortOrder')::integer nulls last
  loop
    v_line_index := v_line_index + 1;
    select id into v_line_id from public.material_receipt_lines
    where receipt_id = v_receipt_id and sort_order = v_line_index - 1;
    v_items := coalesce(v_line->'items', '[]'::jsonb);
    for v_item_index in 0..((v_line->>'quantity')::integer - 1) loop
      v_item := v_items->v_item_index;
      select material_id into v_material_id from public.material_receipt_items
      where line_id = v_line_id and status = 'active' and sort_order = v_item_index;
      select coalesce(jsonb_agg(jsonb_build_object(
        'label',btrim(entry.value->>'label'),'value',btrim(entry.value->>'value')
      ) order by entry.ordinality),'[]'::jsonb) into v_linked_codes
      from jsonb_array_elements(coalesce(v_item->'linkedCodes','[]'::jsonb))
        with ordinality entry(value,ordinality);
      update public.materials
      set code = case when v_item_index = 0 then coalesce(nullif(btrim(v_item->>'code'), ''), code) else code end,
        linked_codes = v_linked_codes,
        is_active = coalesce((v_line#>>'{representative,materialValues,isActive}')::boolean, is_active),
        updated_at = timezone('utc', now())
      where id = v_material_id;
      update public.material_receipt_items
      set material_snapshot = public.material_json(v_material_id), updated_at = timezone('utc', now())
      where material_id = v_material_id and receipt_id = v_receipt_id;
      update public.material_history set to_state = public.material_json(v_material_id)
      where id = (select history.id from public.material_history history
        where history.material_id = v_material_id order by history.created_at desc, history.id desc limit 1);
    end loop;
  end loop;

  -- One pending warehouse allocation per receiving unit; materials with no unit
  -- assignment remain owned and unreserved by the warehouse.
  for v_recipient in select distinct receiving_party_id from public.material_receipt_lines
    where receipt_id = v_receipt_id and receiving_party_id is not null
  loop
    select coalesce(jsonb_agg(jsonb_build_object('materialId', item.material_id,
      'condition', item.condition, 'note', coalesce(item.condition_note, item.note))
      order by line.sort_order, item.sort_order, item.id), '[]'::jsonb)
    into v_group_items
    from public.material_receipt_lines line
    join public.material_receipt_items item on item.line_id = line.id and item.status = 'active'
    join public.materials material on material.id = item.material_id
    where line.receipt_id = v_receipt_id and line.receiving_party_id = v_recipient;
    if jsonb_array_length(v_group_items) > 0 then
      v_handover_id := public.save_warehouse_handover(null, jsonb_build_object(
        'mode','warehouse_allocation','warehouseId',p_values->>'warehouseId',
        'recipientPartyId',v_recipient,'receiptId',v_receipt_id,'note','Excel allocation',
        'items',v_group_items));
      perform public.act_on_warehouse_handover(v_handover_id, 'send', 1, null, '[]'::jsonb);
    end if;
  end loop;

  delete from private.material_receipt_import_reserved_codes
  where actor_user_id=auth.uid() and request_id=p_request_id;

  insert into public.material_receipt_import_requests(actor_user_id, request_id, payload, receipt_id)
  values (auth.uid(), p_request_id, p_values, v_receipt_id);
  return v_receipt_id;
end;
$$;
revoke all on function public.import_material_receipt_from_excel(uuid, jsonb) from public, anon;
grant execute on function public.import_material_receipt_from_excel(uuid, jsonb) to authenticated;

create or replace function public.list_material_receipt_recipient_options(p_warehouse_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_has_receiving_warehouse boolean;
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to list receipt allocation recipients' using errcode='42501';
  end if;
  select exists(
    select 1 from public.material_custodians warehouse
    join public.material_warehouses detail on detail.custodian_id=warehouse.id
    where warehouse.type='warehouse' and warehouse.is_active
      and (p_warehouse_id is null or warehouse.id=p_warehouse_id)
      and public.has_scoped_permission('materials:receipt:manage',warehouse.id)
      and public.material_can_represent(warehouse.id)
  ) into v_has_receiving_warehouse;
  if not v_has_receiving_warehouse then
    raise exception 'You must represent an active warehouse with receipt management access' using errcode='42501';
  end if;
  if p_warehouse_id is not null and not exists(select 1 from public.material_custodians warehouse
    join public.material_warehouses detail on detail.custodian_id=warehouse.id
    where warehouse.id=p_warehouse_id and warehouse.type='warehouse' and warehouse.is_active) then
    raise exception 'Choose an active warehouse' using errcode='22023';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',party.id,'type',party.type,'code',party.code,'name',party.name,'parentId',party.parent_id
    ) order by case when party.is_active then 0 else 1 end,
      lower(party.name) collate "vi-x-icu",party.id)
    from public.material_custodians party
    where party.is_active and party.type in ('department','team','person','external')
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.list_material_receipt_recipient_options(uuid) from public, anon;
grant execute on function public.list_material_receipt_recipient_options(uuid) to authenticated;

create or replace function private.can_use_material_receipt_import_staging(
  p_storage_name text,
  p_require_unclaimed boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_warehouse_id uuid;
begin
  if auth.uid() is null
    or p_storage_name !~ ('^parties/[0-9a-fA-F-]{36}/objects/receipt-imports/'
      || auth.uid()::text || '/[0-9a-fA-F-]{36}/[^/]+$') then
    return false;
  end if;
  v_warehouse_id := private.material_image_upload_party_id(p_storage_name);
  if v_warehouse_id is null
    or not public.has_scoped_permission('materials:receipt:manage', v_warehouse_id)
    or not public.material_can_represent(v_warehouse_id)
    or not exists(select 1 from public.material_custodians warehouse
      join public.material_warehouses detail on detail.custodian_id=warehouse.id
      where warehouse.id=v_warehouse_id and warehouse.type='warehouse' and warehouse.is_active) then
    return false;
  end if;
  if p_require_unclaimed and (
    exists(select 1 from public.material_images image
      where image.storage_bucket='material-images' and image.storage_path=p_storage_name)
    or exists(select 1 from public.material_receipt_representatives representative
      cross join lateral jsonb_array_elements(representative.images) image(value)
      where image.value->>'storageBucket'='material-images'
        and image.value->>'storagePath'=p_storage_name)
  ) then
    return false;
  end if;
  return true;
end;
$$;
revoke all on function private.can_use_material_receipt_import_staging(text, boolean)
  from public, anon;
grant execute on function private.can_use_material_receipt_import_staging(text, boolean)
  to authenticated;

create or replace function private.can_view_material_receipt_import_image(p_storage_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and p_storage_name ~ ('^parties/[0-9a-fA-F-]{36}/objects/receipt-imports/'
      || '[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[^/]+$')
    and exists (
      select 1
      from public.material_receipt_representatives representative
      join public.material_receipt_lines line on line.id=representative.line_id
      join public.material_receipts receipt on receipt.id=line.receipt_id
      cross join lateral jsonb_array_elements(representative.images) image(value)
      where receipt.warehouse_id=private.material_image_upload_party_id(p_storage_name)
        and image.value->>'storageBucket'='material-images'
        and image.value->>'storagePath'=p_storage_name
        and (public.can_view_receipt(receipt.id)
          or public.has_scoped_permission('materials:receipt:manage',receipt.warehouse_id))
    );
$$;
revoke all on function private.can_view_material_receipt_import_image(text)
  from public, anon;
grant execute on function private.can_view_material_receipt_import_image(text)
  to authenticated;

-- These additive policies grant receipt-scoped users access only to their own
-- deterministic staging paths; normal material-image access remains unchanged.
drop policy if exists material_receipt_import_staging_select on storage.objects;
create policy material_receipt_import_staging_select on storage.objects
for select to authenticated using (
  bucket_id='material-images'
  and (private.can_use_material_receipt_import_staging(name, true)
    or private.can_view_material_receipt_import_image(name))
);
drop policy if exists material_receipt_import_staging_insert on storage.objects;
create policy material_receipt_import_staging_insert on storage.objects
for insert to authenticated with check (
  bucket_id='material-images'
  and private.can_use_material_receipt_import_staging(name, true)
);
drop policy if exists material_receipt_import_staging_delete on storage.objects;
create policy material_receipt_import_staging_delete on storage.objects
for delete to authenticated using (
  bucket_id='material-images'
  and private.can_use_material_receipt_import_staging(name, true)
);

create or replace function public.material_receipt_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
    'pendingAllocationItems',(select count(distinct item.material_id)
      from public.material_handover_items item join public.material_handovers handover on handover.id=item.handover_id
      where handover.receipt_id=r.id and handover.status in ('draft','pending','awaiting_warehouse_approval')),
    'allocationsClosed',(r.status in ('completed','cancelled')),
    'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'id',line.id,'modelId',line.model_id,'model',case when line.model_id is null then line.proposed_model else jsonb_build_object(
        'id',model.id,'code',model.code,'name',model.name,'groupId',model.group_id,
        'requiresInspection',model.requires_inspection,'externalCodes',model.external_codes,
        'specifications',model.specifications) end,
      'externalCode',line.external_code,'quantity',line.quantity,'sortOrder',line.sort_order,
      'receivingPartyId',line.receiving_party_id,
      'specificationOverrides',line.specification_overrides,
      'specificationOverrideLabels',line.specification_override_labels,
      'representative',case when representative.id is null then null else jsonb_build_object(
        'id',representative.id,'materialValues',representative.material_values,
        'images',representative.images,'publicDisplaySettings',representative.public_display_settings,
        'publicSpecificationSettings',representative.public_specification_settings) end,
      'items',coalesce((select jsonb_agg(jsonb_build_object(
        'id',item.id,'materialId',item.material_id,'representativeId',item.representative_id,
        'serialNumber',item.serial_number,'condition',item.condition,'conditionNote',item.condition_note,
        'note',item.note,'status',item.status,'voidReason',item.void_reason,'material',item.material_snapshot,
        'currentSpecificationOverrides',case when item.material_id is null then null else (
          select material.specification_overrides from public.materials material where material.id=item.material_id) end,
        'currentSpecificationOverrideLabels',case when item.material_id is null then null else (
          select material.specification_override_labels from public.materials material where material.id=item.material_id) end
      ) order by item.sort_order,item.id) from public.material_receipt_items item where item.line_id=line.id),'[]'::jsonb)
    ) order by line.sort_order,line.id) from public.material_receipt_lines line
      left join public.material_models model on model.id=line.model_id
      left join public.material_receipt_representatives representative on representative.line_id=line.id
      where line.receipt_id=r.id),'[]'::jsonb)
  ) from public.material_receipts r where r.id=p_id
$$;
revoke all on function public.material_receipt_json(uuid) from public, anon, authenticated;

alter function public.act_material_receipt(uuid, text, integer, text)
  rename to act_material_receipt_without_allocation_close;
revoke all on function public.act_material_receipt_without_allocation_close(uuid, text, integer, text)
  from public, anon, authenticated;

create or replace function public.act_material_receipt(
  p_id uuid,
  p_action text,
  p_expected_version integer,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.material_receipts%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if p_action <> 'complete' then
    return public.act_material_receipt_without_allocation_close(p_id, p_action, p_expected_version, p_reason);
  end if;
  if auth.uid() is null or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to manage material receipts' using errcode='42501';
  end if;
  select * into v_receipt from public.material_receipts where id=p_id for update;
  if not found then raise exception 'Material receipt not found' using errcode='P0002'; end if;
  if not public.has_scoped_permission('materials:receipt:manage', v_receipt.warehouse_id) then
    raise exception 'Receipt is outside the permitted management scope' using errcode='42501';
  end if;
  if v_receipt.version is distinct from p_expected_version then
    raise exception 'Receipt changed; reload before acting' using errcode='40001';
  end if;
  if v_receipt.status <> 'handover' then
    raise exception 'Only a receipt in handover status can close allocation' using errcode='55000';
  end if;
  v_before := public.material_receipt_json(p_id);
  update public.material_receipts set status='completed', completed_by=auth.uid(),
    completed_at=timezone('utc',now()), version=version+1, updated_at=timezone('utc',now())
  where id=p_id;
  v_after := public.material_receipt_json(p_id);
  insert into public.material_receipt_history(
    receipt_id,actor_user_id,action,from_status,to_status,before_state,after_state
  ) values (p_id,auth.uid(),'complete','handover','completed',v_before,v_after);
  return p_id;
end;
$$;
revoke all on function public.act_material_receipt(uuid, text, integer, text) from public, anon;
grant execute on function public.act_material_receipt(uuid, text, integer, text) to authenticated;

