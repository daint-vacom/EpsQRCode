-- Shared system-role catalog.
--
-- System roles are global rows (tenant_id IS NULL). Tenant-specific roles remain
-- in the same catalog with tenant_id set. Assignments are still tenant-scoped,
-- but they reference the shared role row instead of copying its definition.

alter table public.roles
  alter column tenant_id drop not null;

alter table public.roles
  add column if not exists sort_order integer not null default 0,
  add column if not exists customer_assignable boolean not null default false,
  add column if not exists grant_all_permissions boolean not null default false;

alter table public.roles
  drop constraint if exists roles_tenant_code_unique;

create unique index if not exists roles_global_code_unique
  on public.roles(code)
  where tenant_id is null;

create unique index if not exists roles_tenant_code_unique
  on public.roles(tenant_id, code)
  where tenant_id is not null;

-- The historical default roles were tenant rows. Keep any non-default edits as
-- tenant custom roles, and move only unchanged defaults to the shared catalog.
create temp table _legacy_role_default_permissions (
  role_code text not null,
  permission_code text not null,
  primary key (role_code, permission_code)
) on commit drop;

insert into _legacy_role_default_permissions (role_code, permission_code)
select 'manager', permission_code
from unnest(array[
  'employees:account:view', 'employees:account:edit', 'employees:account:lock',
  'employees:profile:view', 'employees:profile:edit', 'orders:view', 'orders:edit',
  'orders:approve', 'orders:cancel', 'orders:shipping-status', 'warehouse:stock:view',
  'warehouse:import:edit', 'warehouse:export:edit', 'reports:revenue:view',
  'reports:inventory:view', 'system:roles:view', 'system:settings:view',
  'system:audit-log:view', 'system:tag:view', 'system:tag:create',
  'system:tag:update', 'organization:tag:view', 'organization:tag:create',
  'organization:tag:update', 'contracts:view', 'contracts:create',
  'contracts:update', 'contracts:publish', 'contracts:amend', 'contracts:assign'
]::text[]) as permissions(permission_code)
union all
select 'employee', permission_code
from unnest(array[
  'employees:account:view', 'employees:profile:view', 'orders:view',
  'warehouse:stock:view', 'reports:revenue:view', 'reports:inventory:view',
  'system:tag:view', 'organization:tag:view'
]::text[]) as permissions(permission_code)
union all
select 'accountant', permission_code
from unnest(array[
  'orders:view', 'orders:approve', 'reports:revenue:view',
  'reports:inventory:view', 'reports:debt:view', 'warehouse:stock:view',
  'system:roles:view', 'contracts:view', 'contracts:record-payment',
  'contracts:reverse-payment'
]::text[]) as permissions(permission_code);

create temp table _legacy_role_migration (
  old_role_id uuid primary key,
  target_role_code text not null,
  migrate_to_system boolean not null
) on commit drop;

insert into _legacy_role_migration (old_role_id, target_role_code, migrate_to_system)
select
  role_record.id,
  case role_record.code
    when 'admin' then 'system_admin'
    when 'manager' then 'service_manager'
    when 'employee' then 'data_entry'
    when 'accountant' then 'general_accountant'
  end,
  role_record.code = 'admin'
  or (
    not exists (
      select 1
      from public.role_permissions existing_permission
      where existing_permission.role_id = role_record.id
        and not exists (
          select 1
          from _legacy_role_default_permissions expected_permission
          where expected_permission.role_code = role_record.code
            and expected_permission.permission_code = existing_permission.permission_code
        )
    )
    and not exists (
      select 1
      from _legacy_role_default_permissions expected_permission
      where expected_permission.role_code = role_record.code
        and not exists (
          select 1
          from public.role_permissions existing_permission
          where existing_permission.role_id = role_record.id
            and existing_permission.permission_code = expected_permission.permission_code
        )
    )
  )
from public.roles role_record
where role_record.tenant_id is not null
  and role_record.code in ('admin', 'manager', 'employee', 'accountant');

-- The system role definitions are global and immutable from tenant UI.
create temp table _system_role_seed (
  code text primary key,
  name text not null,
  description text not null,
  scope public.permission_scope not null,
  color public.role_color not null,
  sort_order integer not null,
  customer_assignable boolean not null,
  grant_all_permissions boolean not null default false
) on commit drop;

