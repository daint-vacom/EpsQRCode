-- Development-only material receipt and warehouse workflow.
-- Warehouses are custodian parties so inventory ownership and handovers share one identity.

alter table public.material_custodians
  drop constraint if exists material_custodians_type_check;
alter table public.material_custodians
  add constraint material_custodians_type_check
  check (type in ('department','team','person','external','warehouse'));

create table public.material_warehouses (
  custodian_id uuid primary key references public.material_custodians(id) on delete restrict,
  address text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint material_warehouses_address_length check (length(address) <= 1000)
);

create table public.material_warehouse_accounts (
  warehouse_id uuid not null references public.material_warehouses(custodian_id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (warehouse_id, user_id)
);
create index material_warehouse_accounts_user_idx
  on public.material_warehouse_accounts(user_id, warehouse_id);
alter table public.material_warehouses enable row level security;
alter table public.material_warehouse_accounts enable row level security;
revoke all on public.material_warehouses, public.material_warehouse_accounts
  from public, anon, authenticated;

create or replace function public.material_can_represent(p_party_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.material_custodians c
    join public.user_profiles profile on profile.id=auth.uid() and profile.status='active'
    where c.id=p_party_id and c.is_active
      and (
        c.account_user_id=auth.uid()
        or c.representative_user_id=auth.uid()
        or exists (
          select 1 from public.material_warehouse_accounts a
          where a.warehouse_id=c.id and a.user_id=auth.uid()
        )
      )
  )
$$;
revoke all on function public.material_can_represent(uuid) from public,anon,authenticated;

alter table public.material_models
  add column if not exists external_codes text[] not null default '{}'::text[];

create table public.material_model_external_codes (
  normalized_code text primary key,
  display_code text not null,
  model_id uuid not null references public.material_models(id) on delete cascade,
  sort_order integer not null check (sort_order >= 0),
  constraint material_model_external_codes_not_blank check (length(normalized_code) > 0),
  unique (model_id, sort_order)
);
create index material_model_external_codes_model_idx
  on public.material_model_external_codes(model_id, sort_order);
alter table public.material_model_external_codes enable row level security;
revoke all on public.material_model_external_codes from public, anon, authenticated;

create or replace function private.sync_material_model_external_codes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_normalized text;
  v_index integer := 0;
begin
  if new.external_codes is null then
    raise exception 'External codes must be a text array' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(new.code)), 0));
  if exists (
    select 1 from unnest(new.external_codes) as supplied(code)
    where nullif(btrim(supplied.code), '') is null
  ) then
    raise exception 'External codes cannot be blank' using errcode='22023';
  end if;
  if exists (
    select lower(btrim(code)) from unnest(new.external_codes) as supplied(code)
    group by lower(btrim(code)) having count(*) > 1
  ) then
    raise exception 'External codes must be unique ignoring letter case' using errcode='23505';
  end if;
  if exists (
    select 1 from public.material_models other_model
    where other_model.id<>new.id and lower(btrim(other_model.code))=lower(btrim(new.code))
  ) then raise exception 'Material model codes must be unique ignoring letter case' using errcode='23505'; end if;
  if exists (
    select 1 from public.material_model_external_codes x
    where x.normalized_code=lower(btrim(new.code)) and x.model_id<>new.id
  ) then raise exception 'A material model code cannot equal another model external code' using errcode='23505'; end if;

  delete from public.material_model_external_codes where model_id=new.id;
  for v_code in select btrim(code) from unnest(new.external_codes) with ordinality as supplied(code,ordinality) order by ordinality loop
    v_normalized := lower(v_code);
    perform pg_advisory_xact_lock(hashtextextended(v_normalized, 0));
    if exists (
      select 1 from public.material_models other_model
      where other_model.id <> new.id and lower(btrim(other_model.code))=v_normalized
    ) then
      raise exception 'An external code cannot equal another model code' using errcode='23505';
    end if;
    insert into public.material_model_external_codes(normalized_code,display_code,model_id,sort_order)
      values(v_normalized,v_code,new.id,v_index);
    v_index := v_index + 1;
  end loop;
  new.external_codes := coalesce((
    select array_agg(btrim(code) order by ordinality)
    from unnest(new.external_codes) with ordinality as supplied(code,ordinality)
  ), '{}'::text[]);
  return new;
end $$;
revoke all on function private.sync_material_model_external_codes() from public, anon, authenticated;
create trigger material_models_sync_external_codes
before insert or update of code, external_codes on public.material_models
for each row execute function private.sync_material_model_external_codes();

create or replace function public.find_material_model_by_external_code(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not (
    public.has_permission('material_catalog:material_model:view')
    or public.has_permission('materials:receipt:view')
    or public.has_permission('materials:receipt:manage')
  ) then
    raise exception 'Permission denied to find material models' using errcode='42501';
  end if;
  if nullif(btrim(p_code), '') is null then
    return null;
  end if;
  select jsonb_build_object(
    'id',m.id,'code',m.code,'name',m.name,'externalCodes',m.external_codes,
    'groupId',m.group_id,'description',coalesce(m.description,''),
    'requiresInspection',m.requires_inspection,'specifications',m.specifications,
    'isActive',m.is_active
  ) into v_result
  from public.material_models m
  where m.is_active and (lower(btrim(m.code))=lower(btrim(p_code)) or exists(
    select 1 from public.material_model_external_codes x
    where x.model_id=m.id and x.normalized_code=lower(btrim(p_code))
  ));
  return v_result;
end $$;

revoke all on function public.find_material_model_by_external_code(text) from public, anon;
grant execute on function public.find_material_model_by_external_code(text) to authenticated;

drop function if exists public.save_material_model(uuid,text,text,text,boolean,jsonb);
alter function public.save_material_model(uuid,text,text,text,uuid,boolean,jsonb,jsonb)
  rename to save_material_model_core;
create function public.save_material_model(
  p_id uuid,
  p_code text,
  p_name text,
  p_group_id uuid,
  p_description text,
  p_requires_inspection boolean,
  p_specifications jsonb,
  p_images jsonb,
  p_external_codes text[] default '{}'::text[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  v_id := public.save_material_model_core(p_id,p_code,p_name,p_description,p_group_id,
    p_requires_inspection,p_specifications,p_images);
  update public.material_models
  set external_codes=coalesce(p_external_codes,'{}'::text[])
  where id=v_id;
  return v_id;
end $$;
revoke all on function public.save_material_model_core(uuid,text,text,text,uuid,boolean,jsonb,jsonb)
  from public,anon,authenticated;
revoke all on function public.save_material_model(uuid,text,text,uuid,text,boolean,jsonb,jsonb,text[])
  from public, anon;
grant execute on function public.save_material_model(uuid,text,text,uuid,text,boolean,jsonb,jsonb,text[])
  to authenticated;

create or replace function public.material_model_snapshot(p_model_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',m.id,'code',m.code,'name',m.name,'groupId',m.group_id,
    'description',coalesce(m.description,''),'requiresInspection',m.requires_inspection,
    'specifications',m.specifications,'externalCodes',m.external_codes,
    'capturedAt',timezone('utc',now()),
    'images',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'storagePath',i.storage_path,'externalUrl',i.external_url,
      'sortOrder',i.sort_order,'isCover',i.is_cover) order by i.sort_order,i.id)
      from public.material_model_images i where i.model_id=m.id),'[]'::jsonb)
  ) from public.material_models m where m.id=p_model_id
$$;

create or replace function public.material_party_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',c.id,'type',c.type,'code',c.code,'name',c.name,'parentId',c.parent_id,
    'accountUserId',c.account_user_id,
    'accountUserIds',case when c.type='warehouse' then coalesce((
      select jsonb_agg(a.user_id order by a.user_id) from public.material_warehouse_accounts a
      where a.warehouse_id=c.id),'[]'::jsonb)
      else case when c.account_user_id is null then '[]'::jsonb else jsonb_build_array(c.account_user_id) end end,
    'representativeUserId',c.representative_user_id,
    'isActive',c.is_active
  ) from public.material_custodians c where c.id=p_id
$$;
revoke all on function public.material_party_json(uuid) from public,anon,authenticated;
revoke all on function public.material_model_snapshot(uuid) from public,anon,authenticated;

