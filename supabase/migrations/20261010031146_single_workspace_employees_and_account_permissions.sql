do $$
begin
  create type public.employee_status as enum ('active', 'inactive');
exception when duplicate_object then null;
end $$;

alter table public.user_profiles
  add column if not exists username text;

do $$ begin
  create type public.custom_field_entity_type as enum ('employee');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.custom_field_type as enum ('text', 'number', 'select');
exception when duplicate_object then null;
end $$;

create table if not exists public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  entity_type public.custom_field_entity_type not null,
  field_key text not null,
  label text not null,
  field_type public.custom_field_type not null,
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (entity_type, field_key)
);

create table if not exists public.custom_field_options (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.custom_field_definitions(id) on delete cascade,
  value text not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (field_id, value)
);

create table if not exists public.entity_custom_data (
  id uuid primary key default gen_random_uuid(),
  entity_type public.custom_field_entity_type not null,
  entity_id uuid not null,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (entity_type, entity_id)
);

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint saved_views_name_not_blank check (length(btrim(name)) > 0),
  constraint saved_views_resource_not_blank check (length(btrim(resource)) > 0),
  constraint saved_views_version_positive check (version > 0)
);

create index if not exists custom_field_definitions_entity_sort_idx
  on public.custom_field_definitions(entity_type, sort_order, label);
create index if not exists entity_custom_data_lookup_idx
  on public.entity_custom_data(entity_type, entity_id);
create index if not exists saved_views_resource_order_idx
  on public.saved_views(resource, is_default desc, created_at, name);

drop trigger if exists custom_field_definitions_set_updated_at on public.custom_field_definitions;
create trigger custom_field_definitions_set_updated_at
before update on public.custom_field_definitions
for each row execute function public.set_epsqrcode_updated_at();
drop trigger if exists entity_custom_data_set_updated_at on public.entity_custom_data;
create trigger entity_custom_data_set_updated_at
before update on public.entity_custom_data
for each row execute function public.set_epsqrcode_updated_at();
drop trigger if exists saved_views_set_updated_at on public.saved_views;
create trigger saved_views_set_updated_at
before update on public.saved_views
for each row execute function public.set_epsqrcode_updated_at();

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  employee_code text not null unique,
  username text,
  first_name text not null,
  last_name text not null default '',
  phone text not null default '',
  status public.employee_status not null default 'active',
  joined_at date,
  note text not null default '',
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employees_first_name_not_blank check (length(btrim(first_name)) > 0),
  constraint employees_code_not_blank check (length(btrim(employee_code)) > 0)
);

create unique index if not exists employees_user_id_unique
  on public.employees(user_id)
  where user_id is not null;
create index if not exists employees_status_name_vi_idx
  on public.employees (
    (case status when 'active' then 0 else 1 end),
    ((lower(last_name) || ' ' || lower(first_name)) collate "vi-x-icu"),
    id
  );

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_epsqrcode_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (
    id, display_name, first_name, last_name, avatar_url, username, metadata
  )
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Nhân viên'
    ),
    nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    jsonb_build_object(
      'authProvider', coalesce(new.raw_app_meta_data ->> 'provider', 'email')
    )
  )
  on conflict (id) do update set
    username = coalesce(public.user_profiles.username, excluded.username);
  return new;
end;
$$;

create or replace function public.create_employee_for_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_email text;
  account_metadata jsonb;
  generated_username text;