insert into _system_role_seed (
  code, name, description, scope, color, sort_order,
  customer_assignable, grant_all_permissions
)
values
  ('system_admin', 'Quản trị hệ thống', 'Toàn quyền quản trị và vận hành hệ thống.', 'all', 'red', 10, false, true),
  ('application_admin', 'Quản trị ứng dụng', 'Quản trị người dùng, vai trò và cấu hình ứng dụng.', 'all', 'violet', 20, false, false),
  ('service_manager', 'Quản lý dịch vụ', 'Điều phối dịch vụ kế toán và quản lý khách hàng phụ trách.', 'all', 'violet', 30, true, false),
  ('customer_manager', 'Quản lý dữ liệu khách hàng', 'Quản lý hồ sơ, dữ liệu và thông tin khách hàng.', 'all', 'blue', 40, true, false),
  ('data_entry', 'Nhân viên nhập liệu', 'Nhập và cập nhật dữ liệu nghiệp vụ theo phạm vi được giao.', 'department', 'blue', 50, true, false),
  ('general_accountant', 'Kế toán tổng hợp', 'Theo dõi nghiệp vụ kế toán tổng hợp, chứng từ và báo cáo.', 'all', 'green', 60, true, false),
  ('tax_accountant', 'Kế toán thuế', 'Theo dõi dữ liệu phục vụ kê khai và báo cáo thuế.', 'all', 'green', 70, true, false),
  ('receivables', 'Nhân viên công nợ', 'Theo dõi công nợ, thanh toán và thu hồi công nợ.', 'department', 'amber', 80, true, false),
  ('reviewer', 'Nhân viên kiểm soát', 'Kiểm tra, kiểm soát và duyệt nghiệp vụ theo phân công.', 'all', 'amber', 90, true, false),
  ('chief_accountant', 'Kế toán trưởng', 'Kiểm soát tổng thể và phê duyệt nghiệp vụ kế toán.', 'all', 'red', 100, true, false),
  ('finance_officer', 'Tài chính nội bộ / Thủ quỹ', 'Quản lý thu chi, quỹ và tài khoản nội bộ.', 'all', 'slate', 110, true, false);

insert into public.roles (
  tenant_id, code, name, description, scope, is_system, is_active,
  color, sort_order, customer_assignable, grant_all_permissions
)
select
  null,
  seed.code,
  seed.name,
  seed.description,
  seed.scope,
  true,
  true,
  seed.color,
  seed.sort_order,
  seed.customer_assignable,
  seed.grant_all_permissions
from _system_role_seed seed
where not exists (
  select 1
  from public.roles existing_role
  where existing_role.tenant_id is null
    and existing_role.code = seed.code
);

-- Add the default permissions once to the global role rows. Permission codes
-- that are not present in an older deployment are intentionally ignored.
create temp table _system_role_permissions (
  role_code text not null,
  permission_code text not null,
  primary key (role_code, permission_code)
) on commit drop;

