create table if not exists public.material_specifications (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  data_type text not null,
  unit text,
  description text,
  options jsonb not null default '[]'::jsonb,
  default_selection_mode text not null default 'single',
  allow_model_selection_override boolean not null default false,
  allow_model_options_override boolean not null default false,
  default_value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_specifications_code_not_blank check (length(btrim(code)) > 0),
  constraint material_specifications_name_not_blank check (length(btrim(name)) > 0),
  constraint material_specifications_data_type_check
    check (data_type in ('text', 'number', 'list', 'boolean', 'date')),
  constraint material_specifications_default_selection_mode_check
    check (default_selection_mode in ('single', 'multi')),
  constraint material_specifications_options_array_check
    check (jsonb_typeof(options) = 'array'),
  constraint material_specifications_list_options_check
    check (data_type = 'list' or options = '[]'::jsonb)
);

create unique index if not exists material_specifications_code_ci_uidx
  on public.material_specifications (lower(btrim(code)));

create index if not exists material_specifications_name_order_idx
  on public.material_specifications (lower(name) collate "vi-x-icu", id);

create or replace function public.set_material_specifications_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists material_specifications_set_updated_at
  on public.material_specifications;
create trigger material_specifications_set_updated_at
before update on public.material_specifications
for each row execute function public.set_material_specifications_updated_at();

create or replace function private.validate_material_specification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.data_type = 'list' then
    if pg_catalog.jsonb_typeof(new.options) <> 'array' then
      raise exception 'List specification options must be an array'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(new.options) as option_row(option_value)
      where pg_catalog.jsonb_typeof(option_row.option_value) <> 'object'
        or coalesce(option_row.option_value ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or length(btrim(coalesce(option_row.option_value ->> 'value', ''))) = 0
        or length(btrim(coalesce(option_row.option_value ->> 'label', ''))) = 0
    ) then
      raise exception 'Each list option must include a UUID, code, and label'
        using errcode = '22023';
    end if;

    if exists (
      select lower(btrim(option_row.option_value ->> 'value'))
      from pg_catalog.jsonb_array_elements(new.options) as option_row(option_value)
      group by lower(btrim(option_row.option_value ->> 'value'))
      having count(*) > 1
    ) then
      raise exception 'List option codes must be unique within a specification'
        using errcode = '23505';
    end if;
  else
    new.options := '[]'::jsonb;
    new.default_selection_mode := 'single';
    new.allow_model_selection_override := false;
    new.allow_model_options_override := false;
  end if;

  if new.data_type <> 'number' then
    new.unit := null;
  end if;

  return new;
end;
$$;

drop trigger if exists material_specifications_validate
  on public.material_specifications;
create trigger material_specifications_validate
before insert or update on public.material_specifications
for each row execute function private.validate_material_specification();

create or replace function public.list_material_specifications()
returns setof public.material_specifications
language sql
stable
security invoker
set search_path = ''
as $$
  select specification.*
  from public.material_specifications as specification
  order by lower(specification.name) collate "vi-x-icu", specification.id;
$$;

alter table public.material_specifications enable row level security;
revoke all privileges on public.material_specifications from anon, authenticated;
grant select, insert, update, delete on public.material_specifications to authenticated;

drop policy if exists material_specifications_select_with_permission
  on public.material_specifications;
create policy material_specifications_select_with_permission
on public.material_specifications for select to authenticated
using (public.has_permission('material_catalog:specification:view'));

drop policy if exists material_specifications_insert_with_permission
  on public.material_specifications;
create policy material_specifications_insert_with_permission
on public.material_specifications for insert to authenticated
with check (public.has_permission('material_catalog:specification:manage'));

drop policy if exists material_specifications_update_with_permission
  on public.material_specifications;
create policy material_specifications_update_with_permission
on public.material_specifications for update to authenticated
using (public.has_permission('material_catalog:specification:manage'))
with check (public.has_permission('material_catalog:specification:manage'));

drop policy if exists material_specifications_delete_with_permission
  on public.material_specifications;
