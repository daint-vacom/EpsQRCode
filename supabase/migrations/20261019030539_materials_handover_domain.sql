-- Single-workspace materials, counterparties and handover lifecycle.
-- This migration is intended for the isolated EpsQRCode development project.

create table public.material_custodians (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('department','team','person','external')),
  code text not null,
  name text not null,
  parent_id uuid references public.material_custodians(id) on delete restrict,
  account_user_id uuid references auth.users(id) on delete set null,
  representative_user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint material_custodians_code_check check (length(btrim(code)) > 0),
  constraint material_custodians_name_check check (length(btrim(name)) > 0),
  constraint material_custodians_code_unique unique (code)
);

create index material_custodians_order_idx
  on public.material_custodians(is_active desc, lower(name) collate "vi-x-icu", id);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  model_id uuid not null references public.material_models(id) on delete restrict,
  model_snapshot jsonb not null check (jsonb_typeof(model_snapshot) = 'object'),
  name_override text,
  description_override text,
  image_url_override text,
  specification_overrides jsonb not null default '{}'::jsonb
    check (jsonb_typeof(specification_overrides) = 'object'),
  serial_number text,
  owner_party_id uuid not null references public.material_custodians(id) on delete restrict,
  borrower_party_id uuid references public.material_custodians(id) on delete restrict,
  condition text not null default 'good' check (condition in ('good','damaged')),
  condition_note text,
  status text not null default 'available' check (status in ('available','loaned')),
  active_loan_handover_id uuid,
  reserved_handover_id uuid,
  reservation_status text check (reservation_status in ('draft','pending')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint materials_code_not_blank check (length(btrim(code)) > 0),
  constraint materials_damage_note check (condition <> 'damaged' or nullif(btrim(condition_note),'') is not null),
  constraint materials_reservation_pair check ((reserved_handover_id is null) = (reservation_status is null)),
  constraint materials_loan_state check (
    (status = 'available' and active_loan_handover_id is null and borrower_party_id is null)
    or (status = 'loaned' and active_loan_handover_id is not null
      and borrower_party_id is not null and borrower_party_id <> owner_party_id)
  )
);
create unique index materials_code_ci_uq on public.materials(lower(btrim(code)));
create index materials_list_order_idx on public.materials(created_at desc, id);
create index materials_owner_idx on public.materials(owner_party_id, id);
create index materials_borrower_idx on public.materials(borrower_party_id, id) where borrower_party_id is not null;
create index materials_model_idx on public.materials(model_id, id);
create unique index materials_reservation_uq on public.materials(reserved_handover_id, id) where reserved_handover_id is not null;

create table public.material_handovers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('transfer','loan','return')),
  status text not null default 'draft' check (status in ('draft','pending','completed','rejected','cancelled')),
  sender_party_id uuid not null references public.material_custodians(id) on delete restrict,
  recipient_party_id uuid not null references public.material_custodians(id) on delete restrict,
  sender_party_snapshot jsonb not null default '{}'::jsonb,
  recipient_party_snapshot jsonb not null default '{}'::jsonb,
  sender_representative_user_id uuid references auth.users(id) on delete set null,
  recipient_representative_user_id uuid references auth.users(id) on delete set null,
  sender_representative_snapshot jsonb,
  recipient_representative_snapshot jsonb,
  planned_date date,
  due_date date,
  note text,
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  confirmed_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  constraint material_handovers_parties_differ check (sender_party_id <> recipient_party_id),
  constraint material_handovers_loan_due_date check (type <> 'loan' or due_date is not null)
);
create index material_handovers_list_idx on public.material_handovers(created_at desc, id);
create index material_handovers_parties_idx on public.material_handovers(sender_party_id, recipient_party_id, created_at desc);