insert into _system_role_permissions (role_code, permission_code)
select role_code, permission_code
from (
  values
    ('application_admin', 'employees:account:view'),
    ('application_admin', 'employees:account:edit'),
    ('application_admin', 'employees:account:lock'),
    ('application_admin', 'employees:account:reset-password'),
    ('application_admin', 'employees:account:delete'),
    ('application_admin', 'employees:profile:view'),
    ('application_admin', 'employees:profile:edit'),
    ('application_admin', 'system:roles:view'),
    ('application_admin', 'system:roles:edit'),
    ('application_admin', 'system:roles:permissions-edit'),
    ('application_admin', 'system:roles:copy'),
    ('application_admin', 'system:settings:view'),
    ('application_admin', 'system:settings:edit'),
    ('application_admin', 'system:audit-log:view'),
    ('application_admin', 'organization:custom-field:view'),
    ('application_admin', 'organization:custom-field:create'),
    ('application_admin', 'organization:custom-field:update'),
    ('application_admin', 'organization:custom-field:delete'),
    ('application_admin', 'system:software-account-catalog:view'),
    ('application_admin', 'system:software-account-catalog:create'),
    ('application_admin', 'system:software-account-catalog:update'),
    ('application_admin', 'system:software-account-catalog:delete'),

    ('service_manager', 'customers:view'),
    ('service_manager', 'customers:create'),
    ('service_manager', 'customers:update'),
    ('service_manager', 'customers:delete'),
    ('service_manager', 'customers:assign-tag'),
    ('service_manager', 'customers:software-account:view'),
    ('service_manager', 'customers:software-account:manage'),
    ('service_manager', 'contracts:view'),
    ('service_manager', 'contracts:create'),
    ('service_manager', 'contracts:update'),
    ('service_manager', 'contracts:publish'),
    ('service_manager', 'contracts:amend'),
    ('service_manager', 'contracts:assign'),
    ('service_manager', 'employees:profile:view'),
    ('service_manager', 'reports:revenue:view'),
    ('service_manager', 'reports:debt:view'),

    ('customer_manager', 'customers:view'),
    ('customer_manager', 'customers:create'),
    ('customer_manager', 'customers:update'),
    ('customer_manager', 'customers:delete'),
    ('customer_manager', 'customers:assign-tag'),
    ('customer_manager', 'customers:software-account:view'),
    ('customer_manager', 'customers:software-account:manage'),
    ('customer_manager', 'employees:profile:view'),

    ('data_entry', 'customers:view'),
    ('data_entry', 'customers:create'),
    ('data_entry', 'customers:update'),
    ('data_entry', 'customers:assign-tag'),
    ('data_entry', 'customers:software-account:view'),
    ('data_entry', 'employees:profile:view'),
    ('data_entry', 'contracts:view'),
    ('data_entry', 'reports:revenue:view'),

    ('general_accountant', 'customers:view'),
    ('general_accountant', 'customers:update'),
    ('general_accountant', 'contracts:view'),
    ('general_accountant', 'contracts:record-payment'),
    ('general_accountant', 'contracts:reverse-payment'),
    ('general_accountant', 'finance:voucher:view'),
    ('general_accountant', 'finance:voucher:create'),
    ('general_accountant', 'finance:voucher:update'),
    ('general_accountant', 'finance:obligation:view'),
    ('general_accountant', 'finance:obligation:create'),
    ('general_accountant', 'finance:report:view'),
    ('general_accountant', 'finance:report:export'),
    ('general_accountant', 'reports:revenue:view'),
    ('general_accountant', 'reports:debt:view'),

    ('tax_accountant', 'customers:view'),
    ('tax_accountant', 'contracts:view'),
    ('tax_accountant', 'finance:obligation:view'),
    ('tax_accountant', 'finance:report:view'),
    ('tax_accountant', 'finance:report:export'),
    ('tax_accountant', 'reports:revenue:view'),
    ('tax_accountant', 'reports:debt:view'),
    ('tax_accountant', 'reports:raw-data:view'),

    ('receivables', 'customers:view'),
    ('receivables', 'contracts:view'),
    ('receivables', 'contracts:record-payment'),
    ('receivables', 'contracts:reverse-payment'),
    ('receivables', 'finance:obligation:view'),
    ('receivables', 'finance:obligation:create'),
    ('receivables', 'finance:voucher:view'),
    ('receivables', 'finance:report:view'),
    ('receivables', 'reports:debt:view'),

    ('reviewer', 'customers:view'),
    ('reviewer', 'contracts:view'),
    ('reviewer', 'contracts:publish'),
    ('reviewer', 'contracts:amend'),
    ('reviewer', 'finance:voucher:view'),
    ('reviewer', 'finance:voucher:post'),
    ('reviewer', 'finance:voucher:cancel'),
    ('reviewer', 'finance:report:view'),
    ('reviewer', 'reports:revenue:view'),
    ('reviewer', 'reports:debt:view'),

    ('chief_accountant', 'customers:view'),
    ('chief_accountant', 'contracts:view'),
    ('chief_accountant', 'contracts:publish'),
    ('chief_accountant', 'contracts:amend'),
    ('chief_accountant', 'contracts:record-payment'),
    ('chief_accountant', 'contracts:reverse-payment'),
    ('chief_accountant', 'finance:voucher:view'),
    ('chief_accountant', 'finance:voucher:create'),
    ('chief_accountant', 'finance:voucher:update'),
    ('chief_accountant', 'finance:voucher:post'),
    ('chief_accountant', 'finance:voucher:cancel'),
    ('chief_accountant', 'finance:voucher:reverse'),
    ('chief_accountant', 'finance:obligation:view'),
    ('chief_accountant', 'finance:obligation:create'),
    ('chief_accountant', 'finance:account:view'),
    ('chief_accountant', 'finance:account:manage'),
    ('chief_accountant', 'finance:category:view'),
    ('chief_accountant', 'finance:category:manage'),
    ('chief_accountant', 'finance:report:view'),
    ('chief_accountant', 'finance:report:export'),
    ('chief_accountant', 'reports:revenue:view'),
    ('chief_accountant', 'reports:debt:view'),
    ('chief_accountant', 'reports:gross-profit:view'),

    ('finance_officer', 'customers:view'),
    ('finance_officer', 'finance:voucher:view'),
    ('finance_officer', 'finance:voucher:create'),
    ('finance_officer', 'finance:voucher:update'),
    ('finance_officer', 'finance:account:view'),
    ('finance_officer', 'finance:account:manage'),
    ('finance_officer', 'finance:category:view'),
    ('finance_officer', 'finance:category:manage'),
    ('finance_officer', 'finance:report:view'),
    ('finance_officer', 'finance:report:export')
) as seeded(role_code, permission_code);