create or replace function public.list_custodians(p_include_inactive boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (
    public.has_permission('materials:custodian:view')
    or public.has_permission('materials:material:view')
    or public.has_permission('materials:handover:view')
    or public.has_permission('materials:handover:manage')
    or public.has_permission('materials:warehouse:view')
    or public.has_permission('materials:receipt:view')
    or public.has_permission('materials:receipt:manage')
  ) then
    raise exception 'Permission denied to view custodians' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'type',c.type,'code',c.code,'name',c.name,'parentId',c.parent_id,
    'accountUserId',c.account_user_id,
    'accountUserIds',case when c.type='warehouse' then coalesce((
      select jsonb_agg(a.user_id order by a.user_id) from public.material_warehouse_accounts a
      where a.warehouse_id=c.id),'[]'::jsonb)
      else case when c.account_user_id is null then '[]'::jsonb else jsonb_build_array(c.account_user_id) end end,
    'representativeUserId',c.representative_user_id,
    'representativeDisplayName',coalesce(nullif(btrim(p.display_name),''),nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'')),
    'isActive',c.is_active,'createdAt',c.created_at,'updatedAt',c.updated_at
  ) order by case when c.is_active then 0 else 1 end,lower(c.name) collate "vi-x-icu",c.id)
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
  if p_id is not null and exists(select 1 from public.material_custodians where id=p_id and type='warehouse') then
    raise exception 'Use save_material_warehouse to update a warehouse' using errcode='42501';
  end if;
  v_type:=p_values->>'type';
  if v_type not in ('department','team','person','external') then raise exception 'Invalid custodian type' using errcode='22023'; end if;
  v_parent:=nullif(p_values->>'parentId','')::uuid;
  v_account:=nullif(p_values->>'accountUserId','')::uuid;
  v_rep:=nullif(p_values->>'representativeUserId','')::uuid;
  if v_account is not null and not exists(select 1 from public.user_profiles where id=v_account and status='active') then
    raise exception 'Account link must reference an active EpsQRCode profile' using errcode='22023'; end if;
  if v_rep is not null and not exists(select 1 from public.user_profiles where id=v_rep and status='active') then
    raise exception 'Representative must reference an active EpsQRCode profile' using errcode='22023'; end if;
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

create or replace function public.save_material_warehouse(p_id uuid,p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user_id uuid; v_accounts jsonb;
begin
  if auth.uid() is null or not public.has_permission('materials:warehouse:manage') then
    raise exception 'Permission denied to manage warehouses' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_values->'accountUserIds','[]'::jsonb)) is distinct from 'array' then
    raise exception 'Warehouse accounts must be an array' using errcode='22023';
  end if;
  v_accounts:=coalesce(p_values->'accountUserIds','[]'::jsonb);
  if exists(select 1 from jsonb_array_elements(v_accounts) x where jsonb_typeof(x.value) is distinct from 'string') then
    raise exception 'Warehouse account IDs must be strings' using errcode='22023';
  end if;
  if (select count(*) from jsonb_array_elements(v_accounts))<>
     (select count(distinct x.value#>>'{}') from jsonb_array_elements(v_accounts) x) then
    raise exception 'A warehouse account can only be assigned once' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements_text(v_accounts) x
    where not exists(select 1 from public.user_profiles p where p.id=x.value::uuid and p.status='active')) then
    raise exception 'Warehouse accounts must reference active EpsQRCode profiles' using errcode='22023';
  end if;
  if p_id is null then
    insert into public.material_custodians(type,code,name,parent_id,account_user_id,representative_user_id,is_active)
      values('warehouse',btrim(p_values->>'code'),btrim(p_values->>'name'),null,null,null,coalesce((p_values->>'isActive')::boolean,true))
      returning id into v_id;
    insert into public.material_warehouses(custodian_id,address) values(v_id,btrim(coalesce(p_values->>'address','')));
  else
    select c.id into v_id from public.material_custodians c
    join public.material_warehouses w on w.custodian_id=c.id
    where c.id=p_id and c.type='warehouse' for update of c,w;
    if v_id is null then raise exception 'Warehouse not found' using errcode='P0002'; end if;
    update public.material_custodians set code=btrim(p_values->>'code'),name=btrim(p_values->>'name'),
      is_active=coalesce((p_values->>'isActive')::boolean,true),updated_at=timezone('utc',now()) where id=v_id;
    update public.material_warehouses set address=btrim(coalesce(p_values->>'address','')),
      updated_at=timezone('utc',now()) where custodian_id=v_id;
    delete from public.material_warehouse_accounts where warehouse_id=v_id;
  end if;
  for v_user_id in select x.value::uuid from jsonb_array_elements_text(v_accounts) x loop
    insert into public.material_warehouse_accounts(warehouse_id,user_id) values(v_id,v_user_id);
  end loop;
  return v_id;
end $$;

create or replace function public.list_material_warehouses(p_include_inactive boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (
    public.has_permission('materials:warehouse:view') or public.has_permission('materials:warehouse:manage')
    or public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage')
    or public.has_permission('materials:handover:view') or public.has_permission('materials:handover:manage')
  ) then raise exception 'Permission denied to view warehouses' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'type',c.type,'code',c.code,'name',c.name,'address',w.address,
    'accountUserIds',coalesce((select jsonb_agg(a.user_id order by a.user_id)
      from public.material_warehouse_accounts a where a.warehouse_id=c.id),'[]'::jsonb),
    'isActive',c.is_active,'createdAt',c.created_at,'updatedAt',c.updated_at
  ) order by case when c.is_active then 0 else 1 end,lower(c.name) collate "vi-x-icu",c.id)
    from public.material_warehouses w join public.material_custodians c on c.id=w.custodian_id
    where p_include_inactive or c.is_active),'[]'::jsonb);
end $$;

create or replace function public.list_custodian_account_options()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (
    public.has_permission('materials:custodian:manage') or public.has_permission('materials:warehouse:manage')
  ) then raise exception 'Permission denied to configure custodian representatives' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',profile.id,'username',profile.username,'displayName',coalesce(
      nullif(btrim(profile.display_name),''),nullif(btrim(concat_ws(' ',profile.first_name,profile.last_name)),''),
      nullif(btrim(profile.username),''),profile.id::text
    )
  ) order by lower(coalesce(nullif(btrim(profile.display_name),''),profile.username,profile.id::text)) collate "vi-x-icu",
    lower(coalesce(profile.username,'')),profile.id)
  from public.user_profiles profile where profile.status='active'),'[]'::jsonb);
end $$;
revoke all on function public.list_custodian_account_options() from public,anon;
grant execute on function public.list_custodian_account_options() to authenticated;

