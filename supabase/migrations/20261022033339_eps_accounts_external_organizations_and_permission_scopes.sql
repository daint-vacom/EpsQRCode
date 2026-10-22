-- EPS account linking and per-permission data scopes for the isolated
-- EpsQRCode development project. All EPS directory rows below are synthetic.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.fake_eps_departments (
  id text primary key,
  code text not null unique,
  name text not null,
  is_active boolean not null default true
);

create table if not exists private.fake_eps_teams (
  id text primary key,
  code text not null unique,
  name text not null,
  department_id text not null references private.fake_eps_departments(id),
  is_active boolean not null default true
);

create table if not exists private.fake_eps_employees (
  id text primary key,
  employee_code text not null unique,
  first_name text not null,
  last_name text not null default '',
  email text,
  department_id text not null references private.fake_eps_departments(id),
  team_id text references private.fake_eps_teams(id),
  employment_status text not null default 'active'
    check (employment_status in ('active', 'inactive'))
);

insert into private.fake_eps_departments (id, code, name) values
  ('EPS-MOCK-D01', 'MOCK-D01', 'Đơn vị mẫu A'),
  ('EPS-MOCK-D02', 'MOCK-D02', 'Đơn vị mẫu B')
on conflict (id) do nothing;

insert into private.fake_eps_teams (id, code, name, department_id) values
  ('EPS-MOCK-T01', 'MOCK-T01', 'Tổ mẫu A1', 'EPS-MOCK-D01'),
  ('EPS-MOCK-T02', 'MOCK-T02', 'Tổ mẫu A2', 'EPS-MOCK-D01'),
  ('EPS-MOCK-T03', 'MOCK-T03', 'Tổ mẫu B1', 'EPS-MOCK-D02')
on conflict (id) do nothing;

insert into private.fake_eps_employees (
  id, employee_code, first_name, last_name, email, department_id, team_id
) values
  ('EPS-MOCK-E001', 'MOCK-E001', 'An', 'Nguyễn', 'an.mock@example.invalid', 'EPS-MOCK-D01', 'EPS-MOCK-T01'),
  ('EPS-MOCK-E002', 'MOCK-E002', 'Bình', 'Trần', 'binh.mock@example.invalid', 'EPS-MOCK-D01', 'EPS-MOCK-T01'),
  ('EPS-MOCK-E003', 'MOCK-E003', 'Chi', 'Lê', 'chi.mock@example.invalid', 'EPS-MOCK-D01', 'EPS-MOCK-T02'),
  ('EPS-MOCK-E004', 'MOCK-E004', 'Dũng', 'Phạm', 'dung.mock@example.invalid', 'EPS-MOCK-D02', 'EPS-MOCK-T03'),
  ('EPS-MOCK-E005', 'MOCK-E005', 'Hà', 'Võ', 'ha.mock@example.invalid', 'EPS-MOCK-D02', null)
on conflict (id) do nothing;

alter table public.user_profiles
  add column if not exists account_type text,
  add column if not exists eps_employee_id text,
  add column if not exists external_organization_id uuid;

alter table public.user_profiles
  drop constraint if exists user_profiles_account_type_check,
  drop constraint if exists user_profiles_account_link_check,
  drop constraint if exists user_profiles_external_organization_fk;

alter table public.user_profiles
  add constraint user_profiles_account_type_check
    check (account_type is null or account_type in ('eps', 'external')),
  add constraint user_profiles_account_link_check
    check (
      (account_type is null and eps_employee_id is null and external_organization_id is null)
      or (account_type = 'eps' and eps_employee_id is not null and external_organization_id is null)
      or (account_type = 'external' and eps_employee_id is null and external_organization_id is not null)
    ),
  add constraint user_profiles_external_organization_fk
    foreign key (external_organization_id)
    references public.material_custodians(id) on delete restrict;

create unique index if not exists user_profiles_eps_employee_id_unique
  on public.user_profiles(eps_employee_id)
  where account_type = 'eps' and eps_employee_id is not null;

alter table public.material_custodians
  add column if not exists source_type text,
  add column if not exists source_id text;

alter table public.material_custodians
  drop constraint if exists material_custodians_source_link_check;
alter table public.material_custodians
  add constraint material_custodians_source_link_check
  check (
    (source_type is null and source_id is null)
    or (
      ((source_type = 'eps_department' and type = 'department')
        or (source_type = 'eps_team' and type = 'team')
        or (source_type = 'eps_person' and type = 'person'))
      and nullif(btrim(source_id), '') is not null
    )
  );

create unique index if not exists material_custodians_eps_source_unique
  on public.material_custodians(source_type, source_id)
  where source_type is not null and source_id is not null;

drop trigger if exists user_profiles_create_employee on public.user_profiles;

alter table public.permission_definitions
  add column if not exists scope_options text[] not null default '{}'::text[];
alter table public.role_permissions
  add column if not exists scope text;

update public.permission_definitions
set scope_options = case
  when code in (
    'materials:material:view', 'materials:material:manage',
    'materials:handover:view', 'materials:handover:manage',
    'materials:custodian:view', 'materials:custodian:manage'
  ) then array['team', 'department', 'all', 'assigned_warehouses']::text[]
  when code in (
    'materials:receipt:view', 'materials:receipt:manage',
    'materials:warehouse:view', 'materials:warehouse:manage'
  ) then array['assigned_warehouses']::text[]
  else '{}'::text[]
end;

insert into public.permission_groups (
  module_code, code, name, description, sort_order, is_active
)
values (
  'organization', 'external_organizations', 'Đơn vị ngoài',
  'Quản lý đơn vị ngoài thuộc EpsQRCode.', 20, true
)
on conflict (module_code, code) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true;

update public.permission_groups
set code = 'accounts', name = 'Tài khoản',
    description = 'Quản lý tài khoản được phép sử dụng EpsQRCode.', is_active = true
where module_code = 'organization' and code = 'employees';

insert into public.permission_definitions (
  code, module_code, group_name, group_id, name, action, sensitive,
  sort_order, is_active, tags, scope_options
)
select
  permission.code, 'organization', permission_group.name, permission_group.id,
  permission.name, permission.action, permission.sensitive,
  permission.sort_order, true, permission.tags, '{}'::text[]
from (
  values
    ('organization:account:view', 'Xem tài khoản', 'view', false, 10, array['Xem']::text[], 'accounts'),
    ('organization:account:manage', 'Quản lý tài khoản', 'manage', true, 20, array['Chỉnh sửa']::text[], 'accounts'),
    ('organization:external-organization:view', 'Xem đơn vị ngoài', 'view', false, 30, array['Xem']::text[], 'external_organizations'),
    ('organization:external-organization:manage', 'Quản lý đơn vị ngoài', 'manage', true, 40, array['Chỉnh sửa', 'Xóa']::text[], 'external_organizations')
) as permission(code, name, action, sensitive, sort_order, tags, group_code)
join public.permission_groups permission_group
  on permission_group.module_code = 'organization'
 and permission_group.code = permission.group_code
on conflict (code) do update set
  module_code = excluded.module_code,
  group_name = excluded.group_name,
  group_id = excluded.group_id,
  name = excluded.name,
  action = excluded.action,
  sensitive = excluded.sensitive,
  sort_order = excluded.sort_order,
  is_active = true,
  tags = excluded.tags,
  scope_options = '{}'::text[];

-- Preserve existing assignments while replacing employee CRUD grants with account grants.
insert into public.role_permissions(role_id, permission_code)
select role_permission.role_id, 'organization:account:view'
from public.role_permissions role_permission
where role_permission.permission_code = 'organization:employee:view'
on conflict (role_id, permission_code) do nothing;

insert into public.role_permissions(role_id, permission_code)
select role_permission.role_id, 'organization:account:manage'
from public.role_permissions role_permission
where role_permission.permission_code in (
  'organization:employee:create', 'organization:employee:update',
  'organization:employee:delete', 'organization:employee:assign-role',
  'organization:employee:reset-password'
)
on conflict (role_id, permission_code) do nothing;

insert into public.user_permission_overrides(user_id, permission_code, effect)
select permission_override.user_id,
       case permission_override.permission_code
         when 'organization:employee:view' then 'organization:account:view'
         else 'organization:account:manage'
       end,
       permission_override.effect
from public.user_permission_overrides permission_override
where permission_override.permission_code like 'organization:employee:%'
on conflict (user_id, permission_code) do update set
  effect = case
    when public.user_permission_overrides.effect = 'deny'
      or excluded.effect = 'deny' then 'deny'
    else 'allow'
  end;

delete from public.role_permissions
where permission_code like 'organization:employee:%';
delete from public.user_permission_overrides
where permission_code like 'organization:employee:%';
delete from public.permission_definitions
where code like 'organization:employee:%';

-- Refuse to silently widen any custom role during the cutover. The reviewed
-- existing system administrator gets EPS-wide data and assigned-warehouse data.
do $$
begin
  if exists (
    select 1
    from public.role_permissions role_permission
    join public.roles role_record on role_record.id = role_permission.role_id
    join public.permission_definitions definition
      on definition.code = role_permission.permission_code
    where not role_record.is_system
      and cardinality(definition.scope_options) > 0
  ) then
    raise exception 'Map scoped grants for custom roles before applying this migration.';
  end if;
end $$;

update public.role_permissions role_permission
set scope = case
  when role_permission.permission_code like 'materials:warehouse:%'
    or role_permission.permission_code like 'materials:receipt:%'
    then 'assigned_warehouses'
  else 'all'
end
from public.roles role_record, public.permission_definitions definition
where role_record.id = role_permission.role_id
  and definition.code = role_permission.permission_code
  and role_record.is_system
  and cardinality(definition.scope_options) > 0;

update public.role_permissions role_permission
set scope = null
from public.permission_definitions definition
where definition.code = role_permission.permission_code
  and cardinality(definition.scope_options) = 0;

alter table public.role_permissions
  drop constraint if exists role_permissions_scope_allowed;
alter table public.role_permissions
  add constraint role_permissions_scope_allowed
  check (
    scope is null or scope in ('team', 'department', 'all', 'assigned_warehouses')
  );

create or replace function private.validate_role_permission_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare configured_scopes text[];
begin
  select definition.scope_options into configured_scopes
  from public.permission_definitions definition
  where definition.code = new.permission_code and definition.is_active;
  if not found then raise exception 'Permission definition is unavailable' using errcode = '22023'; end if;
  if cardinality(configured_scopes) = 0 and new.scope is not null then
    raise exception 'Global permission cannot have a data scope' using errcode = '22023';
  end if;
  if cardinality(configured_scopes) > 0
    and not coalesce(new.scope = any(configured_scopes), false) then
    raise exception 'Permission requires a supported data scope' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists role_permissions_validate_scope on public.role_permissions;
create trigger role_permissions_validate_scope
before insert or update of permission_code, scope on public.role_permissions
for each row execute function private.validate_role_permission_scope();

alter table public.roles drop column if exists scope;

drop function if exists public.replace_role_permissions(uuid, text[]);

