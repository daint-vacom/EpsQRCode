-- Keep one-off handover parties as real material owners while limiting them
-- to the permission scope of the party that created the handover.
alter table public.material_custodians
  add column phone text,
  add column email text,
  add column representative_name text,
  add column is_handover_custom boolean not null default false,
  add column handover_scope_party_id uuid references public.material_custodians(id) on delete restrict;

alter table public.material_custodians
  drop constraint if exists material_custodians_type_check,
  add constraint material_custodians_type_check
    check (type in ('department', 'team', 'person', 'external', 'warehouse', 'other')),
  add constraint material_custodians_handover_custom_check check (
    (is_handover_custom and type = 'other'
      and handover_scope_party_id is not null and handover_scope_party_id <> id)
    or (not is_handover_custom and type <> 'other'
      and handover_scope_party_id is null)
  );

create index material_custodians_handover_custom_scope_idx
  on public.material_custodians(handover_scope_party_id, lower(name) collate "vi-x-icu", id)
  where is_handover_custom;

create or replace function private.guard_handover_custom_party_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_handover_custom then
    if new.handover_scope_party_id is null
      or new.handover_scope_party_id = new.id
      or exists (
        select 1 from public.material_custodians anchor
        where anchor.id = new.handover_scope_party_id
          and anchor.is_handover_custom
      ) then
      raise exception 'A custom handover party needs a non-custom scope anchor'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_handover_custom_party_scope()
  from public, anon, authenticated;

create trigger material_custodians_guard_handover_custom_scope
before insert or update
on public.material_custodians
for each row execute function private.guard_handover_custom_party_scope();

alter table public.material_handovers
  add column reverses_handover_id uuid references public.material_handovers(id) on delete set null;

create index material_handovers_reverses_idx
  on public.material_handovers(reverses_handover_id)
  where reverses_handover_id is not null;

-- Custom parties inherit the exact authorization and representation of one
-- non-custom catalog party. The scope trigger rejects a cycle.
create or replace function private.party_in_permission_scope(
  target_party_id uuid,
  target_scope text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  party public.material_custodians%rowtype;
  current_department text;
  current_team text;
  external_organization uuid;
begin
  if auth.uid() is null or target_party_id is null then return false; end if;
  select * into party from public.material_custodians where id = target_party_id;
  if not found then return false; end if;
  if party.is_handover_custom then
    return private.party_in_permission_scope(
      party.handover_scope_party_id, target_scope
    );
  end if;

  select profile.external_organization_id into external_organization
  from public.user_profiles profile
  where profile.id = auth.uid() and profile.account_type = 'external'
    and profile.status = 'active';
  if target_scope = 'assigned_warehouses' then
    return party.type = 'warehouse' and exists (
      select 1 from public.material_warehouses warehouse
      join public.material_custodians warehouse_party
        on warehouse_party.id = warehouse.custodian_id and warehouse_party.is_active
      join public.material_warehouse_accounts assignment
        on assignment.warehouse_id = warehouse.custodian_id
      where warehouse.custodian_id = party.id and assignment.user_id = auth.uid()
    );
  end if;
  if target_scope = 'department' and external_organization is not null then
    return party.type = 'external' and party.id = external_organization;
  end if;
  select employee.department_id, employee.team_id
  into current_department, current_team
  from private.current_account_eps_employee() employee;
  if current_department is null then return false; end if;
  if target_scope = 'all' then
    return party.source_type in ('eps_department', 'eps_team', 'eps_person');
  elsif target_scope = 'team' then
    if current_team is null then return false; end if;
    if party.source_type = 'eps_team' then return party.source_id = current_team; end if;
    if party.source_type = 'eps_person' then
      return exists (
        select 1 from private.fake_eps_employees employee
        where employee.id = party.source_id and employee.team_id = current_team
          and employee.employment_status = 'active'
      );
    end if;
    return false;
  elsif target_scope = 'department' then
    if party.source_type = 'eps_department' then return party.source_id = current_department; end if;
    if party.source_type = 'eps_team' then
      return exists (
        select 1 from private.fake_eps_teams team
        where team.id = party.source_id and team.department_id = current_department
          and team.is_active
      );
    end if;
    if party.source_type = 'eps_person' then
      return exists (
        select 1 from private.fake_eps_employees employee
        where employee.id = party.source_id and employee.department_id = current_department
          and employee.employment_status = 'active'
      );
    end if;
  end if;
  return false;
end;
$$;
revoke all on function private.party_in_permission_scope(uuid, text)
  from public, anon, authenticated;

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
    where party.id = p_party_id and party.is_active and profile.status = 'active'
      and (
        (party.is_handover_custom
          and public.material_can_represent(party.handover_scope_party_id))
        or (not party.is_handover_custom and (
          (party.type = 'person' and party.account_user_id = auth.uid())
          or exists (
            select 1 from private.material_custodian_representatives representative
            where representative.custodian_id = party.id
              and representative.user_id = auth.uid()
              and (
                (party.type = 'external' and profile.account_type = 'external'
                  and profile.external_organization_id = party.id)
                or (party.type = 'department' and profile.account_type = 'eps'
                  and exists (select 1 from private.fake_eps_employees employee
                    where employee.id = profile.eps_employee_id
                      and employee.department_id = party.source_id
                      and employee.employment_status = 'active'))
                or (party.type = 'team' and profile.account_type = 'eps'
                  and exists (select 1 from private.fake_eps_employees employee
                    where employee.id = profile.eps_employee_id
                      and employee.team_id = party.source_id
                      and employee.employment_status = 'active'))
              )
          )
          or exists (
            select 1 from public.material_warehouse_accounts assignment
            where assignment.warehouse_id = party.id and assignment.user_id = auth.uid()
          )
          or (party.type = 'person' and party.source_type = 'eps_person'
            and profile.account_type = 'eps' and profile.eps_employee_id = party.source_id)
        ))
      )
      and (
        (profile.account_type is null and public.is_system_admin())
        or (profile.account_type = 'eps' and exists (
          select 1 from private.fake_eps_employees employee
          where employee.id = profile.eps_employee_id and employee.employment_status = 'active'
        ))
        or (profile.account_type = 'external' and exists (
          select 1 from public.material_custodians external_party
          where external_party.id = profile.external_organization_id
            and external_party.type = 'external' and external_party.is_active
        ))
      )
  )
