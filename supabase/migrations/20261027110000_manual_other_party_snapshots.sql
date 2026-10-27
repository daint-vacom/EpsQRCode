begin;

-- A manually entered Other party is a snapshot, not a catalog entity.
alter table public.materials
  alter column owner_party_id drop not null,
  add column borrower_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(borrower_snapshot) = 'object');
alter table public.material_handovers
  alter column sender_party_id drop not null,
  alter column recipient_party_id drop not null;

alter table public.materials drop constraint if exists materials_loan_state;
alter table public.material_handovers
  drop constraint if exists material_handovers_parties_differ;
alter table public.material_handovers
  add constraint material_handovers_parties_differ check (
    sender_party_id is distinct from recipient_party_id
    or (sender_party_id is null and recipient_party_id is null)
  );

-- Remove generated Other IDs from existing material and handover rows while
-- preserving the exact text and permission scope already captured on them.
alter table public.materials disable trigger materials_scope_guard;
alter table public.materials disable trigger materials_sync_owner_snapshot;
update public.materials material
set owner_snapshot = public.material_owner_snapshot_from_party(
      material.owner_party_id,
      jsonb_build_object(
        'kind', 'other',
        'code', material.owner_snapshot->>'code',
        'name', material.owner_snapshot->>'name',
        'representativeName', material.owner_snapshot->>'representativeName',
        'phone', material.owner_snapshot->>'phone',
        'email', material.owner_snapshot->>'email'
      )
    ) || jsonb_build_object(
      'partyId', null, 'catalogPartyId', null, 'type', 'other', 'kind', 'other',
      'scopePartyId', party.handover_scope_party_id
    ),
    owner_party_id = null
from public.material_custodians party
where party.id = material.owner_party_id and party.is_handover_custom;

update public.materials material
set borrower_snapshot = public.material_owner_snapshot_from_party(
      material.borrower_party_id,
      jsonb_build_object(
        'code', party.code, 'name', party.name,
        'representativeName', party.representative_name,
        'phone', party.phone, 'email', party.email
      )
    ) || jsonb_build_object(
      'partyId', null, 'catalogPartyId', null, 'type', 'other', 'kind', 'other',
      'scopePartyId', party.handover_scope_party_id
    ),
    borrower_party_id = null
from public.material_custodians party
where party.id = material.borrower_party_id and party.is_handover_custom;

update public.materials material
set borrower_snapshot = public.material_owner_snapshot_from_party(
      material.borrower_party_id,
      jsonb_build_object(
        'code', party.code, 'name', party.name,
        'representativeName', party.representative_name,
        'phone', party.phone, 'email', party.email
      )
    )
from public.material_custodians party
where party.id = material.borrower_party_id
  and not party.is_handover_custom
  and material.status = 'loaned'
  and material.borrower_snapshot = '{}'::jsonb;

alter table public.materials add constraint materials_loan_state check (
  (status = 'available' and active_loan_handover_id is null
    and borrower_party_id is null and borrower_snapshot = '{}'::jsonb)
  or (status = 'loaned' and active_loan_handover_id is not null
    and borrower_snapshot <> '{}'::jsonb
    and (borrower_party_id is null
      and borrower_snapshot->>'type' = 'other'
      or borrower_party_id is not null
        and borrower_party_id is distinct from owner_party_id))
);

alter table public.material_handovers disable trigger material_handovers_scope_guard;
update public.material_handovers handover
set sender_party_snapshot = coalesce(nullif(handover.sender_party_snapshot, '{}'::jsonb),
      public.material_party_json(sender.id))
      || jsonb_build_object(
        'id', null, 'partyId', null, 'catalogPartyId', null,
        'type', 'other', 'isHandoverCustom', false,
        'scopePartyId', sender.handover_scope_party_id,
        'handoverScopePartyId', sender.handover_scope_party_id,
        'code', coalesce(handover.sender_party_snapshot->>'code', sender.code),
        'name', coalesce(handover.sender_party_snapshot->>'name', sender.name),
        'phone', coalesce(handover.sender_party_snapshot->>'phone', sender.phone),
        'email', coalesce(handover.sender_party_snapshot->>'email', sender.email),
        'representativeName', coalesce(handover.sender_party_snapshot->>'representativeName', sender.representative_name)
      ),
    sender_party_id = null
from public.material_custodians sender
where sender.id = handover.sender_party_id and sender.is_handover_custom;

update public.material_handovers handover
set recipient_party_snapshot = coalesce(nullif(handover.recipient_party_snapshot, '{}'::jsonb),
      public.material_party_json(recipient.id))
      || jsonb_build_object(
        'id', null, 'partyId', null, 'catalogPartyId', null,
        'type', 'other', 'isHandoverCustom', false,
        'scopePartyId', recipient.handover_scope_party_id,
        'handoverScopePartyId', recipient.handover_scope_party_id,
        'code', coalesce(handover.recipient_party_snapshot->>'code', recipient.code),
        'name', coalesce(handover.recipient_party_snapshot->>'name', recipient.name),
        'phone', coalesce(handover.recipient_party_snapshot->>'phone', recipient.phone),
        'email', coalesce(handover.recipient_party_snapshot->>'email', recipient.email),
        'representativeName', coalesce(handover.recipient_party_snapshot->>'representativeName', recipient.representative_name)
      ),
    recipient_party_id = null
from public.material_custodians recipient
where recipient.id = handover.recipient_party_id and recipient.is_handover_custom;
alter table public.material_handovers enable trigger material_handovers_scope_guard;

-- Keep audit snapshots readable without retaining the generated Other ID.
update public.material_history history
set from_state = case when custom_party.id is not null then
      jsonb_set(jsonb_set(history.from_state, '{ownerPartyId}', 'null'::jsonb),
        '{ownerSnapshot}', coalesce(history.from_state->'ownerSnapshot', '{}'::jsonb)
          || jsonb_build_object('partyId', null, 'catalogPartyId', null,
            'kind', 'other', 'type', 'other', 'scopePartyId', custom_party.handover_scope_party_id), true)
      else history.from_state end,
    to_state = case when custom_party.id is not null then
      jsonb_set(jsonb_set(history.to_state, '{ownerPartyId}', 'null'::jsonb),
        '{ownerSnapshot}', coalesce(history.to_state->'ownerSnapshot', '{}'::jsonb)
          || jsonb_build_object('partyId', null, 'catalogPartyId', null,
            'kind', 'other', 'type', 'other', 'scopePartyId', custom_party.handover_scope_party_id), true)
      else history.to_state end
from public.material_custodians custom_party
where custom_party.is_handover_custom
  and ((history.from_state->>'ownerPartyId')::uuid = custom_party.id
    or (history.to_state->>'ownerPartyId')::uuid = custom_party.id);

update public.material_handover_items item
set material_snapshot = jsonb_set(
      jsonb_set(item.material_snapshot, '{ownerPartyId}', 'null'::jsonb),
      '{ownerSnapshot}', coalesce(item.material_snapshot->'ownerSnapshot', '{}'::jsonb)
        || jsonb_build_object('partyId', null, 'catalogPartyId', null,
          'kind', 'other', 'type', 'other', 'scopePartyId', party.handover_scope_party_id), true)
from public.material_custodians party
where party.is_handover_custom
  and (item.material_snapshot->>'ownerPartyId')::uuid = party.id;