create or replace function public.default_permission_scope(permission_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when permission_code like 'materials:warehouse:%'
      or permission_code like 'materials:receipt:%'
      then 'assigned_warehouses'
    else 'all'
  end;
$$;

create or replace function public.replace_role_permission_grants(
  target_role_id uuid,
  selected_grants jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_system_admin() then
    raise exception 'System administrator required' using errcode = '42501';
  end if;
  if jsonb_typeof(selected_grants) <> 'array' then
    raise exception 'Permission grants must be an array' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.roles role_record
    where role_record.id = target_role_id and not role_record.is_system
  ) then
    raise exception 'Custom role not found or system-managed' using errcode = '42501';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(selected_grants) grant_row
    left join public.permission_definitions definition
      on definition.code = grant_row->>'code' and definition.is_active
    where definition.code is null
      or (cardinality(definition.scope_options) = 0 and nullif(grant_row->>'scope', '') is not null)
      or (cardinality(definition.scope_options) > 0
        and not coalesce(grant_row->>'scope', '') = any(definition.scope_options))
  ) then
    raise exception 'One or more permission scopes are invalid' using errcode = '22023';
  end if;

  delete from public.role_permissions role_permission
  where role_permission.role_id = target_role_id;
  insert into public.role_permissions(role_id, permission_code, scope)
  select target_role_id, grant_row->>'code', nullif(grant_row->>'scope', '')
  from jsonb_array_elements(selected_grants) grant_row;
end;
$$;

create or replace function public.sync_grant_all_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.role_permissions(role_id, permission_code, scope)
  select role_record.id, new.code,
    case when cardinality(new.scope_options) = 0 then null
         else public.default_permission_scope(new.code) end
  from public.roles role_record
  where role_record.grant_all_permissions
  on conflict (role_id, permission_code) do nothing;
  return new;
end;
$$;

