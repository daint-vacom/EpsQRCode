-- Move demo data to the supplied EPS directory, then physically remove the
-- synthetic departments, teams, and their mirrored custodian parties.

create temporary table eps_mock_directory_mapping (
  old_source_type text not null,
  old_source_id text not null,
  old_code text not null,
  old_parent_source_id text,
  new_source_id text not null,
  new_code text not null,
  primary key (old_source_type, old_source_id),
  unique (new_source_id)
);

insert into eps_mock_directory_mapping values
  ('eps_department', 'EPS-MOCK-D01', 'MOCK-D01', null,
    '5007bcd7-98e5-4b9a-8775-d19af5e0e2a5', 'P10'),
  ('eps_department', 'EPS-MOCK-D02', 'MOCK-D02', null,
    'dee68390-db0a-4200-8148-e344464956f0', 'P07'),
  ('eps_team', 'EPS-MOCK-T01', 'MOCK-T01', 'EPS-MOCK-D01',
    '40a3b2c3-1a16-42b7-8553-c9688720e1b5', 'P10.00'),
  ('eps_team', 'EPS-MOCK-T02', 'MOCK-T02', 'EPS-MOCK-D01',
    'ab576cc5-d808-4e9e-a191-34ac4bc785a8', 'P10.05'),
  ('eps_team', 'EPS-MOCK-T03', 'MOCK-T03', 'EPS-MOCK-D02',
    '24c3502f-fcb4-4047-983c-8ae61419ba98', 'P07.02');

create temporary table eps_mock_party_mapping (
  old_source_type text not null,
  old_source_id text not null,
  new_source_id text not null,
  old_party_id uuid not null unique,
  new_party_id uuid not null unique,
  new_code text not null,
  new_name text not null,
  new_type text not null,
  new_parent_id uuid,
  new_is_active boolean not null,
  primary key (old_source_type, old_source_id)
);

insert into eps_mock_party_mapping
select mapping.old_source_type, mapping.old_source_id, mapping.new_source_id,
  old_party.id, new_party.id, new_party.code, new_party.name, new_party.type,
  new_party.parent_id, new_party.is_active
from eps_mock_directory_mapping mapping
join public.material_custodians old_party
  on old_party.source_type = mapping.old_source_type
 and old_party.source_id = mapping.old_source_id
 and old_party.code = mapping.old_code
join public.material_custodians new_party
  on new_party.source_type = mapping.old_source_type
 and new_party.source_id = mapping.new_source_id
 and new_party.code = mapping.new_code;

do $directory_preflight$
begin
  if (select count(*) from eps_mock_party_mapping) <> 5 then
    raise exception 'Expected five legacy EPS parties and five active replacements';
  end if;
  if exists (select 1 from eps_mock_party_mapping where not new_is_active) then
    raise exception 'A replacement EPS party is inactive';
  end if;
  if exists (
    select 1 from eps_mock_directory_mapping mapping
    left join (
      select 'eps_department'::text as source_type, id as source_id, code,
        null::text as department_id from private.fake_eps_departments
      union all
      select 'eps_team', id, code, department_id from private.fake_eps_teams
    ) source on source.source_type = mapping.old_source_type
      and source.source_id = mapping.old_source_id and source.code = mapping.old_code
    where source.source_id is null
  ) then
    raise exception 'A legacy EPS source row no longer matches the expected mock catalog';
  end if;
  if exists (
    select 1 from eps_mock_directory_mapping old_team
    join eps_mock_directory_mapping old_department
      on old_department.old_source_id = old_team.old_parent_source_id
     and old_department.old_source_type = 'eps_department'
    join private.fake_eps_teams new_team on new_team.id = old_team.new_source_id
    where old_team.old_source_type = 'eps_team'
      and new_team.department_id <> old_department.new_source_id
  ) then
    raise exception 'A replacement team does not belong to its mapped department';
  end if;
  if exists (
    select 1 from public.material_handovers handover
    left join eps_mock_party_mapping sender on sender.old_party_id = handover.sender_party_id
    left join eps_mock_party_mapping recipient on recipient.old_party_id = handover.recipient_party_id
    where coalesce(sender.new_party_id, handover.sender_party_id)
      = coalesce(recipient.new_party_id, handover.recipient_party_id)
  ) then
    raise exception 'The replacement would make a handover sender and recipient identical';
  end if;
end;
$directory_preflight$;

-- This one-time fixture remap bypasses session permission guards only. Foreign
-- keys, check constraints, and the warehouse handover guard remain enabled.
alter table public.materials disable trigger materials_scope_guard;
alter table public.material_handovers disable trigger material_handovers_scope_guard;
select set_config('app.materials_warehouse_transition', 'true', true);