insert into public.role_permissions (role_id, permission_code)
select system_role.id, selected.permission_code
from _system_role_permissions selected
join public.roles system_role
  on system_role.tenant_id is null
 and system_role.code = selected.role_code
join public.permission_definitions definition
  on definition.code = selected.permission_code
 and definition.is_active
on conflict do nothing;

-- Keep grant_all roles materialized in the global permission relation so all
-- existing permission checks and the admin UI continue to work.
create or replace function public.sync_grant_all_system_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active then
    insert into public.role_permissions (role_id, permission_code)
    select role_record.id, new.code
    from public.roles role_record
    where role_record.tenant_id is null
      and role_record.is_system
      and role_record.grant_all_permissions
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists permission_definitions_sync_grant_all_roles
  on public.permission_definitions;
create trigger permission_definitions_sync_grant_all_roles
after insert or update of is_active on public.permission_definitions
for each row execute function public.sync_grant_all_system_role_permissions();

insert into public.role_permissions (role_id, permission_code)
select role_record.id, definition.code
from public.roles role_record
cross join public.permission_definitions definition
where role_record.tenant_id is null
  and role_record.grant_all_permissions
  and definition.is_active
on conflict do nothing;

-- Repoint unchanged legacy role assignments to the global role rows. Any
-- customized legacy role remains tenant-scoped and keeps its permissions.
delete from public.tenant_member_roles old_assignment
using _legacy_role_migration migration,
      public.roles target_role,
      public.tenant_member_roles target_assignment
where old_assignment.role_id = migration.old_role_id
  and migration.migrate_to_system
  and target_role.tenant_id is null
  and target_role.code = migration.target_role_code
  and target_assignment.tenant_id = old_assignment.tenant_id
  and target_assignment.user_id = old_assignment.user_id
  and target_assignment.role_id = target_role.id;

update public.tenant_member_roles assignment
set role_id = target_role.id
from _legacy_role_migration migration
join public.roles target_role
  on target_role.tenant_id is null
 and target_role.code = migration.target_role_code
where assignment.role_id = migration.old_role_id
  and migration.migrate_to_system;

delete from public.roles role_record
using _legacy_role_migration migration
where role_record.id = migration.old_role_id
  and migration.migrate_to_system;

-- Any historical system marker that was not one of the known defaults is
-- retained as a tenant custom role rather than violating the new invariant.
update public.roles
set is_system = false,
    grant_all_permissions = false
where tenant_id is not null
  and is_system;