create or replace function public.get_effective_permissions(
  target_user_id uuid default auth.uid()
)
returns table (permission_code text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if target_user_id is distinct from auth.uid() and not public.is_system_admin() then
    raise exception 'Not allowed to inspect another account permissions'
      using errcode = '42501';
  end if;
  return query
  select definition.code
  from public.permission_definitions definition
  join public.user_profiles profile on profile.id = target_user_id
  where definition.is_active and profile.status = 'active'
    and (
      (profile.account_type is null and target_user_id = auth.uid() and public.is_system_admin())
      or (profile.account_type = 'eps' and exists (
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
    and (
      exists (
        select 1 from public.user_roles assignment
        join public.roles role_record on role_record.id = assignment.role_id
        join public.role_permissions role_permission on role_permission.role_id = role_record.id
        where assignment.user_id = target_user_id and role_record.is_active
          and role_permission.permission_code = definition.code
      )
      or exists (
        select 1 from public.user_permission_overrides permission_override
        where permission_override.user_id = target_user_id
          and permission_override.permission_code = definition.code
          and permission_override.effect = 'allow'
      )
    )
    and not exists (
      select 1 from public.user_permission_overrides permission_override
      where permission_override.user_id = target_user_id
        and permission_override.permission_code = definition.code
        and permission_override.effect = 'deny'
    )
  order by definition.sort_order, definition.code;
end;
$$;

create or replace function private.current_account_eps_employee()
returns table (employee_id text, department_id text, team_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select employee.id, employee.department_id, employee.team_id
  from public.user_profiles profile
  join private.fake_eps_employees employee on employee.id = profile.eps_employee_id
  where profile.id = auth.uid() and profile.account_type = 'eps'
    and profile.status = 'active' and employee.employment_status = 'active';
$$;

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

  select current_employee.department_id, current_employee.team_id
  into current_department, current_team
  from private.current_account_eps_employee() current_employee;
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

create or replace function public.has_scoped_permission(
  required_permission_code text,
  target_party_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission(required_permission_code)
    and (
      exists (
        select 1
        from public.user_roles assignment
        join public.roles role_record on role_record.id = assignment.role_id and role_record.is_active
        join public.role_permissions role_permission
          on role_permission.role_id = role_record.id
         and role_permission.permission_code = required_permission_code
        join public.permission_definitions definition
          on definition.code = role_permission.permission_code
        where assignment.user_id = auth.uid()
          and (
            cardinality(definition.scope_options) = 0
            or private.party_in_permission_scope(target_party_id, role_permission.scope)
          )
      )
      or (
        exists (
          select 1 from public.user_permission_overrides permission_override
          where permission_override.user_id = auth.uid()
            and permission_override.permission_code = required_permission_code
            and permission_override.effect = 'allow'
        )
        and exists (
          select 1 from public.permission_definitions definition
          where definition.code = required_permission_code
            and cardinality(definition.scope_options) = 0
        )
      )
    );
$$;

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
        public.has_scoped_permission('materials:material:view', material.owner_party_id)
        or (material.status = 'loaned' and material.borrower_party_id is not null
          and public.has_scoped_permission('materials:material:view', material.borrower_party_id))
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
        public.has_scoped_permission('materials:handover:view', handover.sender_party_id)
        or public.has_scoped_permission('materials:handover:view', handover.recipient_party_id)
        or (handover.receipt_id is not null and exists (
          select 1 from public.material_receipts receipt
          where receipt.id = handover.receipt_id
            and public.has_scoped_permission('materials:receipt:view', receipt.warehouse_id)
        ))
      )
  );
$$;

create or replace function public.can_view_receipt(target_receipt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.material_receipts receipt
    where receipt.id = target_receipt_id
      and public.has_scoped_permission('materials:receipt:view', receipt.warehouse_id)
  );
$$;

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
        party.account_user_id = auth.uid()
        or party.representative_user_id = auth.uid()
        or exists (
          select 1 from public.material_warehouse_accounts assignment
          where assignment.warehouse_id = party.id and assignment.user_id = auth.uid()
        )
        or (party.type = 'external' and profile.account_type = 'external'
          and profile.external_organization_id = party.id)
        or (party.type = 'person' and party.source_type = 'eps_person'
          and profile.account_type = 'eps' and profile.eps_employee_id = party.source_id)
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
  );
$$;

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
        public.material_can_represent(handover.sender_party_id)
        or public.material_can_represent(handover.recipient_party_id)
        or exists (
          select 1 from public.material_handover_history history
          where history.handover_id = handover.id and history.actor_user_id = auth.uid()
        )
      )
  );
$$;

create or replace function private.material_image_upload_party_id(storage_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare matched text[];
begin
  matched := regexp_match(storage_name, '^parties/([0-9a-fA-F-]{36})/objects/');
  if matched is null then return null; end if;
  return matched[1]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function private.guard_material_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare authorized boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if tg_op = 'INSERT' then
    authorized := public.has_scoped_permission('materials:material:manage', new.owner_party_id)
      or public.has_scoped_permission('materials:receipt:manage', new.owner_party_id)
      or public.has_scoped_permission('materials:handover:manage', new.owner_party_id);
  elsif tg_op = 'DELETE' then
    authorized := public.has_scoped_permission('materials:material:manage', old.owner_party_id);
  else
    authorized := public.has_scoped_permission('materials:material:manage', old.owner_party_id)
      or public.has_scoped_permission('materials:receipt:manage', old.owner_party_id)
      or public.has_scoped_permission('materials:handover:manage', old.owner_party_id)
      or public.has_scoped_permission('materials:handover:manage', old.borrower_party_id)
      or public.has_scoped_permission('materials:handover:manage', new.owner_party_id)
      or public.has_scoped_permission('materials:handover:manage', new.borrower_party_id);
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
declare authorized boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  authorized := public.has_scoped_permission('materials:handover:manage', new.sender_party_id)
    or public.has_scoped_permission('materials:handover:manage', new.recipient_party_id);
  if tg_op = 'UPDATE' then
    authorized := authorized
      and (public.has_scoped_permission('materials:handover:manage', old.sender_party_id)
        or public.has_scoped_permission('materials:handover:manage', old.recipient_party_id));
  end if;
  if not coalesce(authorized, false) then
    raise exception 'Handover is outside the permitted management scope' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.guard_receipt_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare receipt_id uuid; warehouse_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if tg_table_name = 'material_receipts' then
    if not public.has_scoped_permission('materials:receipt:manage', new.warehouse_id)
      or (tg_op = 'UPDATE' and not public.has_scoped_permission('materials:receipt:manage', old.warehouse_id)) then
      raise exception 'Receipt is outside the permitted warehouse scope' using errcode = '42501';
    end if;
  else
    receipt_id := case when tg_op = 'DELETE' then old.receipt_id else new.receipt_id end;
    select receipt.warehouse_id into warehouse_id
    from public.material_receipts receipt where receipt.id = receipt_id;
    if not public.has_scoped_permission('materials:receipt:manage', warehouse_id) then
      raise exception 'Receipt items are outside the permitted warehouse scope' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists materials_scope_guard on public.materials;
create trigger materials_scope_guard before insert or update or delete on public.materials
for each row execute function private.guard_material_scope();
drop trigger if exists material_handovers_scope_guard on public.material_handovers;
create trigger material_handovers_scope_guard before insert or update on public.material_handovers
for each row execute function private.guard_handover_scope();
drop trigger if exists material_receipts_scope_guard on public.material_receipts;
create trigger material_receipts_scope_guard before insert or update on public.material_receipts
for each row execute function private.guard_receipt_scope();
drop trigger if exists material_receipt_lines_scope_guard on public.material_receipt_lines;
create trigger material_receipt_lines_scope_guard before insert or update or delete on public.material_receipt_lines
for each row execute function private.guard_receipt_scope();
drop trigger if exists material_receipt_items_scope_guard on public.material_receipt_items;
create trigger material_receipt_items_scope_guard before insert or update or delete on public.material_receipt_items
for each row execute function private.guard_receipt_scope();
drop trigger if exists material_receipt_history_scope_guard on public.material_receipt_history;
create trigger material_receipt_history_scope_guard before insert or update or delete on public.material_receipt_history
for each row execute function private.guard_receipt_scope();

-- User-created EPS custodian links always resolve from the active mock provider.
-- External organizations are maintained through their dedicated contract.
create or replace function public.save_custodian(p_id uuid, p_values jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
  v_custodian_type text := p_values->>'type';
  v_source_id text := nullif(btrim(p_values->>'sourceId'), '');
  v_expected_source_type text;
  v_source_code text;
  v_source_name text;
  v_parent_source_id text;
  v_source_active boolean;
  v_parent_id uuid;
  v_account_user_id uuid := nullif(p_values->>'accountUserId', '')::uuid;
  v_representative_user_id uuid := nullif(p_values->>'representativeUserId', '')::uuid;
  v_existing public.material_custodians%rowtype;
begin
  if auth.uid() is null or not public.has_permission('materials:custodian:manage') then
    raise exception 'Permission denied to manage custodians' using errcode = '42501';
  end if;
  if v_custodian_type is null or v_custodian_type not in ('department', 'team', 'person') then
    raise exception 'EPS custodians must be linked from the EPS directory; external organizations use their own management page' using errcode = '22023';
  end if;
  v_expected_source_type := case v_custodian_type
    when 'department' then 'eps_department'
    when 'team' then 'eps_team'
    else 'eps_person'
  end;
  if v_source_id is null then
    raise exception 'Select a record from the mock EPS directory' using errcode = '22023';
  end if;

  select directory.code, directory.name, directory.parent_source_id, directory.is_active
  into v_source_code, v_source_name, v_parent_source_id, v_source_active
  from (
    select 'eps_department'::text as source_type, department.id as source_id,
      department.code, department.name, null::text as parent_source_id,
      department.is_active
    from private.fake_eps_departments department
    union all
    select 'eps_team', team.id, team.code, team.name, team.department_id, team.is_active
    from private.fake_eps_teams team
    union all
    select 'eps_person', employee.id, employee.employee_code,
      concat_ws(' ', employee.last_name, employee.first_name),
      coalesce(employee.team_id, employee.department_id),
      employee.employment_status = 'active'
    from private.fake_eps_employees employee
  ) directory
  where directory.source_type = v_expected_source_type and directory.source_id = v_source_id;
  if not found then
    raise exception 'The selected EPS directory record is unavailable' using errcode = 'P0002';
  end if;

  if p_id is not null then
    select * into v_existing from public.material_custodians where id = p_id for update;
    if not found or v_existing.type = 'warehouse' then
      raise exception 'Custodian not found' using errcode = 'P0002';
    end if;
    if v_existing.type <> v_custodian_type then
      raise exception 'A custodian source type cannot be changed' using errcode = '22023';
    end if;
    if v_existing.source_type is not null
      and (v_existing.source_type <> v_expected_source_type or v_existing.source_id <> v_source_id) then
      raise exception 'An EPS source link cannot be changed' using errcode = '22023';
    end if;
    if v_existing.source_type is null and not private.has_all_eps_custodian_manage() then
      raise exception 'Only the EPS directory manager can link an existing custodian' using errcode = '42501';
    end if;
    if v_existing.source_type is not null
      and not public.has_scoped_permission('materials:custodian:manage', v_existing.id)
      and not private.has_all_eps_custodian_manage() then
      raise exception 'Custodian is outside the permitted management scope' using errcode = '42501';
    end if;
    if exists (select 1 from public.material_custodians linked
      where linked.source_type = v_expected_source_type and linked.source_id = v_source_id
        and linked.id <> p_id) then
      raise exception 'This EPS directory record is already linked' using errcode = '23505';
    end if;
    saved_id := p_id;
  else
    if not private.has_all_eps_custodian_manage() then
      raise exception 'Creating a link to the EPS directory requires the Toàn EPS custodian-management scope' using errcode = '42501';
    end if;
    if exists (select 1 from public.material_custodians linked
      where linked.source_type = v_expected_source_type and linked.source_id = v_source_id) then
      raise exception 'This EPS directory record is already linked' using errcode = '23505';
    end if;
  end if;

  if v_parent_source_id is not null then
    select parent.id into v_parent_id
    from public.material_custodians parent
    where parent.source_id = v_parent_source_id
      and parent.source_type = case when v_expected_source_type = 'eps_team'
        then 'eps_department'
        when exists (select 1 from private.fake_eps_teams team where team.id = v_parent_source_id)
          then 'eps_team'
        else 'eps_department' end;
    if v_parent_id is null then
      raise exception 'Link the parent EPS organization first' using errcode = '23503';
    end if;
  end if;

  if v_account_user_id is not null and not exists (
    select 1 from public.user_profiles profile
    where profile.id = v_account_user_id and profile.status = 'active'
      and profile.account_type = 'eps' and profile.eps_employee_id = v_source_id
  ) then
    raise exception 'The linked account must belong to this EPS person' using errcode = '22023';
  end if;
  if v_representative_user_id is not null and not exists (
    select 1 from public.user_profiles profile where profile.id = v_representative_user_id
      and profile.status = 'active'
  ) then
    raise exception 'Representative must be an active QRCode account' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.material_custodians(
      type, code, name, parent_id, account_user_id, representative_user_id,
      is_active, source_type, source_id
    ) values (
      v_custodian_type, v_source_code, v_source_name, v_parent_id, v_account_user_id,
      v_representative_user_id, v_source_active, v_expected_source_type, v_source_id
    ) returning id into saved_id;
  else
    update public.material_custodians set
      code = v_source_code,
      name = v_source_name,
      parent_id = v_parent_id,
      account_user_id = v_account_user_id,
      representative_user_id = v_representative_user_id,
      is_active = v_source_active,
      source_type = v_expected_source_type,
      source_id = v_source_id,
      updated_at = timezone('utc', now())
    where id = saved_id;
  end if;
  return saved_id;
end;
$$;

create or replace function public.save_material_warehouse(p_id uuid, p_values jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
  account_id uuid;
  accounts jsonb := coalesce(p_values->'accountUserIds', '[]'::jsonb);
begin
  if auth.uid() is null or not public.has_permission('materials:warehouse:manage') then
    raise exception 'Permission denied to manage warehouses' using errcode = '42501';
  end if;
  if jsonb_typeof(accounts) is distinct from 'array' then
    raise exception 'Warehouse accounts must be an array' using errcode = '22023';
  end if;
  if p_id is null then
    if not public.is_system_admin() then
      raise exception 'Only a system administrator can create a warehouse' using errcode = '42501';
    end if;
  elsif not public.has_scoped_permission('materials:warehouse:manage', p_id) then
    raise exception 'Warehouse is outside the permitted scope' using errcode = '42501';
  end if;
  if exists (select 1 from jsonb_array_elements(accounts) item where jsonb_typeof(item.value) <> 'string')
    or (select count(*) from jsonb_array_elements(accounts)) <>
      (select count(distinct item.value#>>'{}') from jsonb_array_elements(accounts) item) then
    raise exception 'Warehouse account IDs must be unique strings' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements_text(accounts) item(value)
    where not exists (select 1 from public.user_profiles profile
      where profile.id = item.value::uuid and profile.status = 'active')) then
    raise exception 'Warehouse accounts must reference active QRCode accounts' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.material_custodians(type, code, name, is_active)
    values ('warehouse', btrim(p_values->>'code'), btrim(p_values->>'name'),
      coalesce((p_values->>'isActive')::boolean, true)) returning id into saved_id;
    insert into public.material_warehouses(custodian_id, address)
    values (saved_id, btrim(coalesce(p_values->>'address', '')));
  else
    update public.material_custodians set code = btrim(p_values->>'code'),
      name = btrim(p_values->>'name'),
      is_active = coalesce((p_values->>'isActive')::boolean, true),
      updated_at = timezone('utc', now())
    where id = p_id and type = 'warehouse' returning id into saved_id;
    if saved_id is null then raise exception 'Warehouse not found' using errcode = 'P0002'; end if;
    update public.material_warehouses set address = btrim(coalesce(p_values->>'address', '')),
      updated_at = timezone('utc', now()) where custodian_id = saved_id;
    delete from public.material_warehouse_accounts where warehouse_id = saved_id;
  end if;
  for account_id in select item.value::uuid from jsonb_array_elements_text(accounts) item(value) loop
    insert into public.material_warehouse_accounts(warehouse_id, user_id) values (saved_id, account_id);
  end loop;
  return saved_id;
end;
$$;

create or replace function public.can_manage_party(
  required_permission_code text,
  target_party_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_scoped_permission(required_permission_code, target_party_id);
$$;

create or replace function private.has_all_eps_custodian_manage()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.has_permission('materials:custodian:manage')
    and (
      public.is_system_admin()
      or (
        exists (
          select 1 from public.user_profiles profile
          join private.fake_eps_employees employee on employee.id = profile.eps_employee_id
          where profile.id = auth.uid() and profile.account_type = 'eps'
            and profile.status = 'active' and employee.employment_status = 'active'
        )
        and exists (
          select 1 from public.user_roles assignment
          join public.roles role_record on role_record.id = assignment.role_id and role_record.is_active
          join public.role_permissions role_permission on role_permission.role_id = role_record.id
          where assignment.user_id = auth.uid()
            and role_permission.permission_code = 'materials:custodian:manage'
            and role_permission.scope = 'all'
        )
      )
    )
    ;
$$;

create or replace function public.list_fake_eps_parties()
returns table (
  source_type text,
  source_id text,
  code text,
  name text,
  parent_source_id text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('materials:custodian:manage') then
    raise exception 'Custodian management permission required' using errcode = '42501';
  end if;
  if not private.has_all_eps_custodian_manage() then return; end if;
  return query
  select directory.source_type, directory.source_id, directory.code,
    directory.name, directory.parent_source_id, directory.is_active
  from (
    select 'eps_department'::text as source_type, department.id as source_id,
      department.code, department.name, null::text as parent_source_id,
      department.is_active
    from private.fake_eps_departments department
    union all
    select 'eps_team', team.id, team.code, team.name, team.department_id,
      team.is_active
    from private.fake_eps_teams team
    union all
    select 'eps_person', employee.id, employee.employee_code,
      concat_ws(' ', employee.last_name, employee.first_name),
      coalesce(employee.team_id, employee.department_id),
      employee.employment_status = 'active'
    from private.fake_eps_employees employee
  ) directory
  order by case directory.source_type
      when 'eps_department' then 0 when 'eps_team' then 1 else 2 end,
    case when directory.is_active then 0 else 1 end,
    lower(directory.name) collate "vi-x-icu", directory.source_id;
end;
$$;

create or replace function public.list_fake_eps_directory(p_search text default null)
returns table (
  id text, employee_code text, display_name text, email text,
  department_id text, department_name text, team_id text, team_name text,
  employment_status text, linked_user_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('organization:account:manage') then
    raise exception 'Account management permission required' using errcode = '42501';
  end if;
  return query
  select employee.id, employee.employee_code,
    concat_ws(' ', employee.last_name, employee.first_name), employee.email,
    department.id, department.name, team.id, team.name, employee.employment_status,
    profile.id
  from private.fake_eps_employees employee
  join private.fake_eps_departments department on department.id = employee.department_id
  left join private.fake_eps_teams team on team.id = employee.team_id
  left join public.user_profiles profile
    on profile.account_type = 'eps' and profile.eps_employee_id = employee.id
  where nullif(btrim(p_search), '') is null
    or concat_ws(' ', employee.employee_code, employee.first_name, employee.last_name,
      department.name, team.name) ilike '%' || btrim(p_search) || '%'
  order by case employee.employment_status when 'active' then 0 else 1 end,
    lower(concat_ws(' ', employee.last_name, employee.first_name)) collate "vi-x-icu",
    employee.id;
end;
$$;

create or replace function public.list_external_organizations(p_include_inactive boolean default false)
returns table (id uuid, code text, name text, is_active boolean, created_at timestamptz)
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
  select party.id, party.code, party.name, party.is_active, party.created_at
  from public.material_custodians party
  where party.type = 'external' and (p_include_inactive or party.is_active)
  order by case when party.is_active then 0 else 1 end,
    lower(party.name) collate "vi-x-icu", party.id;
end;
$$;

create or replace function public.save_external_organization(
  p_id uuid, p_code text, p_name text, p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare saved_id uuid;
begin
  if auth.uid() is null or not public.has_permission('organization:external-organization:manage') then
    raise exception 'External organization management permission required' using errcode = '42501';
  end if;
  if nullif(btrim(p_code), '') is null or nullif(btrim(p_name), '') is null then
    raise exception 'Mã và tên đơn vị ngoài là bắt buộc' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.material_custodians(type, code, name, is_active)
    values ('external', btrim(p_code), btrim(p_name), coalesce(p_is_active, true))
    returning id into saved_id;
  else
    update public.material_custodians
    set code = btrim(p_code), name = btrim(p_name), is_active = coalesce(p_is_active, true)
    where id = p_id and type = 'external'
    returning id into saved_id;
    if saved_id is null then raise exception 'Không tìm thấy đơn vị ngoài' using errcode = 'P0002'; end if;
  end if;
  return saved_id;
end;
$$;

create or replace function public.list_qrcode_accounts(p_search text default null)
returns table (
  user_id uuid, username text, display_name text, account_type text,
  eps_employee_id text, eps_employee_name text,
  eps_department_id text, eps_department_name text,
  eps_team_id text, eps_team_name text,
  external_organization_id uuid, external_organization_name text,
  status text, role_ids uuid[], role_names text[], warehouse_ids uuid[], warehouse_names text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('organization:account:view') then
    raise exception 'Account view permission required' using errcode = '42501';
  end if;
  return query
  select profile.id, profile.username,
    case when profile.account_type = 'eps' then
      coalesce(nullif(btrim(concat_ws(' ', employee.last_name, employee.first_name)), ''), 'Nhân viên EPS chưa khả dụng')
    else coalesce(nullif(btrim(profile.display_name), ''),
      nullif(btrim(concat_ws(' ', profile.last_name, profile.first_name)), ''),
      profile.username, 'Tài khoản chưa có tên') end,
    profile.account_type, profile.eps_employee_id,
    case when employee.id is null then null else concat_ws(' ', employee.last_name, employee.first_name) end,
    department.id, department.name, team.id, team.name,
    profile.external_organization_id, external_party.name, profile.status,
    coalesce((select array_agg(role.id order by role.sort_order, lower(role.name) collate "vi-x-icu", role.id)
      from public.user_roles assignment join public.roles role on role.id = assignment.role_id
      where assignment.user_id = profile.id and role.is_active), '{}'::uuid[]),
    coalesce((select array_agg(role.name order by role.sort_order, lower(role.name) collate "vi-x-icu", role.id)
      from public.user_roles assignment join public.roles role on role.id = assignment.role_id
      where assignment.user_id = profile.id and role.is_active), '{}'::text[]),
    coalesce((select array_agg(custodian.id order by lower(custodian.name) collate "vi-x-icu", custodian.id)
      from public.material_warehouse_accounts assignment
      join public.material_warehouses warehouse on warehouse.custodian_id = assignment.warehouse_id
      join public.material_custodians custodian on custodian.id = warehouse.custodian_id
      where assignment.user_id = profile.id), '{}'::uuid[]),
    coalesce((select array_agg(custodian.name order by lower(custodian.name) collate "vi-x-icu", custodian.id)
      from public.material_warehouse_accounts assignment
      join public.material_warehouses warehouse on warehouse.custodian_id = assignment.warehouse_id
      join public.material_custodians custodian on custodian.id = warehouse.custodian_id
      where assignment.user_id = profile.id), '{}'::text[])
  from public.user_profiles profile
  left join private.fake_eps_employees employee
    on profile.account_type = 'eps' and employee.id = profile.eps_employee_id
  left join private.fake_eps_departments department on department.id = employee.department_id
  left join private.fake_eps_teams team on team.id = employee.team_id
  left join public.material_custodians external_party
    on profile.account_type = 'external'
   and external_party.id = profile.external_organization_id
   and external_party.type = 'external'
  where nullif(btrim(p_search), '') is null
    or concat_ws(' ', profile.username, profile.display_name, employee.employee_code,
      employee.first_name, employee.last_name, department.name, team.name, external_party.name)
      ilike '%' || btrim(p_search) || '%'
  order by case profile.status when 'active' then 0 when 'suspended' then 1 else 2 end,
    lower(coalesce(nullif(btrim(case when profile.account_type = 'eps'
      then concat_ws(' ', employee.last_name, employee.first_name) else profile.display_name end), ''),
      concat_ws(' ', employee.last_name, employee.first_name), external_party.name, profile.username, '')) collate "vi-x-icu",
    profile.id;
end;
$$;

create or replace function public.list_account_role_options()
returns table (id uuid, code text, name text, is_system boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('organization:account:manage') then
    raise exception 'Account management permission required' using errcode = '42501';
  end if;
  return query
  select role.id, role.code, role.name, role.is_system
  from public.roles role
  where role.is_active
  order by case when role.is_system then 0 else 1 end,
    lower(role.name) collate "vi-x-icu", role.id;
end;
$$;

create or replace function public.list_account_warehouse_options()
returns table (id uuid, code text, name text, address text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('organization:account:manage') then
    raise exception 'Account management permission required' using errcode = '42501';
  end if;
  return query
  select custodian.id, custodian.code, custodian.name, warehouse.address
  from public.material_warehouses warehouse
  join public.material_custodians custodian on custodian.id = warehouse.custodian_id
  where custodian.is_active
  order by lower(custodian.name) collate "vi-x-icu", custodian.id;
end;
$$;

create or replace function public.get_my_qrcode_account()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select jsonb_build_object(
    'userId', profile.id, 'username', profile.username,
    'displayName', case when profile.account_type = 'eps'
      then coalesce(nullif(btrim(concat_ws(' ', employee.last_name, employee.first_name)), ''), profile.username)
      else profile.display_name end,
    'accountType', profile.account_type,
    'status', profile.status, 'epsEmployeeId', employee.id,
    'epsEmployeeCode', employee.employee_code,
    'epsEmployeeName', case when employee.id is null then null else concat_ws(' ', employee.last_name, employee.first_name) end,
    'epsEmploymentStatus', employee.employment_status,
    'epsDepartmentId', department.id, 'epsDepartmentName', department.name,
    'epsTeamId', team.id, 'epsTeamName', team.name,
    'externalOrganizationId', external_party.id,
    'externalOrganizationName', external_party.name
  ) into result
  from public.user_profiles profile
  left join private.fake_eps_employees employee
    on profile.account_type = 'eps' and employee.id = profile.eps_employee_id
  left join private.fake_eps_departments department on department.id = employee.department_id
  left join private.fake_eps_teams team on team.id = employee.team_id
  left join public.material_custodians external_party
    on profile.account_type = 'external' and external_party.id = profile.external_organization_id
  where profile.id = auth.uid();
  return result;
end;
$$;

drop function if exists public.save_account_access(uuid, text, text, uuid, text, uuid[], uuid[]);

create or replace function public.save_account_access(
  p_user_id uuid, p_account_type text, p_eps_employee_id text,
  p_external_organization_id uuid, p_status text, p_display_name text,
  p_role_ids uuid[] default '{}', p_warehouse_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare selected_count integer; active_selected_count integer;
begin
  if auth.uid() is null or not public.has_permission('organization:account:manage') then
    raise exception 'Account management permission required' using errcode = '42501';
  end if;
  if p_account_type not in ('eps', 'external') then
    raise exception 'Account type is invalid' using errcode = '22023';
  end if;
  if p_status not in ('active', 'suspended', 'deactivated') then
    raise exception 'Account status is invalid' using errcode = '22023';
  end if;
  if p_account_type = 'eps' then
    if p_eps_employee_id is null or p_external_organization_id is not null
      or not exists (select 1 from private.fake_eps_employees employee
        where employee.id = p_eps_employee_id
          and (employee.employment_status = 'active' or exists (
            select 1 from public.user_profiles current_profile
            where current_profile.id = p_user_id
              and current_profile.account_type = 'eps'
              and current_profile.eps_employee_id = employee.id
          ))) then
      raise exception 'EPS account must link to one active mock EPS employee' using errcode = '22023';
    end if;
    if exists (select 1 from public.user_profiles other_profile
      where other_profile.eps_employee_id = p_eps_employee_id and other_profile.id <> p_user_id) then
      raise exception 'EPS employee already has a QRCode account' using errcode = '23505';
    end if;
  else
    if p_eps_employee_id is not null or p_external_organization_id is null
      or not exists (select 1 from public.material_custodians party
        where party.id = p_external_organization_id and party.type = 'external'
          and (party.is_active or exists (
            select 1 from public.user_profiles current_profile
            where current_profile.id = p_user_id
              and current_profile.account_type = 'external'
              and current_profile.external_organization_id = party.id
          ))) then
      raise exception 'External account must link to one active external organization' using errcode = '22023';
    end if;
    if nullif(btrim(p_display_name), '') is null then
      raise exception 'External account display name is required' using errcode = '22023';
    end if;
  end if;
  if not exists (select 1 from public.user_profiles profile where profile.id = p_user_id) then
    raise exception 'QRCode account does not exist' using errcode = 'P0002';
  end if;

  select count(distinct role_id) into selected_count
  from unnest(coalesce(p_role_ids, '{}'::uuid[])) selected(role_id);
  select count(distinct role.id) into active_selected_count
  from public.roles role
  where role.id = any(coalesce(p_role_ids, '{}'::uuid[])) and role.is_active;
  if selected_count <> active_selected_count then
    raise exception 'One or more selected roles are unavailable' using errcode = '22023';
  end if;
  if exists (select 1 from public.roles role
    where role.id = any(coalesce(p_role_ids, '{}'::uuid[]))
      and (role.is_system or role.grant_all_permissions)
      and not exists (select 1 from public.user_roles existing_role
        where existing_role.user_id = p_user_id and existing_role.role_id = role.id)) then
    raise exception 'System roles cannot be newly assigned from account management' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_warehouse_ids, '{}'::uuid[])) selected(warehouse_id)
    left join public.material_warehouses warehouse
      on warehouse.custodian_id = selected.warehouse_id
    left join public.material_custodians warehouse_party
      on warehouse_party.id = warehouse.custodian_id and warehouse_party.is_active
    where warehouse.custodian_id is null or warehouse_party.id is null
  ) then raise exception 'One or more selected warehouses are unavailable' using errcode = '22023'; end if;

  update public.user_profiles
  set account_type = p_account_type,
      eps_employee_id = case when p_account_type = 'eps' then p_eps_employee_id else null end,
      external_organization_id = case when p_account_type = 'external' then p_external_organization_id else null end,
      display_name = case when p_account_type = 'external' then btrim(p_display_name) else display_name end,
      status = p_status
  where id = p_user_id;

  delete from public.user_roles assignment where assignment.user_id = p_user_id;
  insert into public.user_roles(user_id, role_id)
  select p_user_id, role.id from public.roles role
  where role.id = any(coalesce(p_role_ids, '{}'::uuid[])) and role.is_active;

  delete from public.material_warehouse_accounts assignment where assignment.user_id = p_user_id;
  insert into public.material_warehouse_accounts(warehouse_id, user_id)
  select selected.warehouse_id, p_user_id
  from (select distinct unnest(coalesce(p_warehouse_ids, '{}'::uuid[])) as warehouse_id) selected;
end;
$$;

-- Resolve scopes at the database boundary from the current mock provider profile.
alter table public.material_custodians enable row level security;
alter table public.materials enable row level security;
alter table public.material_handovers enable row level security;
alter table public.material_handover_items enable row level security;
alter table public.material_history enable row level security;
alter table public.material_handover_history enable row level security;
alter table public.material_warehouses enable row level security;
alter table public.material_warehouse_accounts enable row level security;
alter table public.material_receipts enable row level security;
alter table public.material_receipt_lines enable row level security;
alter table public.material_receipt_items enable row level security;
alter table public.material_receipt_history enable row level security;

drop policy if exists material_custodians_view on public.material_custodians;
create policy material_custodians_view on public.material_custodians
for select to authenticated using (
  public.has_scoped_permission('materials:custodian:view', id)
  or public.has_scoped_permission('materials:material:view', id)
  or public.has_scoped_permission('materials:handover:view', id)
  or public.has_scoped_permission('materials:warehouse:view', id)
);

drop policy if exists materials_view on public.materials;
create policy materials_view on public.materials
for select to authenticated using (public.can_view_material_current(id));

drop policy if exists material_handovers_view on public.material_handovers;
create policy material_handovers_view on public.material_handovers
for select to authenticated using (public.can_view_handover(id));

drop policy if exists material_handover_items_view on public.material_handover_items;
create policy material_handover_items_view on public.material_handover_items
for select to authenticated using (public.can_view_handover(handover_id));

drop policy if exists material_history_view on public.material_history;
create policy material_history_view on public.material_history
for select to authenticated using (
  public.can_view_material_current(material_id)
  and action = 'handover' and exists (
    select 1 from public.material_handovers handover
    join public.material_handover_items item on item.handover_id = handover.id
    where item.material_id = material_history.material_id
      and handover.code = material_history.note
      and private.account_participated_in_handover(handover.id)
  )
);

drop policy if exists material_handover_history_view on public.material_handover_history;
create policy material_handover_history_view on public.material_handover_history
for select to authenticated using (
  public.can_view_handover(handover_id)
  and private.account_participated_in_handover(handover_id)
);

drop policy if exists material_warehouses_view on public.material_warehouses;
create policy material_warehouses_view on public.material_warehouses
for select to authenticated using (
  public.has_scoped_permission('materials:warehouse:view', custodian_id)
);

drop policy if exists material_warehouse_accounts_view on public.material_warehouse_accounts;
create policy material_warehouse_accounts_view on public.material_warehouse_accounts
for select to authenticated using (
  user_id = auth.uid()
  or public.has_permission('organization:account:view')
);

drop policy if exists material_receipts_view on public.material_receipts;
create policy material_receipts_view on public.material_receipts
for select to authenticated using (public.can_view_receipt(id));

drop policy if exists material_receipt_lines_view on public.material_receipt_lines;
create policy material_receipt_lines_view on public.material_receipt_lines
for select to authenticated using (public.can_view_receipt(receipt_id));

drop policy if exists material_receipt_items_view on public.material_receipt_items;
create policy material_receipt_items_view on public.material_receipt_items
for select to authenticated using (public.can_view_receipt(receipt_id));

drop policy if exists material_receipt_history_view on public.material_receipt_history;
create policy material_receipt_history_view on public.material_receipt_history
for select to authenticated using (public.can_view_receipt(receipt_id));

-- Keep all scoped domain records behind their security-definer contracts.
revoke insert, update, delete on public.material_custodians, public.materials,
  public.material_handovers, public.material_handover_items, public.material_history,
  public.material_handover_history, public.material_warehouses,
  public.material_warehouse_accounts, public.material_receipts,
  public.material_receipt_lines, public.material_receipt_items,
  public.material_receipt_history from anon, authenticated;
grant select on public.material_custodians, public.materials,
  public.material_handovers, public.material_handover_items, public.material_history,
  public.material_handover_history, public.material_warehouses,
  public.material_warehouse_accounts, public.material_receipts,
  public.material_receipt_lines, public.material_receipt_items,
  public.material_receipt_history to authenticated;

-- Material metadata and object storage follow the material's current access scope.
alter table public.material_images enable row level security;
drop policy if exists material_images_select_with_permission on public.material_images;
create policy material_images_select_with_permission on public.material_images
for select to authenticated using (
  exists (
    select 1 from public.materials material
    where material.id = material_images.material_id
      and public.can_view_material_current(material.id)
  )
);
revoke insert, update, delete on public.material_images from anon, authenticated;
grant select on public.material_images to authenticated;

drop policy if exists material_images_storage_select on storage.objects;
create policy material_images_storage_select on storage.objects
for select to authenticated using (
  bucket_id = 'material-images' and exists (
    select 1 from public.material_images image
    join public.materials material on material.id = image.material_id
    where image.storage_bucket = storage.objects.bucket_id
      and image.storage_path = storage.objects.name
      and public.can_view_material_current(material.id)
  )
);
drop policy if exists material_images_storage_insert on storage.objects;
create policy material_images_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'material-images'
  and public.has_scoped_permission('materials:material:manage',
    private.material_image_upload_party_id(name))
);
drop policy if exists material_images_storage_update on storage.objects;
create policy material_images_storage_update on storage.objects
for update to authenticated using (
  bucket_id = 'material-images'
  and public.has_scoped_permission('materials:material:manage',
    private.material_image_upload_party_id(name))
) with check (
  bucket_id = 'material-images'
  and public.has_scoped_permission('materials:material:manage',
    private.material_image_upload_party_id(name))
);
drop policy if exists material_images_storage_delete on storage.objects;
create policy material_images_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'material-images' and (
    public.has_scoped_permission('materials:material:manage',
      private.material_image_upload_party_id(name))
    or exists (
      select 1 from public.material_images image
      join public.materials material on material.id = image.material_id
      where image.storage_bucket = storage.objects.bucket_id
        and image.storage_path = storage.objects.name
        and (
          public.has_scoped_permission('materials:material:manage', material.owner_party_id)
          or (material.borrower_party_id is not null
            and public.has_scoped_permission('materials:material:manage', material.borrower_party_id))
        )
    )
  )
);

drop policy if exists material_model_images_storage_select on storage.objects;
create policy material_model_images_storage_select on storage.objects
for select to authenticated using (
  bucket_id = 'material-model-images' and (
    public.has_permission('material_catalog:material_model:view')
    or public.has_permission('material_catalog:material_model:manage')
    or exists (
      select 1 from public.materials material
      where public.can_view_material_current(material.id)
        and material.model_snapshot->'images' @> jsonb_build_array(
          jsonb_build_object('storagePath', storage.objects.name)
        )
    )
  )
);

create or replace function public.list_custodians(p_include_inactive boolean default false)
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
    or public.has_permission('materials:material:view')
    or public.has_permission('materials:handover:view')
    or public.has_permission('materials:handover:manage')
    or public.has_permission('materials:warehouse:view')
    or public.has_permission('materials:warehouse:manage')
    or public.has_permission('materials:receipt:view')
    or public.has_permission('materials:receipt:manage')
  ) then
    raise exception 'Permission denied to view custodians' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', custodian.id,
      'type', custodian.type,
      'code', custodian.code,
      'name', custodian.name,
      'parentId', custodian.parent_id,
      'sourceType', custodian.source_type,
      'sourceId', custodian.source_id,
      'canRepresent', public.material_can_represent(custodian.id),
      'accountUserId', case when public.has_scoped_permission('materials:custodian:manage', custodian.id)
        then custodian.account_user_id else null end,
      'accountUserIds', case
        when public.has_scoped_permission('materials:custodian:manage', custodian.id)
          or private.has_all_eps_custodian_manage()
        then case when custodian.type = 'warehouse' then coalesce((
          select jsonb_agg(assignment.user_id order by assignment.user_id)
          from public.material_warehouse_accounts assignment
          where assignment.warehouse_id = custodian.id
        ), '[]'::jsonb)
        when custodian.account_user_id is null then '[]'::jsonb
        else jsonb_build_array(custodian.account_user_id) end
        when exists (select 1 from public.material_warehouse_accounts assignment
          where assignment.warehouse_id = custodian.id and assignment.user_id = auth.uid())
          then jsonb_build_array(auth.uid())
        else '[]'::jsonb end,
      'representativeUserId', case when public.has_scoped_permission('materials:custodian:manage', custodian.id)
        or private.has_all_eps_custodian_manage() then custodian.representative_user_id else null end,
      'representativeDisplayName', case when public.has_scoped_permission('materials:custodian:manage', custodian.id)
        or private.has_all_eps_custodian_manage()
        then coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''))
        else null end,
      'isActive', custodian.is_active,
      'createdAt', custodian.created_at,
      'updatedAt', custodian.updated_at
    ) order by case when custodian.is_active then 0 else 1 end,
      lower(custodian.name) collate "vi-x-icu", custodian.id)
    from public.material_custodians custodian
    left join public.user_profiles profile on profile.id = custodian.representative_user_id
    where (p_include_inactive or custodian.is_active)
      and (
        public.has_scoped_permission('materials:custodian:view', custodian.id)
        or public.has_scoped_permission('materials:custodian:manage', custodian.id)
        or public.has_scoped_permission('materials:material:view', custodian.id)
        or public.has_scoped_permission('materials:handover:view', custodian.id)
        or public.has_scoped_permission('materials:handover:manage', custodian.id)
        or public.has_scoped_permission('materials:warehouse:view', custodian.id)
        or public.has_scoped_permission('materials:warehouse:manage', custodian.id)
        or public.has_scoped_permission('materials:receipt:view', custodian.id)
        or public.has_scoped_permission('materials:receipt:manage', custodian.id)
        or (custodian.source_type is null
          and custodian.type in ('department', 'team', 'person')
          and private.has_all_eps_custodian_manage())
      )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_material_warehouses(p_include_inactive boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    public.has_permission('materials:warehouse:view')
    or public.has_permission('materials:warehouse:manage')
    or public.has_permission('materials:receipt:view')
    or public.has_permission('materials:receipt:manage')
    or public.has_permission('materials:handover:view')
    or public.has_permission('materials:handover:manage')
  ) then
    raise exception 'Permission denied to view warehouses' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', custodian.id, 'type', custodian.type, 'code', custodian.code,
      'name', custodian.name, 'address', warehouse.address,
      'accountUserIds', case
        when public.has_scoped_permission('materials:warehouse:manage', custodian.id)
          then coalesce((select jsonb_agg(assignment.user_id order by assignment.user_id)
            from public.material_warehouse_accounts assignment
            where assignment.warehouse_id = custodian.id), '[]'::jsonb)
        when exists (select 1 from public.material_warehouse_accounts assignment
          where assignment.warehouse_id = custodian.id and assignment.user_id = auth.uid())
          then jsonb_build_array(auth.uid())
        else '[]'::jsonb end,
      'isActive', custodian.is_active,
      'createdAt', custodian.created_at,
      'updatedAt', custodian.updated_at
    ) order by case when custodian.is_active then 0 else 1 end,
      lower(custodian.name) collate "vi-x-icu", custodian.id)
    from public.material_warehouses warehouse
    join public.material_custodians custodian on custodian.id = warehouse.custodian_id
    where (p_include_inactive or custodian.is_active)
      and (
        public.has_scoped_permission('materials:warehouse:view', custodian.id)
        or public.has_scoped_permission('materials:warehouse:manage', custodian.id)
        or public.has_scoped_permission('materials:receipt:view', custodian.id)
        or public.has_scoped_permission('materials:receipt:manage', custodian.id)
        or public.has_scoped_permission('materials:handover:view', custodian.id)
        or public.has_scoped_permission('materials:handover:manage', custodian.id)
      )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_custodian_account_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('materials:custodian:manage') then
    raise exception 'Permission denied to configure custodian representatives' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', profile.id,
      'username', profile.username,
      'displayName', coalesce(nullif(btrim(profile.display_name), ''),
        nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
        nullif(btrim(profile.username), ''), profile.id::text)
    ) order by lower(coalesce(nullif(btrim(profile.display_name), ''), profile.username, profile.id::text)) collate "vi-x-icu",
      profile.id)
    from public.user_profiles profile
    where profile.status = 'active'
      and profile.account_type = 'eps'
      and (private.has_all_eps_custodian_manage() or exists (
        select 1 from public.material_custodians party
        where party.is_active
          and party.type = 'person'
          and party.source_type = 'eps_person'
          and party.source_id = profile.eps_employee_id
          and public.has_scoped_permission('materials:custodian:manage', party.id)
      ))
  ), '[]'::jsonb);