with employee_targets as (
  select employee.id,
    coalesce(department_map.new_source_id, team_parent_map.new_source_id,
      employee.department_id) as department_id,
    coalesce(team_map.new_source_id, fallback_team.id) as team_id
  from private.fake_eps_employees employee
  left join eps_mock_directory_mapping department_map
    on department_map.old_source_type = 'eps_department'
   and department_map.old_source_id = employee.department_id
  left join eps_mock_directory_mapping team_map
    on team_map.old_source_type = 'eps_team'
   and team_map.old_source_id = employee.team_id
  left join eps_mock_directory_mapping team_parent_map
    on team_parent_map.old_source_type = 'eps_department'
   and team_parent_map.old_source_id = team_map.old_parent_source_id
  left join lateral (
    select team.id from private.fake_eps_teams team
    where team.department_id = coalesce(department_map.new_source_id,
      team_parent_map.new_source_id, employee.department_id)
      and team.is_active
    order by md5(employee.id || ':' || team.id || ':eps-directory-demo')
    limit 1
  ) fallback_team on true
  where department_map.old_source_id is not null or team_map.old_source_id is not null
)
update private.fake_eps_employees employee
set department_id = employee_targets.department_id,
    team_id = employee_targets.team_id
from employee_targets
where employee.id = employee_targets.id;

insert into private.material_custodian_representatives (custodian_id, user_id)
select mapping.new_party_id, representative.user_id
from private.material_custodian_representatives representative
join eps_mock_party_mapping mapping on mapping.old_party_id = representative.custodian_id
on conflict (custodian_id, user_id) do nothing;

delete from private.material_custodian_representatives representative
using eps_mock_party_mapping mapping
where representative.custodian_id = mapping.old_party_id;

with material_targets as (
  select material.id,
    coalesce(owner_mapping.new_party_id, material.owner_party_id) as owner_party_id,
    coalesce(borrower_mapping.new_party_id, material.borrower_party_id) as borrower_party_id
  from public.materials material
  left join eps_mock_party_mapping owner_mapping
    on owner_mapping.old_party_id = material.owner_party_id
  left join eps_mock_party_mapping borrower_mapping
    on borrower_mapping.old_party_id = material.borrower_party_id
  where owner_mapping.old_party_id is not null or borrower_mapping.old_party_id is not null
)
update public.materials material
set owner_party_id = material_targets.owner_party_id,
    borrower_party_id = material_targets.borrower_party_id,
    version = material.version + 1,
    updated_at = timezone('utc', now())
from material_targets
where material.id = material_targets.id;

with handover_targets as (
  select handover.id,
    coalesce(sender.new_party_id, handover.sender_party_id) as sender_party_id,
    coalesce(recipient.new_party_id, handover.recipient_party_id) as recipient_party_id,
    case when sender.old_party_id is null then handover.sender_party_snapshot
      else handover.sender_party_snapshot || jsonb_build_object(
        'id', sender.new_party_id, 'code', sender.new_code, 'name', sender.new_name,
        'type', sender.new_type, 'parentId', sender.new_parent_id,
        'isActive', sender.new_is_active
      ) end as sender_party_snapshot,
    case when recipient.old_party_id is null then handover.recipient_party_snapshot
      else handover.recipient_party_snapshot || jsonb_build_object(
        'id', recipient.new_party_id, 'code', recipient.new_code, 'name', recipient.new_name,
        'type', recipient.new_type, 'parentId', recipient.new_parent_id,
        'isActive', recipient.new_is_active
      ) end as recipient_party_snapshot
  from public.material_handovers handover
  left join eps_mock_party_mapping sender on sender.old_party_id = handover.sender_party_id
  left join eps_mock_party_mapping recipient on recipient.old_party_id = handover.recipient_party_id
  where sender.old_party_id is not null or recipient.old_party_id is not null
)
update public.material_handovers handover
set sender_party_id = targets.sender_party_id,
    recipient_party_id = targets.recipient_party_id,
    sender_party_snapshot = targets.sender_party_snapshot,
    recipient_party_snapshot = targets.recipient_party_snapshot,
    version = handover.version + 1
from handover_targets targets
where handover.id = targets.id;

do $history_rewrite$
declare
  party_mapping record;