create table public.material_handover_items (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.material_handovers(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  material_snapshot jsonb not null check (jsonb_typeof(material_snapshot) = 'object'),
  sender_condition text not null check (sender_condition in ('good','damaged')),
  sender_condition_note text,
  receiver_condition text check (receiver_condition is null or receiver_condition in ('good','damaged')),
  receiver_condition_note text,
  sort_order integer not null default 0,
  unique (handover_id, material_id),
  constraint handover_sender_damage_note check (sender_condition <> 'damaged' or nullif(btrim(sender_condition_note),'') is not null),
  constraint handover_receiver_damage_note check (receiver_condition <> 'damaged' or nullif(btrim(receiver_condition_note),'') is not null)
);
create index material_handover_items_material_idx on public.material_handover_items(material_id, handover_id);

create table public.material_history (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete restrict,
  actor_user_id uuid not null default auth.uid() references auth.users(id),
  action text not null check (action in ('created','updated','model_synced','handover')),
  note text,
  from_state jsonb,
  to_state jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);
create index material_history_order_idx on public.material_history(material_id, created_at desc, id);

create table public.material_handover_history (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.material_handovers(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id),
  action text not null check (action in ('created','updated','sent','confirmed','rejected','cancelled')),
  note text,
  from_status text,
  to_status text not null,
  created_at timestamptz not null default timezone('utc', now())
);
create index material_handover_history_order_idx on public.material_handover_history(handover_id, created_at, id);

alter table public.materials add constraint materials_active_loan_fk
  foreign key (active_loan_handover_id) references public.material_handovers(id) on delete restrict;
alter table public.materials add constraint materials_reserved_handover_fk
  foreign key (reserved_handover_id) references public.material_handovers(id) on delete restrict;

alter table public.material_custodians enable row level security;
alter table public.materials enable row level security;
alter table public.material_handovers enable row level security;
alter table public.material_handover_items enable row level security;
alter table public.material_history enable row level security;
alter table public.material_handover_history enable row level security;

create policy material_custodians_view on public.material_custodians for select to authenticated
using (public.has_permission('materials:custodian:view'));
create policy materials_view on public.materials for select to authenticated
using (public.has_permission('materials:material:view'));
create policy material_handovers_view on public.material_handovers for select to authenticated
using (public.has_permission('materials:handover:view'));
create policy material_handover_items_view on public.material_handover_items for select to authenticated
using (public.has_permission('materials:handover:view'));
create policy material_history_view on public.material_history for select to authenticated
using (public.has_permission('materials:material:view'));
create policy material_handover_history_view on public.material_handover_history for select to authenticated
using (public.has_permission('materials:handover:view'));

revoke all on public.material_custodians, public.materials, public.material_handovers,
  public.material_handover_items, public.material_history, public.material_handover_history
  from anon, authenticated;
grant select on public.material_custodians, public.materials, public.material_handovers,
  public.material_handover_items, public.material_history, public.material_handover_history
  to authenticated;

-- Permission catalog follows the existing account-level, single-workspace RBAC model.
insert into public.permission_modules(code,name,description,sort_order,is_active)
values ('materials','Vật tư','Quản lý tài sản và bàn giao vật tư.',25,true)
on conflict (code) do update set name=excluded.name,description=excluded.description,is_active=true;
insert into public.permission_groups(module_code,code,name,description,sort_order,is_active) values
 ('materials','material','Vật tư','Quản lý hồ sơ vật tư.',10,true),
 ('materials','handover','Bàn giao','Lập và xác nhận bàn giao.',20,true),
 ('materials','custodian','Đơn vị quản lý','Quản lý các bên tham gia.',30,true)
on conflict (module_code,code) do update set name=excluded.name,description=excluded.description,is_active=true;
insert into public.permission_definitions(code,module_code,group_name,group_id,name,action,sensitive,sort_order,is_active,tags)
select v.code,'materials',g.name,g.id,v.name,v.action,v.sensitive,v.sort_order,true,v.tags
from (values
 ('materials:material:view','material','Xem vật tư','view',false,10,array['Xem']::text[]),
 ('materials:material:manage','material','Quản lý vật tư','manage',true,20,array['Thêm','Sửa']::text[]),
 ('materials:handover:view','handover','Xem bàn giao','view',false,10,array['Xem']::text[]),
 ('materials:handover:manage','handover','Lập bàn giao','manage',true,20,array['Thêm','Sửa']::text[]),
 ('materials:custodian:view','custodian','Xem đơn vị quản lý','view',false,10,array['Xem']::text[]),
 ('materials:custodian:manage','custodian','Quản lý đơn vị','manage',true,20,array['Thêm','Sửa']::text[])
) as v(code,group_code,name,action,sensitive,sort_order,tags)
join public.permission_groups g on g.module_code='materials' and g.code=v.group_code
on conflict (code) do update set module_code=excluded.module_code,group_name=excluded.group_name,group_id=excluded.group_id,
  name=excluded.name,action=excluded.action,sensitive=excluded.sensitive,sort_order=excluded.sort_order,is_active=true,tags=excluded.tags;
insert into public.role_permissions(role_id,permission_code)
select r.id,p.code from public.roles r cross join public.permission_definitions p
where r.is_system and r.grant_all_permissions and p.module_code='materials'
on conflict do nothing;

-- Development-only seed counterparties. These are EpsQRCode-owned and contain no EPS records.
insert into public.material_custodians(type,code,name,is_active) values
 ('department','DEV-OPS','Phòng Vận hành',true),
 ('team','DEV-MAINT','Tổ Bảo trì',true),
 ('external','DEV-PARTNER','Đối tác thiết bị',true)
on conflict (code) do nothing;

create sequence public.material_handover_code_seq;

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
      'conditionNote',coalesce(i.receiver_condition_note,i.sender_condition_note),
      'senderCondition',i.sender_condition,'senderConditionNote',i.sender_condition_note
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
      or ((v_item->>'condition')='damaged' and nullif(btrim(v_item->>'conditionNote'),'') is null) then raise exception 'Material condition is invalid or damage note is missing' using errcode='22023'; end if;
    if v_type in ('transfer','loan') then
      if v_material.owner_party_id<>v_sender or v_material.status<>'available' then raise exception 'Transfer and loan require an available material owned by the sender' using errcode='55000'; end if;
    else
      if v_material.status<>'loaned' or v_material.borrower_party_id<>v_sender or v_material.owner_party_id<>v_recipient then raise exception 'Return must come from the current borrower to the owner' using errcode='55000'; end if;
    end if;
    v_snapshot:=public.material_json(v_material.id);
    insert into public.material_handover_items(handover_id,material_id,material_snapshot,sender_condition,sender_condition_note,sort_order)
      values(v_id,v_material.id,v_snapshot,v_item->>'condition',nullif(btrim(v_item->>'conditionNote'),''),v_index)
      on conflict(handover_id,material_id) do update set material_snapshot=excluded.material_snapshot,
        sender_condition=excluded.sender_condition,sender_condition_note=excluded.sender_condition_note,sort_order=excluded.sort_order;
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

create or replace function public.get_handover(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_permission('materials:handover:view') then raise exception 'Permission denied to view handovers' using errcode='42501'; end if;
  if not exists(select 1 from public.material_handovers where id=p_id) then raise exception 'Handover not found' using errcode='P0002'; end if;
  return public.handover_json(p_id);
end $$;

create or replace function public.list_handovers(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_page int:=greatest(coalesce((p_filters->>'page')::int,1),1); v_size int:=least(greatest(coalesce((p_filters->>'pageSize')::int,20),1),100); v_total int;
begin
  if auth.uid() is null or not public.has_permission('materials:handover:view') then raise exception 'Permission denied to view handovers' using errcode='42501'; end if;
  select count(*) into v_total from public.material_handovers h
    where (nullif(p_filters->>'type','') is null or h.type=p_filters->>'type')
      and (nullif(p_filters->>'status','') is null or h.status=p_filters->>'status')
      and (nullif(p_filters->>'senderPartyId','') is null or h.sender_party_id=(p_filters->>'senderPartyId')::uuid)
      and (nullif(p_filters->>'recipientPartyId','') is null or h.recipient_party_id=(p_filters->>'recipientPartyId')::uuid)
      and (nullif(p_filters->>'materialId','') is null or exists(select 1 from public.material_handover_items i where i.handover_id=h.id and i.material_id=(p_filters->>'materialId')::uuid))
      and (nullif(p_filters->>'dateFrom','') is null or h.created_at >= (p_filters->>'dateFrom')::date)
      and (nullif(p_filters->>'dateTo','') is null or h.created_at < (p_filters->>'dateTo')::date+1)
      and (nullif(p_filters->>'search','') is null or h.code ilike '%'||btrim(p_filters->>'search')||'%' or h.sender_party_snapshot->>'name' ilike '%'||btrim(p_filters->>'search')||'%' or h.recipient_party_snapshot->>'name' ilike '%'||btrim(p_filters->>'search')||'%');
  return jsonb_build_object('items',coalesce((select jsonb_agg(public.handover_json(q.id) order by q.created_at desc,q.id)
    from (select h.id,h.created_at from public.material_handovers h
      where (nullif(p_filters->>'type','') is null or h.type=p_filters->>'type')
        and (nullif(p_filters->>'status','') is null or h.status=p_filters->>'status')
        and (nullif(p_filters->>'senderPartyId','') is null or h.sender_party_id=(p_filters->>'senderPartyId')::uuid)
        and (nullif(p_filters->>'recipientPartyId','') is null or h.recipient_party_id=(p_filters->>'recipientPartyId')::uuid)
        and (nullif(p_filters->>'materialId','') is null or exists(select 1 from public.material_handover_items i where i.handover_id=h.id and i.material_id=(p_filters->>'materialId')::uuid))
        and (nullif(p_filters->>'dateFrom','') is null or h.created_at >= (p_filters->>'dateFrom')::date)
        and (nullif(p_filters->>'dateTo','') is null or h.created_at < (p_filters->>'dateTo')::date+1)
        and (nullif(p_filters->>'search','') is null or h.code ilike '%'||btrim(p_filters->>'search')||'%' or h.sender_party_snapshot->>'name' ilike '%'||btrim(p_filters->>'search')||'%' or h.recipient_party_snapshot->>'name' ilike '%'||btrim(p_filters->>'search')||'%')
      order by h.created_at desc,h.id offset (v_page-1)*v_size limit v_size) q),'[]'::jsonb),
    'total',v_total,'page',v_page,'pageSize',v_size);
end $$;

create or replace function public.act_on_handover(p_id uuid,p_action text,p_expected_version integer,p_note text default null,p_item_conditions jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_h public.material_handovers%rowtype; v_item record; v_before jsonb; v_to text; v_actor_party uuid;
  v_material_before jsonb; v_condition text; v_condition_note text;
begin
  if auth.uid() is null or not public.has_permission('materials:handover:manage') then raise exception 'Permission denied to manage handovers' using errcode='42501'; end if;
  select * into v_h from public.material_handovers where id=p_id for update;
  if not found then raise exception 'Handover not found' using errcode='P0002'; end if;
  if (p_action='confirm' and v_h.status='completed') or (p_action='reject' and v_h.status='rejected') or (p_action='cancel' and v_h.status='cancelled') or (p_action='send' and v_h.status='pending') then return p_id; end if;
  if v_h.version is distinct from p_expected_version then raise exception 'Handover changed; reload before acting' using errcode='40001'; end if;
  if p_action not in ('send','confirm','reject','cancel') then raise exception 'Unknown handover action' using errcode='22023'; end if;
  if p_action='confirm' and jsonb_typeof(p_item_conditions) is distinct from 'array' then raise exception 'Receiver conditions must be an array' using errcode='22023'; end if;
  if p_action='send' then
    if v_h.status<>'draft' or not public.material_can_represent(v_h.sender_party_id) then raise exception 'Only the represented sender can send a draft handover' using errcode='42501'; end if;
    if not exists(select 1 from public.material_handover_items where handover_id=p_id) then raise exception 'Handover has no materials' using errcode='22023'; end if;
    v_to:='pending';
  elsif p_action='cancel' then
    if v_h.status not in ('draft','pending') or not public.material_can_represent(v_h.sender_party_id) then raise exception 'Only the represented sender can cancel an open handover' using errcode='42501'; end if;
    if nullif(btrim(p_note),'') is null then raise exception 'A cancellation reason is required' using errcode='22023'; end if;
    v_to:='cancelled';
  elsif p_action='reject' then
    if v_h.status<>'pending' or not public.material_can_represent(v_h.recipient_party_id) then raise exception 'Only the represented receiver can reject a pending handover' using errcode='42501'; end if;
    if nullif(btrim(p_note),'') is null then raise exception 'A rejection reason is required' using errcode='22023'; end if;
    v_to:='rejected';
  else
    if v_h.status<>'pending' or not public.material_can_represent(v_h.recipient_party_id) then raise exception 'Only the represented receiver can confirm a pending handover' using errcode='42501'; end if;
    v_to:='completed';
  end if;
  v_before:=public.handover_json(p_id);
  if p_action='send' then
    update public.material_handovers set status='pending',version=version+1 where id=p_id;
    update public.materials set reservation_status='pending' where reserved_handover_id=p_id;
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note) values(p_id,auth.uid(),'sent',v_h.status,'pending',nullif(btrim(p_note),''));
  elsif p_action='confirm' then
    for v_item in select i.*,m.id as material_row_id from public.material_handover_items i join public.materials m on m.id=i.material_id where i.handover_id=p_id order by m.id for update of m loop
      v_material_before:=public.material_json(v_item.material_id);
      if not exists(select 1 from public.materials m where m.id=v_item.material_id and m.reserved_handover_id=p_id) then
        raise exception 'A handover material is no longer reserved by this document' using errcode='55000'; end if;
      if v_h.type in ('transfer','loan') and not exists(select 1 from public.materials m where m.id=v_item.material_id
        and m.owner_party_id=v_h.sender_party_id and m.status='available' and m.borrower_party_id is null and m.active_loan_handover_id is null) then
        raise exception 'Current material custody no longer matches the handover sender' using errcode='55000'; end if;
      if v_h.type='return' and not exists(select 1 from public.materials m where m.id=v_item.material_id
        and m.owner_party_id=v_h.recipient_party_id and m.borrower_party_id=v_h.sender_party_id
        and m.status='loaned' and m.active_loan_handover_id is not null) then
        raise exception 'Current loan no longer matches the return parties' using errcode='55000'; end if;
      v_condition:=v_item.sender_condition; v_condition_note:=v_item.sender_condition_note;
      if jsonb_typeof(p_item_conditions)='array' and jsonb_array_length(p_item_conditions)>0 then
        select x.value->>'condition',nullif(btrim(x.value->>'conditionNote'),'') into v_condition,v_condition_note
          from jsonb_array_elements(p_item_conditions) x(value) where x.value->>'materialId'=v_item.material_id::text;
      end if;
      if jsonb_typeof(p_item_conditions)='array' and jsonb_array_length(p_item_conditions)>0 then
        if (select count(*) from jsonb_array_elements(p_item_conditions)) <>
           (select count(*) from public.material_handover_items where handover_id=p_id)
          or (select count(distinct x.value->>'materialId') from jsonb_array_elements(p_item_conditions) x(value)) <>
             (select count(*) from jsonb_array_elements(p_item_conditions)) then
          raise exception 'Provide exactly one receiver condition for every material' using errcode='22023'; end if;
        if not exists(select 1 from jsonb_array_elements(p_item_conditions) x where x.value->>'materialId'=v_item.material_id::text) then
          raise exception 'A receiver condition is required for each material' using errcode='22023'; end if;
        if exists(select 1 from jsonb_array_elements(p_item_conditions) x where x.value->>'materialId'=v_item.material_id::text
          and ((x.value->>'condition') is distinct from 'good' and (x.value->>'condition') is distinct from 'damaged'
            or ((x.value->>'condition')='damaged' and nullif(btrim(x.value->>'conditionNote'),'') is null))) then
          raise exception 'Damaged materials require a receiver note' using errcode='22023'; end if;
        update public.material_handover_items i set receiver_condition=x.value->>'condition',receiver_condition_note=nullif(btrim(x.value->>'conditionNote'),'')
          from jsonb_array_elements(p_item_conditions) x(value) where i.handover_id=p_id and i.material_id=(x.value->>'materialId')::uuid;
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
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note) values(p_id,auth.uid(),'confirmed',v_h.status,'completed',nullif(btrim(p_note),''));
  else
    update public.material_handovers set status=v_to,version=version+1 where id=p_id;
    update public.materials set reserved_handover_id=null,reservation_status=null where reserved_handover_id=p_id;
    insert into public.material_handover_history(handover_id,actor_user_id,action,from_status,to_status,note)
      values(p_id,auth.uid(),case when p_action='reject' then 'rejected' else 'cancelled' end,v_h.status,v_to,nullif(btrim(p_note),''));
  end if;
  return p_id;
end $$;

create or replace function public.list_material_history(p_material_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then raise exception 'Permission denied to view material history' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'materialId',h.material_id,'actorUserId',h.actor_user_id,
    'action',h.action,'note',h.note,'fromState',h.from_state,'toState',h.to_state,'createdAt',h.created_at) order by h.created_at desc,h.id)
    from public.material_history h where h.material_id=p_material_id),'[]'::jsonb);