end;
$$;

-- Read RPC contracts are scoped before pagination/counting; details repeat the
-- same check so direct RPC calls cannot use a guessed identifier.
create or replace function public.list_materials(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_page int := greatest(coalesce((p_filters->>'page')::int, 1), 1);
  v_size int := least(greatest(coalesce((p_filters->>'pageSize')::int, 20), 1), 100);
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
        and (nullif(p_filters->>'ownerPartyId', '') is null or material.owner_party_id = (p_filters->>'ownerPartyId')::uuid)
        and (nullif(p_filters->>'borrowerPartyId', '') is null or material.borrower_party_id = (p_filters->>'borrowerPartyId')::uuid)
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
      'items', coalesce((
        select jsonb_agg(public.material_json(page.id) order by
          case page.status when 'available' then 0 when 'loaned' then 1 else 2 end,
          lower(coalesce(nullif(btrim(page.name_override), ''), page.model_snapshot->>'name', '')) collate "vi-x-icu", page.id)
        from (select * from filtered order by
          case status when 'available' then 0 when 'loaned' then 1 else 2 end,
          lower(coalesce(nullif(btrim(name_override), ''), model_snapshot->>'name', '')) collate "vi-x-icu", id
          offset (v_page - 1) * v_size limit v_size) page
      ), '[]'::jsonb),
      'total', (select count(*) from filtered), 'page', v_page, 'pageSize', v_size
    )
  );