$$;
revoke all on function public.material_can_represent(uuid)
  from public, anon, authenticated;

-- Add party contact fields while preserving the existing scoped catalog rules.
alter function public.list_custodians(boolean)
  rename to list_custodians_base;
revoke all on function public.list_custodians_base(boolean)
  from public, anon, authenticated;

create function public.list_custodians(p_include_inactive boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    item.value || jsonb_build_object(
      'phone', custodian.phone,
      'email', custodian.email,
      'representativeName', coalesce(
        custodian.representative_name,
        nullif(btrim(profile.display_name), ''),
        nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), '')
      ),
      'isHandoverCustom', false,
      'handoverScopePartyId', null,
      'canManageHandover', public.has_scoped_permission(
        'materials:handover:manage', custodian.id
      )
    ) order by item.ordinality
  ), '[]'::jsonb)
  from jsonb_array_elements(
    coalesce(public.list_custodians_base(p_include_inactive), '[]'::jsonb)
  ) with ordinality item(value, ordinality)
  join public.material_custodians custodian
    on custodian.id = (item.value->>'id')::uuid
  left join public.user_profiles profile
    on profile.id = custodian.representative_user_id
  where not custodian.is_handover_custom
$$;

create or replace function public.list_handover_custom_parties()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to view custom handover parties'
      using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', party.id,
      'type', party.type,
      'code', party.code,
      'name', party.name,
      'parentId', party.parent_id,
      'isActive', party.is_active,
      'canRepresent', public.material_can_represent(party.id),
      'phone', party.phone,
      'email', party.email,
      'representativeName', party.representative_name,
      'isHandoverCustom', true,
      'handoverScopePartyId', party.handover_scope_party_id
    ) order by case when party.is_active then 0 else 1 end,
      lower(party.name) collate "vi-x-icu", party.id)
    from public.material_custodians party
    where party.is_handover_custom and party.is_active
      and public.has_scoped_permission('materials:handover:manage', party.id)
  ), '[]'::jsonb);