drop policy if exists material_models_select_with_permission on public.material_models;
create policy material_models_select_with_permission on public.material_models for select to authenticated
using (public.has_permission('material_catalog:material_model:view')
  or public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage'));
drop policy if exists material_groups_select_with_permission on public.material_groups;
create policy material_groups_select_with_permission on public.material_groups for select to authenticated
using (public.has_permission('material_catalog:material_group:view')
  or public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage'));
drop policy if exists material_model_images_select_with_permission on public.material_model_images;
create policy material_model_images_select_with_permission on public.material_model_images for select to authenticated
using (public.has_permission('material_catalog:material_model:view')
  or public.has_permission('material_catalog:material_model:manage')
  or public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage'));
drop policy if exists material_model_images_storage_select on storage.objects;
create policy material_model_images_storage_select on storage.objects for select to authenticated
using (bucket_id='material-model-images' and (
  public.has_permission('material_catalog:material_model:view')
  or public.has_permission('material_catalog:material_model:manage')
  or public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage')
));

revoke all on function public.save_material_warehouse(uuid,jsonb) from public, anon;
grant execute on function public.save_material_warehouse(uuid,jsonb) to authenticated;
revoke all on function public.list_material_warehouses(boolean) from public, anon;
grant execute on function public.list_material_warehouses(boolean) to authenticated;

create table public.material_receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  warehouse_id uuid not null references public.material_warehouses(custodian_id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft','handover','completed','cancelled')),
  note text not null default '',
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  confirmed_by uuid references auth.users(id),
  completed_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  confirmed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);
create index material_receipts_list_order_idx on public.material_receipts(created_at desc, id);
create index material_receipts_warehouse_idx on public.material_receipts(warehouse_id, created_at desc, id);

create table public.material_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.material_receipts(id) on delete cascade,
  model_id uuid references public.material_models(id) on delete restrict,
  proposed_model jsonb,
  external_code text,
  quantity integer not null default 0 check (quantity >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint material_receipt_line_model_choice check (
    (model_id is not null and proposed_model is null)
    or (model_id is null and jsonb_typeof(proposed_model)='object')
  ),
  constraint material_receipt_line_external_code_not_blank check (
    external_code is null or length(btrim(external_code)) > 0
  )
);
create index material_receipt_lines_receipt_idx on public.material_receipt_lines(receipt_id, sort_order, id);

create table public.material_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.material_receipts(id) on delete cascade,
  line_id uuid not null references public.material_receipt_lines(id) on delete cascade,
  material_id uuid unique references public.materials(id) on delete restrict,
  material_snapshot jsonb,
  serial_number text,
  condition text not null default 'good' check (condition in ('good','damaged')),
  condition_note text,
  note text not null default '',
  status text not null default 'active' check (status in ('active','voided')),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint material_receipt_item_snapshot check (
    material_snapshot is null or jsonb_typeof(material_snapshot)='object'
  ),
  constraint material_receipt_item_damage_note check (
    condition <> 'damaged' or nullif(btrim(condition_note),'') is not null
  ),
  constraint material_receipt_item_void_state check (
    (status='active' and voided_at is null and voided_by is null and void_reason is null)
    or (status='voided' and voided_at is not null and voided_by is not null and nullif(btrim(void_reason),'') is not null)
  )
);
create index material_receipt_items_receipt_idx on public.material_receipt_items(receipt_id, status, sort_order, id);
create index material_receipt_items_material_idx on public.material_receipt_items(material_id) where material_id is not null;

create table public.material_receipt_history (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.material_receipts(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  reason text,
  from_status text,
  to_status text,
  before_state jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index material_receipt_history_order_idx on public.material_receipt_history(receipt_id, created_at, id);

alter table public.material_receipts enable row level security;
alter table public.material_receipt_lines enable row level security;
alter table public.material_receipt_items enable row level security;
alter table public.material_receipt_history enable row level security;
revoke all on public.material_receipts, public.material_receipt_lines,
  public.material_receipt_items, public.material_receipt_history
  from public, anon, authenticated;

alter table public.material_handovers
  add column if not exists mode text not null default 'standard'
    check (mode in ('standard','warehouse_allocation','warehouse_request')),
  add column if not exists receipt_id uuid references public.material_receipts(id) on delete restrict;
alter table public.material_handovers
  drop constraint if exists material_handovers_status_check;
alter table public.material_handovers
  add constraint material_handovers_status_check
  check (status in ('draft','awaiting_warehouse_approval','pending','completed','rejected','cancelled'));
alter table public.material_handover_items
  add column if not exists receiver_outcome text not null default 'pending'
    check (receiver_outcome in ('pending','received','not_received'));
alter table public.material_handover_history
  drop constraint if exists material_handover_history_action_check;
alter table public.material_handover_history
  add constraint material_handover_history_action_check
  check (action in ('created','updated','sent','warehouse_approved','confirmed','rejected','cancelled'));
create index material_handovers_receipt_idx on public.material_handovers(receipt_id, created_at desc, id)
  where receipt_id is not null;

create sequence public.material_receipt_code_seq;
create sequence public.material_receipt_material_code_seq;
revoke all on sequence public.material_receipt_code_seq,public.material_receipt_material_code_seq
  from public,anon,authenticated;

insert into public.permission_groups(module_code,code,name,description,sort_order,is_active)
values
 ('materials','warehouse','Kho','Quản lý kho và tài khoản phụ trách.',40,true),
 ('materials','receipt','Phiếu nhập','Quản lý nhập vật tư và điều chỉnh danh sách.',50,true)
on conflict (module_code,code) do update set
  name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,is_active=true;
insert into public.permission_definitions(code,module_code,group_name,group_id,name,action,sensitive,sort_order,is_active,tags)
select v.code,'materials',g.name,g.id,v.name,v.action,v.sensitive,v.sort_order,true,v.tags
from (values
 ('materials:warehouse:view','warehouse','Xem kho','view',false,10,array['Xem']::text[]),
 ('materials:warehouse:manage','warehouse','Quản lý kho','manage',true,20,array['Thêm','Sửa']::text[]),
 ('materials:receipt:view','receipt','Xem phiếu nhập','view',false,10,array['Xem']::text[]),
 ('materials:receipt:manage','receipt','Quản lý phiếu nhập','manage',true,20,array['Thêm','Sửa','Xác nhận','Điều chỉnh']::text[])
) as v(code,group_code,name,action,sensitive,sort_order,tags)
join public.permission_groups g on g.module_code='materials' and g.code=v.group_code
on conflict (code) do update set module_code=excluded.module_code,group_name=excluded.group_name,
  group_id=excluded.group_id,name=excluded.name,action=excluded.action,sensitive=excluded.sensitive,
  sort_order=excluded.sort_order,is_active=true,tags=excluded.tags;
insert into public.role_permissions(role_id,permission_code)
select r.id,p.code from public.roles r cross join public.permission_definitions p
where r.is_system and r.grant_all_permissions and p.code in (
  'materials:warehouse:view','materials:warehouse:manage',
  'materials:receipt:view','materials:receipt:manage'
)
on conflict do nothing;

create or replace function private.generate_receipt_material_model_code()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_pattern text;
  v_width integer;
  v_date_format text;
  v_sequence bigint;
  v_code text;
  v_timestamp timestamp;
begin
  select pattern into v_pattern from public.code_generation_patterns where entity_key='material_model';
  if v_pattern is null then raise exception 'No material model code pattern is configured' using errcode='22023'; end if;
  v_width:=(regexp_match(v_pattern,'\{SEQ:([0-9]{1,2})\}'))[1]::integer;
  v_date_format:=(regexp_match(v_pattern,'\{DATE:(YYYYMMDD|YYYYMM|YYYY|MM|DD)\}'))[1];
  v_timestamp:=clock_timestamp() at time zone 'Asia/Ho_Chi_Minh';
  loop
    insert into private.code_generation_counters as counter(entity_key,last_value)
      values('material_model',1)
      on conflict(entity_key) do update set last_value=counter.last_value+1,updated_at=now()
      returning last_value into v_sequence;
    v_code:=replace(v_pattern,'{SEQ:'||v_width::text||'}',lpad(v_sequence::text,v_width,'0'));
    if v_date_format is not null then
      v_code:=replace(v_code,'{DATE:'||v_date_format||'}',to_char(v_timestamp,v_date_format));
    end if;
    exit when not exists(select 1 from public.material_models m where lower(btrim(m.code))=lower(btrim(v_code)))
      and not exists(select 1 from public.material_model_external_codes x where x.normalized_code=lower(btrim(v_code)));
  end loop;
  return v_code;
end $$;
revoke all on function private.generate_receipt_material_model_code() from public, anon, authenticated;

create or replace function private.generate_receipt_material_code()
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  loop
    v_code:='VT-'||lpad(nextval('public.material_receipt_material_code_seq')::text,6,'0');
    exit when not exists(select 1 from public.materials m where lower(btrim(m.code))=lower(btrim(v_code)));
  end loop;
  return v_code;
end $$;
revoke all on function private.generate_receipt_material_code() from public, anon, authenticated;

create or replace function private.resolve_material_receipt_model(
  p_model_id uuid,p_proposed_model jsonb,p_external_code text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_model_id uuid; v_code text; v_external text:=nullif(btrim(p_external_code),'');
begin
  if v_external is not null then
    select m.id into v_model_id from public.material_models m
    where m.is_active and (lower(btrim(m.code))=lower(v_external) or exists(
      select 1 from public.material_model_external_codes x where x.model_id=m.id and x.normalized_code=lower(v_external)
    ));
    if v_model_id is not null and p_model_id is not null and v_model_id<>p_model_id then
      raise exception 'The external code belongs to a different model' using errcode='23505';
    end if;
  end if;
  v_model_id:=coalesce(v_model_id,p_model_id);
  if v_model_id is null then
    if jsonb_typeof(p_proposed_model) is distinct from 'object' then
      raise exception 'A new receipt item needs a material model' using errcode='22023';
    end if;
    if nullif(btrim(p_proposed_model->>'name'),'') is null
      or nullif(p_proposed_model->>'groupId','') is null
      or not exists(select 1 from public.material_groups g where g.id=(p_proposed_model->>'groupId')::uuid and g.is_active) then
      raise exception 'A new model needs a name and active material group' using errcode='22023';
    end if;
    v_code:=nullif(btrim(p_proposed_model->>'code'),'');
    if v_code is null then v_code:=private.generate_receipt_material_model_code(); end if;
    insert into public.material_models(code,name,group_id,description,requires_inspection,specifications,external_codes)
    values(v_code,btrim(p_proposed_model->>'name'),(p_proposed_model->>'groupId')::uuid,
      nullif(btrim(p_proposed_model->>'description'),''),
      coalesce((p_proposed_model->>'requiresInspection')::boolean,false),
      coalesce(p_proposed_model->'specifications','[]'::jsonb),
      case when v_external is null then '{}'::text[] else array[v_external] end)
    returning id into v_model_id;
  else
    if not exists(select 1 from public.material_models m where m.id=v_model_id and m.is_active) then
      raise exception 'Choose an active material model' using errcode='22023';
    end if;
    if v_external is not null and not exists(
      select 1 from public.material_model_external_codes x where x.model_id=v_model_id and x.normalized_code=lower(v_external)
    ) and lower(btrim((select m.code from public.material_models m where m.id=v_model_id)))<>lower(v_external) then
      update public.material_models set external_codes=array_append(external_codes,v_external) where id=v_model_id;
    end if;
  end if;
  return v_model_id;
end $$;
revoke all on function private.resolve_material_receipt_model(uuid,jsonb,text) from public, anon, authenticated;

create or replace function public.material_receipt_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
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
    'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'id',l.id,'modelId',l.model_id,'model',case when l.model_id is null then l.proposed_model else jsonb_build_object(
        'id',m.id,'code',m.code,'name',m.name,'groupId',m.group_id,
        'requiresInspection',m.requires_inspection,'externalCodes',m.external_codes) end,
      'externalCode',l.external_code,'quantity',l.quantity,'sortOrder',l.sort_order,
      'items',coalesce((select jsonb_agg(jsonb_build_object(
        'id',i.id,'materialId',i.material_id,'serialNumber',i.serial_number,
        'condition',i.condition,'conditionNote',i.condition_note,'note',i.note,
        'status',i.status,'voidReason',i.void_reason,'material',i.material_snapshot
      ) order by i.sort_order,i.id) from public.material_receipt_items i where i.line_id=l.id),'[]'::jsonb)
    ) order by l.sort_order,l.id) from public.material_receipt_lines l
      left join public.material_models m on m.id=l.model_id where l.receipt_id=r.id),'[]'::jsonb)
  ) from public.material_receipts r where r.id=p_id