end;
$$;

create or replace function public.get_material(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.can_view_material_current(p_id) then
    raise exception 'Permission denied to view material' using errcode = '42501';
  end if;
  return public.material_json(p_id);
end;
$$;

create or replace function public.list_material_history(p_material_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.can_view_material_current(p_material_id) then
    raise exception 'Permission denied to view material history' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', history.id, 'materialId', history.material_id, 'actorUserId', history.actor_user_id,
      'action', history.action, 'note', history.note, 'fromState', history.from_state,
      'toState', history.to_state, 'createdAt', history.created_at
    ) order by history.created_at desc, history.id)
    from public.material_history history
    where history.material_id = p_material_id and history.action = 'handover'
      and exists (
        select 1 from public.material_handover_items item
        join public.material_handovers handover on handover.id = item.handover_id
        where item.material_id = history.material_id
          and handover.code = history.note
          and private.account_participated_in_handover(handover.id)
      )
  ), '[]'::jsonb);
end;
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
      exists (select 1 from public.user_profiles profile
        where profile.id = party.account_user_id and profile.status = 'active')
      or exists (select 1 from public.user_profiles profile
        where profile.id = party.representative_user_id and profile.status = 'active')
      or (party.type = 'person' and party.source_type = 'eps_person'
        and exists (select 1 from public.user_profiles profile
          where profile.account_type = 'eps' and profile.eps_employee_id = party.source_id
            and profile.status = 'active'))
      or (party.type = 'external'
        and exists (select 1 from public.user_profiles profile
          where profile.account_type = 'external'
            and profile.external_organization_id = party.id and profile.status = 'active'))
      or (party.type = 'warehouse'
        and exists (select 1 from public.material_warehouse_accounts assignment
          join public.user_profiles profile on profile.id = assignment.user_id
          where assignment.warehouse_id = party.id and profile.status = 'active'))
    )
  );