-- Convert the former tenant-specific customer responsibility catalog to the
-- same role catalog. Built-in responsibilities map to the corresponding
-- system role; tenant-defined responsibilities remain tenant custom roles.
create temp table _responsibility_role_migration (
  old_role_id uuid primary key,
  target_role_id uuid not null
) on commit drop;

insert into public.roles (
  tenant_id, code, name, description, scope, is_system, is_active,
  customer_assignable, sort_order
)
select
  responsibility_role.tenant_id,
  'customer_responsibility:' || responsibility_role.code,
  responsibility_role.name,
  responsibility_role.description,
  'all',
  false,
  responsibility_role.is_active,
  true,
  responsibility_role.sort_order
from public.customer_responsibility_roles responsibility_role
where responsibility_role.code not in ('contract', 'receivables')
  and not exists (
    select 1
    from public.roles existing_role
    where existing_role.tenant_id = responsibility_role.tenant_id
      and existing_role.code = 'customer_responsibility:' || responsibility_role.code
  );

insert into _responsibility_role_migration (old_role_id, target_role_id)
select
  old_role.id,
  target_role.id
from public.customer_responsibility_roles old_role
join public.roles target_role
  on (
    old_role.code = 'contract'
    and target_role.tenant_id is null
    and target_role.code = 'service_manager'
  )
  or (
    old_role.code = 'receivables'
    and target_role.tenant_id is null
    and target_role.code = 'receivables'
  )
  or (
    old_role.code not in ('contract', 'receivables')
    and target_role.tenant_id = old_role.tenant_id
    and target_role.code = 'customer_responsibility:' || old_role.code
  );

alter table public.customer_responsibles
  drop constraint if exists customer_responsibles_responsibility_role_id_fkey;

update public.customer_responsibles responsible
set responsibility_role_id = migration.target_role_id
from _responsibility_role_migration migration
where responsible.responsibility_role_id = migration.old_role_id;

alter table public.customer_responsibles
  add constraint customer_responsibles_responsibility_role_id_fkey
  foreign key (responsibility_role_id)
  references public.roles(id)
  on delete restrict;

drop trigger if exists tenants_seed_customer_responsibility_roles
  on public.tenants;
drop function if exists public.seed_customer_responsibility_roles_for_tenant();
drop table if exists public.customer_responsibility_roles;