end $$;

create or replace function public.list_handover_history(p_handover_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_permission('materials:handover:view') then raise exception 'Permission denied to view handover history' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'handoverId',h.handover_id,'actorUserId',h.actor_user_id,
    'action',h.action,'note',h.note,'fromStatus',h.from_status,'toStatus',h.to_status,'createdAt',h.created_at) order by h.created_at,h.id)
    from public.material_handover_history h where h.handover_id=p_handover_id),'[]'::jsonb);
end $$;

create or replace function public.material_party_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'type',c.type)
  from public.material_custodians c where c.id=p_id
$$;

create or replace function public.material_can_represent(p_party_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.material_custodians c where c.id=p_party_id
      and (c.account_user_id=auth.uid() or c.representative_user_id=auth.uid())
  )
$$;

create or replace function public.material_model_snapshot(p_model_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',m.id,'code',m.code,'name',m.name,'groupId',m.group_id,
    'description',coalesce(m.description,''),'requiresInspection',m.requires_inspection,
    'specifications',m.specifications,'capturedAt',timezone('utc',now()),
    'images',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'storagePath',i.storage_path,'externalUrl',i.external_url,
      'sortOrder',i.sort_order,'isCover',i.is_cover) order by i.sort_order,i.id)
      from public.material_model_images i where i.model_id=m.id),'[]'::jsonb)
  ) from public.material_models m where m.id=p_model_id