-- Old Other records no longer participate in selection or identity matching.
delete from public.material_custodians party
where party.is_handover_custom
  and not exists (select 1 from public.materials material
    where material.owner_party_id = party.id or material.borrower_party_id = party.id)
  and not exists (select 1 from public.material_handovers handover
    where handover.sender_party_id = party.id or handover.recipient_party_id = party.id)
  and not exists (select 1 from public.material_custodians child
    where child.parent_id = party.id or child.handover_scope_party_id = party.id);

alter table public.materials enable trigger materials_sync_owner_snapshot;
alter table public.materials enable trigger materials_scope_guard;

create or replace function private.manual_other_party_snapshot(
  p_name text,
  p_code text,
  p_representative_name text,
  p_phone text,
  p_email text,
  p_scope_party_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'kind', 'other', 'type', 'other', 'partyId', null, 'id', null,
    'catalogPartyId', null, 'sourceType', null, 'sourceId', null,
    'departmentId', null, 'departmentSourceId', null, 'departmentCode', null,
    'departmentName', null, 'teamId', null, 'teamSourceId', null,
    'teamCode', null, 'teamName', null, 'employeeId', null,
    'employeeSourceId', null, 'employeeCode', null, 'employeeName', null,
    'externalOrganizationId', null, 'warehouseId', null,
    'scopePartyId', p_scope_party_id,
    'handoverScopePartyId', p_scope_party_id,
    'code', coalesce(btrim(p_code), ''), 'name', coalesce(btrim(p_name), ''),
    'representativeName', coalesce(btrim(p_representative_name), ''),
    'phone', coalesce(btrim(p_phone), ''), 'email', coalesce(btrim(p_email), ''),
    'isHandoverCustom', false, 'capturedAt', timezone('utc', now())
  );
$$;
revoke all on function private.manual_other_party_snapshot(text, text, text, text, text, uuid)
  from public, anon, authenticated;