begin
  for party_mapping in select old_party_id, new_party_id from eps_mock_party_mapping loop
    update public.material_history history
    set from_state = jsonb_set(from_state, '{ownerPartyId}',
      to_jsonb(party_mapping.new_party_id::text), false)
    where jsonb_typeof(from_state) = 'object'
      and from_state->>'ownerPartyId' = party_mapping.old_party_id::text;
    update public.material_history history
    set from_state = jsonb_set(from_state, '{borrowerPartyId}',
      to_jsonb(party_mapping.new_party_id::text), false)
    where jsonb_typeof(from_state) = 'object'
      and from_state->>'borrowerPartyId' = party_mapping.old_party_id::text;
    update public.material_history history
    set to_state = jsonb_set(to_state, '{ownerPartyId}',
      to_jsonb(party_mapping.new_party_id::text), false)
    where jsonb_typeof(to_state) = 'object'
      and to_state->>'ownerPartyId' = party_mapping.old_party_id::text;
    update public.material_history history
    set to_state = jsonb_set(to_state, '{borrowerPartyId}',
      to_jsonb(party_mapping.new_party_id::text), false)
    where jsonb_typeof(to_state) = 'object'
      and to_state->>'borrowerPartyId' = party_mapping.old_party_id::text;
  end loop;
end;
$history_rewrite$;

select set_config('app.materials_warehouse_transition', 'false', true);
alter table public.material_handovers enable trigger material_handovers_scope_guard;
alter table public.materials enable trigger materials_scope_guard;

delete from private.fake_eps_teams team
using eps_mock_directory_mapping mapping
where mapping.old_source_type = 'eps_team'
  and team.id = mapping.old_source_id and team.code = mapping.old_code;

delete from private.fake_eps_departments department
using eps_mock_directory_mapping mapping
where mapping.old_source_type = 'eps_department'
  and department.id = mapping.old_source_id and department.code = mapping.old_code;

delete from public.material_custodians party
using eps_mock_party_mapping mapping
where party.id = mapping.old_party_id and mapping.old_source_type = 'eps_team';

delete from public.material_custodians party
using eps_mock_party_mapping mapping
where party.id = mapping.old_party_id and mapping.old_source_type = 'eps_department';

do $directory_postflight$
begin
  if exists (
    select 1 from private.fake_eps_departments
    where id in ('EPS-MOCK-D01', 'EPS-MOCK-D02')
  ) or exists (
    select 1 from private.fake_eps_teams
    where id in ('EPS-MOCK-T01', 'EPS-MOCK-T02', 'EPS-MOCK-T03')
  ) or exists (
    select 1 from public.material_custodians
    where source_type in ('eps_department', 'eps_team')
      and source_id in ('EPS-MOCK-D01', 'EPS-MOCK-D02', 'EPS-MOCK-T01', 'EPS-MOCK-T02', 'EPS-MOCK-T03')
  ) then
    raise exception 'Legacy EPS mock department/team rows remain after cleanup';
  end if;
  if exists (
    select 1 from private.fake_eps_employees
    where department_id like 'EPS-MOCK-D%' or team_id like 'EPS-MOCK-T%'
  ) then
    raise exception 'A demo EPS employee still references a legacy department or team';
  end if;
  if exists (
    select 1 from public.material_custodians
    where parent_id in (select old_party_id from eps_mock_party_mapping)
  ) then
    raise exception 'A custodian party still references a legacy EPS party';
  end if;
  if exists (
    select 1 from public.material_handovers handover
    join eps_mock_party_mapping mapping
      on mapping.old_party_id in (handover.sender_party_id, handover.recipient_party_id)
  ) or exists (
    select 1 from public.materials material
    join eps_mock_party_mapping mapping
      on mapping.old_party_id in (material.owner_party_id, material.borrower_party_id)
  ) or exists (
    select 1 from private.material_custodian_representatives representative
    join eps_mock_party_mapping mapping on mapping.old_party_id = representative.custodian_id
  ) then
    raise exception 'A demo record still references a legacy EPS party';
  end if;
  if exists (
    select 1 from public.material_history history
    join eps_mock_party_mapping mapping on
      history.from_state->>'ownerPartyId' = mapping.old_party_id::text
      or history.from_state->>'borrowerPartyId' = mapping.old_party_id::text
      or history.to_state->>'ownerPartyId' = mapping.old_party_id::text
      or history.to_state->>'borrowerPartyId' = mapping.old_party_id::text
  ) then
    raise exception 'Material history still references a legacy EPS party';
  end if;
  if (select count(*) from private.fake_eps_departments where is_active) <> 14
    or (select count(*) from private.fake_eps_teams where is_active) <> 80 then
    raise exception 'Active EPS directory totals changed during cleanup';
  end if;
end;
$directory_postflight$;

drop table eps_mock_party_mapping;
drop table eps_mock_directory_mapping;