$$;
revoke all on function private.party_has_qrcode_account(uuid) from public, anon, authenticated;

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
      (result->'recipientParty'->>'id')::uuid));
end;
$$;
revoke all on function private.scoped_handover_json(uuid) from public, anon, authenticated;

create or replace function public.list_handovers(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_page int := greatest(coalesce((p_filters->>'page')::int, 1), 1);
  v_size int := least(greatest(coalesce((p_filters->>'pageSize')::int, 20), 1), 100);
begin
  if auth.uid() is null or not public.has_permission('materials:handover:view') then
    raise exception 'Permission denied to view handovers' using errcode = '42501';
  end if;
  return (
    with filtered as (
      select handover.id, handover.created_at
      from public.material_handovers handover
      where public.can_view_handover(handover.id)
        and (nullif(p_filters->>'search', '') is null or handover.code ilike '%' || btrim(p_filters->>'search') || '%')
        and (nullif(p_filters->>'status', '') is null or handover.status = p_filters->>'status')
        and (nullif(p_filters->>'type', '') is null or handover.type = p_filters->>'type')
        and (nullif(p_filters->>'senderPartyId', '') is null or handover.sender_party_id = (p_filters->>'senderPartyId')::uuid)
        and (nullif(p_filters->>'recipientPartyId', '') is null or handover.recipient_party_id = (p_filters->>'recipientPartyId')::uuid)
        and (nullif(p_filters->>'materialId', '') is null or exists (
          select 1 from public.material_handover_items item
          where item.handover_id = handover.id and item.material_id = (p_filters->>'materialId')::uuid
        ))
        and (nullif(p_filters->>'dateFrom', '') is null or handover.created_at >= (p_filters->>'dateFrom')::date)
        and (nullif(p_filters->>'dateTo', '') is null or handover.created_at < (p_filters->>'dateTo')::date + 1)
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(private.scoped_handover_json(page.id) order by page.created_at desc, page.id)
        from (select * from filtered order by created_at desc, id offset (v_page - 1) * v_size limit v_size) page), '[]'::jsonb),
      'total', (select count(*) from filtered), 'page', v_page, 'pageSize', v_size
    )
  );
end;
$$;

create or replace function public.list_handover_history(p_handover_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_view_handover(p_handover_id)
    or not private.account_participated_in_handover(p_handover_id) then
    raise exception 'Permission denied to view handover history' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', history.id, 'handoverId', history.handover_id,
      'actorUserId', history.actor_user_id,
      'actorDisplayName', coalesce(nullif(btrim(profile.display_name), ''),
        nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), '')),
      'action', history.action, 'note', history.note,
      'fromStatus', history.from_status, 'toStatus', history.to_status,
      'createdAt', history.created_at
    ) order by history.created_at, history.id)
    from public.material_handover_history history
    left join public.user_profiles profile on profile.id = history.actor_user_id
    where history.handover_id = p_handover_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_handover_counterparty_options(p_party_id uuid)
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
  where party.is_active and party.id <> p_party_id
  order by lower(party.name) collate "vi-x-icu", party.id;
end;
$$;