create policy material_specifications_delete_with_permission
on public.material_specifications for delete to authenticated
using (public.has_permission('material_catalog:specification:manage'));

insert into public.permission_groups (
  module_code, code, name, description, sort_order, is_active
)
values (
  'material_catalog',
  'material_specifications',
  'Danh mục thông số',
  'Quản lý các thông số kỹ thuật dùng chung cho mẫu vật tư.',
  30,
  true
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
  permission.module_code,
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
    (
      'material_catalog:specification:view',
      'material_catalog',
      'Xem danh mục thông số',
      'view',
      false,
      10,
      array['Xem']::text[]
    ),
    (
      'material_catalog:specification:manage',
      'material_catalog',
      'Thêm, sửa, xóa thông số',
      'manage',
      true,
      20,
      array['Chỉnh sửa', 'Xóa']::text[]
    )
) as permission(code, module_code, name, action, sensitive, sort_order, tags)
join public.permission_groups permission_group
  on permission_group.module_code = permission.module_code
 and permission_group.code = 'material_specifications'
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

insert into public.role_permissions (role_id, permission_code)
select role_record.id, definition.code
from public.roles role_record
cross join public.permission_definitions definition
where role_record.is_system
  and role_record.grant_all_permissions
  and definition.code in (
    'material_catalog:specification:view',
    'material_catalog:specification:manage'
  )
on conflict do nothing;

alter table public.code_generation_patterns
  drop constraint if exists code_generation_patterns_entity_key_check;
alter table public.code_generation_patterns
  add constraint code_generation_patterns_entity_key_check
  check (entity_key in (
    'material_group', 'material_model', 'material_specification'
  ));

insert into public.code_generation_patterns (entity_key, pattern)
values ('material_specification', 'TS-{SEQ:5}')
on conflict (entity_key) do nothing;

drop policy if exists code_generation_patterns_select_with_permission
  on public.code_generation_patterns;
create policy code_generation_patterns_select_with_permission
on public.code_generation_patterns for select to authenticated
using (
  public.has_permission('organization:custom-field:view')
  or public.has_permission('organization:custom-field:update')
  or (
    entity_key = 'material_group'
    and public.has_permission('material_catalog:material_group:manage')
  )
  or (
    entity_key = 'material_model'
    and public.has_permission('material_catalog:material_model:manage')
  )
  or (
    entity_key = 'material_specification'
    and public.has_permission('material_catalog:specification:manage')
  )
);

