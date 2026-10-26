-- Replace the combined handover-custodian whitelist with source-backed EPS
-- parties and explicit, exact-level account representation.

create table if not exists private.material_custodian_representatives (
  custodian_id uuid not null references public.material_custodians(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (custodian_id, user_id)
);
revoke all on table private.material_custodian_representatives
  from public, anon, authenticated;

-- Preserve the former explicit representative where it matches the party's
-- exact EPS level. External accounts previously represented their linked org;
-- preserve that access by making each active linked account explicit.
insert into private.material_custodian_representatives (custodian_id, user_id)
select party.id, profile.id
from public.material_custodians party
join public.user_profiles profile on profile.id = party.representative_user_id
where party.type in ('department', 'team', 'external')
  and profile.status = 'active'
  and (
    (party.type = 'external'
      and profile.account_type = 'external'
      and profile.external_organization_id = party.id)
    or (party.type = 'department'
      and party.source_type = 'eps_department'
      and profile.account_type = 'eps'
      and exists (
        select 1 from private.fake_eps_employees employee
        where employee.id = profile.eps_employee_id
          and employee.department_id = party.source_id
          and employee.employment_status = 'active'
      ))
    or (party.type = 'team'
      and party.source_type = 'eps_team'
      and profile.account_type = 'eps'
      and exists (
        select 1 from private.fake_eps_employees employee
        where employee.id = profile.eps_employee_id
          and employee.team_id = party.source_id
          and employee.employment_status = 'active'
      ))
  )
on conflict do nothing;

insert into private.material_custodian_representatives (custodian_id, user_id)
select party.id, profile.id
from public.material_custodians party
join public.user_profiles profile
  on profile.account_type = 'external'
 and profile.external_organization_id = party.id
 and profile.status = 'active'
where party.type = 'external'
on conflict do nothing;

update public.material_custodians party
set representative_user_id = (
  select representative.user_id
  from private.material_custodian_representatives representative
  where representative.custodian_id = party.id
  order by (representative.user_id = party.representative_user_id) desc,
    representative.created_at, representative.user_id
  limit 1
),
updated_at = timezone('utc', now())
where party.type in ('department', 'team', 'external');

create or replace function private.sync_eps_custodian_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source jsonb;
  source_type text;
  source_id text;
  source_code text;
  source_name text;
  parent_source_id text;
  source_active boolean;
  parent_party_id uuid;
begin
  source := to_jsonb(new);
  if tg_table_name = 'fake_eps_departments' then
    source_type := 'eps_department';
    source_id := source->>'id';
    source_code := source->>'code';
    source_name := source->>'name';
    source_active := coalesce((source->>'is_active')::boolean, true);
  elsif tg_table_name = 'fake_eps_teams' then
    source_type := 'eps_team';
    source_id := source->>'id';
    source_code := source->>'code';
    source_name := source->>'name';
    parent_source_id := source->>'department_id';
    source_active := coalesce((source->>'is_active')::boolean, true);
  elsif tg_table_name = 'fake_eps_employees' then
    source_type := 'eps_person';
    source_id := source->>'id';
    source_code := source->>'employee_code';
    source_name := concat_ws(' ', source->>'last_name', source->>'first_name');
    parent_source_id := coalesce(nullif(source->>'team_id', ''), source->>'department_id');
    source_active := source->>'employment_status' = 'active';
  else
    raise exception 'Unsupported EPS source table: %', tg_table_name using errcode = '22023';
  end if;

  if parent_source_id is not null then
    select party.id into parent_party_id
    from public.material_custodians party
    where party.source_id = parent_source_id
      and party.source_type = case
        when source_type = 'eps_person' and exists (
          select 1 from private.fake_eps_teams team where team.id = parent_source_id
        ) then 'eps_team'
        else 'eps_department'
      end;
    if parent_party_id is null and source_type <> 'eps_person' then
      raise exception 'EPS department must be synced before its child' using errcode = '23503';
    end if;
  end if;

  insert into public.material_custodians (
    type, code, name, parent_id, is_active, source_type, source_id
  ) values (
    case source_type when 'eps_department' then 'department'
      when 'eps_team' then 'team' else 'person' end,
    source_code, source_name, parent_party_id, source_active, source_type, source_id
  )
  on conflict (source_type, source_id)
    where source_type is not null and source_id is not null
  do update set
    type = excluded.type,
    code = excluded.code,
    name = excluded.name,
    parent_id = excluded.parent_id,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());
  return new;