begin
  select auth_user.email, auth_user.raw_user_meta_data
  into account_email, account_metadata
  from auth.users auth_user
  where auth_user.id = new.id;

  generated_username := coalesce(
    nullif(new.username, ''),
    nullif(split_part(coalesce(account_email, ''), '@', 1), ''),
    'user-' || left(replace(new.id::text, '-', ''), 8)
  );

  insert into public.employees (
    user_id, employee_code, username, first_name, last_name, phone,
    status, note, avatar_url
  )
  values (
    new.id,
    'NV-' || upper(replace(new.id::text, '-', '')),
    generated_username,
    coalesce(
      nullif(btrim(new.first_name), ''),
      nullif(btrim(new.display_name), ''),
      generated_username,
      'Nhân viên'
    ),
    coalesce(nullif(btrim(new.last_name), ''), ''),
    coalesce(nullif(btrim(account_metadata ->> 'phone'), ''), ''),
    'active',
    '',
    new.avatar_url
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists user_profiles_create_employee on public.user_profiles;
create trigger user_profiles_create_employee
after insert on public.user_profiles
for each row execute function public.create_employee_for_user_profile();

insert into public.user_profiles (id, display_name, avatar_url, username, metadata)
select
  auth_user.id,
  coalesce(
    nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
    'Nhân viên'
  ),
  nullif(btrim(auth_user.raw_user_meta_data ->> 'avatar_url'), ''),
  nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
  jsonb_build_object(
    'authProvider', coalesce(auth_user.raw_app_meta_data ->> 'provider', 'email')
  )
from auth.users auth_user
on conflict (id) do update set
  username = coalesce(public.user_profiles.username, excluded.username);

insert into public.employees (
  user_id, employee_code, username, first_name, last_name, phone,
  status, note, avatar_url
)
select
  profile.id,
  'NV-' || upper(replace(profile.id::text, '-', '')),
  coalesce(
    nullif(profile.username, ''),
    nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
    'user-' || left(replace(profile.id::text, '-', ''), 8)
  ),
  coalesce(
    nullif(btrim(profile.first_name), ''),
    nullif(btrim(profile.display_name), ''),
    nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
    'Nhân viên'
  ),
  coalesce(nullif(btrim(profile.last_name), ''), ''),
  coalesce(nullif(btrim(auth_user.raw_user_meta_data ->> 'phone'), ''), ''),
  case when profile.status = 'active' then 'active'::public.employee_status
       else 'inactive'::public.employee_status end,
  '',
  profile.avatar_url
from public.user_profiles profile
join auth.users auth_user on auth_user.id = profile.id
on conflict do nothing;

insert into public.permission_modules (code, name, description, sort_order, is_active)
values ('organization', 'Tổ chức', 'Quản lý nhân viên và tài khoản.', 20, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.permission_groups (
  module_code, code, name, description, sort_order, is_active
)
values (
  'organization', 'employees', 'Nhân viên',
  'Quản lý hồ sơ nhân viên và tài khoản trong workspace.', 10, true
)
on conflict (module_code, code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.permission_definitions (
  code, module_code, group_name, group_id, name, action, sensitive,
  sort_order, is_active, tags
)
select
  permission.code,
  'organization',
  permission_group.name,
  permission_group.id,
  permission.name,
  permission.action,
  permission.sensitive,
  permission.sort_order,
  true,
  permission.tags
from (
  values
    ('organization:employee:view', 'Xem nhân viên', 'view', false, 10, array['Xem']::text[]),
    ('organization:employee:create', 'Thêm nhân viên', 'create', false, 20, array['Chỉnh sửa']::text[]),
    ('organization:employee:update', 'Sửa nhân viên', 'update', false, 30, array['Chỉnh sửa']::text[]),
    ('organization:employee:delete', 'Xóa nhân viên', 'delete', true, 40, array['Xóa']::text[]),
    ('organization:employee:assign-role', 'Gán vai trò cho nhân viên', 'assign', true, 50, array['Chỉnh sửa']::text[]),
    ('organization:employee:reset-password', 'Đặt lại mật khẩu nhân viên', 'reset-password', true, 60, array['Chỉnh sửa']::text[]),
    ('organization:custom-field:view', 'Xem cấu hình dữ liệu', 'view', false, 70, array['Xem']::text[]),
    ('organization:custom-field:create', 'Thêm trường dữ liệu', 'create', false, 80, array['Chỉnh sửa']::text[]),
    ('organization:custom-field:update', 'Sửa trường dữ liệu', 'update', false, 90, array['Chỉnh sửa']::text[]),
    ('organization:custom-field:delete', 'Xóa trường dữ liệu', 'delete', true, 100, array['Xóa']::text[])
) as permission(code, name, action, sensitive, sort_order, tags)
join public.permission_groups permission_group
  on permission_group.module_code = 'organization'
 and permission_group.code = 'employees'
on conflict (code) do update set
  module_code = excluded.module_code,
  group_name = excluded.group_name,
  group_id = excluded.group_id,
  name = excluded.name,
  action = excluded.action,
  sensitive = excluded.sensitive,
  sort_order = excluded.sort_order,
  is_active = true,
  tags = excluded.tags;

create or replace function public.list_employees(
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null,
  p_statuses public.employee_status[] default null,
  p_role_ids uuid[] default null,
  p_account_linked boolean default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 100);
  v_search text := nullif(btrim(p_search), '');
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_permission('organization:employee:view') then
    raise exception 'Employee view permission required' using errcode = '42501';
  end if;

  with filtered_employees as (
    select
      employee.id,
      employee.user_id,
      employee.username,
      employee.employee_code,
      employee.first_name,
      employee.last_name,
      employee.phone,
      employee.status,
      employee.joined_at,
      employee.note,
      employee.avatar_url,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('name', role.name, 'color', role.color)
          order by role.sort_order, lower(role.name) collate "vi-x-icu", role.id
        )
        from public.user_roles assignment
        join public.roles role
          on role.id = assignment.role_id
         and role.is_active
        where assignment.user_id = employee.user_id
      ), '[]'::jsonb) as roles,
      coalesce((
        select jsonb_agg(
          role.id order by role.sort_order, lower(role.name) collate "vi-x-icu", role.id
        )
        from public.user_roles assignment
        join public.roles role
          on role.id = assignment.role_id
         and role.is_active
        where assignment.user_id = employee.user_id
      ), '[]'::jsonb) as role_ids,
      count(*) over () as total_count
    from public.employees employee
    where (
      v_search is null
      or employee.employee_code ilike '%' || v_search || '%'
      or employee.username ilike '%' || v_search || '%'
      or concat_ws(' ', employee.last_name, employee.first_name) ilike '%' || v_search || '%'
      or employee.phone ilike '%' || v_search || '%'
    )
    and (p_statuses is null or cardinality(p_statuses) = 0 or employee.status = any(p_statuses))
    and (
      p_role_ids is null or cardinality(p_role_ids) = 0
      or exists (
        select 1 from public.user_roles assignment
        where assignment.user_id = employee.user_id
          and assignment.role_id = any(p_role_ids)
      )
    )
    and (p_account_linked is null or (employee.user_id is not null) = p_account_linked)
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(to_jsonb(page_row) - 'total_count'
        order by
          case page_row.status when 'active' then 0 else 1 end,
          lower(concat_ws(' ', page_row.last_name, page_row.first_name)) collate "vi-x-icu",
          page_row.id
      )
      from (
        select * from filtered_employees
        order by
          case status when 'active' then 0 else 1 end,
          lower(concat_ws(' ', last_name, first_name)) collate "vi-x-icu",
          id
        offset (v_page - 1) * v_page_size
        limit v_page_size
      ) page_row
    ), '[]'::jsonb),
    'total', coalesce((select max(total_count) from filtered_employees), 0)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.save_custom_fields(
  p_entity_type public.custom_field_entity_type,
  p_fields jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  field_item jsonb;
  option_item jsonb;
  target_field_id uuid;
  incoming_ids uuid[] := '{}'::uuid[];
  row_index integer := 0;
  target_field_type public.custom_field_type;
begin
  if auth.uid() is null or jsonb_typeof(p_fields) <> 'array' then
    raise exception 'Invalid custom field request' using errcode = '22023';
  end if;

  for field_item in select value from jsonb_array_elements(p_fields) loop
    row_index := row_index + 1;
    target_field_id := nullif(field_item->>'id', '')::uuid;
    target_field_type := (field_item->>'fieldType')::public.custom_field_type;

    if target_field_id is not null then
      if not public.has_permission('organization:custom-field:update') then
        raise exception 'Custom field update permission required' using errcode = '42501';
      end if;
      update public.custom_field_definitions definition
      set field_key = btrim(field_item->>'key'),
          label = btrim(field_item->>'label'),
          field_type = target_field_type,
          is_required = coalesce((field_item->>'isRequired')::boolean, false),
          is_active = coalesce((field_item->>'isActive')::boolean, true),
          sort_order = row_index - 1
      where definition.id = target_field_id and definition.entity_type = p_entity_type;
      if not found then raise exception 'Custom field not found' using errcode = 'P0002'; end if;
    else
      if not public.has_permission('organization:custom-field:create') then
        raise exception 'Custom field create permission required' using errcode = '42501';
      end if;
      insert into public.custom_field_definitions (
        entity_type, field_key, label, field_type, is_required, is_active, sort_order
      ) values (
        p_entity_type, btrim(field_item->>'key'), btrim(field_item->>'label'),
        target_field_type, coalesce((field_item->>'isRequired')::boolean, false),
        coalesce((field_item->>'isActive')::boolean, true), row_index - 1
      ) returning id into target_field_id;
    end if;

    incoming_ids := array_append(incoming_ids, target_field_id);
    delete from public.custom_field_options option_row where option_row.field_id = target_field_id;
    if target_field_type = 'select' then
      for option_item in select value from jsonb_array_elements(coalesce(field_item->'options', '[]'::jsonb)) loop
        insert into public.custom_field_options(field_id, value, label, sort_order)
        values (target_field_id, btrim(option_item->>'value'), btrim(option_item->>'label'),
          (select count(*)::integer from public.custom_field_options option_row where option_row.field_id = target_field_id));
      end loop;
    end if;
  end loop;

  if exists (
    select 1 from public.custom_field_definitions definition
    where definition.entity_type = p_entity_type and not (definition.id = any(incoming_ids))
  ) then
    if not public.has_permission('organization:custom-field:delete') then
      raise exception 'Custom field delete permission required' using errcode = '42501';
    end if;
    delete from public.custom_field_definitions definition
    where definition.entity_type = p_entity_type and not (definition.id = any(incoming_ids));
  end if;
end;
$$;

alter table public.custom_field_definitions enable row level security;
alter table public.custom_field_options enable row level security;
alter table public.entity_custom_data enable row level security;
alter table public.saved_views enable row level security;
grant select, insert, update, delete on public.custom_field_definitions,
  public.custom_field_options, public.entity_custom_data, public.saved_views to authenticated;
drop policy if exists custom_field_definitions_view on public.custom_field_definitions;
create policy custom_field_definitions_view on public.custom_field_definitions
for select to authenticated using (public.has_permission('organization:custom-field:view'));
drop policy if exists custom_field_definitions_manage on public.custom_field_definitions;
create policy custom_field_definitions_manage on public.custom_field_definitions
for all to authenticated using (
  public.has_permission('organization:custom-field:update')
  or public.has_permission('organization:custom-field:delete')
) with check (public.has_permission('organization:custom-field:create')
  or public.has_permission('organization:custom-field:update'));
drop policy if exists custom_field_options_access on public.custom_field_options;
create policy custom_field_options_access on public.custom_field_options
for all to authenticated using (
  exists (select 1 from public.custom_field_definitions definition
    where definition.id = field_id and public.has_permission('organization:custom-field:view'))
) with check (
  exists (select 1 from public.custom_field_definitions definition
    where definition.id = field_id and public.has_permission('organization:custom-field:update'))
);
drop policy if exists entity_custom_data_access on public.entity_custom_data;
create policy entity_custom_data_access on public.entity_custom_data
for all to authenticated using (
  public.has_permission('organization:employee:view')
) with check (public.has_permission('organization:employee:update'));
drop policy if exists saved_views_view on public.saved_views;
create policy saved_views_view on public.saved_views
for select to authenticated using (auth.uid() is not null);
drop policy if exists saved_views_manage on public.saved_views;
create policy saved_views_manage on public.saved_views
for all to authenticated using (public.has_permission('system:views:manage'))
with check (public.has_permission('system:views:manage'));
revoke all on function public.save_custom_fields(public.custom_field_entity_type, jsonb) from public, anon;
grant execute on function public.save_custom_fields(public.custom_field_entity_type, jsonb) to authenticated;

create or replace function public.save_employee_role_assignments(
  p_employee_id uuid,
  p_role_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  selected_count integer;
  active_selected_count integer;
begin
  if auth.uid() is null
    or not public.has_permission('organization:employee:assign-role') then
    raise exception 'Employee role assignment permission required' using errcode = '42501';
  end if;

  select employee.user_id into target_user_id
  from public.employees employee
  where employee.id = p_employee_id;

  if not found or target_user_id is null then
    raise exception 'Employee does not have a linked account' using errcode = 'P0002';
  end if;

  select count(distinct role_id) into selected_count
  from unnest(coalesce(p_role_ids, '{}'::uuid[])) selected(role_id);

  select count(distinct role_record.id) into active_selected_count
  from public.roles role_record
  where role_record.id = any(coalesce(p_role_ids, '{}'::uuid[]))
    and role_record.is_active;

  if selected_count <> active_selected_count then
    raise exception 'One or more selected roles are unavailable' using errcode = '22023';
  end if;

  if not public.is_system_admin() and exists (
    select 1 from public.roles role_record
    where role_record.id = any(coalesce(p_role_ids, '{}'::uuid[]))
      and (role_record.is_system or role_record.grant_all_permissions)
  ) then
    raise exception 'Only a system administrator may assign system roles' using errcode = '42501';
  end if;

  delete from public.user_roles assignment
  where assignment.user_id = target_user_id;

  insert into public.user_roles (user_id, role_id)
  select target_user_id, role_record.id
  from public.roles role_record
  where role_record.id = any(coalesce(p_role_ids, '{}'::uuid[]))
    and role_record.is_active;
end;
$$;

create or replace function public.link_employee_account(
  p_employee_id uuid,
  p_user_id uuid,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_employee_id uuid;
begin
  select employee.id into generated_employee_id
  from public.employees employee
  where employee.user_id = p_user_id;

  if generated_employee_id is null then
    raise exception 'Auth account has no provisioned employee profile'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.employees employee
    where employee.id = p_employee_id and employee.user_id is null
  ) then
    raise exception 'Employee profile is missing or already linked'
      using errcode = '23505';
  end if;

  delete from public.employees where id = generated_employee_id;
  update public.employees
  set user_id = p_user_id, username = p_username
  where id = p_employee_id;

  update public.user_profiles
  set username = p_username
  where id = p_user_id;
end;
$$;

create or replace function public.update_my_employee_profile(
  p_employee_id uuid,
  p_employee_code text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_status public.employee_status,
  p_joined_at date,
  p_note text,
  p_avatar_url text
)
returns setof public.employees
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
  update public.employees employee
  set employee_code = btrim(p_employee_code),
      first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      phone = btrim(p_phone),
      status = p_status,
      joined_at = p_joined_at,
      note = btrim(p_note),
      avatar_url = p_avatar_url
  where employee.id = p_employee_id
    and employee.user_id = auth.uid()
  returning employee.*;

  if not found then
    raise exception 'Employee profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.list_employees(integer, integer, text, public.employee_status[], uuid[], boolean) from public, anon;
grant execute on function public.list_employees(integer, integer, text, public.employee_status[], uuid[], boolean) to authenticated;
revoke all on function public.save_employee_role_assignments(uuid, uuid[]) from public, anon;
grant execute on function public.save_employee_role_assignments(uuid, uuid[]) to authenticated;
revoke all on function public.link_employee_account(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.link_employee_account(uuid, uuid, text) to service_role;
revoke all on function public.update_my_employee_profile(uuid, text, text, text, text, public.employee_status, date, text, text) from public, anon;
grant execute on function public.update_my_employee_profile(uuid, text, text, text, text, public.employee_status, date, text, text) to authenticated;
revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
revoke all on function public.create_employee_for_user_profile() from public, anon, authenticated;

revoke all on public.employees from anon, authenticated;
grant select, insert, update, delete on public.employees to authenticated;
alter table public.employees enable row level security;

drop policy if exists employees_select_with_permission on public.employees;
create policy employees_select_with_permission
on public.employees for select to authenticated
using (public.has_permission('organization:employee:view'));

drop policy if exists employees_insert_with_permission on public.employees;
create policy employees_insert_with_permission
on public.employees for insert to authenticated
with check (public.has_permission('organization:employee:create'));

drop policy if exists employees_update_with_permission on public.employees;
create policy employees_update_with_permission
on public.employees for update to authenticated
using (public.has_permission('organization:employee:update'))
with check (public.has_permission('organization:employee:update'));

drop policy if exists employees_delete_unlinked_with_permission on public.employees;
create policy employees_delete_unlinked_with_permission
on public.employees for delete to authenticated
using (user_id is null and public.has_permission('organization:employee:delete'));

drop policy if exists roles_select_account on public.roles;
create policy roles_select_account
on public.roles for select to authenticated
using (
  is_active and (
    public.has_permission('system:roles:view')
    or public.has_permission('organization:employee:view')
    or public.has_permission('organization:employee:assign-role')
  )
);

drop policy if exists user_roles_select_account on public.user_roles;
create policy user_roles_select_account
on public.user_roles for select to authenticated
using (
  user_id = auth.uid()
  or public.is_system_admin()
  or public.has_permission('organization:employee:view')
);

notify pgrst, 'reload schema';
