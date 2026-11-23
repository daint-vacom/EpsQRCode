alter table public.material_receipts
  add column request_registration_scope text not null default 'all'
    check (request_registration_scope in ('all', 'selected'));

create table public.material_receipt_request_targets (
  receipt_id uuid not null references public.material_receipts(id) on delete cascade,
  party_id uuid not null references public.material_custodians(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (receipt_id, party_id)
);
create index material_receipt_request_targets_party_idx
  on public.material_receipt_request_targets(party_id, receipt_id);
alter table public.material_receipt_request_targets enable row level security;
revoke all on public.material_receipt_request_targets from public, anon, authenticated;

create or replace function private.can_request_material_receipt(
  p_receipt_id uuid,
  p_party_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.has_permission('materials:handover:manage')
    and public.material_can_represent(p_party_id)
    and exists (
      select 1
      from public.material_receipts receipt
      join public.material_custodians party on party.id = p_party_id
      where receipt.id = p_receipt_id
        and receipt.status = 'handover'
        and party.is_active
        and party.type <> 'warehouse'
        and (
          receipt.request_registration_scope = 'all'
          or exists (
            select 1 from public.material_receipt_request_targets target
            where target.receipt_id = receipt.id and target.party_id = p_party_id
          )
        )
    );
$$;
revoke all on function private.can_request_material_receipt(uuid, uuid)
  from public, anon, authenticated;

alter function public.save_material_receipt(uuid, jsonb)
  rename to save_material_receipt_with_receiving_party;
revoke all on function public.save_material_receipt_with_receiving_party(uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.save_material_receipt(p_id uuid, p_values jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_scope text;
  v_party_ids uuid[];
  v_warehouse_id uuid;
  v_targets jsonb := coalesce(p_values->'requestRegistrationPartyIds', '[]'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(v_targets) is distinct from 'array' then
    raise exception 'Registration targets must be an array' using errcode = '22023';
  end if;

  v_scope := coalesce(nullif(p_values->>'requestRegistrationScope', ''), 'all');
  if v_scope not in ('all', 'selected') then
    raise exception 'Invalid receipt request registration scope' using errcode = '22023';
  end if;
  if v_scope = 'selected' then
    select coalesce(array_agg(distinct value::uuid), '{}'::uuid[])
    into v_party_ids
    from jsonb_array_elements_text(v_targets);
  else
    v_party_ids := '{}'::uuid[];
  end if;
  if v_scope = 'selected' and cardinality(v_party_ids) = 0 then
    raise exception 'Choose at least one party that may request this receipt' using errcode = '22023';
  end if;
  if v_scope = 'all' and cardinality(v_party_ids) > 0 then
    raise exception 'Registration targets must be empty when all parties are allowed' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_party_ids) selected(id)
    where not exists (
      select 1 from public.material_custodians party
      where party.id = selected.id and party.is_active
        and party.type in ('department', 'team', 'person', 'external')
    )
  ) then
    raise exception 'A registration target is invalid or inactive' using errcode = '22023';
  end if;

  v_id := public.save_material_receipt_with_receiving_party(p_id, p_values);
  select receipt.warehouse_id into v_warehouse_id
  from public.material_receipts receipt where receipt.id = v_id;
  if not public.has_scoped_permission('materials:receipt:manage', v_warehouse_id) then
    raise exception 'Permission denied to configure receipt registration' using errcode = '42501';
  end if;

  update public.material_receipts
  set request_registration_scope = v_scope,
      updated_at = timezone('utc', now())
  where id = v_id;
  delete from public.material_receipt_request_targets where receipt_id = v_id;
  if v_scope = 'selected' then
    insert into public.material_receipt_request_targets(receipt_id, party_id)
    select v_id, unnest(v_party_ids);
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_material_receipt(uuid, jsonb) from public, anon;
grant execute on function public.save_material_receipt(uuid, jsonb) to authenticated;

alter function public.get_material_receipt(uuid)
  rename to get_material_receipt_with_receipt_permission;
revoke all on function public.get_material_receipt_with_receipt_permission(uuid)
  from public, anon, authenticated;

create or replace function public.get_material_receipt(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_receipt jsonb;
  v_allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'Permission denied to view receipt' using errcode = '42501';
  end if;
  select exists (
    select 1 from public.material_receipts receipt
    where receipt.id = p_id and public.can_view_receipt(receipt.id)
  ) into v_allowed;
  if v_allowed then
    v_receipt := public.get_material_receipt_with_receipt_permission(p_id);
  else
    select exists (
      select 1 from public.material_receipts receipt
      where receipt.id = p_id
        and public.has_scoped_permission('materials:receipt:manage', receipt.warehouse_id)
    ) into v_allowed;
    if v_allowed then
      v_receipt := public.material_receipt_json(p_id);
    end if;
  end if;
  if not v_allowed then
    select exists (
      select 1 from public.material_custodians party
      where party.is_active and party.type <> 'warehouse'
        and private.can_request_material_receipt(p_id, party.id)
    ) into v_allowed;
    if not v_allowed then
      raise exception 'Permission denied to view receipt' using errcode = '42501';
    end if;
    v_receipt := public.material_receipt_json(p_id);
  end if;
  return v_receipt || jsonb_build_object(
    'requestRegistrationScope', (
      select receipt.request_registration_scope from public.material_receipts receipt where receipt.id = p_id
    ),
    'requestRegistrationPartyIds', coalesce((
      select jsonb_agg(target.party_id order by target.party_id)
      from public.material_receipt_request_targets target where target.receipt_id = p_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_material_receipt(uuid) from public, anon;
grant execute on function public.get_material_receipt(uuid) to authenticated;

create or replace function public.list_available_material_receipt_requests(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce((p_filters->>'page')::integer, 1), 1);
  v_size integer := least(greatest(coalesce((p_filters->>'pageSize')::integer, 20), 1), 100);
  v_search text := nullif(btrim(p_filters->>'search'), '');
  v_total integer;
begin
  if auth.uid() is null or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to view receipts available for request' using errcode = '42501';
  end if;
  with eligible as (
    select distinct receipt.id, receipt.created_at
    from public.material_receipts receipt
    join public.material_receipt_items receipt_item
      on receipt_item.receipt_id = receipt.id and receipt_item.status = 'active'
    join public.materials material
      on material.id = receipt_item.material_id
      and material.owner_party_id = receipt.warehouse_id
      and material.is_active and material.status = 'available'
      and material.borrower_party_id is null and material.active_loan_handover_id is null
      and material.reserved_handover_id is null
    where receipt.status = 'handover'
      and (v_search is null or receipt.code ilike '%' || v_search || '%')
      and exists (
        select 1 from public.material_custodians party
        where party.is_active and party.type <> 'warehouse'
          and private.can_request_material_receipt(receipt.id, party.id)
      )
  )
  select count(*) into v_total from eligible;

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', page.id,
        'code', page.code,
        'status', page.status,
        'warehouse', public.material_party_json(page.warehouse_id),
        'warehouseId', page.warehouse_id,
        'note', page.note,
        'version', page.version,
        'createdBy', page.created_by,
        'confirmedBy', page.confirmed_by,
        'completedBy', page.completed_by,
        'createdAt', page.created_at,
        'confirmedAt', page.confirmed_at,
        'completedAt', page.completed_at,
        'updatedAt', page.updated_at,
        'totalItems', page.total_items,
        'receivedItems', page.received_items,
        'pendingAllocationItems', page.pending_items,
        'allocationsClosed', false,
        'requestRegistrationScope', page.request_registration_scope,
        'requestRegistrationPartyIds', page.request_target_ids,
        'lines', '[]'::jsonb
      ) order by page.created_at desc, page.id)
      from (
        select receipt.*,
          (select count(*) from public.material_receipt_items item
            where item.receipt_id = receipt.id and item.status = 'active') as total_items,
          (select count(distinct item.material_id) from public.material_receipt_items item
            join public.material_handover_items handover_item on handover_item.material_id = item.material_id
            join public.material_handovers handover on handover.id = handover_item.handover_id
              and handover.receipt_id = receipt.id and handover.status = 'completed'
              and handover_item.receiver_outcome = 'received'
            where item.receipt_id = receipt.id and item.status = 'active') as received_items,
          (select count(*) from public.material_receipt_items item
            where item.receipt_id = receipt.id and item.status = 'active') as pending_items,
          coalesce((select jsonb_agg(target.party_id order by target.party_id)
            from public.material_receipt_request_targets target where target.receipt_id = receipt.id), '[]'::jsonb) as request_target_ids
        from public.material_receipts receipt
        where receipt.status = 'handover'
          and (v_search is null or receipt.code ilike '%' || v_search || '%')
          and exists (
            select 1 from public.material_receipt_items receipt_item
            join public.materials material on material.id = receipt_item.material_id
              and material.owner_party_id = receipt.warehouse_id
              and material.is_active and material.status = 'available'
              and material.borrower_party_id is null and material.active_loan_handover_id is null
              and material.reserved_handover_id is null
            where receipt_item.receipt_id = receipt.id and receipt_item.status = 'active'
          )
          and exists (
            select 1 from public.material_custodians party
            where party.is_active and party.type <> 'warehouse'
              and private.can_request_material_receipt(receipt.id, party.id)
          )
        order by receipt.created_at desc, receipt.id
        offset (v_page - 1) * v_size limit v_size
      ) page
    ), '[]'::jsonb),
    'total', v_total, 'page', v_page, 'pageSize', v_size
  );
end;
$$;
revoke all on function public.list_available_material_receipt_requests(jsonb) from public, anon;
grant execute on function public.list_available_material_receipt_requests(jsonb) to authenticated;

alter function public.save_warehouse_handover(uuid, jsonb)
  rename to save_warehouse_handover_without_receipt_registration_check;
revoke all on function public.save_warehouse_handover_without_receipt_registration_check(uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.save_warehouse_handover(p_id uuid, p_values jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text := p_values->>'mode';
  v_receipt_id uuid := nullif(p_values->>'receiptId', '')::uuid;
  v_party_id uuid := nullif(p_values->>'recipientPartyId', '')::uuid;
begin
  if v_mode = 'warehouse_request' then
    if p_id is null and v_receipt_id is null then
      raise exception 'A new warehouse request must be linked to a material receipt' using errcode = '22023';
    end if;
    if v_receipt_id is not null and not private.can_request_material_receipt(v_receipt_id, v_party_id) then
      raise exception 'This unit is not allowed to request materials from the selected receipt' using errcode = '42501';
    end if;
  end if;
  return public.save_warehouse_handover_without_receipt_registration_check(p_id, p_values);
end;
$$;
revoke all on function public.save_warehouse_handover(uuid, jsonb) from public, anon;
grant execute on function public.save_warehouse_handover(uuid, jsonb) to authenticated;