create or replace function public.save_code_generation_patterns(p_patterns jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated_count integer;
begin
  if not public.has_permission('organization:custom-field:update') then
    raise exception 'Permission denied to update code generation patterns'
      using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(p_patterns) <> 'array'
    or pg_catalog.jsonb_array_length(p_patterns) <> 3 then
    raise exception 'Exactly three code generation patterns are required'
      using errcode = '22023';
  end if;

  update public.code_generation_patterns as current_pattern
  set pattern = supplied_pattern.pattern
  from pg_catalog.jsonb_to_recordset(p_patterns)
    as supplied_pattern(entity_key text, pattern text)
  where current_pattern.entity_key = supplied_pattern.entity_key;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 3 then
    raise exception 'The submitted patterns must include material_group, material_model, and material_specification'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.generate_catalog_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_key text;
  v_permission_code text;
  v_pattern text;
  v_sequence_width integer;
  v_date_format text;
  v_local_timestamp timestamp;
  v_sequence bigint;
  v_code text;
  v_code_exists boolean;
  v_attempt integer := 0;
  v_max_attempts integer;
begin
  if new.code is not null and length(pg_catalog.btrim(new.code)) > 0 then
    return new;
  end if;

  if tg_table_name = 'material_groups' then
    v_entity_key := 'material_group';
    v_permission_code := 'material_catalog:material_group:manage';
  elsif tg_table_name = 'material_models' then
    v_entity_key := 'material_model';
    v_permission_code := 'material_catalog:material_model:manage';
  elsif tg_table_name = 'material_specifications' then
    v_entity_key := 'material_specification';
    v_permission_code := 'material_catalog:specification:manage';
  else
    raise exception 'Code generation is not configured for table %', tg_table_name
      using errcode = '22023';
  end if;

  if auth.uid() is null or not public.has_permission(v_permission_code) then
    raise exception 'Permission denied to generate a catalog code'
      using errcode = '42501';
  end if;

  select configured_pattern.pattern
  into v_pattern
  from public.code_generation_patterns as configured_pattern
  where configured_pattern.entity_key = v_entity_key;

  if v_pattern is null then
    raise exception 'No code generation pattern configured for %', v_entity_key
      using errcode = '22023';
  end if;

  v_sequence_width := (pg_catalog.regexp_match(v_pattern, '\{SEQ:([0-9]{1,2})\}'))[1]::integer;
  v_date_format := (pg_catalog.regexp_match(v_pattern, '\{DATE:(YYYYMMDD|YYYYMM|YYYY|MM|DD)\}'))[1];
  v_local_timestamp := pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh';

  if tg_table_name = 'material_groups' then
    select pg_catalog.count(*)::integer + 1 into v_max_attempts
    from public.material_groups;
  elsif tg_table_name = 'material_models' then
    select pg_catalog.count(*)::integer + 1 into v_max_attempts
    from public.material_models;
  else
    select pg_catalog.count(*)::integer + 1 into v_max_attempts
    from public.material_specifications;
  end if;

  loop
    insert into private.code_generation_counters as counter (entity_key, last_value)
    values (v_entity_key, 1)
    on conflict (entity_key) do update
      set last_value = counter.last_value + 1,
          updated_at = pg_catalog.now()
    returning last_value into v_sequence;

    v_code := pg_catalog.replace(
      v_pattern,
      '{SEQ:' || v_sequence_width::text || '}',
      case
        when pg_catalog.length(v_sequence::text) >= v_sequence_width
          then v_sequence::text
        else pg_catalog.lpad(v_sequence::text, v_sequence_width, '0')
      end
    );

    if v_date_format is not null then
      v_code := pg_catalog.replace(
        v_code,
        '{DATE:' || v_date_format || '}',
        pg_catalog.to_char(v_local_timestamp, v_date_format)
      );
    end if;

    if tg_table_name = 'material_groups' then
      select exists (
        select 1 from public.material_groups as existing_row
        where pg_catalog.lower(pg_catalog.btrim(existing_row.code)) = pg_catalog.lower(pg_catalog.btrim(v_code))
      ) into v_code_exists;
    elsif tg_table_name = 'material_models' then
      select exists (
        select 1 from public.material_models as existing_row
        where pg_catalog.lower(pg_catalog.btrim(existing_row.code)) = pg_catalog.lower(pg_catalog.btrim(v_code))
      ) into v_code_exists;
    else
      select exists (
        select 1 from public.material_specifications as existing_row
        where pg_catalog.lower(pg_catalog.btrim(existing_row.code)) = pg_catalog.lower(pg_catalog.btrim(v_code))
      ) into v_code_exists;
    end if;

    exit when not v_code_exists;
    v_attempt := v_attempt + 1;
    if v_attempt >= v_max_attempts then
      raise exception 'Unable to allocate a unique code for %', v_entity_key
        using errcode = '23505';
    end if;
  end loop;

  new.code := v_code;
  return new;
end;
$$;

drop trigger if exists material_specifications_generate_code
  on public.material_specifications;
create trigger material_specifications_generate_code
before insert on public.material_specifications
for each row execute function private.generate_catalog_code();

revoke all on function public.set_material_specifications_updated_at()
  from public, anon, authenticated;
revoke all on function private.validate_material_specification()
  from public, anon, authenticated;
revoke all on function public.list_material_specifications() from public, anon;
grant execute on function public.list_material_specifications() to authenticated;
revoke all on function public.save_code_generation_patterns(jsonb) from public, anon;
grant execute on function public.save_code_generation_patterns(jsonb) to authenticated;
revoke all on function private.generate_catalog_code() from public, anon, authenticated;

notify pgrst, 'reload schema';