create or replace function public.get_handover(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.can_view_handover(p_id) then
    raise exception 'Permission denied to view handover' using errcode = '42501';
  end if;
  return private.scoped_handover_json(p_id);
end;
$$;

create or replace function public.get_material_receipt(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.can_view_receipt(p_id) then
    raise exception 'Permission denied to view receipt' using errcode = '42501';
  end if;
  return public.material_receipt_json(p_id);
end;
$$;

create or replace function public.list_material_receipts(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_page int := greatest(coalesce((p_filters->>'page')::int, 1), 1);
  v_size int := least(greatest(coalesce((p_filters->>'pageSize')::int, 20), 1), 100);
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:view') then
    raise exception 'Permission denied to view receipts' using errcode = '42501';
  end if;
  return (
    with filtered as (
      select receipt.id, receipt.created_at
      from public.material_receipts receipt
      where public.can_view_receipt(receipt.id)
        and (nullif(p_filters->>'search', '') is null or receipt.code ilike '%' || btrim(p_filters->>'search') || '%')
        and (nullif(p_filters->>'status', '') is null or receipt.status = p_filters->>'status')
        and (nullif(p_filters->>'warehouseId', '') is null or receipt.warehouse_id = (p_filters->>'warehouseId')::uuid)
        and (nullif(p_filters->>'dateFrom', '') is null or receipt.created_at >= (p_filters->>'dateFrom')::date)
        and (nullif(p_filters->>'dateTo', '') is null or receipt.created_at < (p_filters->>'dateTo')::date + 1)
        and (nullif(p_filters->>'materialId', '') is null or exists (
          select 1 from public.material_receipt_items item
          where item.receipt_id = receipt.id and item.material_id = (p_filters->>'materialId')::uuid
        ))
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(public.material_receipt_json(page.id) order by page.created_at desc, page.id)
        from (select * from filtered order by created_at desc, id offset (v_page - 1) * v_size limit v_size) page), '[]'::jsonb),
      'total', (select count(*) from filtered), 'page', v_page, 'pageSize', v_size
    )
  );
end;
$$;

-- Block the legacy QRCode-owned employee CRUD surface. The table is retained
-- for old references until a separately reviewed cleanup migration.
drop policy if exists employees_select_with_permission on public.employees;
drop policy if exists employees_insert_with_permission on public.employees;
drop policy if exists employees_update_with_permission on public.employees;
drop policy if exists employees_delete_unlinked_with_permission on public.employees;
create policy employees_no_client_access on public.employees
for all to authenticated using (false) with check (false);
revoke all on public.employees from anon, authenticated;
revoke all on function public.list_employees(integer, integer, text, public.employee_status[], uuid[], boolean) from public, anon, authenticated;
revoke all on function public.save_employee_role_assignments(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.update_my_employee_profile(uuid, text, text, text, text, public.employee_status, date, text, text) from public, anon, authenticated;

revoke all on function public.default_permission_scope(text) from public, anon;
revoke all on function public.replace_role_permission_grants(uuid, jsonb) from public, anon;
revoke all on function public.list_fake_eps_directory(text) from public, anon;
revoke all on function public.list_external_organizations(boolean) from public, anon;
revoke all on function public.save_external_organization(uuid, text, text, boolean) from public, anon;
revoke all on function public.list_qrcode_accounts(text) from public, anon;
revoke all on function public.list_account_role_options() from public, anon;
revoke all on function public.list_account_warehouse_options() from public, anon;
revoke all on function public.get_my_qrcode_account() from public, anon;
revoke all on function public.save_account_access(uuid, text, text, uuid, text, text, uuid[], uuid[]) from public, anon;
revoke all on function public.has_scoped_permission(text, uuid) from public, anon;
revoke all on function public.can_view_material_current(uuid) from public, anon;
revoke all on function public.can_view_handover(uuid) from public, anon;
revoke all on function public.can_view_receipt(uuid) from public, anon;
revoke all on function public.can_manage_party(text, uuid) from public, anon;

grant execute on function public.replace_role_permission_grants(uuid, jsonb) to authenticated;
grant execute on function public.list_fake_eps_directory(text) to authenticated;
grant execute on function public.list_external_organizations(boolean) to authenticated;
grant execute on function public.save_external_organization(uuid, text, text, boolean) to authenticated;
grant execute on function public.list_qrcode_accounts(text) to authenticated;
grant execute on function public.list_account_role_options() to authenticated;
grant execute on function public.list_account_warehouse_options() to authenticated;
grant execute on function public.get_my_qrcode_account() to authenticated;
grant execute on function public.save_account_access(uuid, text, text, uuid, text, text, uuid[], uuid[]) to authenticated;
grant execute on function public.has_scoped_permission(text, uuid) to authenticated;
grant execute on function public.can_view_material_current(uuid) to authenticated;
grant execute on function public.can_view_handover(uuid) to authenticated;
grant execute on function public.can_view_receipt(uuid) to authenticated;
grant execute on function public.can_manage_party(text, uuid) to authenticated;

grant select on public.permission_definitions to authenticated;
grant select on public.role_permissions to authenticated;
revoke insert, update, delete on public.role_permissions from authenticated;

-- A normal handover is managed from the represented sender side. The receiver
-- may be an EPS directory record without a QRCode account.
create or replace function public.save_handover(p_id uuid, p_values jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_row public.material_handovers%rowtype;
  v_type text := p_values->>'type';
  v_sender uuid := nullif(p_values->>'senderPartyId', '')::uuid;
  v_recipient uuid := nullif(p_values->>'recipientPartyId', '')::uuid;
  v_rep_sender uuid := nullif(p_values->>'senderRepresentativeUserId', '')::uuid;
  v_rep_recipient uuid := nullif(p_values->>'recipientRepresentativeUserId', '')::uuid;
  v_items jsonb := coalesce(p_values->'items', '[]'::jsonb);
  v_files jsonb := coalesce(p_values->'attachmentFileIds', '[]'::jsonb);
  v_item jsonb;
  v_material public.materials%rowtype;
  v_snapshot jsonb;
  v_old_status text;
  v_index integer := 0;
begin
  if auth.uid() is null
    or not public.has_scoped_permission('materials:handover:manage', v_sender)
    or not public.material_can_represent(v_sender) then
    raise exception 'You must manage and represent the sender party' using errcode = '42501';
  end if;
  if v_type not in ('transfer', 'loan', 'return')
    or v_sender is null or v_recipient is null or v_sender = v_recipient then
    raise exception 'Invalid handover parties or type' using errcode = '22023';
  end if;
  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'A handover needs at least one material' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(v_items)) <>
    (select count(distinct item.value->>'materialId') from jsonb_array_elements(v_items) item(value)) then
    raise exception 'A material can appear only once in a handover' using errcode = '22023';
  end if;
  if jsonb_typeof(v_files) is distinct from 'array' then
    raise exception 'Attachments must be an array of file IDs' using errcode = '22023';
  end if;
  if v_type = 'loan' and nullif(p_values->>'dueDate', '') is null then
    raise exception 'A due date is required for a loan' using errcode = '22023';
  end if;
  if v_rep_sender is not null and not exists (
    select 1 from public.material_custodians party
    where party.id = v_sender
      and v_rep_sender in (party.account_user_id, party.representative_user_id)
  ) then
    raise exception 'Sender representative is not assigned to this party' using errcode = '42501';
  end if;
  if v_rep_recipient is not null and not exists (
    select 1 from public.material_custodians party
    where party.id = v_recipient
      and v_rep_recipient in (party.account_user_id, party.representative_user_id)
  ) then
    raise exception 'Recipient representative is not assigned to this party' using errcode = '42501';
  end if;
  if not exists (select 1 from public.material_custodians party where party.id = v_sender and party.is_active)
    or not exists (select 1 from public.material_custodians party where party.id = v_recipient and party.is_active) then
    raise exception 'Both handover parties must be active' using errcode = '22023';
  end if;

  perform set_config('app.materials_handover_actor_party_id', v_sender::text, true);
  if p_id is null then
    insert into public.material_handovers(
      code, type, sender_party_id, recipient_party_id, status,
      planned_date, due_date, note
    ) values (
      'BG-' || to_char(current_date, 'YYYYMMDD') || '-' ||
        nextval('public.material_handover_code_seq')::text,
      v_type, v_sender, v_recipient, 'draft',
      nullif(p_values->>'plannedDate', '')::date,
      nullif(p_values->>'dueDate', '')::date,
      nullif(btrim(p_values->>'note'), '')
    ) returning id into v_id;
  else
    select * into v_row from public.material_handovers where id = p_id for update;
    if not found then raise exception 'Handover not found' using errcode = 'P0002'; end if;
    if v_row.mode <> 'standard' or v_row.status <> 'draft' then
      raise exception 'Only standard draft handovers can be edited here' using errcode = '55000';
    end if;
    if (p_values->>'expectedVersion')::integer is distinct from v_row.version then
      raise exception 'Handover changed; reload before saving' using errcode = '40001';
    end if;
    if not public.has_scoped_permission('materials:handover:manage', v_row.sender_party_id)
      or not public.material_can_represent(v_row.sender_party_id) then
      raise exception 'You must manage and represent the current sender party' using errcode = '42501';
    end if;
    v_old_status := v_row.status;
    v_id := p_id;
    update public.material_handovers set
      type = v_type,
      sender_party_id = v_sender,
      recipient_party_id = v_recipient,
      sender_representative_user_id = v_rep_sender,
      recipient_representative_user_id = v_rep_recipient,
      planned_date = nullif(p_values->>'plannedDate', '')::date,
      due_date = nullif(p_values->>'dueDate', '')::date,
      note = nullif(btrim(p_values->>'note'), ''),
      version = version + 1
    where id = v_id;
  end if;

  update public.material_handovers handover set
    sender_representative_snapshot = case when v_rep_sender is null then null else (
      select jsonb_build_object('userId', profile.id, 'displayName',
        coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), '')))
      from public.user_profiles profile where profile.id = v_rep_sender
    ) end,
    recipient_representative_snapshot = case when v_rep_recipient is null then null else (
      select jsonb_build_object('userId', profile.id, 'displayName',
        coalesce(nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), '')))
      from public.user_profiles profile where profile.id = v_rep_recipient
    ) end,
    sender_party_snapshot = public.material_party_json(v_sender),
    recipient_party_snapshot = public.material_party_json(v_recipient)
  where handover.id = v_id;

  if exists (select 1 from jsonb_array_elements(v_files) file where jsonb_typeof(file.value) is distinct from 'string') then
    raise exception 'Attachment IDs must be strings' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_files) file(value)
    where not exists (select 1 from public.files item
      where item.id = file.value::uuid and item.status = 'active' and item.deleted_at is null)
  ) then
    raise exception 'Every attachment must reference an active workspace file' using errcode = '22023';
  end if;
  update public.material_handovers handover set attachments = coalesce((
    select jsonb_agg(jsonb_build_object(
      'fileId', file.id, 'fileName', file.file_name,
      'mimeType', file.mime_type, 'sizeBytes', file.size_bytes
    ) order by selected.ordinality)
    from jsonb_array_elements_text(v_files) with ordinality selected(value, ordinality)
    join public.files file on file.id = selected.value::uuid
  ), '[]'::jsonb) where handover.id = v_id;

  perform set_config('app.materials_handover_transition', 'true', true);
  for v_material in
    select material.* from public.materials material
    where material.reserved_handover_id = v_id
      or material.id in (
        select (item.value->>'materialId')::uuid from jsonb_array_elements(v_items) item(value)
      )
    order by material.id for update
  loop
    null;
  end loop;
  for v_item in select value from jsonb_array_elements(v_items) loop
    if nullif(v_item->>'materialId', '') is null then
      raise exception 'Each line needs a material ID' using errcode = '22023';
    end if;
    select * into v_material from public.materials where id = (v_item->>'materialId')::uuid;
    if not found then raise exception 'A selected material no longer exists' using errcode = 'P0002'; end if;
    if v_material.reserved_handover_id is not null and v_material.reserved_handover_id <> v_id then
      raise exception 'A selected material is reserved by another open handover' using errcode = '55000';
    end if;
    if v_item->>'condition' not in ('good', 'damaged')
      or ((v_item->>'condition') = 'damaged' and nullif(btrim(v_item->>'conditionNote'), '') is null) then
      raise exception 'Material condition is invalid or damage note is missing' using errcode = '22023';
    end if;
    if v_type in ('transfer', 'loan') then
      if v_material.owner_party_id <> v_sender or v_material.status <> 'available' then
        raise exception 'Transfer and loan require an available material owned by the sender' using errcode = '55000';
      end if;
    elsif v_material.status <> 'loaned'
      or v_material.borrower_party_id <> v_sender
      or v_material.owner_party_id <> v_recipient then
      raise exception 'Return must come from the current borrower to the owner' using errcode = '55000';
    end if;
    v_snapshot := public.material_json(v_material.id);
    insert into public.material_handover_items(
      handover_id, material_id, material_snapshot, sender_condition,
      sender_condition_note, sort_order
    ) values (
      v_id, v_material.id, v_snapshot, v_item->>'condition',
      nullif(btrim(v_item->>'conditionNote'), ''), v_index
    ) on conflict (handover_id, material_id) do update set
      material_snapshot = excluded.material_snapshot,
      sender_condition = excluded.sender_condition,
      sender_condition_note = excluded.sender_condition_note,
      sort_order = excluded.sort_order;
    update public.materials set reserved_handover_id = v_id,
      reservation_status = 'draft' where id = v_material.id;
    v_index := v_index + 1;
  end loop;
  delete from public.material_handover_items item
  where item.handover_id = v_id and not exists (
    select 1 from jsonb_array_elements(v_items) selected
    where (selected.value->>'materialId')::uuid = item.material_id
  );
  update public.materials material set reserved_handover_id = null, reservation_status = null
  where material.reserved_handover_id = v_id and not exists (
    select 1 from jsonb_array_elements(v_items) selected
    where (selected.value->>'materialId')::uuid = material.id
  );
  if p_id is null then
    insert into public.material_handover_history(
      handover_id, actor_user_id, action, to_status, note
    ) values (v_id, auth.uid(), 'created', 'draft', nullif(btrim(p_values->>'note'), ''));
  else
    insert into public.material_handover_history(
      handover_id, actor_user_id, action, from_status, to_status, note
    ) values (v_id, auth.uid(), 'updated', v_old_status, 'draft', nullif(btrim(p_values->>'note'), ''));
  end if;
  return v_id;
end;
$$;