$$;
revoke all on function public.material_receipt_json(uuid) from public,anon,authenticated;

create or replace function public.get_material_receipt(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (
    public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage')
  ) then raise exception 'Permission denied to view material receipts' using errcode='42501'; end if;
  if not exists(select 1 from public.material_receipts where id=p_id) then
    raise exception 'Material receipt not found' using errcode='P0002';
  end if;
  return public.material_receipt_json(p_id);
end $$;

create or replace function public.list_material_receipts(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_page integer:=greatest(coalesce((p_filters->>'page')::integer,1),1);
  v_size integer:=least(greatest(coalesce((p_filters->>'pageSize')::integer,20),1),100); v_total integer;
begin
  if auth.uid() is null or not (
    public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage')
  ) then raise exception 'Permission denied to view material receipts' using errcode='42501'; end if;
  select count(*) into v_total from public.material_receipts r
  where (nullif(p_filters->>'status','') is null or r.status=p_filters->>'status')
    and (nullif(p_filters->>'warehouseId','') is null or r.warehouse_id=(p_filters->>'warehouseId')::uuid)
    and (nullif(p_filters->>'dateFrom','') is null or r.created_at >= (p_filters->>'dateFrom')::date)
    and (nullif(p_filters->>'dateTo','') is null or r.created_at < (p_filters->>'dateTo')::date+1)
    and (nullif(p_filters->>'search','') is null or r.code ilike '%'||btrim(p_filters->>'search')||'%'
      or exists(select 1 from public.material_custodians c where c.id=r.warehouse_id
        and (c.name ilike '%'||btrim(p_filters->>'search')||'%' or c.code ilike '%'||btrim(p_filters->>'search')||'%')));
  return jsonb_build_object(
    'items',coalesce((select jsonb_agg(public.material_receipt_json(q.id) order by q.created_at desc,q.id)
      from (select r.id,r.created_at from public.material_receipts r
        where (nullif(p_filters->>'status','') is null or r.status=p_filters->>'status')
          and (nullif(p_filters->>'warehouseId','') is null or r.warehouse_id=(p_filters->>'warehouseId')::uuid)
          and (nullif(p_filters->>'dateFrom','') is null or r.created_at >= (p_filters->>'dateFrom')::date)
          and (nullif(p_filters->>'dateTo','') is null or r.created_at < (p_filters->>'dateTo')::date+1)
          and (nullif(p_filters->>'search','') is null or r.code ilike '%'||btrim(p_filters->>'search')||'%'
            or exists(select 1 from public.material_custodians c where c.id=r.warehouse_id
              and (c.name ilike '%'||btrim(p_filters->>'search')||'%' or c.code ilike '%'||btrim(p_filters->>'search')||'%')))
        order by r.created_at desc,r.id offset (v_page-1)*v_size limit v_size) q),'[]'::jsonb),
    'total',v_total,'page',v_page,'pageSize',v_size
  );
end $$;

create or replace function private.guard_warehouse_handover()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_sender_type text; v_recipient_type text;
begin
  if new.mode<>'standard' and current_setting('app.materials_warehouse_transition',true) is distinct from 'true' then
    raise exception 'Use warehouse handover operations for warehouse handovers' using errcode='42501';
  end if;
  if new.mode='standard' then
    select type into v_sender_type from public.material_custodians where id=new.sender_party_id;
    select type into v_recipient_type from public.material_custodians where id=new.recipient_party_id;
    if v_sender_type='warehouse' or v_recipient_type='warehouse' then
      raise exception 'Use the warehouse handover flow when a party is a warehouse' using errcode='22023';
    end if;
  end if;
  if new.mode<>'standard' and new.receipt_id is not null and not exists(
    select 1 from public.material_receipts r where r.id=new.receipt_id and r.warehouse_id=new.sender_party_id
  ) then raise exception 'The linked receipt must belong to the warehouse sender' using errcode='22023'; end if;
  return new;
end $$;
revoke all on function private.guard_warehouse_handover() from public,anon,authenticated;
drop trigger if exists material_handovers_guard_warehouse on public.material_handovers;
create trigger material_handovers_guard_warehouse
before insert or update of mode,receipt_id,sender_party_id,recipient_party_id,status
on public.material_handovers for each row execute function private.guard_warehouse_handover();

create or replace function public.save_warehouse_handover(p_id uuid,p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_row public.material_handovers%rowtype; v_material public.materials%rowtype;
  v_mode text; v_warehouse uuid; v_recipient uuid; v_receipt_id uuid;
  v_actor_party uuid; v_actor_role text; v_items jsonb; v_item jsonb;
  v_before jsonb; v_external_code text; v_condition text; v_index integer:=0;
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
    and c.type<>'warehouse' and (c.account_user_id is not null or c.representative_user_id is not null)) then
    raise exception 'The recipient must be active and have an assigned account or representative' using errcode='22023';
  end if;
  if v_mode='warehouse_allocation' then
    if not public.material_can_represent(v_warehouse) then raise exception 'You must represent the warehouse to allocate materials' using errcode='42501'; end if;
    v_actor_party:=v_warehouse;
    v_actor_role:='sender';
  else
    if not public.material_can_represent(v_recipient) then raise exception 'You must represent the requesting unit' using errcode='42501'; end if;
    v_actor_party:=v_recipient;
    v_actor_role:='recipient';
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
    v_before:=public.handover_json(p_id);
    v_id:=p_id;
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
      where reserved_handover_id=v_id and not exists(
        select 1 from jsonb_array_elements(v_items) x(value) where (x.value->>'materialId')::uuid=materials.id
      );
    delete from public.material_handover_items i where i.handover_id=v_id and not exists(
      select 1 from jsonb_array_elements(v_items) x(value) where (x.value->>'materialId')::uuid=i.material_id
    );
  end if;
  perform 1 from public.materials m where m.id in (select (x.value->>'materialId')::uuid from jsonb_array_elements(v_items) x(value))
    or m.reserved_handover_id=v_id order by m.id for update;
  for v_item in select value from jsonb_array_elements(v_items) order by (value->>'materialId')::uuid loop
    if nullif(v_item->>'materialId','') is null then raise exception 'Each line needs a material ID' using errcode='22023'; end if;
    select * into v_material from public.materials where id=(v_item->>'materialId')::uuid;
    if not found then raise exception 'A selected material no longer exists' using errcode='P0002'; end if;
    if not v_material.is_active or v_material.status<>'available' or v_material.owner_party_id<>v_warehouse
      or v_material.borrower_party_id is not null or v_material.active_loan_handover_id is not null then
      raise exception 'Only active, available stock owned by the warehouse can be selected' using errcode='55000';
    end if;
    if v_material.reserved_handover_id is not null and v_material.reserved_handover_id<>v_id then
      raise exception 'A selected material is reserved by another open handover' using errcode='55000';
    end if;
    if v_receipt_id is not null and not exists(
      select 1 from public.material_receipt_items ri where ri.receipt_id=v_receipt_id and ri.material_id=v_material.id and ri.status='active'
    ) then raise exception 'A linked handover can only use active items from its receipt' using errcode='55000'; end if;
    if v_receipt_id is null and v_material.owner_party_id<>v_warehouse then raise exception 'The selected stock is not owned by this warehouse' using errcode='55000'; end if;
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
  elsif p_action in ('approve','reject') then
    if v_h.status<>'awaiting_warehouse_approval' or v_h.mode<>'warehouse_request'
      or not public.material_can_represent(v_h.sender_party_id) then
      raise exception 'Only a represented warehouse can approve or reject a request' using errcode='42501';
    end if;
    if p_action='reject' and nullif(btrim(p_note),'') is null then raise exception 'A rejection reason is required' using errcode='22023'; end if;
    v_to:=case when p_action='approve' then 'pending' else 'rejected' end;
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

create or replace function public.handover_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',h.id,'code',h.code,'type',h.type,'mode',h.mode,'receiptId',h.receipt_id,'status',h.status,
    'senderParty',h.sender_party_snapshot,'recipientParty',h.recipient_party_snapshot,
    'senderRepresentative',h.sender_representative_snapshot,'recipientRepresentative',h.recipient_representative_snapshot,
    'plannedDate',h.planned_date,'dueDate',h.due_date,'note',h.note,'version',h.version,
    'createdBy',h.created_by,'confirmedBy',h.confirmed_by,'createdAt',h.created_at,'completedAt',h.completed_at,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'materialId',i.material_id,'materialCode',i.material_snapshot->>'code',
      'materialName',coalesce(nullif(i.material_snapshot->>'nameOverride',''),i.material_snapshot#>>'{modelSnapshot,name}'),
      'modelCode',i.material_snapshot#>>'{modelSnapshot,code}','modelName',i.material_snapshot#>>'{modelSnapshot,name}',
      'serialNumber',i.material_snapshot->>'serialNumber','condition',coalesce(i.receiver_condition,i.sender_condition),
      'note',i.note,'senderCondition',i.sender_condition,'receiverOutcome',i.receiver_outcome
    ) order by i.sort_order,i.id) from public.material_handover_items i where i.handover_id=h.id),'[]'::jsonb),
    'attachments',h.attachments
  ) from public.material_handovers h where h.id=p_id