end;
$$;
revoke all on function private.sync_eps_custodian_source() from public, anon, authenticated;

-- Populate every source-backed EPS handover party, including rows not selected
-- in the retired custodian page.
insert into public.material_custodians (
  type, code, name, parent_id, is_active, source_type, source_id
)
select 'department', department.code, department.name, null, department.is_active,
  'eps_department', department.id
from private.fake_eps_departments department
on conflict (source_type, source_id)
  where source_type is not null and source_id is not null
do update set code = excluded.code, name = excluded.name,
  parent_id = null, is_active = excluded.is_active,
  updated_at = timezone('utc', now());

insert into public.material_custodians (
  type, code, name, parent_id, is_active, source_type, source_id
)
select 'team', team.code, team.name, department_party.id, team.is_active,
  'eps_team', team.id
from private.fake_eps_teams team
join public.material_custodians department_party
  on department_party.source_type = 'eps_department'
 and department_party.source_id = team.department_id
on conflict (source_type, source_id)
  where source_type is not null and source_id is not null
do update set code = excluded.code, name = excluded.name,
  parent_id = excluded.parent_id, is_active = excluded.is_active,
  updated_at = timezone('utc', now());

insert into public.material_custodians (
  type, code, name, parent_id, is_active, source_type, source_id
)
select 'person', employee.employee_code,
  concat_ws(' ', employee.last_name, employee.first_name),
  coalesce(team_party.id, department_party.id),
  employee.employment_status = 'active', 'eps_person', employee.id
from private.fake_eps_employees employee
join public.material_custodians department_party
  on department_party.source_type = 'eps_department'
 and department_party.source_id = employee.department_id
left join public.material_custodians team_party
  on team_party.source_type = 'eps_team'
 and team_party.source_id = employee.team_id
on conflict (source_type, source_id)
  where source_type is not null and source_id is not null
do update set code = excluded.code, name = excluded.name,
  parent_id = excluded.parent_id, is_active = excluded.is_active,
  updated_at = timezone('utc', now());

drop trigger if exists fake_eps_departments_sync_custodian on private.fake_eps_departments;
create trigger fake_eps_departments_sync_custodian
after insert or update on private.fake_eps_departments
for each row execute function private.sync_eps_custodian_source();
drop trigger if exists fake_eps_teams_sync_custodian on private.fake_eps_teams;
create trigger fake_eps_teams_sync_custodian
after insert or update on private.fake_eps_teams
for each row execute function private.sync_eps_custodian_source();
drop trigger if exists fake_eps_employees_sync_custodian on private.fake_eps_employees;
create trigger fake_eps_employees_sync_custodian
after insert or update on private.fake_eps_employees
for each row execute function private.sync_eps_custodian_source();

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
      )
      and (
        (profile.account_type = 'eps' and exists (
          select 1 from private.fake_eps_employees employee
          where employee.id = profile.eps_employee_id
            and employee.employment_status = 'active'
        ))
        or (profile.account_type = 'external' and exists (
          select 1 from public.material_custodians external_party
          where external_party.id = profile.external_organization_id
            and external_party.type = 'external' and external_party.is_active
        ))
      )
  );
$$;