create or replace function public.act_on_handover(
  p_id uuid, p_action text, p_expected_version integer,
  p_note text default null, p_item_conditions jsonb default '[]'::jsonb
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
  if p_action in ('send', 'cancel') then
    v_actor_party := v_h.sender_party_id;
    if not public.has_scoped_permission('materials:handover:manage', v_actor_party)
      or not public.material_can_represent(v_actor_party) then
      raise exception 'Only a represented sender with handover scope can do this action' using errcode = '42501';
    end if;
  else
    v_actor_party := v_h.recipient_party_id;
    if not public.has_scoped_permission('materials:handover:manage', v_actor_party)
      or not public.material_can_represent(v_actor_party) then
      raise exception 'Only a represented receiver with handover scope can do this action' using errcode = '42501';
    end if;
  end if;

  if p_action = 'send' then
    if v_h.status <> 'draft' then raise exception 'Only a draft handover can be sent' using errcode = '55000'; end if;
    if not exists (
      select 1 from public.material_custodians party
      where party.id in (v_h.sender_party_id, v_h.recipient_party_id)
        and party.is_active having count(*) = 2
    ) then raise exception 'Both parties must be active to send a handover' using errcode = '22023'; end if;
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
    if not exists (
      select 1 from public.material_custodians party
      where party.id in (v_h.sender_party_id, v_h.recipient_party_id)
        and party.is_active having count(*) = 2
    ) then raise exception 'Both parties must be active to confirm a handover' using errcode = '22023'; end if;
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
      select item.*, material.id as material_row_id
      from public.material_handover_items item
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
          and material.owner_party_id = v_h.sender_party_id and material.status = 'available'
          and material.borrower_party_id is null and material.active_loan_handover_id is null
      ) then
        raise exception 'Current material custody no longer matches the handover sender' using errcode = '55000';
      end if;
      if v_h.type = 'return' and not exists (
        select 1 from public.materials material where material.id = v_item.material_id
          and material.owner_party_id = v_h.recipient_party_id
          and material.borrower_party_id = v_h.sender_party_id
          and material.status = 'loaned' and material.active_loan_handover_id is not null
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
          condition = v_condition, reserved_handover_id = null, reservation_status = null,
          version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
      elsif v_h.type = 'loan' then
        update public.materials set borrower_party_id = v_h.recipient_party_id,
          status = 'loaned', active_loan_handover_id = p_id, condition = v_condition,
          reserved_handover_id = null, reservation_status = null,
          version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
      else
        update public.materials set borrower_party_id = null, status = 'available',
          active_loan_handover_id = null, condition = v_condition,
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

alter table public.material_handover_history
  drop constraint if exists material_handover_history_action_check;
alter table public.material_handover_history
  add constraint material_handover_history_action_check
  check (action in (
    'created', 'updated', 'sent', 'warehouse_approved', 'confirmed',
    'confirmed_offline', 'rejected', 'cancelled'
  ));

create or replace function public.complete_handover_offline(
  p_id uuid, p_expected_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_h public.material_handovers%rowtype;
  v_item record;
  v_before jsonb;
begin
  if auth.uid() is null or not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to manage handovers' using errcode = '42501';
  end if;
  select * into v_h from public.material_handovers where id = p_id for update;
  if not found then raise exception 'Handover not found' using errcode = 'P0002'; end if;
  if v_h.mode <> 'standard' or v_h.receipt_id is not null then
    raise exception 'Offline completion is available only for standard handovers' using errcode = '22023';
  end if;
  if v_h.status = 'completed' then return p_id; end if;
  if v_h.status <> 'pending' then raise exception 'Only a pending handover can be completed offline' using errcode = '55000'; end if;
  if v_h.version is distinct from p_expected_version then
    raise exception 'Handover changed; reload before acting' using errcode = '40001';
  end if;
  if not public.has_scoped_permission('materials:handover:manage', v_h.sender_party_id)
    or not public.material_can_represent(v_h.sender_party_id) then
    raise exception 'Only a represented sender with handover scope can complete offline' using errcode = '42501';
  end if;
  if private.party_has_qrcode_account(v_h.recipient_party_id) then
    raise exception 'The receiving party has a QRCode account and must confirm the handover' using errcode = '55000';
  end if;
  if not exists (select 1 from public.material_custodians party
    where party.id in (v_h.sender_party_id, v_h.recipient_party_id)
      and party.is_active having count(*) = 2) then
    raise exception 'Both parties must be active to complete a handover' using errcode = '22023';
  end if;
  perform set_config('app.materials_handover_actor_party_id', v_h.sender_party_id::text, true);
  perform set_config('app.materials_handover_transition', 'true', true);
  for v_item in
    select item.* from public.material_handover_items item
    join public.materials material on material.id = item.material_id
    where item.handover_id = p_id order by material.id for update of material
  loop
    if not exists (select 1 from public.materials material
      where material.id = v_item.material_id and material.reserved_handover_id = p_id) then
      raise exception 'A handover material is no longer reserved by this document' using errcode = '55000';
    end if;
    if v_h.type in ('transfer', 'loan') and not exists (
      select 1 from public.materials material where material.id = v_item.material_id
        and material.owner_party_id = v_h.sender_party_id and material.status = 'available'
        and material.borrower_party_id is null and material.active_loan_handover_id is null
    ) then
      raise exception 'Current material custody no longer matches the handover sender' using errcode = '55000';
    end if;
    if v_h.type = 'return' and not exists (
      select 1 from public.materials material where material.id = v_item.material_id
        and material.owner_party_id = v_h.recipient_party_id
        and material.borrower_party_id = v_h.sender_party_id
        and material.status = 'loaned' and material.active_loan_handover_id is not null
    ) then
      raise exception 'Current loan no longer matches the return parties' using errcode = '55000';
    end if;
    v_before := public.material_json(v_item.material_id);
    update public.material_handover_items set receiver_condition = sender_condition
    where id = v_item.id;
    if v_h.type = 'transfer' then
      update public.materials set owner_party_id = v_h.recipient_party_id,
        condition = v_item.sender_condition, reserved_handover_id = null, reservation_status = null,
        version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
    elsif v_h.type = 'loan' then
      update public.materials set borrower_party_id = v_h.recipient_party_id,
        status = 'loaned', active_loan_handover_id = p_id, condition = v_item.sender_condition,
        reserved_handover_id = null, reservation_status = null,
        version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
    else
      update public.materials set borrower_party_id = null, status = 'available',
        active_loan_handover_id = null, condition = v_item.sender_condition,
        reserved_handover_id = null, reservation_status = null,
        version = version + 1, updated_at = timezone('utc', now()) where id = v_item.material_id;
    end if;
    insert into public.material_history(material_id, actor_user_id, action, note, from_state, to_state)
    values (v_item.material_id, auth.uid(), 'handover', v_h.code,
      v_before, public.material_json(v_item.material_id));
  end loop;
  update public.material_handovers set status = 'completed', confirmed_by = auth.uid(),
    completed_at = timezone('utc', now()), version = version + 1 where id = p_id;
  insert into public.material_handover_history(
    handover_id, actor_user_id, action, from_status, to_status, note
  ) values (
    p_id, auth.uid(), 'confirmed_offline', 'pending', 'completed',
    'Bên giao xác nhận đã bàn giao trực tiếp; bên nhận chưa có tài khoản QRCode.'
  );
  return p_id;
end;
$$;

-- Keep table triggers aligned with the authorization checks in the RPCs.
create or replace function private.guard_material_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authorized boolean := false;
  transition_handover_id uuid;
  transition_sender_id uuid;
  transition_recipient_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if tg_op = 'INSERT' then
    authorized := public.has_scoped_permission('materials:material:manage', new.owner_party_id)
      or public.has_scoped_permission('materials:receipt:manage', new.owner_party_id);
  elsif tg_op = 'DELETE' then
    authorized := public.has_scoped_permission('materials:material:manage', old.owner_party_id);
  elsif current_setting('app.materials_handover_transition', true) = 'true'
    or current_setting('app.materials_warehouse_transition', true) = 'true' then
    transition_handover_id := coalesce(old.reserved_handover_id, new.reserved_handover_id,
      old.active_loan_handover_id, new.active_loan_handover_id);
    if transition_handover_id is not null then
      select handover.sender_party_id, handover.recipient_party_id
      into transition_sender_id, transition_recipient_id
      from public.material_handovers handover where handover.id = transition_handover_id;
    end if;
    authorized := public.has_scoped_permission('materials:handover:manage', transition_sender_id)
      or public.has_scoped_permission('materials:handover:manage', transition_recipient_id)
      or public.has_scoped_permission('materials:receipt:manage', old.owner_party_id)
      or public.has_scoped_permission('materials:receipt:manage', new.owner_party_id);
  else
    authorized := (
      public.has_scoped_permission('materials:material:manage', old.owner_party_id)
      or public.has_scoped_permission('materials:receipt:manage', old.owner_party_id)
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
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  actor_setting := nullif(current_setting('app.materials_handover_actor_party_id', true), '');
  if actor_setting is not null then actor_party_id := actor_setting::uuid; end if;
  if actor_party_id is null then
    if tg_op = 'INSERT' then
      actor_party_id := case when new.mode = 'warehouse_request'
        then new.recipient_party_id else new.sender_party_id end;
    elsif old.status = 'draft' and new.status = 'awaiting_warehouse_approval' then
      actor_party_id := new.recipient_party_id;
    elsif old.status = 'awaiting_warehouse_approval' and new.status = 'pending' then
      actor_party_id := new.sender_party_id;
    elsif old.status = 'awaiting_warehouse_approval' and new.status = 'rejected' then
      actor_party_id := new.sender_party_id;
    elsif old.status = 'pending' and new.status in ('completed', 'rejected') then
      actor_party_id := new.recipient_party_id;
    elsif new.status = 'cancelled' then
      actor_party_id := case when new.mode = 'warehouse_request' and old.status = 'draft'
        then new.recipient_party_id else new.sender_party_id end;
    elsif old.status = 'draft' and new.status = 'pending' then
      actor_party_id := new.sender_party_id;
    else
      actor_party_id := case when new.mode = 'warehouse_request'
        then new.recipient_party_id else new.sender_party_id end;
    end if;
  end if;
  if actor_party_id not in (new.sender_party_id, new.recipient_party_id)
    or not public.has_scoped_permission('materials:handover:manage', actor_party_id)
    or not public.material_can_represent(actor_party_id) then
    if current_setting('app.materials_warehouse_transition', true) = 'true'
      and new.receipt_id is not null and exists (
        select 1 from public.material_receipts receipt
        where receipt.id = new.receipt_id
          and public.has_scoped_permission('materials:receipt:manage', receipt.warehouse_id)
      ) then
      return new;
    end if;
    raise exception 'Handover is outside the represented management scope' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'draft' then
    if old.sender_party_id is distinct from new.sender_party_id
      and (not public.has_scoped_permission('materials:handover:manage', old.sender_party_id)
        or not public.material_can_represent(old.sender_party_id)) then
      raise exception 'The previous sender is outside the represented management scope' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.save_handover(uuid, jsonb) from public, anon;
revoke all on function public.act_on_handover(uuid, text, integer, text, jsonb) from public, anon;
revoke all on function public.complete_handover_offline(uuid, integer) from public, anon;
revoke all on function public.list_fake_eps_parties() from public, anon;
revoke all on function public.list_handover_history(uuid) from public, anon;
revoke all on function public.list_handover_counterparty_options(uuid) from public, anon;
revoke all on function public.save_custodian(uuid, jsonb) from public, anon;
revoke all on function public.save_material_warehouse(uuid, jsonb) from public, anon;
grant execute on function public.save_handover(uuid, jsonb) to authenticated;
grant execute on function public.act_on_handover(uuid, text, integer, text, jsonb) to authenticated;
grant execute on function public.complete_handover_offline(uuid, integer) to authenticated;
grant execute on function public.list_fake_eps_parties() to authenticated;
grant execute on function public.list_handover_history(uuid) to authenticated;
grant execute on function public.list_handover_counterparty_options(uuid) to authenticated;
grant execute on function public.save_custodian(uuid, jsonb) to authenticated;
grant execute on function public.save_material_warehouse(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
