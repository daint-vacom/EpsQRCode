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
        and party.type = 'department'
        and party.source_type = 'eps_department'
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
    raise exception 'Choose at least one EPS department that may request this receipt' using errcode = '22023';
  end if;
  if v_scope = 'all' and cardinality(v_party_ids) > 0 then
    raise exception 'Registration targets must be empty when all EPS departments are allowed' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_party_ids) selected(id)
    where not exists (
      select 1 from public.material_custodians party
      where party.id = selected.id and party.is_active
        and party.type = 'department'
        and party.source_type = 'eps_department'
    )
  ) then
    raise exception 'A registration target must be an active EPS department' using errcode = '22023';
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
    ) order by lower(party.name) collate "vi-x-icu",party.id)
    from public.material_custodians party
    where party.is_active
      and party.type = 'department'
      and party.source_type = 'eps_department'
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.list_material_receipt_recipient_options(uuid) from public, anon;
grant execute on function public.list_material_receipt_recipient_options(uuid) to authenticated;