-- The role catalog is the single source of truth for customer responsibility
-- options and employee authorization roles.
create or replace function public.get_customer_responsibility_workspace(
  p_tenant_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'customers:view')
  then
    raise exception 'Customer view permission required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.customers customer
    where customer.id = p_customer_id
      and customer.tenant_id = p_tenant_id
  ) then
    raise exception 'Customer does not belong to tenant' using errcode = '42501';
  end if;

  with role_rows as (
    select role_definition.*
    from public.roles role_definition
    where role_definition.customer_assignable
      and (
        role_definition.tenant_id is null
        or role_definition.tenant_id = p_tenant_id
      )
      and (
        role_definition.is_active
        or exists (
          select 1
          from public.customer_responsibles responsible
          where responsible.tenant_id = p_tenant_id
            and responsible.customer_id = p_customer_id
            and responsible.responsibility_role_id = role_definition.id
        )
      )
  ), employee_rows as (
    select
      employee.id,
      employee.user_id,
      employee.employee_code,
      employee.first_name,
      employee.last_name,
      employee.job_title,
      employee.department,
      employee.status,
      profile.avatar_url,
      coalesce(
        (
          select jsonb_agg(member_role.role_id order by member_role.role_id)
          from public.tenant_member_roles member_role
          where member_role.tenant_id = p_tenant_id
            and member_role.user_id = employee.user_id
        ),
        '[]'::jsonb
      ) as role_ids
    from public.employees employee
    left join public.user_profiles profile on profile.id = employee.user_id
    where employee.tenant_id = p_tenant_id
      and (
        employee.status = 'active'
        or exists (
          select 1
          from public.customer_responsibles responsible
          where responsible.tenant_id = p_tenant_id
            and responsible.customer_id = p_customer_id
            and responsible.employee_id = employee.id
        )
      )
  ), assignment_rows as (
    select
      responsible.employee_id,
      jsonb_agg(
        responsible.responsibility_role_id
        order by role_definition.sort_order, role_definition.code
      ) as responsibility_role_ids,
      min(responsible.created_at) as created_at,
      min(responsible.assigned_by::text)::uuid as assigned_by
    from public.customer_responsibles responsible
    join public.roles role_definition
      on role_definition.id = responsible.responsibility_role_id
    where responsible.tenant_id = p_tenant_id
      and responsible.customer_id = p_customer_id
    group by responsible.employee_id
  )
  select jsonb_build_object(
    'roles', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', role_definition.id,
            'code', role_definition.code,
            'name', role_definition.name,
            'description', role_definition.description,
            'sortOrder', role_definition.sort_order,
            'isSystem', role_definition.is_system,
            'isActive', role_definition.is_active
          )
          order by role_definition.sort_order, role_definition.name
        )
        from role_rows role_definition
      ),
      '[]'::jsonb
    ),
    'employees', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', employee.id,
            'userId', employee.user_id,
            'employeeCode', employee.employee_code,
            'displayName', trim(concat(employee.last_name, ' ', employee.first_name)),
            'jobTitle', employee.job_title,
            'department', employee.department,
            'status', employee.status,
            'avatarUrl', employee.avatar_url,
            'roleIds', employee.role_ids
          )
          order by employee.status asc, employee.last_name, employee.first_name, employee.employee_code
        )
        from employee_rows employee
      ),
      '[]'::jsonb
    ),
    'assignments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'employeeId', assignment.employee_id,
            'responsibilityRoleIds', assignment.responsibility_role_ids,
            'assignedBy', assignment.assigned_by,
            'createdAt', assignment.created_at
          )
          order by assignment.created_at, assignment.employee_id
        )
        from assignment_rows assignment
      ),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.replace_customer_responsibilities(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_assignments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'customers:update')
  then
    raise exception 'Customer update permission required' using errcode = '42501';
  end if;

  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'Assignments must be an array' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.customers customer
    where customer.id = p_customer_id
      and customer.tenant_id = p_tenant_id
  ) then
    raise exception 'Customer does not belong to tenant' using errcode = '42501';
  end if;

  if exists (
    select employee_id
    from (
      select (assignment->>'employee_id')::uuid as employee_id
      from jsonb_array_elements(p_assignments) assignment
    ) parsed
    group by employee_id
    having count(*) > 1
  ) then
    raise exception 'An employee can only be assigned once' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) assignment
    where (assignment->>'employee_id') is null
      or jsonb_typeof(assignment->'responsibility_role_ids') <> 'array'
      or jsonb_array_length(assignment->'responsibility_role_ids') = 0
  ) then
    raise exception 'Every employee assignment requires at least one role' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) assignment
    where not exists (
      select 1
      from public.employees employee
      where employee.id = (assignment->>'employee_id')::uuid
        and employee.tenant_id = p_tenant_id
        and (
          employee.status = 'active'
          or exists (
            select 1
            from public.customer_responsibles responsible
            where responsible.tenant_id = p_tenant_id
              and responsible.customer_id = p_customer_id
              and responsible.employee_id = employee.id
          )
        )
    )
  ) then
    raise exception 'Assignments contain an invalid or inactive employee' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) assignment
    cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item
    where not exists (
      select 1
      from public.roles role_definition
      where role_definition.id = role_item.value::uuid
        and role_definition.customer_assignable
        and (
          role_definition.tenant_id is null
          or role_definition.tenant_id = p_tenant_id
        )
        and (
          role_definition.is_active
          or exists (
            select 1
            from public.customer_responsibles responsible
            where responsible.tenant_id = p_tenant_id
              and responsible.customer_id = p_customer_id
              and responsible.responsibility_role_id = role_definition.id
          )
        )
    )
  ) then
    raise exception 'Assignments contain an invalid or inactive responsibility role' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) assignment
    cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item
    join public.employees employee
      on employee.id = (assignment->>'employee_id')::uuid
    where employee.user_id is not null
      and not exists (
        select 1
        from public.tenant_member_roles member_role
        where member_role.tenant_id = p_tenant_id
          and member_role.user_id = employee.user_id
          and member_role.role_id = role_item.value::uuid
      )
      and not exists (
        select 1
        from public.customer_responsibles existing_responsible
        where existing_responsible.tenant_id = p_tenant_id
          and existing_responsible.customer_id = p_customer_id
          and existing_responsible.employee_id = employee.id
          and existing_responsible.responsibility_role_id = role_item.value::uuid
      )
  ) then
    raise exception 'An employee can only be assigned customer roles already granted to that employee' using errcode = '22023';
  end if;

  if exists (
    select employee_id, role_id
    from (
      select
        (assignment->>'employee_id')::uuid as employee_id,
        role_item.value::uuid as role_id
      from jsonb_array_elements(p_assignments) assignment
      cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item
    ) parsed
    group by employee_id, role_id
    having count(*) > 1
  ) then
    raise exception 'A responsibility role can only be assigned once per employee' using errcode = '22023';
  end if;

  delete from public.customer_responsibles
  where tenant_id = p_tenant_id
    and customer_id = p_customer_id;

  insert into public.customer_responsibles (
    tenant_id, customer_id, employee_id, responsibility_role_id, assigned_by
  )
  select
    p_tenant_id,
    p_customer_id,
    (assignment->>'employee_id')::uuid,
    role_item.value::uuid,
    auth.uid()
  from jsonb_array_elements(p_assignments) assignment
  cross join lateral jsonb_array_elements_text(assignment->'responsibility_role_ids') role_item;