$$;

create or replace function public.material_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',m.id,'code',m.code,'modelId',m.model_id,'modelSnapshot',m.model_snapshot,
    'nameOverride',m.name_override,'descriptionOverride',m.description_override,
    'imageUrlOverride',m.image_url_override,'specificationOverrides',m.specification_overrides,
    'serialNumber',m.serial_number,'ownerPartyId',m.owner_party_id,'borrowerPartyId',m.borrower_party_id,
    'condition',m.condition,'conditionNote',m.condition_note,'status',m.status,
    'activeLoanHandoverId',m.active_loan_handover_id,'reservedHandoverId',m.reserved_handover_id,
    'reservationStatus',m.reservation_status,'version',m.version,
    'createdAt',m.created_at,'updatedAt',m.updated_at
  ) from public.materials m where m.id=p_id
$$;

create or replace function public.material_spec_override_is_valid(p_spec jsonb,p_values jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_value jsonb; v_text text; v_type text; v_is_list boolean;
begin
  if p_spec is null or jsonb_typeof(p_values) is distinct from 'array' then return false; end if;
  v_type:=p_spec->>'dataType'; v_is_list:=coalesce((p_spec->>'isList')::boolean,false);
  if jsonb_array_length(p_values)=0 or (not v_is_list and jsonb_array_length(p_values)>1) then return false; end if;
  for v_value in select value from jsonb_array_elements(p_values) value loop
    if jsonb_typeof(v_value) is distinct from 'string' then return false; end if;
    v_text:=v_value#>>'{}';
    if nullif(btrim(v_text),'') is null then return false; end if;
    if v_type='number' and v_text !~ '^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$' then return false; end if;
    if v_type='boolean' and lower(v_text) not in ('true','false') then return false; end if;
    if v_type='date' and (v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(v_text::date,'YYYY-MM-DD')<>v_text) then return false; end if;
    if v_type='color' and v_text !~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$' then return false; end if;
    if v_type='length' and v_text !~ '^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)\s*(mm|cm|m|km)?$' then return false; end if;
    if v_type='weight' and v_text !~ '^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)\s*(mg|g|kg|t)?$' then return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.list_custodians(p_include_inactive boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (
    public.has_permission('materials:custodian:view')
    or public.has_permission('materials:material:view')
    or public.has_permission('materials:handover:view')
  ) then
    raise exception 'Permission denied to view custodians' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'type',c.type,'code',c.code,'name',c.name,'parentId',c.parent_id,
    'accountUserId',c.account_user_id,'representativeUserId',c.representative_user_id,
    'representativeDisplayName',coalesce(nullif(btrim(p.display_name),''),nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'')),
    'isActive',c.is_active,'createdAt',c.created_at,'updatedAt',c.updated_at
  ) order by case when c.is_active then 0 else 1 end, lower(c.name) collate "vi-x-icu",c.id)
    from public.material_custodians c left join public.user_profiles p on p.id=c.representative_user_id
    where p_include_inactive or c.is_active), '[]'::jsonb);