create or replace function private.party_has_qrcode_account(target_party_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.material_custodians party
    where party.id = target_party_id and (
      (party.type = 'person' and exists (
        select 1 from public.user_profiles profile
        join private.fake_eps_employees employee on employee.id = profile.eps_employee_id
        where profile.id = party.account_user_id and profile.status = 'active'
          and profile.account_type = 'eps' and employee.id = party.source_id
          and employee.employment_status = 'active'
      ))
      or exists (
        select 1 from private.material_custodian_representatives representative
        join public.user_profiles profile on profile.id = representative.user_id
        where representative.custodian_id = party.id and profile.status = 'active'
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
      or (party.type = 'person' and party.source_type = 'eps_person'
        and exists (select 1 from public.user_profiles profile
          join private.fake_eps_employees employee on employee.id = profile.eps_employee_id
          where profile.account_type = 'eps' and employee.id = party.source_id
            and employee.employment_status = 'active' and profile.status = 'active'))
      or (party.type = 'warehouse'
        and exists (select 1 from public.material_warehouse_accounts assignment
          join public.user_profiles profile on profile.id = assignment.user_id
          where assignment.warehouse_id = party.id and profile.status = 'active'))
    )
  );
$$;
revoke all on function private.party_has_qrcode_account(uuid) from public, anon, authenticated;

create or replace function public.list_eps_organizations()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    public.has_permission('materials:custodian:view')
    or public.has_permission('materials:custodian:manage')
  ) then
    raise exception 'EPS organization view permission required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', party.id,
      'sourceId', party.source_id,
      'type', party.type,
      'code', party.code,
      'name', party.name,
      'parentName', parent.name,
      'isActive', party.is_active,
      'canManageRepresentatives',
        public.has_scoped_permission('materials:custodian:manage', party.id)
        or private.has_all_eps_custodian_manage(),
      'representativeUserIds', coalesce((
        select jsonb_agg(representative.user_id order by
          (representative.user_id = party.representative_user_id) desc,
          lower(coalesce(nullif(btrim(profile.display_name), ''),
            nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
            profile.username)) collate "vi-x-icu", profile.id)
        from private.material_custodian_representatives representative
        join public.user_profiles profile on profile.id = representative.user_id
        where representative.custodian_id = party.id and profile.status = 'active'
          and profile.account_type = 'eps'
          and exists (select 1 from private.fake_eps_employees employee
            where employee.id = profile.eps_employee_id
              and employee.employment_status = 'active'
              and case party.type when 'department'
                then employee.department_id = party.source_id
                else employee.team_id = party.source_id end)
      ), '[]'::jsonb),
      'representativeAccounts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', profile.id,
          'displayName', coalesce(nullif(btrim(profile.display_name), ''),
            nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
            profile.username),
          'username', profile.username
        ) order by lower(coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          profile.username)) collate "vi-x-icu", profile.id)
        from private.material_custodian_representatives representative
        join public.user_profiles profile on profile.id = representative.user_id
        where representative.custodian_id = party.id and profile.status = 'active'
          and profile.account_type = 'eps'
          and exists (select 1 from private.fake_eps_employees employee
            where employee.id = profile.eps_employee_id
              and employee.employment_status = 'active'
              and case party.type when 'department'
                then employee.department_id = party.source_id
                else employee.team_id = party.source_id end)
      ), '[]'::jsonb),
      'representativeOptions', case when
        public.has_scoped_permission('materials:custodian:manage', party.id)
        or private.has_all_eps_custodian_manage()
      then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', profile.id,
          'displayName', coalesce(nullif(btrim(profile.display_name), ''),
            nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
            profile.username),
          'username', profile.username
        ) order by lower(coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          profile.username)) collate "vi-x-icu", profile.id)
        from public.user_profiles profile
        join private.fake_eps_employees employee on employee.id = profile.eps_employee_id
        where profile.account_type = 'eps' and profile.status = 'active'
          and employee.employment_status = 'active'
          and case party.type when 'department' then employee.department_id = party.source_id
            else employee.team_id = party.source_id end
      ), '[]'::jsonb) else '[]'::jsonb end
    ) order by case party.type when 'department' then 0 else 1 end,
      case when party.is_active then 0 else 1 end,
      lower(party.name) collate "vi-x-icu", party.id)
    from public.material_custodians party
    left join public.material_custodians parent on parent.id = party.parent_id
    where party.source_type in ('eps_department', 'eps_team')
      and (public.has_scoped_permission('materials:custodian:view', party.id)
        or public.has_scoped_permission('materials:custodian:manage', party.id)
        or private.has_all_eps_custodian_manage())
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.list_external_organizations(boolean);
create function public.list_external_organizations(p_include_inactive boolean default false)
returns table (
  id uuid,
  code text,
  name text,
  is_active boolean,
  created_at timestamptz,
  representative_user_ids uuid[],
  representative_accounts jsonb,
  representative_options jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    public.has_permission('organization:external-organization:view')
    or public.has_permission('organization:external-organization:manage')
    or public.has_permission('organization:account:view')
    or public.has_permission('organization:account:manage')
  ) then
    raise exception 'External organization view permission required' using errcode = '42501';
  end if;

  return query
  select party.id, party.code, party.name, party.is_active, party.created_at,
    coalesce((
      select array_agg(representative.user_id order by
        (representative.user_id = party.representative_user_id) desc,
        lower(coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          profile.username)) collate "vi-x-icu", profile.id)
      from private.material_custodian_representatives representative
      join public.user_profiles profile on profile.id = representative.user_id
      where representative.custodian_id = party.id and profile.status = 'active'
        and profile.account_type = 'external'
        and profile.external_organization_id = party.id
    ), array[]::uuid[]),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id,
        'displayName', coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          profile.username),
        'username', profile.username
      ) order by lower(coalesce(nullif(btrim(profile.display_name), ''),
        nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
        profile.username)) collate "vi-x-icu", profile.id)
      from private.material_custodian_representatives representative
      join public.user_profiles profile on profile.id = representative.user_id
      where representative.custodian_id = party.id and profile.status = 'active'
        and profile.account_type = 'external'
        and profile.external_organization_id = party.id
    ), '[]'::jsonb),
    case when public.has_permission('organization:external-organization:manage')
      then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id,
        'displayName', coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          profile.username),
        'username', profile.username
      ) order by lower(coalesce(nullif(btrim(profile.display_name), ''),
        nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
        profile.username)) collate "vi-x-icu", profile.id)
      from public.user_profiles profile
      where profile.account_type = 'external'
        and profile.external_organization_id = party.id
        and profile.status = 'active'
      ), '[]'::jsonb)
      else '[]'::jsonb end
  from public.material_custodians party
  where party.type = 'external' and (p_include_inactive or party.is_active)
  order by case when party.is_active then 0 else 1 end,
    lower(party.name) collate "vi-x-icu", party.id;