end;
$$;

create or replace function public.list_customer_responsibility_filter_options(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'customers:view')
  then
    raise exception 'Customer view permission required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'employees', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', employee.id,
            'employeeCode', employee.employee_code,
            'displayName', trim(concat(employee.last_name, ' ', employee.first_name)),
            'department', employee.department,
            'status', employee.status,
            'avatarUrl', profile.avatar_url,
            'customerCount', (
              select count(distinct responsible.customer_id)
              from public.customer_responsibles responsible
              where responsible.tenant_id = p_tenant_id
                and responsible.employee_id = employee.id
            )
          )
          order by employee.status asc, employee.last_name, employee.first_name, employee.employee_code
        )
        from public.employees employee
        left join public.user_profiles profile on profile.id = employee.user_id
        where employee.tenant_id = p_tenant_id
          and (
            employee.status = 'active'
            or exists (
              select 1
              from public.customer_responsibles responsible
              where responsible.tenant_id = p_tenant_id
                and responsible.employee_id = employee.id
            )
          )
      ),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Tenant creation now assigns the shared admin role instead of creating role
-- definitions or customer-responsibility role rows inside the tenant.
create or replace function public.ensure_tenant_permission_defaults(target_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_tenant_role(
    target_tenant_id,
    array['owner', 'admin']::public.tenant_member_role[]
  ) then
    raise exception 'Tenant administrator required' using errcode = '42501';
  end if;

  insert into public.tenant_member_roles (tenant_id, user_id, role_id)
  select target_tenant_id, auth.uid(), role_record.id
  from public.roles role_record
  where role_record.tenant_id is null
    and role_record.code = 'system_admin'
    and role_record.is_active
  on conflict do nothing;
end;
$$;

create or replace function public.create_tenant(
  tenant_name text,
  tenant_slug text,
  tenant_legal_name text default null,
  tenant_plan public.tenant_plan default 'free'
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  created_tenant public.tenants;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.tenants (name, slug, legal_name, plan, created_by)
  values (tenant_name, lower(tenant_slug), tenant_legal_name, tenant_plan, auth.uid())
  returning * into created_tenant;

  insert into public.tenant_members (tenant_id, user_id, role, status, joined_at)
  values (created_tenant.id, auth.uid(), 'owner', 'active', timezone('utc', now()));

  perform public.ensure_tenant_permission_defaults(created_tenant.id);
  return created_tenant;
end;
$$;

-- System roles are readable in every tenant but writable only by migrations or
-- trusted backend operations. Tenant admins can manage custom roles only.
alter table public.roles
  drop constraint if exists roles_system_tenant_check,
  drop constraint if exists roles_grant_all_system_check;

alter table public.roles
  add constraint roles_system_tenant_check
  check (
    (is_system and tenant_id is null)
    or (not is_system and tenant_id is not null)
  ),
  add constraint roles_grant_all_system_check
  check (not grant_all_permissions or is_system);

drop policy if exists "Tenant members can view roles" on public.roles;
create policy "Tenant members can view roles"
on public.roles
for select
to authenticated
using (
  tenant_id is null
  or public.is_tenant_member(tenant_id)
);

drop policy if exists "Tenant admins can manage roles" on public.roles;
create policy "Tenant admins can manage custom roles"
on public.roles
for all
to authenticated
using (
  tenant_id is not null
  and public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[])
)
with check (
  tenant_id is not null
  and not is_system
  and not grant_all_permissions
  and public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[])
);