end;
$$;

drop function public.list_handover_counterparty_options(uuid);

create function public.list_handover_counterparty_options(p_party_id uuid)
returns table (
  id uuid,
  type text,
  code text,
  name text,
  "parentId" uuid,
  phone text,
  email text,
  "representativeName" text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not public.has_scoped_permission('materials:handover:manage', p_party_id)
    or not public.material_can_represent(p_party_id) then
    raise exception 'You must manage and represent a handover party'
      using errcode = '42501';
  end if;
  return query
  select party.id, party.type, party.code, party.name, party.parent_id,
    party.phone, party.email,
    coalesce(
      nullif(btrim(profile.display_name), ''),
      nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), '')
    )
  from public.material_custodians party
  left join public.user_profiles profile
    on profile.id = party.representative_user_id
  where party.is_active
    and party.id <> p_party_id
    and party.type <> 'warehouse'
    and not party.is_handover_custom
  order by lower(party.name) collate "vi-x-icu", party.id;
end;
$$;

create or replace function public.material_party_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', party.id,
    'type', party.type,
    'code', party.code,
    'name', party.name,
    'parentId', party.parent_id,
    'accountUserId', party.account_user_id,
    'accountUserIds', case when party.type = 'warehouse' then coalesce((
      select jsonb_agg(assignment.user_id order by assignment.user_id)
      from public.material_warehouse_accounts assignment
      where assignment.warehouse_id = party.id
    ), '[]'::jsonb) else case when party.account_user_id is null
      then '[]'::jsonb else jsonb_build_array(party.account_user_id) end end,
    'representativeUserId', party.representative_user_id,
    'isActive', party.is_active,
    'phone', party.phone,
    'email', party.email,
    'representativeName', coalesce(
      nullif(btrim(party.representative_name), ''),
      nullif(btrim(profile.display_name), ''),
      nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), '')
    ),
    'isHandoverCustom', party.is_handover_custom,
    'handoverScopePartyId', party.handover_scope_party_id
  )
  from public.material_custodians party
  left join public.user_profiles profile
    on profile.id = party.representative_user_id
  where party.id = p_id
$$;
revoke all on function public.material_party_json(uuid)
  from public, anon, authenticated;

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
    'senderCanRepresent', public.material_can_represent(
      (result->'senderParty'->>'id')::uuid),
    'recipientCanRepresent', public.material_can_represent(
      (result->'recipientParty'->>'id')::uuid),
    'reversesHandoverId', (
      select handover.reverses_handover_id
      from public.material_handovers handover
      where handover.id = target_handover_id
    )
  );
end;
$$;
revoke all on function private.scoped_handover_json(uuid)
  from public, anon, authenticated;

alter function public.save_handover(uuid, jsonb)
  rename to save_handover_base;
revoke all on function public.save_handover_base(uuid, jsonb)
  from public, anon, authenticated;