end $$;

create or replace function public.save_custodian(p_id uuid,p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_parent uuid; v_account uuid; v_rep uuid; v_type text;
begin
  if auth.uid() is null or not public.has_permission('materials:custodian:manage') then
    raise exception 'Permission denied to manage custodians' using errcode='42501';
  end if;
  v_type:=p_values->>'type';
  if v_type not in ('department','team','person','external') then raise exception 'Invalid custodian type' using errcode='22023'; end if;
  v_parent:=nullif(p_values->>'parentId','')::uuid;
  v_account:=nullif(p_values->>'accountUserId','')::uuid;
  v_rep:=nullif(p_values->>'representativeUserId','')::uuid;
  if v_account is not null and not exists(select 1 from public.user_profiles where id=v_account and status='active') then
    raise exception 'Account link must reference an active EpsQRCode profile' using errcode='22023';
  end if;
  if v_rep is not null and not exists(select 1 from public.user_profiles where id=v_rep and status='active') then
    raise exception 'Representative must reference an active EpsQRCode profile' using errcode='22023';
  end if;
  if v_parent=p_id then raise exception 'Custodian cannot be its own parent' using errcode='22023'; end if;
  if v_parent is not null and exists(
    with recursive ancestors(id,parent_id) as (
      select id,parent_id from public.material_custodians where id=v_parent
      union all select c.id,c.parent_id from public.material_custodians c join ancestors a on c.id=a.parent_id
    ) select 1 from ancestors where id=p_id
  ) then raise exception 'Custodian hierarchy cannot contain a cycle' using errcode='22023'; end if;
  if p_id is null then
    insert into public.material_custodians(type,code,name,parent_id,account_user_id,representative_user_id,is_active)
    values(v_type,btrim(p_values->>'code'),btrim(p_values->>'name'),v_parent,v_account,v_rep,coalesce((p_values->>'isActive')::boolean,true)) returning id into v_id;
  else
    update public.material_custodians set type=v_type,code=btrim(p_values->>'code'),name=btrim(p_values->>'name'),
      parent_id=v_parent,account_user_id=v_account,representative_user_id=v_rep,is_active=coalesce((p_values->>'isActive')::boolean,true),
      updated_at=timezone('utc',now()) where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Custodian not found' using errcode='P0002'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.get_material(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then raise exception 'Permission denied to view materials' using errcode='42501'; end if;
  if not exists(select 1 from public.materials where id=p_id) then raise exception 'Material not found' using errcode='P0002'; end if;
  return public.material_json(p_id);
end $$;

create or replace function public.list_materials(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_page int:=greatest(coalesce((p_filters->>'page')::int,1),1); v_size int:=least(greatest(coalesce((p_filters->>'pageSize')::int,20),1),100); v_total int;
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then raise exception 'Permission denied to view materials' using errcode='42501'; end if;
  select count(*) into v_total from public.materials m
    where (nullif(p_filters->>'modelId','') is null or m.model_id=(p_filters->>'modelId')::uuid)
      and (nullif(p_filters->>'groupId','') is null or m.model_snapshot->>'groupId'=p_filters->>'groupId')
      and (nullif(p_filters->>'ownerPartyId','') is null or m.owner_party_id=(p_filters->>'ownerPartyId')::uuid)
      and (nullif(p_filters->>'borrowerPartyId','') is null or m.borrower_party_id=(p_filters->>'borrowerPartyId')::uuid)
      and (nullif(p_filters->>'status','') is null or m.status=p_filters->>'status')
      and (nullif(p_filters->>'condition','') is null or m.condition=p_filters->>'condition')
      and (nullif(p_filters->>'search','') is null or concat_ws(' ',m.code,m.serial_number,m.name_override,m.model_snapshot->>'name') ilike '%'||btrim(p_filters->>'search')||'%')
      and (nullif(p_filters->>'updatedFrom','') is null or m.updated_at >= (p_filters->>'updatedFrom')::timestamptz)
      and (nullif(p_filters->>'updatedTo','') is null or m.updated_at < (p_filters->>'updatedTo')::timestamptz + interval '1 day');
  return jsonb_build_object('items',coalesce((select jsonb_agg(public.material_json(page.id) order by page.created_at desc,page.id)
    from (select m.id,m.created_at from public.materials m
      where (nullif(p_filters->>'modelId','') is null or m.model_id=(p_filters->>'modelId')::uuid)
        and (nullif(p_filters->>'groupId','') is null or m.model_snapshot->>'groupId'=p_filters->>'groupId')
        and (nullif(p_filters->>'ownerPartyId','') is null or m.owner_party_id=(p_filters->>'ownerPartyId')::uuid)
        and (nullif(p_filters->>'borrowerPartyId','') is null or m.borrower_party_id=(p_filters->>'borrowerPartyId')::uuid)
        and (nullif(p_filters->>'status','') is null or m.status=p_filters->>'status')
        and (nullif(p_filters->>'condition','') is null or m.condition=p_filters->>'condition')
        and (nullif(p_filters->>'search','') is null or concat_ws(' ',m.code,m.serial_number,m.name_override,m.model_snapshot->>'name') ilike '%'||btrim(p_filters->>'search')||'%')
        and (nullif(p_filters->>'updatedFrom','') is null or m.updated_at >= (p_filters->>'updatedFrom')::timestamptz)
        and (nullif(p_filters->>'updatedTo','') is null or m.updated_at < (p_filters->>'updatedTo')::timestamptz + interval '1 day')
      order by m.created_at desc,m.id offset (v_page-1)*v_size limit v_size) page),'[]'::jsonb),
    'total',v_total,'page',v_page,'pageSize',v_size);
end $$;

create or replace function public.save_material(p_id uuid,p_expected_version integer,p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_row public.materials%rowtype; v_id uuid; v_model_id uuid; v_owner uuid;
  v_snapshot jsonb; v_overrides jsonb; v_override record; v_spec jsonb; v_source_model public.material_models%rowtype;
  v_condition text; v_note text; v_before jsonb;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then raise exception 'Permission denied to manage materials' using errcode='42501'; end if;
  if p_id is not null then
    select * into v_row from public.materials where id=p_id for update;
    if not found then raise exception 'Material not found' using errcode='P0002'; end if;
  end if;
  v_model_id:=nullif(p_values->>'modelId','')::uuid;
  v_owner:=nullif(p_values->>'ownerPartyId','')::uuid;
  v_condition:=coalesce(p_values->>'condition','good');
  v_note:=nullif(btrim(p_values->>'conditionNote'),'');
  v_overrides:=coalesce(p_values->'specificationOverrides','{}'::jsonb);
  if jsonb_typeof(v_overrides) is distinct from 'object' then raise exception 'Specification overrides must be an object' using errcode='22023'; end if;
  if v_condition not in ('good','damaged') or (v_condition='damaged' and v_note is null) then raise exception 'Damaged materials require a condition note' using errcode='22023'; end if;
  if v_model_id is null then raise exception 'Material model not found' using errcode='P0002'; end if;
  select * into v_source_model from public.material_models where id=v_model_id;
  if not found then raise exception 'Material model not found' using errcode='P0002'; end if;
  if p_id is null and not v_source_model.is_active then raise exception 'Only active models can be used for new materials' using errcode='22023'; end if;
  if v_owner is null or not exists(select 1 from public.material_custodians where id=v_owner and is_active) then raise exception 'An active owner party is required' using errcode='22023'; end if;
  if not public.material_can_represent(v_owner) then raise exception 'You must represent the owner party' using errcode='42501'; end if;
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
    insert into public.materials(code,model_id,model_snapshot,name_override,description_override,image_url_override,
      specification_overrides,serial_number,owner_party_id,condition,condition_note)
    values(btrim(p_values->>'code'),v_model_id,v_snapshot,nullif(btrim(p_values->>'nameOverride'),''),
      nullif(btrim(p_values->>'descriptionOverride'),''),nullif(btrim(p_values->>'imageUrlOverride'),''),
      v_overrides,nullif(btrim(p_values->>'serialNumber'),''),v_owner,v_condition,v_note)
    returning id into v_id;
    insert into public.material_history(material_id,action,to_state) values(v_id,'created',public.material_json(v_id));
  else
    if v_row.version is distinct from p_expected_version then raise exception 'Material changed; reload before saving' using errcode='40001'; end if;
    if v_row.code is distinct from btrim(p_values->>'code') then raise exception 'Material code is immutable' using errcode='22023'; end if;
    if v_row.model_id<>v_model_id or v_row.owner_party_id<>v_owner or v_row.condition<>v_condition
       or v_row.borrower_party_id is not null or v_row.active_loan_handover_id is not null
       or v_row.reserved_handover_id is not null then
      raise exception 'Model, owner, condition and handover state cannot be edited directly' using errcode='22023';
    end if;
    v_before:=public.material_json(p_id);
    update public.materials set name_override=nullif(btrim(p_values->>'nameOverride'),''),
      description_override=nullif(btrim(p_values->>'descriptionOverride'),''),image_url_override=nullif(btrim(p_values->>'imageUrlOverride'),''),
      specification_overrides=v_overrides,serial_number=nullif(btrim(p_values->>'serialNumber'),''),version=version+1,
      updated_at=timezone('utc',now()) where id=p_id returning id into v_id;
    insert into public.material_history(material_id,action,from_state,to_state) values(v_id,'updated',v_before,public.material_json(v_id));
  end if;
  return v_id;
end $$;

create or replace function public.preview_material_model_sync(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.materials%rowtype; v_new jsonb;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then raise exception 'Permission denied to manage materials' using errcode='42501'; end if;
  select * into v_row from public.materials where id=p_id;
  if not found then raise exception 'Material not found' using errcode='P0002'; end if;
  if not public.material_can_represent(v_row.owner_party_id) then raise exception 'You must represent the owner party' using errcode='42501'; end if;
  v_new:=public.material_model_snapshot(v_row.model_id);
  return jsonb_build_object('materialId',v_row.id,'currentSnapshot',v_row.model_snapshot,'proposedSnapshot',v_new,
    'modelUpdatedAt',(select m.updated_at from public.material_models m where m.id=v_row.model_id),
    'preservedOverrides',coalesce((select jsonb_agg(key) from jsonb_object_keys(v_row.specification_overrides) key),'[]'::jsonb),
    'changedFields',coalesce((select jsonb_agg(f.name) from (values
      ('code',v_row.model_snapshot->'code',v_new->'code'),('name',v_row.model_snapshot->'name',v_new->'name'),
      ('groupId',v_row.model_snapshot->'groupId',v_new->'groupId'),('description',v_row.model_snapshot->'description',v_new->'description'),
      ('requiresInspection',v_row.model_snapshot->'requiresInspection',v_new->'requiresInspection'),
      ('specifications',v_row.model_snapshot->'specifications',v_new->'specifications'),('images',v_row.model_snapshot->'images',v_new->'images')
    ) f(name,old_value,new_value) where f.old_value is distinct from f.new_value),'[]'::jsonb));
end $$;

create or replace function public.apply_material_model_sync(p_id uuid,p_expected_version integer,p_expected_model_updated_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_row public.materials%rowtype; v_before jsonb; v_new jsonb; v_new_overrides jsonb:='{}'::jsonb; v_key text; v_spec jsonb;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then raise exception 'Permission denied to manage materials' using errcode='42501'; end if;
  select * into v_row from public.materials where id=p_id for update;
  if not found then raise exception 'Material not found' using errcode='P0002'; end if;
  if v_row.version is distinct from p_expected_version then raise exception 'Material changed; reload before syncing' using errcode='40001'; end if;
  if p_expected_model_updated_at is null or (select m.updated_at from public.material_models m where m.id=v_row.model_id) is distinct from p_expected_model_updated_at then
    raise exception 'Model changed after preview; reload the sync preview' using errcode='40001'; end if;
  if not public.material_can_represent(v_row.owner_party_id) then raise exception 'You must represent the owner party' using errcode='42501'; end if;
  if v_row.reserved_handover_id is not null then raise exception 'Material is reserved by an open handover' using errcode='55000'; end if;
  v_before:=public.material_json(p_id); v_new:=public.material_model_snapshot(v_row.model_id);
  for v_key in select jsonb_object_keys(v_row.specification_overrides) loop
    select s.value into v_spec from jsonb_array_elements(v_new->'specifications') s(value) where s.value->>'id'=v_key;
    if v_spec is null or not public.material_spec_override_is_valid(v_spec,v_row.specification_overrides->v_key) then
      raise exception 'The model removed or changed an overridden specification; resolve overrides before syncing' using errcode='22023';
    end if;
    v_new_overrides:=v_new_overrides||jsonb_build_object(v_key,v_row.specification_overrides->v_key);
  end loop;
  update public.materials set model_snapshot=v_new,specification_overrides=v_new_overrides,version=version+1,updated_at=timezone('utc',now()) where id=p_id;
  insert into public.material_history(material_id,action,note,from_state,to_state)
  values(p_id,'model_synced','Đồng bộ phiên bản mẫu vật tư',v_before,public.material_json(p_id));
  return p_id;
end $$;

-- Restrict executable entry points. Definer helpers are callable only from RPCs.
revoke all on function public.handover_json(uuid), public.material_party_json(uuid),
  public.material_can_represent(uuid), public.material_model_snapshot(uuid), public.material_json(uuid),
  public.material_spec_override_is_valid(jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.list_custodians(boolean), public.save_custodian(uuid,jsonb),
  public.get_material(uuid), public.list_materials(jsonb), public.save_material(uuid,integer,jsonb),
  public.preview_material_model_sync(uuid), public.apply_material_model_sync(uuid,integer,timestamptz),
  public.get_handover(uuid), public.list_handovers(jsonb), public.save_handover(uuid,jsonb),
  public.act_on_handover(uuid,text,integer,text,jsonb), public.list_material_history(uuid),
  public.list_handover_history(uuid) from public, anon;
grant execute on function public.list_custodians(boolean), public.save_custodian(uuid,jsonb),
  public.get_material(uuid), public.list_materials(jsonb), public.save_material(uuid,integer,jsonb),
  public.preview_material_model_sync(uuid), public.apply_material_model_sync(uuid,integer,timestamptz),
  public.get_handover(uuid), public.list_handovers(jsonb), public.save_handover(uuid,jsonb),
  public.act_on_handover(uuid,text,integer,text,jsonb), public.list_material_history(uuid),
  public.list_handover_history(uuid) to authenticated;
revoke all on sequence public.material_handover_code_seq from public, anon, authenticated;

notify pgrst, 'reload schema';