drop policy if exists "Tenant members can view role permissions" on public.role_permissions;
create policy "Tenant members can view role permissions"
on public.role_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.roles role_record
    where role_record.id = role_id
      and (
        role_record.tenant_id is null
        or public.is_tenant_member(role_record.tenant_id)
      )
  )
);

drop policy if exists "Tenant admins can manage role permissions" on public.role_permissions;
create policy "Tenant admins can manage custom role permissions"
on public.role_permissions
for all
to authenticated
using (
  exists (
    select 1
    from public.roles role_record
    where role_record.id = role_id
      and role_record.tenant_id is not null
      and public.has_tenant_role(role_record.tenant_id, array['owner', 'admin']::public.tenant_member_role[])
  )
)
with check (
  exists (
    select 1
    from public.roles role_record
    where role_record.id = role_id
      and role_record.tenant_id is not null
      and not role_record.is_system
      and public.has_tenant_role(role_record.tenant_id, array['owner', 'admin']::public.tenant_member_role[])
  )
);

drop policy if exists "Tenant admins can manage role assignments" on public.tenant_member_roles;
create policy "Tenant admins can manage role assignments"
on public.tenant_member_roles
for all
to authenticated
using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[]))
with check (
  public.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_member_role[])
  and exists (
    select 1
    from public.roles role_record
    where role_record.id = role_id
      and (
        role_record.tenant_id is null
        or role_record.tenant_id = tenant_member_roles.tenant_id
      )
      and role_record.is_active
  )
);

-- A system role cannot be edited through the existing RPC. Custom role edits
-- continue to use the same endpoint.
create or replace function public.replace_role_permissions(
  target_role_id uuid,
  selected_permission_codes text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  target_is_system boolean;
begin
  select tenant_id, is_system
  into target_tenant_id, target_is_system
  from public.roles
  where id = target_role_id;

  if not found then
    raise exception 'Role not found' using errcode = 'P0002';
  end if;

  if target_is_system or target_tenant_id is null then
    raise exception 'System role permissions are managed by the system' using errcode = '42501';
  end if;

  if not public.has_tenant_role(
    target_tenant_id,
    array['owner', 'admin']::public.tenant_member_role[]
  ) then
    raise exception 'Tenant administrator required' using errcode = '42501';
  end if;

  delete from public.role_permissions
  where role_id = target_role_id;

  insert into public.role_permissions (role_id, permission_code)
  select target_role_id, definition.code
  from public.permission_definitions definition
  where definition.is_active
    and definition.code = any(coalesce(selected_permission_codes, array[]::text[]));
end;
$$;

revoke execute on function public.ensure_tenant_permission_defaults(uuid)
  from public, anon;
grant execute on function public.ensure_tenant_permission_defaults(uuid)
  to authenticated;
revoke execute on function public.replace_role_permissions(uuid, text[])
  from public, anon;
grant execute on function public.replace_role_permissions(uuid, text[])
  to authenticated;
revoke execute on function public.get_customer_responsibility_workspace(uuid, uuid)
  from public, anon;
grant execute on function public.get_customer_responsibility_workspace(uuid, uuid)
  to authenticated;
revoke execute on function public.replace_customer_responsibilities(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.replace_customer_responsibilities(uuid, uuid, jsonb)
  to authenticated;
revoke execute on function public.list_customer_responsibility_filter_options(uuid)
  from public, anon;
grant execute on function public.list_customer_responsibility_filter_options(uuid)
  to authenticated;