create function public.save_handover(p_id uuid, p_values jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid := nullif(p_values->>'senderPartyId', '')::uuid;
  v_recipient uuid := nullif(p_values->>'recipientPartyId', '')::uuid;
  v_sender_kind text := coalesce(p_values->>'senderPartyKind', 'eps');
  v_recipient_kind text := coalesce(p_values->>'recipientPartyKind', 'eps');
  v_recipient_scope uuid;
  v_reverse_id uuid := nullif(p_values->>'reverseFromHandoverId', '')::uuid;
  v_reverse public.material_handovers%rowtype;
  v_saved_id uuid;
  v_item_count integer;
  v_source_item_count integer;
  v_party public.material_custodians%rowtype;
  v_snapshot jsonb;
  v_work_values jsonb;
begin
  if auth.uid() is null
    or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to manage handovers' using errcode = '42501';
  end if;

  if v_sender_kind not in ('eps', 'external', 'other')
    or v_recipient_kind not in ('eps', 'external', 'other') then
    raise exception 'Invalid handover party kind' using errcode = '22023';
  end if;
  if p_values->>'type' not in ('transfer', 'loan', 'return') then
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
    if v_sender is null then
      raise exception 'Select an existing Other party that owns the materials'
        using errcode = '22023';
    else
      select * into v_party from public.material_custodians
      where id = v_sender and is_handover_custom for update;
      if not found then
        raise exception 'The selected custom sender no longer exists'
          using errcode = 'P0002';
      end if;
      if not public.has_scoped_permission('materials:handover:manage', v_sender)
        or not public.material_can_represent(v_sender) then
        raise exception 'You cannot manage or represent the selected custom sender'
          using errcode = '42501';
      end if;
      update public.material_custodians set
        name = btrim(p_values->>'senderPartyName'),
        phone = nullif(btrim(p_values->>'senderPartyPhone'), ''),
        email = nullif(btrim(p_values->>'senderPartyEmail'), ''),
        representative_name = nullif(btrim(p_values->>'senderRepresentativeName'), ''),
        updated_at = timezone('utc', now())
      where id = v_sender;
    end if;
  else
    if v_sender is null or not exists (
      select 1 from public.material_custodians party
      where party.id = v_sender and party.is_active and not party.is_handover_custom
        and ((v_sender_kind = 'external' and party.type = 'external')
          or (v_sender_kind = 'eps' and party.type in ('department', 'team', 'person')))
    ) then
      raise exception 'Select a valid sender from the selected catalog'
        using errcode = '22023';
    end if;
  end if;

  if v_recipient_kind = 'other' then
    if v_recipient is null then
      select case when party.is_handover_custom
        then party.handover_scope_party_id else party.id end
      into v_recipient_scope
      from public.material_custodians party
      where party.id = v_sender and party.is_active;
      if v_recipient_scope is null then
        raise exception 'Could not determine the custom recipient scope'
          using errcode = '22023';
      end if;
      v_recipient := gen_random_uuid();
      insert into public.material_custodians(
        id, type, code, name, is_active, phone, email, representative_name,
        is_handover_custom, handover_scope_party_id
      ) values (
        v_recipient, 'other',
        'OTH-' || upper(substr(replace(v_recipient::text, '-', ''), 1, 12)),
        btrim(p_values->>'recipientPartyName'), true,
        nullif(btrim(p_values->>'recipientPartyPhone'), ''),
        nullif(btrim(p_values->>'recipientPartyEmail'), ''),
        nullif(btrim(p_values->>'recipientRepresentativeName'), ''), true,
        v_recipient_scope
      );
    else
      select * into v_party from public.material_custodians
      where id = v_recipient and is_handover_custom for update;
      if not found then
        raise exception 'The selected custom recipient no longer exists'
          using errcode = 'P0002';
      end if;
      if not public.has_scoped_permission('materials:handover:manage', v_recipient) then
        raise exception 'You cannot select this custom recipient outside your handover scope'
          using errcode = '42501';
      end if;
      update public.material_custodians set
        name = btrim(p_values->>'recipientPartyName'),
        phone = nullif(btrim(p_values->>'recipientPartyPhone'), ''),
        email = nullif(btrim(p_values->>'recipientPartyEmail'), ''),
        representative_name = nullif(btrim(p_values->>'recipientRepresentativeName'), ''),
        updated_at = timezone('utc', now())
      where id = v_recipient;
    end if;
  else
    if v_recipient is null or not exists (
      select 1 from public.material_custodians party
      where party.id = v_recipient and party.is_active and not party.is_handover_custom
        and ((v_recipient_kind = 'external' and party.type = 'external')
          or (v_recipient_kind = 'eps' and party.type in ('department', 'team', 'person')))
    ) then
      raise exception 'Select a valid recipient from the selected catalog'
        using errcode = '22023';
    end if;
  end if;

  if v_reverse_id is not null then
    select * into v_reverse from public.material_handovers
    where id = v_reverse_id for share;
    if not found or v_reverse.status <> 'completed'
      or v_reverse.mode <> 'standard' or v_reverse.type not in ('transfer', 'loan') then
      raise exception 'Only a completed transfer or loan can be reversed'
        using errcode = '55000';
    end if;
    if v_sender <> v_reverse.recipient_party_id
      or v_recipient <> v_reverse.sender_party_id
      or (p_values->>'type' is distinct from
        case when v_reverse.type = 'loan' then 'return' else 'transfer' end) then
      raise exception 'Reverse handover parties or type do not match the source'
        using errcode = '22023';
    end if;
    select count(*) into v_item_count from jsonb_array_elements(
      coalesce(p_values->'items', '[]'::jsonb)
    );
    select count(*) into v_source_item_count from public.material_handover_items
    where handover_id = v_reverse_id;
    if v_item_count <> v_source_item_count or exists (
      select 1 from public.material_handover_items source_item
      where source_item.handover_id = v_reverse_id and not exists (
        select 1 from jsonb_array_elements(coalesce(p_values->'items', '[]'::jsonb)) selected
        where (selected.value->>'materialId')::uuid = source_item.material_id
      )
    ) then
      raise exception 'Reverse handover must include all source materials'
        using errcode = '22023';
    end if;
  end if;

  v_work_values := p_values || jsonb_build_object(
    'senderPartyId', v_sender,
    'recipientPartyId', v_recipient
  );
  v_saved_id := public.save_handover_base(p_id, v_work_values);

  if v_reverse_id is not null then
    update public.material_handovers
    set reverses_handover_id = v_reverse_id
    where id = v_saved_id;
  end if;

  select * into v_party from public.material_custodians where id = v_sender;
  v_snapshot := public.material_party_json(v_sender) || jsonb_build_object(
    'id', v_sender,
    'code', v_party.code,
    'name', btrim(p_values->>'senderPartyName'),
    'type', v_party.type,
    'phone', nullif(btrim(p_values->>'senderPartyPhone'), ''),
    'email', nullif(btrim(p_values->>'senderPartyEmail'), ''),
    'isHandoverCustom', v_party.is_handover_custom,
    'handoverScopePartyId', v_party.handover_scope_party_id
  );
  update public.material_handovers handover set
    sender_party_snapshot = v_snapshot,
    sender_representative_snapshot = case
      when nullif(btrim(p_values->>'senderRepresentativeName'), '') is null
        and handover.sender_representative_user_id is null then null
      else jsonb_build_object(
        'userId', handover.sender_representative_user_id,
        'displayName', coalesce(
          nullif(btrim(p_values->>'senderRepresentativeName'), ''),
          handover.sender_representative_snapshot->>'displayName', ''
        )
      ) end
  where handover.id = v_saved_id;

  select * into v_party from public.material_custodians where id = v_recipient;
  v_snapshot := public.material_party_json(v_recipient) || jsonb_build_object(
    'id', v_recipient,
    'code', v_party.code,
    'name', btrim(p_values->>'recipientPartyName'),
    'type', v_party.type,
    'phone', nullif(btrim(p_values->>'recipientPartyPhone'), ''),
    'email', nullif(btrim(p_values->>'recipientPartyEmail'), ''),
    'isHandoverCustom', v_party.is_handover_custom,
    'handoverScopePartyId', v_party.handover_scope_party_id
  );
  update public.material_handovers handover set
    recipient_party_snapshot = v_snapshot,
    recipient_representative_snapshot = case
      when nullif(btrim(p_values->>'recipientRepresentativeName'), '') is null
        and handover.recipient_representative_user_id is null then null
      else jsonb_build_object(
        'userId', handover.recipient_representative_user_id,
        'displayName', coalesce(
          nullif(btrim(p_values->>'recipientRepresentativeName'), ''),
          handover.recipient_representative_snapshot->>'displayName', ''
        )
      ) end
  where handover.id = v_saved_id;

  return v_saved_id;
end;
$$;

revoke all on function public.list_custodians(boolean) from public, anon;
grant execute on function public.list_custodians(boolean) to authenticated;
revoke all on function public.list_handover_custom_parties() from public, anon;
grant execute on function public.list_handover_custom_parties() to authenticated;
revoke all on function public.list_handover_counterparty_options(uuid) from public, anon;
grant execute on function public.list_handover_counterparty_options(uuid) to authenticated;
revoke all on function public.save_handover(uuid, jsonb) from public, anon;
grant execute on function public.save_handover(uuid, jsonb) to authenticated;