create or replace function private.handover_snapshot_for_party(
  p_party_id uuid,
  p_kind text,
  p_code text,
  p_name text,
  p_representative_name text,
  p_phone text,
  p_email text,
  p_scope_party_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_party public.material_custodians%rowtype;
begin
  if p_kind = 'other' then
    return private.manual_other_party_snapshot(
      p_name, p_code, p_representative_name, p_phone, p_email, p_scope_party_id
    );
  end if;
  select * into v_party from public.material_custodians where id = p_party_id;
  if not found then raise exception 'Catalog party not found' using errcode = 'P0002'; end if;
  return public.material_party_json(p_party_id) || jsonb_build_object(
    'id', p_party_id, 'partyId', p_party_id,
    'catalogPartyId', p_party_id, 'type', v_party.type,
    'code', coalesce(nullif(btrim(p_code), ''), v_party.code),
    'name', coalesce(nullif(btrim(p_name), ''), v_party.name),
    'representativeName', coalesce(btrim(p_representative_name), ''),
    'phone', coalesce(btrim(p_phone), ''), 'email', coalesce(btrim(p_email), ''),
    'scopePartyId', v_party.handover_scope_party_id,
    'handoverScopePartyId', v_party.handover_scope_party_id,
    'isHandoverCustom', false
  );
end;
$$;
revoke all on function private.handover_snapshot_for_party(uuid, text, text, text, text, text, text, uuid)
  from public, anon, authenticated;

create or replace function private.owner_snapshot_from_handover_party(p_snapshot jsonb, p_party_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_party_id is null then
    return private.manual_other_party_snapshot(
      p_snapshot->>'name', p_snapshot->>'code', p_snapshot->>'representativeName',
      p_snapshot->>'phone', p_snapshot->>'email',
      coalesce(nullif(p_snapshot->>'scopePartyId', '')::uuid,
        nullif(p_snapshot->>'handoverScopePartyId', '')::uuid)
    );
  end if;
  return public.material_owner_snapshot_from_party(p_party_id, jsonb_build_object(
    'code', p_snapshot->>'code', 'name', p_snapshot->>'name',
    'representativeName', p_snapshot->>'representativeName',
    'phone', p_snapshot->>'phone', 'email', p_snapshot->>'email'
  ));
end;
$$;
revoke all on function private.owner_snapshot_from_handover_party(jsonb, uuid)
  from public, anon, authenticated;

create or replace function private.borrower_snapshot_from_handover_party(p_snapshot jsonb, p_party_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'kind', case when p_party_id is null then 'other'
      when p_snapshot->>'type' = 'external' then 'external'
      when p_snapshot->>'type' = 'warehouse' then 'warehouse' else 'eps' end,
    'type', p_snapshot->>'type',
    'partyId', p_party_id, 'catalogPartyId', p_snapshot->'catalogPartyId',
    'scopePartyId', coalesce(p_snapshot->'scopePartyId', p_snapshot->'handoverScopePartyId'),
    'code', coalesce(p_snapshot->'code', '""'::jsonb),
    'name', coalesce(p_snapshot->'name', '""'::jsonb),
    'representativeName', coalesce(p_snapshot->'representativeName', '""'::jsonb),
    'phone', coalesce(p_snapshot->'phone', '""'::jsonb),
    'email', coalesce(p_snapshot->'email', '""'::jsonb)
  );
$$;
revoke all on function private.borrower_snapshot_from_handover_party(jsonb, uuid)
  from public, anon, authenticated;

create or replace function private.matches_manual_party(p_material_snapshot jsonb, p_party_snapshot jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_material_snapshot->>'kind', p_material_snapshot->>'type') = 'other'
    and p_party_snapshot->>'type' = 'other'
    and coalesce(nullif(p_material_snapshot->>'scopePartyId', ''),
      nullif(p_material_snapshot->>'handoverScopePartyId', ''))
      = coalesce(nullif(p_party_snapshot->>'scopePartyId', ''),
        nullif(p_party_snapshot->>'handoverScopePartyId', ''))
    and lower(btrim(coalesce(p_material_snapshot->>'name', '')))
      = lower(btrim(coalesce(p_party_snapshot->>'name', '')));
$$;
revoke all on function private.matches_manual_party(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function private.sync_material_owner_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.materials_temp_party_mapping', true) is distinct from 'true'
    and new.owner_snapshot->>'kind' = 'other' then
    new.owner_party_id := null;
    return new;
  end if;
  if current_setting('app.materials_temp_party_mapping', true) = 'true' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.owner_party_id is not null and new.owner_snapshot = '{}'::jsonb then
      new.owner_snapshot := public.material_owner_snapshot_from_party(new.owner_party_id, '{}'::jsonb);
    end if;
  elsif new.owner_party_id is distinct from old.owner_party_id
    and new.owner_party_id is not null
    and new.owner_snapshot->>'catalogPartyId' is distinct from new.owner_party_id::text then
    new.owner_snapshot := public.material_owner_snapshot_from_party(new.owner_party_id, '{}'::jsonb);
  end if;
  return new;
end;
$$;
revoke all on function private.sync_material_owner_snapshot() from public, anon, authenticated;
drop trigger if exists materials_sync_owner_snapshot on public.materials;
create trigger materials_sync_owner_snapshot
before insert or update of owner_party_id on public.materials
for each row execute function private.sync_material_owner_snapshot();

create or replace function private.sync_material_borrower_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.materials_temp_party_mapping', true) = 'true' then
    return new;
  end if;
  if new.status = 'available' then
    new.borrower_snapshot := '{}'::jsonb;
  elsif new.borrower_party_id is not null
    and (new.borrower_party_id is distinct from old.borrower_party_id
      or new.borrower_snapshot = '{}'::jsonb)
    and new.borrower_snapshot->>'catalogPartyId' is distinct from new.borrower_party_id::text then
    new.borrower_snapshot := private.borrower_snapshot_from_handover_party(
      public.material_party_json(new.borrower_party_id), new.borrower_party_id
    );
  end if;
  return new;
end;
$$;
revoke all on function private.sync_material_borrower_snapshot() from public, anon, authenticated;
drop trigger if exists materials_sync_borrower_snapshot on public.materials;
create trigger materials_sync_borrower_snapshot
before insert or update of borrower_party_id, borrower_snapshot, status on public.materials
for each row execute function private.sync_material_borrower_snapshot();

create or replace function public.material_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', material.id, 'code', material.code, 'modelId', material.model_id,
    'modelSnapshot', material.model_snapshot, 'nameOverride', material.name_override,
    'descriptionOverride', material.description_override,
    'images', coalesce((select jsonb_agg(jsonb_build_object(
      'id', image.id, 'storageBucket', image.storage_bucket,
      'storagePath', image.storage_path, 'externalUrl', image.external_url,
      'sortOrder', image.sort_order, 'isCover', image.is_cover
    ) order by image.sort_order, image.id)
      from public.material_images image where image.material_id = material.id), '[]'::jsonb),
    'specificationOverrides', material.specification_overrides,
    'specificationOverrideLabels', material.specification_override_labels,
    'serialNumber', material.serial_number, 'ownerPartyId', material.owner_party_id,
    'ownerSnapshot', material.owner_snapshot, 'borrowerPartyId', material.borrower_party_id,
    'borrowerSnapshot', nullif(material.borrower_snapshot, '{}'::jsonb),
    'condition', material.condition, 'note', material.note, 'status', material.status,
    'isActive', material.is_active, 'activeLoanHandoverId', material.active_loan_handover_id,
    'reservedHandoverId', material.reserved_handover_id,
    'reservationStatus', material.reservation_status, 'version', material.version,
    'createdAt', material.created_at, 'updatedAt', material.updated_at
  ) from public.materials material where material.id = p_id
$$;
revoke all on function public.material_json(uuid) from public, anon, authenticated;

-- Other owners carry no party ID. The existing permission scope is kept only
-- to authorize the operation and image path.
create or replace function public.save_material(
  p_id uuid,
  p_expected_version integer,
  p_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_values jsonb := p_values;
  v_kind text := coalesce(p_values->'ownerSnapshot'->>'kind', 'eps');
  v_owner uuid := nullif(p_values->>'ownerPartyId', '')::uuid;
  v_scope uuid := nullif(p_values->'ownerSnapshot'->>'scopePartyId', '')::uuid;
  v_id uuid;
  v_snapshot jsonb;
begin
  if v_kind = 'other' then
    if nullif(btrim(p_values->'ownerSnapshot'->>'name'), '') is null then
      raise exception 'An Other owner name is required' using errcode = '22023';
    end if;
    if p_id is not null and v_scope is null then
      select nullif(material.owner_snapshot->>'scopePartyId', '')::uuid
      into v_scope from public.materials material where material.id = p_id;
    end if;
    if v_scope is null then
      select party.id into v_scope
      from public.material_custodians party
      where party.is_active and not party.is_handover_custom
        and party.type in ('department', 'team', 'person')
        and public.has_scoped_permission('materials:material:manage', party.id)
        and public.material_can_represent(party.id)
      order by case party.type when 'department' then 0 when 'team' then 1 else 2 end,
        lower(party.name) collate "vi-x-icu", party.id limit 1;
    end if;
    if v_scope is null or not exists (
      select 1 from public.material_custodians party
      where party.id = v_scope and party.is_active and not party.is_handover_custom
        and party.type in ('department', 'team', 'person')
        and public.has_scoped_permission('materials:material:manage', party.id)
        and public.material_can_represent(party.id)
    ) then
      raise exception 'Selected owner scope is not available for material management' using errcode = '42501';
    end if;
    v_values := p_values || jsonb_build_object('ownerPartyId', v_scope);
    if p_id is null then
      -- The base create workflow snapshots the operational scope party. Keep
      -- its catalog kind internally, then replace it with the manual snapshot
      -- below before returning the created material.
      v_values := v_values || jsonb_build_object('ownerSnapshot', '{}'::jsonb);
    end if;
  elsif v_kind not in ('eps', 'external', 'warehouse') then
    raise exception 'Invalid owner kind' using errcode = '22023';
  end if;

  v_id := public.save_material_owner_snapshot_base(p_id, p_expected_version, v_values);
  if p_id is null then
    if v_kind = 'other' then
      v_snapshot := private.manual_other_party_snapshot(
        p_values->'ownerSnapshot'->>'name', p_values->'ownerSnapshot'->>'code',
        p_values->'ownerSnapshot'->>'representativeName',
        p_values->'ownerSnapshot'->>'phone', p_values->'ownerSnapshot'->>'email', v_scope
      );
    else
      v_snapshot := public.material_owner_snapshot_from_party(
        v_owner, coalesce(p_values->'ownerSnapshot', '{}'::jsonb)
      );
    end if;
    update public.materials set owner_party_id = null, owner_snapshot = v_snapshot
    where v_kind = 'other' and id = v_id;
    update public.materials set owner_snapshot = v_snapshot
    where v_kind <> 'other' and id = v_id;
    update public.material_history history
    set to_state = public.material_json(v_id)
    where history.id = (
      select latest.id from public.material_history latest
      where latest.material_id = v_id and latest.action = 'created'
      order by latest.created_at desc, latest.id desc limit 1
    );
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_material(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_material(uuid, integer, jsonb) to authenticated;

create or replace function public.can_view_material_current(target_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.materials material
    where material.id = target_material_id
      and (
        public.has_scoped_permission('materials:material:view',
          coalesce(material.owner_party_id,
            nullif(material.owner_snapshot->>'scopePartyId', '')::uuid))
        or (material.status = 'loaned' and public.has_scoped_permission(
          'materials:material:view', coalesce(material.borrower_party_id,
            nullif(material.borrower_snapshot->>'scopePartyId', '')::uuid)))
      )
  );
$$;

create or replace function public.can_view_handover(target_handover_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.material_handovers handover
    where handover.id = target_handover_id
      and (
        public.has_scoped_permission('materials:handover:view', coalesce(
          handover.sender_party_id,
          nullif(handover.sender_party_snapshot->>'scopePartyId', '')::uuid,
          nullif(handover.sender_party_snapshot->>'handoverScopePartyId', '')::uuid))
        or public.has_scoped_permission('materials:handover:view', coalesce(
          handover.recipient_party_id,
          nullif(handover.recipient_party_snapshot->>'scopePartyId', '')::uuid,
          nullif(handover.recipient_party_snapshot->>'handoverScopePartyId', '')::uuid))
        or (handover.receipt_id is not null and exists (
          select 1 from public.material_receipts receipt
          where receipt.id = handover.receipt_id
            and public.has_scoped_permission('materials:receipt:view', receipt.warehouse_id)
        ))
      )
  );
$$;

create or replace function private.guard_material_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authorized boolean := false;
  transition_id uuid;
  sender_scope uuid;
  recipient_scope uuid;
  old_owner_scope uuid;
  new_owner_scope uuid;
  old_borrower_scope uuid;
  new_borrower_scope uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if current_setting('app.materials_temp_party_mapping', true) = 'true' then return new; end if;
  if tg_op <> 'INSERT' then
    old_owner_scope := coalesce(old.owner_party_id,
      nullif(old.owner_snapshot->>'scopePartyId', '')::uuid);
    old_borrower_scope := coalesce(old.borrower_party_id,
      nullif(old.borrower_snapshot->>'scopePartyId', '')::uuid);
  end if;
  if tg_op <> 'DELETE' then
    new_owner_scope := coalesce(new.owner_party_id,
      nullif(new.owner_snapshot->>'scopePartyId', '')::uuid);
    new_borrower_scope := coalesce(new.borrower_party_id,
      nullif(new.borrower_snapshot->>'scopePartyId', '')::uuid);
  end if;

  if tg_op = 'INSERT' then
    authorized := public.has_scoped_permission('materials:material:manage', new_owner_scope)
      or public.has_scoped_permission('materials:receipt:manage', new_owner_scope);
  elsif tg_op = 'DELETE' then
    authorized := public.has_scoped_permission('materials:material:manage', old_owner_scope);
  elsif current_setting('app.materials_handover_transition', true) = 'true'
    or current_setting('app.materials_warehouse_transition', true) = 'true' then
    transition_id := coalesce(old.reserved_handover_id, new.reserved_handover_id,
      old.active_loan_handover_id, new.active_loan_handover_id);
    if transition_id is not null then
      select coalesce(handover.sender_party_id,
               nullif(handover.sender_party_snapshot->>'scopePartyId', '')::uuid,
               nullif(handover.sender_party_snapshot->>'handoverScopePartyId', '')::uuid),
             coalesce(handover.recipient_party_id,
               nullif(handover.recipient_party_snapshot->>'scopePartyId', '')::uuid,
               nullif(handover.recipient_party_snapshot->>'handoverScopePartyId', '')::uuid)
      into sender_scope, recipient_scope
      from public.material_handovers handover where handover.id = transition_id;
    end if;
    authorized := public.has_scoped_permission('materials:handover:manage', sender_scope)
      or public.has_scoped_permission('materials:handover:manage', recipient_scope)
      or public.has_scoped_permission('materials:receipt:manage', old_owner_scope)
      or public.has_scoped_permission('materials:receipt:manage', new_owner_scope);
  else
    authorized := (
      public.has_scoped_permission('materials:material:manage', old_owner_scope)
      or public.has_scoped_permission('materials:receipt:manage', old_owner_scope)
    ) and new.owner_party_id is not distinct from old.owner_party_id;
  end if;
  if not coalesce(authorized, false) then
    raise exception 'Material is outside the permitted management scope' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

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
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if current_setting('app.materials_temp_party_mapping', true) is distinct from 'true' then
    if new.sender_party_snapshot->>'type' = 'other' then new.sender_party_id := null; end if;
    if new.recipient_party_snapshot->>'type' = 'other' then new.recipient_party_id := null; end if;
  end if;
  actor_setting := nullif(current_setting('app.materials_handover_actor_party_id', true), '');
  if actor_setting is not null then actor_party_id := actor_setting::uuid; end if;
  new_sender_scope := coalesce(new.sender_party_id,
    nullif(new.sender_party_snapshot->>'scopePartyId', '')::uuid,
    nullif(new.sender_party_snapshot->>'handoverScopePartyId', '')::uuid);
  new_recipient_scope := coalesce(new.recipient_party_id,
    nullif(new.recipient_party_snapshot->>'scopePartyId', '')::uuid,
    nullif(new.recipient_party_snapshot->>'handoverScopePartyId', '')::uuid);
  if actor_party_id is null then
    actor_party_id := case when new.mode = 'warehouse_request'
      then new_recipient_scope else new_sender_scope end;
  end if;
  if actor_party_id is distinct from new_sender_scope
    and actor_party_id is distinct from new_recipient_scope then
    raise exception 'Handover is outside the represented management scope' using errcode = '42501';
  end if;
  if not public.has_scoped_permission('materials:handover:manage', actor_party_id)
    or not public.material_can_represent(actor_party_id) then
    if current_setting('app.materials_warehouse_transition', true) = 'true'
      and new.receipt_id is not null and exists (
        select 1 from public.material_receipts receipt
        where receipt.id = new.receipt_id
          and public.has_scoped_permission('materials:receipt:manage', receipt.warehouse_id)
      ) then return new; end if;
    raise exception 'Handover is outside the represented management scope' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'draft' then
    old_sender_scope := coalesce(old.sender_party_id,
      nullif(old.sender_party_snapshot->>'scopePartyId', '')::uuid,
      nullif(old.sender_party_snapshot->>'handoverScopePartyId', '')::uuid);
    if old_sender_scope is distinct from new_sender_scope
      and (not public.has_scoped_permission('materials:handover:manage', old_sender_scope)
        or not public.material_can_represent(old_sender_scope)) then
      raise exception 'The previous sender is outside the represented management scope' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.list_materials(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce((p_filters->>'page')::integer, 1), 1);
  v_size integer := least(greatest(coalesce((p_filters->>'pageSize')::integer, 20), 1), 100);
  v_owner uuid := nullif(p_filters->>'ownerPartyId', '')::uuid;
  v_owner_catalog text := nullif(p_filters->>'ownerCatalogId', '');
  v_owner_scope uuid := nullif(p_filters->>'ownerScopePartyId', '')::uuid;
  v_borrower_scope uuid := nullif(p_filters->>'borrowerScopePartyId', '')::uuid;
  v_owner_name text := nullif(btrim(p_filters->>'ownerName'), '');
  v_borrower_name text := nullif(btrim(p_filters->>'borrowerName'), '');
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode = '42501';
  end if;
  return (
    with filtered as (
      select material.id, material.status, material.name_override, material.model_snapshot
      from public.materials material
      where public.can_view_material_current(material.id)
        and (nullif(p_filters->>'id', '') is null or material.id = (p_filters->>'id')::uuid)
        and (not coalesce((p_filters->>'excludeReserved')::boolean, false)
          or material.reserved_handover_id is null
          or material.reserved_handover_id = nullif(p_filters->>'allowReservedByHandoverId', '')::uuid)
        and (nullif(p_filters->>'modelId', '') is null or material.model_id = (p_filters->>'modelId')::uuid)
        and (nullif(p_filters->>'groupId', '') is null or material.model_snapshot->>'groupId' = p_filters->>'groupId')
        and (v_owner is null or material.owner_party_id = v_owner
          or material.owner_snapshot->>'departmentId' = v_owner::text
          or material.owner_snapshot->>'teamId' = v_owner::text
          or material.owner_snapshot->>'employeeId' = v_owner::text)
        and (v_owner_scope is null or (material.owner_party_id is null
          and material.owner_snapshot->>'kind' = 'other'
          and nullif(material.owner_snapshot->>'scopePartyId', '')::uuid = v_owner_scope
          and (v_owner_name is null or lower(btrim(material.owner_snapshot->>'name')) = lower(v_owner_name))))
        and (v_owner_catalog is null
          or material.owner_snapshot->>'sourceId' = v_owner_catalog
          or material.owner_snapshot->>'departmentSourceId' = v_owner_catalog
          or material.owner_snapshot->>'teamSourceId' = v_owner_catalog
          or material.owner_snapshot->>'employeeSourceId' = v_owner_catalog
          or material.owner_snapshot->>'externalOrganizationId' = v_owner_catalog
          or material.owner_snapshot->>'warehouseId' = v_owner_catalog)
        and (nullif(p_filters->>'borrowerPartyId', '') is null
          or material.borrower_party_id = (p_filters->>'borrowerPartyId')::uuid)
        and (v_borrower_scope is null or (material.borrower_party_id is null
          and material.borrower_snapshot->>'type' = 'other'
          and nullif(material.borrower_snapshot->>'scopePartyId', '')::uuid = v_borrower_scope
          and (v_borrower_name is null or lower(btrim(material.borrower_snapshot->>'name')) = lower(v_borrower_name))))
        and (nullif(p_filters->>'status', '') is null or material.status = p_filters->>'status')
        and (nullif(p_filters->>'condition', '') is null or material.condition = p_filters->>'condition')
        and (nullif(p_filters->>'search', '') is null or concat_ws(' ', material.code, material.serial_number,
          material.name_override, material.model_snapshot->>'name') ilike '%' || btrim(p_filters->>'search') || '%')
        and (nullif(p_filters->>'updatedFrom', '') is null or material.updated_at >= (p_filters->>'updatedFrom')::timestamptz)
        and (nullif(p_filters->>'updatedTo', '') is null or material.updated_at < (p_filters->>'updatedTo')::timestamptz + interval '1 day')
        and (nullif(p_filters->>'isActive', '') is null or material.is_active = (p_filters->>'isActive')::boolean)
        and (nullif(p_filters->>'receiptId', '') is null or exists (
          select 1 from public.material_receipt_items item
          join public.material_receipts receipt on receipt.id = item.receipt_id
          where item.receipt_id = (p_filters->>'receiptId')::uuid and item.material_id = material.id
            and item.status = 'active' and receipt.status = 'handover'
            and receipt.warehouse_id = material.owner_party_id and public.can_view_receipt(receipt.id)
        ))
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(public.material_json(page.id) order by
        case page.status when 'available' then 0 when 'loaned' then 1 else 2 end,
        lower(coalesce(nullif(btrim(page.name_override), ''), page.model_snapshot->>'name', '')) collate "vi-x-icu", page.id)
        from (select * from filtered order by
          case status when 'available' then 0 when 'loaned' then 1 else 2 end,
          lower(coalesce(nullif(btrim(name_override), ''), model_snapshot->>'name', '')) collate "vi-x-icu", id
          offset (v_page - 1) * v_size limit v_size) page), '[]'::jsonb),
      'total', (select count(*) from filtered), 'page', v_page, 'pageSize', v_size
    )
  );
end;
$$;
revoke all on function public.list_materials(jsonb) from public, anon;
grant execute on function public.list_materials(jsonb) to authenticated;

-- Model refresh still authorizes against the material's real owner scope when
-- the owner itself is a free-form snapshot with no catalog party ID.
create or replace function public.preview_material_model_sync(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.materials%rowtype;
  v_new jsonb;
  v_owner_scope uuid;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode = '42501';
  end if;
  select * into v_row from public.materials where id = p_id;
  if not found then raise exception 'Material not found' using errcode = 'P0002'; end if;
  v_owner_scope := coalesce(v_row.owner_party_id,
    nullif(v_row.owner_snapshot->>'scopePartyId', '')::uuid);
  if not public.material_can_represent(v_owner_scope) then
    raise exception 'You must represent the owner party' using errcode = '42501';
  end if;
  v_new := public.material_model_snapshot(v_row.model_id);
  return jsonb_build_object(
    'materialId', v_row.id,
    'currentSnapshot', v_row.model_snapshot,
    'proposedSnapshot', v_new,
    'modelUpdatedAt', (select model.updated_at from public.material_models model where model.id = v_row.model_id),
    'preservedOverrides', coalesce((select jsonb_agg(key) from jsonb_object_keys(v_row.specification_overrides) key), '[]'::jsonb),
    'changedFields', coalesce((select jsonb_agg(field.name) from (values
      ('code', v_row.model_snapshot->'code', v_new->'code'),
      ('name', v_row.model_snapshot->'name', v_new->'name'),
      ('groupId', v_row.model_snapshot->'groupId', v_new->'groupId'),
      ('description', v_row.model_snapshot->'description', v_new->'description'),
      ('requiresInspection', v_row.model_snapshot->'requiresInspection', v_new->'requiresInspection'),
      ('specifications', v_row.model_snapshot->'specifications', v_new->'specifications'),
      ('images', v_row.model_snapshot->'images', v_new->'images')
    ) field(name, old_value, new_value) where field.old_value is distinct from field.new_value), '[]'::jsonb)
  );
end;
$$;

create or replace function public.apply_material_model_sync(
  p_id uuid,
  p_expected_version integer,
  p_expected_model_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.materials%rowtype;
  v_before jsonb;
  v_new jsonb;
  v_new_overrides jsonb := '{}'::jsonb;
  v_key text;
  v_spec jsonb;
  v_owner_scope uuid;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode = '42501';
  end if;
  select * into v_row from public.materials where id = p_id for update;
  if not found then raise exception 'Material not found' using errcode = 'P0002'; end if;
  if v_row.version is distinct from p_expected_version then
    raise exception 'Material changed; reload before syncing' using errcode = '40001';
  end if;
  if p_expected_model_updated_at is null
    or (select model.updated_at from public.material_models model where model.id = v_row.model_id)
      is distinct from p_expected_model_updated_at then
    raise exception 'Model changed after preview; reload the sync preview' using errcode = '40001';
  end if;
  v_owner_scope := coalesce(v_row.owner_party_id,
    nullif(v_row.owner_snapshot->>'scopePartyId', '')::uuid);
  if not public.material_can_represent(v_owner_scope) then
    raise exception 'You must represent the owner party' using errcode = '42501';
  end if;
  if v_row.reserved_handover_id is not null then
    raise exception 'Material is reserved by an open handover' using errcode = '55000';
  end if;
  v_before := public.material_json(p_id);
  v_new := public.material_model_snapshot(v_row.model_id);
  for v_key in select jsonb_object_keys(v_row.specification_overrides) loop
    select specification.value into v_spec
    from jsonb_array_elements(v_new->'specifications') specification(value)
    where specification.value->>'id' = v_key;
    if v_spec is null or not public.material_spec_override_is_valid(v_spec, v_row.specification_overrides->v_key) then
      raise exception 'The model removed or changed an overridden specification; resolve overrides before syncing' using errcode = '22023';
    end if;
    v_new_overrides := v_new_overrides || jsonb_build_object(v_key, v_row.specification_overrides->v_key);
  end loop;
  update public.materials set model_snapshot = v_new, specification_overrides = v_new_overrides,
    version = version + 1, updated_at = timezone('utc', now()) where id = p_id;
  insert into public.material_history(material_id, action, note, from_state, to_state)
  values (p_id, 'model_synced', 'Đồng bộ phiên bản mẫu vật tư', v_before, public.material_json(p_id));
  return p_id;
end;
$$;

create or replace function public.save_handover(p_id uuid, p_values jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender_kind text := coalesce(p_values->>'senderPartyKind', 'eps');
  v_recipient_kind text := coalesce(p_values->>'recipientPartyKind', 'eps');
  v_sender uuid := case when v_sender_kind = 'other' then null
    else nullif(p_values->>'senderPartyId', '')::uuid end;
  v_recipient uuid := case when v_recipient_kind = 'other' then null
    else nullif(p_values->>'recipientPartyId', '')::uuid end;
  v_sender_scope uuid := nullif(p_values->>'senderPartyScopePartyId', '')::uuid;
  v_recipient_scope uuid := nullif(p_values->>'recipientPartyScopePartyId', '')::uuid;
  v_sender_access uuid;
  v_temp_sender uuid;
  v_temp_recipient uuid;
  v_sender_snapshot jsonb;
  v_recipient_snapshot jsonb;
  v_reverse_id uuid := nullif(p_values->>'reverseFromHandoverId', '')::uuid;
  v_reverse public.material_handovers%rowtype;
  v_values jsonb;
  v_id uuid;
  v_item jsonb;
  v_material public.materials%rowtype;
  v_type text := p_values->>'type';
begin
  if v_sender_kind not in ('eps', 'external', 'warehouse', 'other')
    or v_recipient_kind not in ('eps', 'external', 'warehouse', 'other') then
    raise exception 'Invalid handover party kind' using errcode = '22023';
  end if;
  if v_sender_kind <> 'other' and v_recipient_kind <> 'other' then
    return public.save_handover_party_snapshot_base(p_id, p_values);
  end if;
  if auth.uid() is null or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to manage handovers' using errcode = '42501';
  end if;
  if v_type not in ('transfer', 'loan', 'return') then
    raise exception 'Invalid handover type' using errcode = '22023';
  end if;
  if nullif(btrim(p_values->>'senderPartyName'), '') is null
    or nullif(btrim(p_values->>'recipientPartyName'), '') is null then
    raise exception 'Both handover party names are required' using errcode = '22023';
  end if;
  if coalesce(p_values->>'senderPartyEmail', '') <> ''
    and p_values->>'senderPartyEmail' !~* '^\S+@\S+\.\S+$' then
    raise exception 'Sender email is invalid' using errcode = '22023';
  end if;
  if coalesce(p_values->>'recipientPartyEmail', '') <> ''
    and p_values->>'recipientPartyEmail' !~* '^\S+@\S+\.\S+$' then
    raise exception 'Recipient email is invalid' using errcode = '22023';
  end if;

  if v_sender_kind = 'other' then
    if v_sender_scope is null then
      select party.id into v_sender_scope
      from public.material_custodians party
      where party.is_active and not party.is_handover_custom
        and public.has_scoped_permission('materials:handover:manage', party.id)
        and public.material_can_represent(party.id)
      order by case party.type when 'department' then 0 when 'team' then 1 else 2 end,
        lower(party.name) collate "vi-x-icu", party.id limit 1;
    end if;
    if v_sender_scope is null or not exists (
      select 1 from public.material_custodians party
      where party.id = v_sender_scope and party.is_active and not party.is_handover_custom
        and public.has_scoped_permission('materials:handover:manage', party.id)
        and public.material_can_represent(party.id)
    ) then
      raise exception 'Select a represented permission scope for the Other sender' using errcode = '42501';
    end if;
  elsif v_sender is null or not exists (
    select 1 from public.material_custodians party
    where party.id = v_sender and party.is_active and not party.is_handover_custom
      and ((v_sender_kind = 'external' and party.type = 'external')
        or (v_sender_kind = 'warehouse' and party.type = 'warehouse')
        or (v_sender_kind = 'eps' and party.type in ('department', 'team', 'person')))
  ) then
    raise exception 'Select a valid sender from the selected catalog' using errcode = '22023';
  end if;
  v_sender_access := coalesce(v_sender, v_sender_scope);
  if not public.has_scoped_permission('materials:handover:manage', v_sender_access)
    or not public.material_can_represent(v_sender_access) then
    raise exception 'You must manage and represent the sender party' using errcode = '42501';
  end if;

  if v_recipient_kind = 'other' then
    v_recipient_scope := v_sender_access;
    if v_recipient_scope is null or not exists (
      select 1 from public.material_custodians party
      where party.id = v_recipient_scope and party.is_active and not party.is_handover_custom
    ) then
      raise exception 'The Other recipient permission scope is unavailable' using errcode = '22023';
    end if;
  elsif v_recipient is null or not exists (
    select 1 from public.material_custodians party
    where party.id = v_recipient and party.is_active and not party.is_handover_custom
      and ((v_recipient_kind = 'external' and party.type = 'external')
        or (v_recipient_kind = 'warehouse' and party.type = 'warehouse')
        or (v_recipient_kind = 'eps' and party.type in ('department', 'team', 'person')))
  ) then
    raise exception 'Select a valid recipient from the selected catalog' using errcode = '22023';
  end if;

  v_sender_snapshot := private.handover_snapshot_for_party(
    v_sender, v_sender_kind, p_values->>'senderPartyCode', p_values->>'senderPartyName',
    p_values->>'senderRepresentativeName', p_values->>'senderPartyPhone',
    p_values->>'senderPartyEmail', v_sender_scope
  );
  v_recipient_snapshot := private.handover_snapshot_for_party(
    v_recipient, v_recipient_kind, p_values->>'recipientPartyCode', p_values->>'recipientPartyName',
    p_values->>'recipientRepresentativeName', p_values->>'recipientPartyPhone',
    p_values->>'recipientPartyEmail', v_recipient_scope
  );
  if v_sender is not null and v_sender = v_recipient then
    raise exception 'Sender and recipient must be different parties' using errcode = '22023';
  end if;
  if v_sender_kind = 'other' and v_recipient_kind = 'other'
    and private.matches_manual_party(v_sender_snapshot, v_recipient_snapshot) then
    raise exception 'Sender and recipient must be different parties' using errcode = '22023';
  end if;

  v_temp_sender := coalesce(v_sender, v_sender_scope);
  v_temp_recipient := coalesce(v_recipient, v_recipient_scope);
  if v_temp_sender = v_temp_recipient then
    select party.id into v_temp_recipient
    from public.material_custodians party
    where party.is_active and not party.is_handover_custom and party.id <> v_temp_sender
    order by lower(party.name) collate "vi-x-icu", party.id limit 1;
  end if;
  if v_temp_sender is null or v_temp_recipient is null or v_temp_sender = v_temp_recipient then
    raise exception 'Could not resolve operational handover scope' using errcode = '22023';
  end if;

  if v_reverse_id is not null then
    select * into v_reverse from public.material_handovers
    where id = v_reverse_id for share;
    if not found or v_reverse.status <> 'completed'
      or v_reverse.mode <> 'standard' or v_reverse.type not in ('transfer', 'loan') then
      raise exception 'Only a completed transfer or loan can be reversed' using errcode = '55000';
    end if;
    if (v_sender is not null and v_sender <> v_reverse.recipient_party_id)
      or (v_sender is null and not private.matches_manual_party(
        v_sender_snapshot, v_reverse.recipient_party_snapshot))
      or (v_recipient is not null and v_recipient <> v_reverse.sender_party_id)
      or (v_recipient is null and not private.matches_manual_party(
        v_recipient_snapshot, v_reverse.sender_party_snapshot))
      or (v_type is distinct from case when v_reverse.type = 'loan' then 'return' else 'transfer' end) then
      raise exception 'Reverse handover parties or type do not match the source' using errcode = '22023';
    end if;
    if jsonb_array_length(coalesce(p_values->'items', '[]'::jsonb)) <>
      (select count(*) from public.material_handover_items where handover_id = v_reverse_id)
      or exists (select 1 from public.material_handover_items source_item
        where source_item.handover_id = v_reverse_id and not exists (
          select 1 from jsonb_array_elements(coalesce(p_values->'items', '[]'::jsonb)) selected
          where (selected.value->>'materialId')::uuid = source_item.material_id
        )) then
      raise exception 'Reverse handover must include all source materials' using errcode = '22023';
    end if;
  end if;

  perform set_config('app.materials_temp_party_mapping', 'true', true);
  perform set_config('app.materials_handover_actor_party_id', v_sender_access::text, true);
  perform set_config('app.materials_handover_transition', 'true', true);
  perform 1 from public.materials material
  where material.reserved_handover_id = p_id
    or material.id in (select (selected.value->>'materialId')::uuid
      from jsonb_array_elements(coalesce(p_values->'items', '[]'::jsonb)) selected)
  order by material.id for update;

  for v_item in select value from jsonb_array_elements(coalesce(p_values->'items', '[]'::jsonb)) loop
    select * into v_material from public.materials
    where id = (v_item->>'materialId')::uuid;
    if not found then raise exception 'A selected material no longer exists' using errcode = 'P0002'; end if;
    if v_type in ('transfer', 'loan') then
      if v_sender is not null then
        if v_material.owner_party_id is distinct from v_sender then
          raise exception 'Transfer and loan require material owned by the sender' using errcode = '55000';
        end if;
      elsif v_material.owner_party_id is not null
        or not private.matches_manual_party(v_material.owner_snapshot, v_sender_snapshot) then
        raise exception 'The entered Other sender does not match the material owner snapshot' using errcode = '55000';
      end if;
      if v_material.status <> 'available' then
        raise exception 'Transfer and loan require an available material' using errcode = '55000';
      end if;
      if v_sender is null then
        update public.materials set owner_party_id = v_temp_sender where id = v_material.id;
      end if;
    else
      if v_sender is not null then
        if v_material.borrower_party_id is distinct from v_sender then
          raise exception 'Return must come from the current borrower' using errcode = '55000';
        end if;
      elsif v_material.borrower_party_id is not null
        or not private.matches_manual_party(v_material.borrower_snapshot, v_sender_snapshot) then
        raise exception 'The entered Other sender does not match the current borrower snapshot' using errcode = '55000';
      end if;
      if v_recipient is not null then
        if v_material.owner_party_id is distinct from v_recipient then
          raise exception 'Return must be made to the current owner' using errcode = '55000';
        end if;
      elsif v_material.owner_party_id is not null
        or not private.matches_manual_party(v_material.owner_snapshot, v_recipient_snapshot) then
        raise exception 'The entered Other recipient does not match the current owner snapshot' using errcode = '55000';
      end if;
      if v_material.status <> 'loaned' then
        raise exception 'Only loaned materials can be returned' using errcode = '55000';
      end if;
      if v_recipient is null or v_temp_recipient is distinct from v_recipient then
        update public.materials set owner_party_id = v_temp_recipient where id = v_material.id;
      end if;
      if v_sender is null or v_temp_sender is distinct from v_sender then
        update public.materials set borrower_party_id = v_temp_sender where id = v_material.id;
      end if;
    end if;
  end loop;

  if p_id is not null then
    update public.material_handovers set sender_party_id = v_temp_sender,
      recipient_party_id = v_temp_recipient where id = p_id;
  end if;
  v_values := p_values || jsonb_build_object(
    'senderPartyId', v_temp_sender,
    'recipientPartyId', v_temp_recipient,
    'senderRepresentativeUserId', case when v_sender_kind = 'other' then ''
      else coalesce(p_values->>'senderRepresentativeUserId', '') end,
    'recipientRepresentativeUserId', case when v_recipient_kind = 'other' then ''
      else coalesce(p_values->>'recipientRepresentativeUserId', '') end
  );
  v_id := public.save_handover_base(p_id, v_values);

  if v_type in ('transfer', 'loan') and v_sender_kind = 'other' then
    update public.materials set owner_party_id = null
    where reserved_handover_id = v_id;
  elsif v_type = 'return' then
    update public.materials material set
      owner_party_id = v_recipient,
      borrower_party_id = v_sender
    where material.reserved_handover_id = v_id;
  end if;
  update public.material_handover_items item
  set material_snapshot = public.material_json(item.material_id)
  where item.handover_id = v_id;

  perform set_config('app.materials_temp_party_mapping', 'false', true);
  update public.material_handovers handover set
    sender_party_id = v_sender,
    recipient_party_id = v_recipient,
    sender_party_snapshot = v_sender_snapshot,
    recipient_party_snapshot = v_recipient_snapshot,
    sender_representative_user_id = case when v_sender_kind = 'other' then null
      else nullif(p_values->>'senderRepresentativeUserId', '')::uuid end,
    recipient_representative_user_id = case when v_recipient_kind = 'other' then null
      else nullif(p_values->>'recipientRepresentativeUserId', '')::uuid end,
    sender_representative_snapshot = case
      when nullif(btrim(p_values->>'senderRepresentativeName'), '') is null then null
      else jsonb_build_object('userId', case when v_sender_kind = 'other' then null
        else nullif(p_values->>'senderRepresentativeUserId', '')::uuid end,
        'displayName', btrim(p_values->>'senderRepresentativeName')) end,
    recipient_representative_snapshot = case
      when nullif(btrim(p_values->>'recipientRepresentativeName'), '') is null then null
      else jsonb_build_object('userId', case when v_recipient_kind = 'other' then null
        else nullif(p_values->>'recipientRepresentativeUserId', '')::uuid end,
        'displayName', btrim(p_values->>'recipientRepresentativeName')) end
  where handover.id = v_id;
  if v_reverse_id is not null then
    update public.material_handovers set reverses_handover_id = v_reverse_id where id = v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_handover(uuid, jsonb) from public, anon;
grant execute on function public.save_handover(uuid, jsonb) to authenticated;

create or replace function private.handover_party_scope(p_party_id uuid, p_snapshot jsonb)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_party_id,
    nullif(p_snapshot->>'scopePartyId', '')::uuid,
    nullif(p_snapshot->>'handoverScopePartyId', '')::uuid)
$$;
revoke all on function private.handover_party_scope(uuid, jsonb)
  from public, anon, authenticated;

create or replace function private.handover_party_is_active(p_party_id uuid, p_snapshot jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_party_id is not null then exists (
      select 1 from public.material_custodians party
      where party.id = p_party_id and party.is_active and not party.is_handover_custom
    )
    else p_snapshot->>'type' = 'other' and exists (
      select 1 from public.material_custodians scope_party
      where scope_party.id = private.handover_party_scope(null, p_snapshot)
        and scope_party.is_active and not scope_party.is_handover_custom
    ) end
$$;
revoke all on function private.handover_party_is_active(uuid, jsonb)
  from public, anon, authenticated;

drop function public.list_handover_counterparty_options(uuid);

create function public.list_handover_counterparty_options(p_party_id uuid)
returns table (id uuid, type text, code text, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not public.has_scoped_permission('materials:handover:manage', p_party_id)
    or not public.material_can_represent(p_party_id) then
    raise exception 'You must manage and represent a handover party' using errcode = '42501';
  end if;
  return query
  select party.id, party.type, party.code, party.name
  from public.material_custodians party
  where party.is_active and not party.is_handover_custom and party.id <> p_party_id
  order by lower(party.name) collate "vi-x-icu", party.id;
end;
$$;
revoke all on function public.list_handover_counterparty_options(uuid) from public, anon;
grant execute on function public.list_handover_counterparty_options(uuid) to authenticated;

create or replace function private.account_participated_in_handover(target_handover_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.material_handovers handover
    where handover.id = target_handover_id
      and (
        public.material_can_represent(private.handover_party_scope(
          handover.sender_party_id, handover.sender_party_snapshot))
        or public.material_can_represent(private.handover_party_scope(
          handover.recipient_party_id, handover.recipient_party_snapshot))
        or exists (
          select 1 from public.material_handover_history history
          where history.handover_id = handover.id and history.actor_user_id = auth.uid()
        )
      )
  );
$$;
revoke all on function private.account_participated_in_handover(uuid)
  from public, anon, authenticated;

create or replace function private.scoped_handover_json(target_handover_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
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
    result := jsonb_set(result, '{senderRepresentative}',
      (result->'senderRepresentative') - 'userId', true);
  end if;
  if jsonb_typeof(result->'recipientRepresentative') = 'object' then
    result := jsonb_set(result, '{recipientRepresentative}',
      (result->'recipientRepresentative') - 'userId', true);
  end if;
  return result || jsonb_build_object(
    'recipientHasQrAccount', private.party_has_qrcode_account(
      (result->'recipientParty'->>'id')::uuid),
    'senderCanRepresent', public.material_can_represent(private.handover_party_scope(
      (result->'senderParty'->>'id')::uuid, result->'senderParty')),
    'recipientCanRepresent', public.material_can_represent(private.handover_party_scope(
      (result->'recipientParty'->>'id')::uuid, result->'recipientParty'))
  );
end;
$$;
revoke all on function private.scoped_handover_json(uuid)
  from public, anon, authenticated;

create or replace function public.act_on_handover(
  p_id uuid,
  p_action text,
  p_expected_version integer,
  p_note text default null,
  p_item_conditions jsonb default '[]'::jsonb
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
  v_sender_scope uuid;
  v_recipient_scope uuid;
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
  v_sender_scope := private.handover_party_scope(v_h.sender_party_id, v_h.sender_party_snapshot);
  v_recipient_scope := private.handover_party_scope(v_h.recipient_party_id, v_h.recipient_party_snapshot);

  if p_action in ('send', 'cancel') then
    v_actor_party := v_sender_scope;
  elsif p_action in ('confirm', 'reject')
    and (v_h.sender_party_snapshot->>'type' = 'other'
      or v_h.recipient_party_snapshot->>'type' = 'other') then
    if v_h.created_by is distinct from auth.uid() then
      raise exception 'Only the handover creator can act on a handover with an Other party'
        using errcode = '42501';
    end if;
    v_actor_party := v_sender_scope;
    if not public.has_scoped_permission('materials:handover:manage', v_actor_party)
      or not public.material_can_represent(v_actor_party) then
      v_actor_party := v_recipient_scope;
    end if;
  else
    v_actor_party := v_recipient_scope;
  end if;
  if not public.has_scoped_permission('materials:handover:manage', v_actor_party)
    or not public.material_can_represent(v_actor_party) then
    raise exception 'Only a represented party with handover scope can do this action' using errcode = '42501';
  end if;

  if p_action = 'send' then
    if v_h.status <> 'draft' then raise exception 'Only a draft handover can be sent' using errcode = '55000'; end if;
    if not private.handover_party_is_active(v_h.sender_party_id, v_h.sender_party_snapshot)
      or not private.handover_party_is_active(v_h.recipient_party_id, v_h.recipient_party_snapshot) then
      raise exception 'Both parties must be active to send a handover' using errcode = '22023';
    end if;
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
    if not private.handover_party_is_active(v_h.sender_party_id, v_h.sender_party_snapshot)
      or not private.handover_party_is_active(v_h.recipient_party_id, v_h.recipient_party_snapshot) then
      raise exception 'Both parties must be active to confirm a handover' using errcode = '22023';
    end if;
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
      select item.* from public.material_handover_items item
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
          and material.status = 'available' and material.borrower_party_id is null
          and material.borrower_snapshot = '{}'::jsonb and material.active_loan_handover_id is null
          and ((v_h.sender_party_id is not null and material.owner_party_id = v_h.sender_party_id)
            or (v_h.sender_party_id is null and material.owner_party_id is null
              and private.matches_manual_party(material.owner_snapshot, v_h.sender_party_snapshot)))
      ) then
        raise exception 'Current material custody no longer matches the handover sender' using errcode = '55000';
      end if;
      if v_h.type = 'return' and not exists (
        select 1 from public.materials material where material.id = v_item.material_id
          and material.status = 'loaned' and material.active_loan_handover_id is not null
          and ((v_h.recipient_party_id is not null and material.owner_party_id = v_h.recipient_party_id)
            or (v_h.recipient_party_id is null and material.owner_party_id is null
              and private.matches_manual_party(material.owner_snapshot, v_h.recipient_party_snapshot)))
          and ((v_h.sender_party_id is not null and material.borrower_party_id = v_h.sender_party_id)
            or (v_h.sender_party_id is null and material.borrower_party_id is null
              and private.matches_manual_party(material.borrower_snapshot, v_h.sender_party_snapshot)))
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
          owner_snapshot = private.owner_snapshot_from_handover_party(
            v_h.recipient_party_snapshot, v_h.recipient_party_id
          ), condition = v_condition, reserved_handover_id = null,
          reservation_status = null, version = version + 1,
          updated_at = timezone('utc', now()) where id = v_item.material_id;
      elsif v_h.type = 'loan' then
        update public.materials set borrower_party_id = v_h.recipient_party_id,
          borrower_snapshot = private.borrower_snapshot_from_handover_party(
            v_h.recipient_party_snapshot, v_h.recipient_party_id
          ), status = 'loaned', active_loan_handover_id = p_id, condition = v_condition,
          reserved_handover_id = null, reservation_status = null,
          version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
      else
        update public.materials set borrower_party_id = null, borrower_snapshot = '{}'::jsonb,
          status = 'available', active_loan_handover_id = null, condition = v_condition,
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
revoke all on function public.act_on_handover(uuid, text, integer, text, jsonb) from public, anon;
grant execute on function public.act_on_handover(uuid, text, integer, text, jsonb) to authenticated;

alter function public.complete_handover_offline(uuid, integer)
  rename to complete_handover_offline_catalog_base;
revoke all on function public.complete_handover_offline_catalog_base(uuid, integer)
  from public, anon, authenticated;
create function public.complete_handover_offline(p_id uuid, p_expected_version integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_h public.material_handovers%rowtype;
begin
  select * into v_h from public.material_handovers where id = p_id;
  if not found then raise exception 'Handover not found' using errcode = 'P0002'; end if;
  if v_h.sender_party_snapshot->>'type' = 'other'
    or v_h.recipient_party_snapshot->>'type' = 'other' then
    raise exception 'Offline completion is unavailable for handovers with an Other party'
      using errcode = '22023';
  end if;
  return public.complete_handover_offline_catalog_base(p_id, p_expected_version);
end;
$$;
revoke all on function public.complete_handover_offline(uuid, integer) from public, anon;
grant execute on function public.complete_handover_offline(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