$$;
revoke all on function public.handover_json(uuid) from public,anon,authenticated;

create or replace function public.get_handover(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_receipt_id uuid;
begin
  select receipt_id into v_receipt_id from public.material_handovers where id=p_id;
  if auth.uid() is null or not (
    public.has_permission('materials:handover:view')
    or public.has_permission('materials:handover:manage')
    or (v_receipt_id is not null and (public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage')))
  ) then raise exception 'Permission denied to view handovers' using errcode='42501'; end if;
  if not exists(select 1 from public.material_handovers where id=p_id) then raise exception 'Handover not found' using errcode='P0002'; end if;
  return public.handover_json(p_id);
end $$;

create or replace function public.list_handovers(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_page integer:=greatest(coalesce((p_filters->>'page')::integer,1),1);
  v_size integer:=least(greatest(coalesce((p_filters->>'pageSize')::integer,20),1),100); v_total integer;
  v_receipt_filter uuid:=nullif(p_filters->>'receiptId','')::uuid;
begin
  if auth.uid() is null or not (public.has_permission('materials:handover:view') or public.has_permission('materials:handover:manage') or
    (v_receipt_filter is not null and (public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage')))) then
    raise exception 'Permission denied to view handovers' using errcode='42501'; end if;
  select count(*) into v_total from public.material_handovers h where
    (v_receipt_filter is null or h.receipt_id=v_receipt_filter)
    and (nullif(p_filters->>'type','') is null or h.type=p_filters->>'type')
    and (nullif(p_filters->>'status','') is null or h.status=p_filters->>'status')
    and (nullif(p_filters->>'senderPartyId','') is null or h.sender_party_id=(p_filters->>'senderPartyId')::uuid)
    and (nullif(p_filters->>'recipientPartyId','') is null or h.recipient_party_id=(p_filters->>'recipientPartyId')::uuid)
    and (nullif(p_filters->>'materialId','') is null or exists(select 1 from public.material_handover_items i where i.handover_id=h.id and i.material_id=(p_filters->>'materialId')::uuid))
    and (nullif(p_filters->>'dateFrom','') is null or h.created_at >= (p_filters->>'dateFrom')::date)
    and (nullif(p_filters->>'dateTo','') is null or h.created_at < (p_filters->>'dateTo')::date+1)
    and (nullif(p_filters->>'search','') is null or h.code ilike '%'||btrim(p_filters->>'search')||'%'
      or h.sender_party_snapshot->>'name' ilike '%'||btrim(p_filters->>'search')||'%'
      or h.recipient_party_snapshot->>'name' ilike '%'||btrim(p_filters->>'search')||'%');
  return jsonb_build_object('items',coalesce((select jsonb_agg(public.handover_json(q.id) order by q.created_at desc,q.id)
    from (select h.id,h.created_at from public.material_handovers h where
      (v_receipt_filter is null or h.receipt_id=v_receipt_filter)
      and (nullif(p_filters->>'type','') is null or h.type=p_filters->>'type')
      and (nullif(p_filters->>'status','') is null or h.status=p_filters->>'status')
      and (nullif(p_filters->>'senderPartyId','') is null or h.sender_party_id=(p_filters->>'senderPartyId')::uuid)
      and (nullif(p_filters->>'recipientPartyId','') is null or h.recipient_party_id=(p_filters->>'recipientPartyId')::uuid)
      and (nullif(p_filters->>'materialId','') is null or exists(select 1 from public.material_handover_items i where i.handover_id=h.id and i.material_id=(p_filters->>'materialId')::uuid))
      and (nullif(p_filters->>'dateFrom','') is null or h.created_at >= (p_filters->>'dateFrom')::date)
      and (nullif(p_filters->>'dateTo','') is null or h.created_at < (p_filters->>'dateTo')::date+1)
      and (nullif(p_filters->>'search','') is null or h.code ilike '%'||btrim(p_filters->>'search')||'%'
        or h.sender_party_snapshot->>'name' ilike '%'||btrim(p_filters->>'search')||'%'
        or h.recipient_party_snapshot->>'name' ilike '%'||btrim(p_filters->>'search')||'%')
      order by h.created_at desc,h.id offset (v_page-1)*v_size limit v_size) q),'[]'::jsonb),
    'total',v_total,'page',v_page,'pageSize',v_size);
end $$;

revoke all on function public.get_handover(uuid),public.list_handovers(jsonb),
  public.save_warehouse_handover(uuid,jsonb),public.act_on_warehouse_handover(uuid,text,integer,text,jsonb)
  from public,anon;
grant execute on function public.get_handover(uuid),public.list_handovers(jsonb),
  public.save_warehouse_handover(uuid,jsonb),public.act_on_warehouse_handover(uuid,text,integer,text,jsonb)
  to authenticated;

create or replace function public.save_material_receipt(p_id uuid,p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_receipt public.material_receipts%rowtype; v_warehouse uuid;
  v_lines jsonb; v_line jsonb; v_item jsonb; v_items jsonb;
  v_line_id uuid; v_model_id uuid; v_external_code text; v_quantity integer;
  v_sort integer:=0; v_item_sort integer; v_condition text; v_condition_note text;
  v_old jsonb; v_after jsonb; v_was_new boolean:=p_id is null;
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to manage material receipts' using errcode='42501';
  end if;
  v_warehouse:=nullif(p_values->>'warehouseId','')::uuid;
  v_lines:=coalesce(p_values->'lines','[]'::jsonb);
  if v_warehouse is null or not exists(select 1 from public.material_warehouses w
    join public.material_custodians c on c.id=w.custodian_id
    where w.custodian_id=v_warehouse and c.is_active) then
    raise exception 'Choose an active warehouse' using errcode='22023';
  end if;
  if jsonb_typeof(v_lines) is distinct from 'array' then raise exception 'Receipt lines must be an array' using errcode='22023'; end if;
  if p_id is null then
    insert into public.material_receipts(code,warehouse_id,note,status)
    values('PN-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.material_receipt_code_seq')::text,6,'0'),
      v_warehouse,btrim(coalesce(p_values->>'note','')),'draft') returning id into v_id;
  else
    select * into v_receipt from public.material_receipts where id=p_id for update;
    if not found then raise exception 'Material receipt not found' using errcode='P0002'; end if;
    if v_receipt.status<>'draft' then raise exception 'Only a draft receipt can be edited' using errcode='55000'; end if;
    if (p_values->>'expectedVersion')::integer is distinct from v_receipt.version then
      raise exception 'Receipt changed; reload before saving' using errcode='40001';
    end if;
    v_old:=public.material_receipt_json(p_id);
    v_id:=p_id;
    update public.material_receipts set warehouse_id=v_warehouse,note=btrim(coalesce(p_values->>'note','')),
      version=version+1,updated_at=timezone('utc',now()) where id=v_id;
    delete from public.material_receipt_lines where receipt_id=v_id;
  end if;
  for v_line in select value from jsonb_array_elements(v_lines) order by (value->>'sortOrder')::integer nulls last loop
    v_model_id:=nullif(v_line->>'modelId','')::uuid;
    v_external_code:=nullif(btrim(v_line->>'externalCode'),'');
    v_quantity:=nullif(v_line->>'quantity','')::integer;
    if v_model_id is null and jsonb_typeof(v_line->'newModel') is distinct from 'object' and v_external_code is not null then
      select m.id into v_model_id from public.material_models m
      where m.is_active and (lower(btrim(m.code))=lower(v_external_code) or exists(
        select 1 from public.material_model_external_codes x
        where x.model_id=m.id and x.normalized_code=lower(v_external_code)
      ));
    end if;
    if (v_model_id is null and jsonb_typeof(v_line->'newModel') is distinct from 'object')
      or (v_model_id is not null and v_line ? 'newModel') then
      raise exception 'Each receipt line must select an existing model or define a new model' using errcode='22023';
    end if;
    if v_quantity is null or v_quantity<1 or v_quantity>10000 then raise exception 'Line quantity must be between 1 and 10000' using errcode='22023'; end if;
    if v_model_id is not null and not exists(select 1 from public.material_models m where m.id=v_model_id and m.is_active) then
      raise exception 'Choose an active material model' using errcode='22023';
    end if;
    if jsonb_typeof(v_line->'items') is not null and jsonb_typeof(v_line->'items') is distinct from 'array' then
      raise exception 'Unit details must be an array' using errcode='22023';
    end if;
    v_items:=coalesce(v_line->'items','[]'::jsonb);
    if jsonb_array_length(v_items)>0 and jsonb_array_length(v_items)<>v_quantity then
      raise exception 'Unit details must match the line quantity' using errcode='22023';
    end if;
    if v_model_id is null then
      if nullif(btrim(v_line->'newModel'->>'name'),'') is null or nullif(v_line->'newModel'->>'groupId','') is null
        or not exists(select 1 from public.material_groups g where g.id=(v_line->'newModel'->>'groupId')::uuid and g.is_active) then
        raise exception 'A new model needs a name and an active material group' using errcode='22023';
      end if;
      if jsonb_typeof(coalesce(v_line->'newModel'->'specifications','[]'::jsonb)) is distinct from 'array' then
        raise exception 'Model specifications must be an array' using errcode='22023';
      end if;
    end if;
    insert into public.material_receipt_lines(receipt_id,model_id,proposed_model,external_code,quantity,sort_order)
    values(v_id,v_model_id,case when v_model_id is null then v_line->'newModel' else null end,
      v_external_code,v_quantity,v_sort) returning id into v_line_id;
    for v_item_sort in 1..v_quantity loop
      if jsonb_array_length(v_items)=0 then v_item:='{}'::jsonb;
      else v_item:=v_items->(v_item_sort-1); end if;
      v_condition:=coalesce(v_item->>'condition','good');
      v_condition_note:=nullif(btrim(v_item->>'conditionNote'),'');
      if v_condition not in ('good','damaged') then raise exception 'Material condition is invalid' using errcode='22023'; end if;
      if v_condition='damaged' and v_condition_note is null then raise exception 'A damaged item needs a condition note' using errcode='22023'; end if;
      insert into public.material_receipt_items(receipt_id,line_id,serial_number,condition,condition_note,note,sort_order)
      values(v_id,v_line_id,nullif(btrim(v_item->>'serialNumber'),''),v_condition,v_condition_note,
        btrim(coalesce(v_item->>'note','')),v_item_sort-1);
    end loop;
    v_sort:=v_sort+1;
  end loop;
  if v_was_new then
    insert into public.material_receipt_history(receipt_id,actor_user_id,action,to_status,after_state)
    values(v_id,auth.uid(),'created','draft',public.material_receipt_json(v_id));
  else
    v_after:=public.material_receipt_json(v_id);
    insert into public.material_receipt_history(receipt_id,actor_user_id,action,from_status,to_status,reason,before_state,after_state)
    values(v_id,auth.uid(),'updated','draft','draft',nullif(btrim(p_values->>'reason'),''),v_old,v_after);
  end if;
  return v_id;
end $$;

create or replace function public.act_material_receipt(
  p_id uuid,p_action text,p_expected_version integer,p_reason text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_receipt public.material_receipts%rowtype;
  v_line record;
  v_item record;
  v_model_id uuid;
  v_code text;
  v_external text;
  v_before jsonb;
  v_after jsonb;
  v_from text;
  v_to text;
  v_material_id uuid;
  v_snapshot jsonb;
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to manage material receipts' using errcode='42501';
  end if;
  select * into v_receipt from public.material_receipts where id=p_id for update;
  if not found then raise exception 'Material receipt not found' using errcode='P0002'; end if;
  if v_receipt.version is distinct from p_expected_version then
    raise exception 'Receipt changed; reload before acting' using errcode='40001';
  end if;
  if p_action not in ('confirm','complete','reopen','cancel') then
    raise exception 'Unknown material receipt action' using errcode='22023';
  end if;
  v_before:=public.material_receipt_json(p_id);
  v_from:=v_receipt.status;
  if p_action='confirm' then
    if v_receipt.status<>'draft' then raise exception 'Only a draft receipt can create inventory' using errcode='55000'; end if;
    if not exists(select 1 from public.material_receipt_items i where i.receipt_id=p_id and i.status='active') then
      raise exception 'A material receipt needs at least one item' using errcode='22023';
    end if;
    perform 1 from public.material_custodians c where c.id=v_receipt.warehouse_id and c.type='warehouse' and c.is_active for update;
    if not found then raise exception 'The warehouse is inactive or no longer exists' using errcode='55000'; end if;
    for v_line in
      select l.* from public.material_receipt_lines l where l.receipt_id=p_id order by l.sort_order,l.id for update
    loop
      v_model_id:=v_line.model_id;
      v_external:=nullif(btrim(v_line.external_code),'');
      if v_external is not null then
        select m.id into v_material_id from public.material_models m
        where m.is_active and (lower(btrim(m.code))=lower(v_external) or exists(
          select 1 from public.material_model_external_codes x where x.model_id=m.id and x.normalized_code=lower(v_external)
        ));
        if v_material_id is not null then
          if v_model_id is not null and v_model_id<>v_material_id then
            raise exception 'The external code belongs to a different model; reload the receipt' using errcode='23505';
          end if;
          v_model_id:=v_material_id;
        end if;
      end if;
      if v_model_id is null then
        v_code:=nullif(btrim(v_line.proposed_model->>'code'),'');
        if v_code is null then v_code:=private.generate_receipt_material_model_code(); end if;
        insert into public.material_models(code,name,group_id,description,requires_inspection,specifications,external_codes)
        values(v_code,btrim(v_line.proposed_model->>'name'),(v_line.proposed_model->>'groupId')::uuid,
          nullif(btrim(v_line.proposed_model->>'description'),''),
          coalesce((v_line.proposed_model->>'requiresInspection')::boolean,false),
          coalesce(v_line.proposed_model->'specifications','[]'::jsonb),
          case when v_external is null then '{}'::text[] else array[v_external] end)
        returning id into v_model_id;
      elsif v_external is not null and not exists(
        select 1 from public.material_model_external_codes x where x.model_id=v_model_id and x.normalized_code=lower(v_external)
      ) and lower(btrim((select m.code from public.material_models m where m.id=v_model_id)))<>lower(v_external) then
        update public.material_models set external_codes=array_append(external_codes,v_external) where id=v_model_id;
      end if;
      if not exists(select 1 from public.material_models m where m.id=v_model_id and m.is_active) then
        raise exception 'A receipt line refers to an inactive model' using errcode='55000';
      end if;
      update public.material_receipt_lines set model_id=v_model_id,proposed_model=null,updated_at=timezone('utc',now())
        where id=v_line.id;
      for v_item in select i.* from public.material_receipt_items i
        where i.line_id=v_line.id and i.status='active' and i.material_id is null order by i.sort_order,i.id for update
      loop
        v_snapshot:=public.material_model_snapshot(v_model_id);
        insert into public.materials(code,model_id,model_snapshot,serial_number,owner_party_id,condition,note)
        values(private.generate_receipt_material_code(),v_model_id,v_snapshot,v_item.serial_number,
          v_receipt.warehouse_id,v_item.condition,coalesce(v_item.condition_note,nullif(btrim(v_item.note),'')))
        returning id into v_material_id;
        update public.material_receipt_items set material_id=v_material_id,
          material_snapshot=public.material_json(v_material_id),updated_at=timezone('utc',now()) where id=v_item.id;
        insert into public.material_history(material_id,actor_user_id,action,note,to_state)
          values(v_material_id,auth.uid(),'created','Tạo từ phiếu nhập '||v_receipt.code,public.material_json(v_material_id));
      end loop;
      update public.material_receipt_lines l set quantity=(select count(*) from public.material_receipt_items i
        where i.line_id=l.id and i.status='active'),updated_at=timezone('utc',now()) where l.id=v_line.id;
    end loop;
    update public.material_receipts set status='handover',confirmed_by=auth.uid(),confirmed_at=timezone('utc',now()),
      version=version+1,updated_at=timezone('utc',now()) where id=p_id;
    v_to:='handover';
  elsif p_action='complete' then
    if v_receipt.status<>'handover' then raise exception 'Only a receipt in handover status can be completed' using errcode='55000'; end if;
    perform 1 from public.material_handovers h where h.receipt_id=p_id and h.status in ('draft','awaiting_warehouse_approval','pending')
      order by h.id for update;
    if found then raise exception 'Resolve every linked draft or open handover before completing the receipt' using errcode='55000'; end if;
    update public.material_receipts set status='completed',completed_by=auth.uid(),completed_at=timezone('utc',now()),
      version=version+1,updated_at=timezone('utc',now()) where id=p_id;
    v_to:='completed';
  elsif p_action='reopen' then
    if v_receipt.status<>'completed' then raise exception 'Only a completed receipt can be reopened' using errcode='55000'; end if;
    if nullif(btrim(p_reason),'') is null then raise exception 'A reason is required to reopen a receipt' using errcode='22023'; end if;
    update public.material_receipts set status='handover',completed_by=null,completed_at=null,
      version=version+1,updated_at=timezone('utc',now()) where id=p_id;
    v_to:='handover';
  else
    if v_receipt.status<>'draft' then raise exception 'Only a draft receipt can be cancelled' using errcode='55000'; end if;
    if nullif(btrim(p_reason),'') is null then raise exception 'A cancellation reason is required' using errcode='22023'; end if;
    update public.material_receipts set status='cancelled',version=version+1,updated_at=timezone('utc',now()) where id=p_id;
    v_to:='cancelled';
  end if;
  v_after:=public.material_receipt_json(p_id);
  insert into public.material_receipt_history(receipt_id,actor_user_id,action,reason,from_status,to_status,before_state,after_state)
  values(p_id,auth.uid(),p_action,nullif(btrim(p_reason),''),v_from,v_to,v_before,v_after);
  return p_id;
end $$;

create or replace function public.list_material_receipt_history(p_receipt_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (
    public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage')
  ) then raise exception 'Permission denied to view material receipt history' using errcode='42501'; end if;
  if not exists(select 1 from public.material_receipts where id=p_receipt_id) then
    raise exception 'Material receipt not found' using errcode='P0002'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',h.id,'actorUserId',h.actor_user_id,'action',h.action,'reason',h.reason,
    'actorDisplayName',coalesce(nullif(btrim(p.display_name),''),nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),h.actor_user_id::text),
    'fromStatus',h.from_status,'toStatus',h.to_status,'createdAt',h.created_at,
    'beforeState',h.before_state,'afterState',h.after_state
  ) order by h.created_at,h.id) from public.material_receipt_history h
    left join public.user_profiles p on p.id=h.actor_user_id where h.receipt_id=p_receipt_id),'[]'::jsonb);
end $$;

create or replace function public.list_material_receipt_items(p_receipt_id uuid,p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_page integer:=greatest(coalesce((p_filters->>'page')::integer,1),1);
  v_size integer:=least(greatest(coalesce((p_filters->>'pageSize')::integer,20),1),100);
  v_total integer;
begin
  if auth.uid() is null or not (
    public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage')
  ) then raise exception 'Permission denied to view material receipt items' using errcode='42501'; end if;
  if not exists(select 1 from public.material_receipts r where r.id=p_receipt_id) then
    raise exception 'Material receipt not found' using errcode='P0002'; end if;
  select count(*) into v_total from public.material_receipt_items i
    join public.material_receipt_lines l on l.id=i.line_id
  where i.receipt_id=p_receipt_id
    and (nullif(p_filters->>'status','') is null or i.status=p_filters->>'status')
    and (nullif(p_filters->>'search','') is null or coalesce(i.material_snapshot->>'code','') ilike '%'||btrim(p_filters->>'search')||'%'
      or coalesce(i.serial_number,'') ilike '%'||btrim(p_filters->>'search')||'%'
      or coalesce(i.material_snapshot#>>'{modelSnapshot,name}','') ilike '%'||btrim(p_filters->>'search')||'%');
  return jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'receiptId',i.receipt_id,'lineId',i.line_id,'materialId',i.material_id,
      'materialCode',i.material_snapshot->>'code',
      'materialName',coalesce(nullif(i.material_snapshot->>'nameOverride',''),i.material_snapshot#>>'{modelSnapshot,name}'),
      'modelCode',i.material_snapshot#>>'{modelSnapshot,code}','modelName',i.material_snapshot#>>'{modelSnapshot,name}',
      'serialNumber',i.serial_number,'condition',i.condition,'conditionNote',i.condition_note,
      'note',i.note,'status',i.status,'voidReason',i.void_reason,
      'receiverOutcome',case when exists(select 1 from public.material_handover_items hi
        join public.material_handovers h on h.id=hi.handover_id and h.receipt_id=p_receipt_id and h.status='completed'
        where hi.material_id=i.material_id and hi.receiver_outcome='received') then 'received'
        when exists(select 1 from public.material_handover_items hi
          join public.material_handovers h on h.id=hi.handover_id and h.receipt_id=p_receipt_id and h.status='completed'
          where hi.material_id=i.material_id and hi.receiver_outcome='not_received') then 'not_received'
        else 'pending' end
    ) order by l.sort_order,i.sort_order,i.id) from (
      select i.* from public.material_receipt_items i
      join public.material_receipt_lines l on l.id=i.line_id
      where i.receipt_id=p_receipt_id
        and (nullif(p_filters->>'status','') is null or i.status=p_filters->>'status')
        and (nullif(p_filters->>'search','') is null or coalesce(i.material_snapshot->>'code','') ilike '%'||btrim(p_filters->>'search')||'%'
          or coalesce(i.serial_number,'') ilike '%'||btrim(p_filters->>'search')||'%'
          or coalesce(i.material_snapshot#>>'{modelSnapshot,name}','') ilike '%'||btrim(p_filters->>'search')||'%')
      order by l.sort_order,i.sort_order,i.id offset (v_page-1)*v_size limit v_size
    ) i join public.material_receipt_lines l on l.id=i.line_id),'[]'::jsonb),
    'total',v_total,'page',v_page,'pageSize',v_size
  );
end $$;

revoke all on function public.get_material_receipt(uuid),public.list_material_receipts(jsonb),
  public.save_material_receipt(uuid,jsonb),public.act_material_receipt(uuid,text,integer,text),
  public.list_material_receipt_history(uuid),public.list_material_receipt_items(uuid,jsonb)
  from public,anon;
grant execute on function public.get_material_receipt(uuid),public.list_material_receipts(jsonb),
  public.save_material_receipt(uuid,jsonb),public.act_material_receipt(uuid,text,integer,text),
  public.list_material_receipt_history(uuid),public.list_material_receipt_items(uuid,jsonb)
  to authenticated;

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
        where hi.material_id=m.id and h.status='completed') then 'Vật tư đã phát sinh bàn giao hoàn tất'
      else null end
  ) order by ri.id) filter (where m.id is not null and (
    m.is_active is false or m.status<>'available' or m.owner_party_id<>v_receipt.warehouse_id
    or m.active_loan_handover_id is not null or exists(select 1 from public.material_handover_items hi
      join public.material_handovers h on h.id=hi.handover_id where hi.material_id=m.id and h.status='completed')
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

revoke all on function public.preview_material_receipt_adjustment(uuid,integer,jsonb) from public,anon;
grant execute on function public.preview_material_receipt_adjustment(uuid,integer,jsonb) to authenticated;

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
              where hi.material_id=v_item_row.material_id and h.status='completed') then
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

revoke all on function public.apply_material_receipt_adjustment(uuid,integer,text,jsonb,text,jsonb) from public,anon;
grant execute on function public.apply_material_receipt_adjustment(uuid,integer,text,jsonb,text,jsonb) to authenticated;

create or replace function public.list_materials(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_page int:=greatest(coalesce((p_filters->>'page')::int,1),1);
  v_size int:=least(greatest(coalesce((p_filters->>'pageSize')::int,20),1),100);
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode='42501'; end if;
  return (with filtered as (
    select m.id,m.status,m.name_override,m.model_snapshot from public.materials m
    where (nullif(p_filters->>'id','') is null or m.id=(p_filters->>'id')::uuid)
      and (not coalesce((p_filters->>'excludeReserved')::boolean,false) or m.reserved_handover_id is null
        or m.reserved_handover_id=nullif(p_filters->>'allowReservedByHandoverId','')::uuid)
      and (nullif(p_filters->>'modelId','') is null or m.model_id=(p_filters->>'modelId')::uuid)
      and (nullif(p_filters->>'groupId','') is null or m.model_snapshot->>'groupId'=p_filters->>'groupId')
      and (nullif(p_filters->>'ownerPartyId','') is null or m.owner_party_id=(p_filters->>'ownerPartyId')::uuid)
      and (nullif(p_filters->>'borrowerPartyId','') is null or m.borrower_party_id=(p_filters->>'borrowerPartyId')::uuid)
      and (nullif(p_filters->>'status','') is null or m.status=p_filters->>'status')
      and (nullif(p_filters->>'condition','') is null or m.condition=p_filters->>'condition')
      and (nullif(p_filters->>'search','') is null or concat_ws(' ',m.code,m.serial_number,m.name_override,m.model_snapshot->>'name') ilike '%'||btrim(p_filters->>'search')||'%')
      and (nullif(p_filters->>'updatedFrom','') is null or m.updated_at >= (p_filters->>'updatedFrom')::timestamptz)
      and (nullif(p_filters->>'updatedTo','') is null or m.updated_at < (p_filters->>'updatedTo')::timestamptz+interval '1 day')
      and (nullif(p_filters->>'isActive','') is null or m.is_active=(p_filters->>'isActive')::boolean)
      and (nullif(p_filters->>'receiptId','') is null or (
        m.is_active and m.status='available' and m.borrower_party_id is null and m.active_loan_handover_id is null
        and exists(select 1 from public.material_receipt_items ri
          join public.material_receipts r on r.id=ri.receipt_id and r.warehouse_id=m.owner_party_id and r.status='handover'
          where ri.receipt_id=(p_filters->>'receiptId')::uuid and ri.material_id=m.id and ri.status='active')
      ))
  ) select jsonb_build_object(
    'items',coalesce((select jsonb_agg(public.material_json(page.id) order by
      case page.status when 'available' then 0 when 'loaned' then 1 else 2 end,
      lower(coalesce(nullif(btrim(page.name_override),''),page.model_snapshot->>'name','')) collate "vi-x-icu",page.id)
      from (select f.id,f.status,f.name_override,f.model_snapshot from filtered f
        order by case f.status when 'available' then 0 when 'loaned' then 1 else 2 end,
        lower(coalesce(nullif(btrim(f.name_override),''),f.model_snapshot->>'name','')) collate "vi-x-icu",f.id
        offset (v_page-1)*v_size limit v_size) page),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',v_page,'pageSize',v_size
  ));
end $$;
revoke all on function public.list_materials(jsonb) from public,anon;
grant execute on function public.list_materials(jsonb) to authenticated;

create or replace function public.list_handover_history(p_handover_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (
    public.has_permission('materials:handover:view') or public.has_permission('materials:handover:manage')
    or exists(select 1 from public.material_handovers h where h.id=p_handover_id and h.receipt_id is not null
      and (public.has_permission('materials:receipt:view') or public.has_permission('materials:receipt:manage')))
  ) then raise exception 'Permission denied to view handover history' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',h.id,'handoverId',h.handover_id,'actorUserId',h.actor_user_id,
    'actorDisplayName',coalesce(nullif(btrim(p.display_name),''),nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'')),
    'action',h.action,'note',h.note,'fromStatus',h.from_status,'toStatus',h.to_status,'createdAt',h.created_at
  ) order by h.created_at,h.id) from public.material_handover_history h
    left join public.user_profiles p on p.id=h.actor_user_id where h.handover_id=p_handover_id),'[]'::jsonb);
end $$;
revoke all on function public.list_handover_history(uuid) from public,anon;
grant execute on function public.list_handover_history(uuid) to authenticated;

notify pgrst, 'reload schema';