end;
$$;

create or replace function public.replace_material_custodian_representatives(
  p_custodian_id uuid,
  p_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  party public.material_custodians%rowtype;
  selected_ids uuid[] := coalesce(p_user_ids, array[]::uuid[]);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into party from public.material_custodians where id = p_custodian_id for update;
  if not found or party.type not in ('department', 'team', 'external') then
    raise exception 'Representative assignment target is unavailable' using errcode = 'P0002';
  end if;

  if party.type = 'external' then
    if not public.has_permission('organization:external-organization:manage') then
      raise exception 'External organization management permission required' using errcode = '42501';
    end if;
    if exists (
      select 1 from unnest(selected_ids) selected(user_id)
      where not exists (select 1 from public.user_profiles profile
        where profile.id = selected.user_id and profile.status = 'active'
          and profile.account_type = 'external'
          and profile.external_organization_id = party.id)
    ) then
      raise exception 'Representatives must be active accounts of this external organization' using errcode = '22023';
    end if;
  else
    if not (public.has_scoped_permission('materials:custodian:manage', party.id)
      or private.has_all_eps_custodian_manage()) then
      raise exception 'Custodian is outside the permitted management scope' using errcode = '42501';
    end if;
    if party.source_type not in ('eps_department', 'eps_team')
      or exists (
        select 1 from unnest(selected_ids) selected(user_id)
        where not exists (
          select 1 from public.user_profiles profile
          join private.fake_eps_employees employee on employee.id = profile.eps_employee_id
          where profile.id = selected.user_id and profile.status = 'active'
            and profile.account_type = 'eps'
            and employee.employment_status = 'active'
            and case party.type when 'department'
              then employee.department_id = party.source_id
              else employee.team_id = party.source_id end
        )
      ) then
      raise exception 'Representatives must be active EPS accounts of this exact unit or team' using errcode = '22023';
    end if;
  end if;

  if cardinality(selected_ids) <> (select count(distinct selected.user_id)
    from unnest(selected_ids) selected(user_id)) then
    raise exception 'Representative accounts cannot be duplicated' using errcode = '22023';
  end if;

  delete from private.material_custodian_representatives
  where custodian_id = party.id;
  insert into private.material_custodian_representatives (custodian_id, user_id)
  select party.id, selected.user_id
  from unnest(selected_ids) with ordinality selected(user_id, position)
  order by selected.position;

  update public.material_custodians
  set representative_user_id = selected_ids[1],
      updated_at = timezone('utc', now())
  where id = party.id;
end;
$$;

revoke all on function public.list_eps_organizations() from public, anon;
revoke all on function public.list_external_organizations(boolean) from public, anon;
revoke all on function public.replace_material_custodian_representatives(uuid, uuid[]) from public, anon;
revoke all on function public.save_custodian(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.list_fake_eps_parties() from public, anon, authenticated;
grant execute on function public.list_eps_organizations() to authenticated;
grant execute on function public.list_external_organizations(boolean) to authenticated;
grant execute on function public.replace_material_custodian_representatives(uuid, uuid[]) to authenticated;
