create table if not exists public.code_generation_patterns (
  entity_key text primary key,
  pattern text not null,
  updated_at timestamptz not null default now(),
  constraint code_generation_patterns_entity_key_check
    check (entity_key in ('material_group', 'material_model')),
  constraint code_generation_patterns_pattern_not_blank
    check (length(btrim(pattern)) > 0)
);

insert into public.code_generation_patterns (entity_key, pattern)
values
  ('material_group', 'NVT-{SEQ:5}'),
  ('material_model', 'MVT-{SEQ:5}')
on conflict (entity_key) do nothing;

alter table public.code_generation_patterns enable row level security;
revoke all on public.code_generation_patterns from public, anon, authenticated;
grant select, update on public.code_generation_patterns to authenticated;

drop policy if exists code_generation_patterns_select_with_permission
  on public.code_generation_patterns;
create policy code_generation_patterns_select_with_permission
on public.code_generation_patterns for select to authenticated
using (
  public.has_permission('organization:custom-field:view')
  or public.has_permission('organization:custom-field:update')
);

drop policy if exists code_generation_patterns_update_with_permission
  on public.code_generation_patterns;
create policy code_generation_patterns_update_with_permission
on public.code_generation_patterns for update to authenticated
using (public.has_permission('organization:custom-field:update'))
with check (public.has_permission('organization:custom-field:update'));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.code_generation_counters (
  entity_key text primary key,
  last_value bigint not null check (last_value >= 0),
  updated_at timestamptz not null default now()
);
revoke all on private.code_generation_counters from public, anon, authenticated;

create or replace function private.validate_code_generation_pattern()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_without_sequence text;
  v_without_tokens text;
  v_sequence_width integer;
begin
  if pg_catalog.regexp_count(new.pattern, '\{SEQ:[0-9]{1,2}\}') <> 1 then
    raise exception 'Pattern must contain exactly one {SEQ:n} token, where n is between 1 and 12'
      using errcode = '22023';
  end if;

  v_without_sequence := pg_catalog.regexp_replace(
    new.pattern,
    '\{SEQ:[0-9]{1,2}\}',
    '',
    'g'
  );
  v_sequence_width := (
    pg_catalog.regexp_match(new.pattern, '\{SEQ:([0-9]{1,2})\}')
  )[1]::integer;
  if v_sequence_width < 1 or v_sequence_width > 12 then
    raise exception 'Sequence width must be between 1 and 12'
      using errcode = '22023';
  end if;

  if pg_catalog.regexp_count(v_without_sequence, '\{DATE:') > 1 then
    raise exception 'Pattern may contain at most one date token'
      using errcode = '22023';
  end if;

  v_without_tokens := pg_catalog.regexp_replace(
    v_without_sequence,
    '\{DATE:(YYYYMMDD|YYYYMM|YYYY|MM|DD)\}',
    '',
    'g'
  );

  if v_without_tokens ~ '[{}]' then
    raise exception 'Unsupported pattern token. Date formats: YYYY, MM, DD, YYYYMM, YYYYMMDD'
      using errcode = '22023';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists code_generation_patterns_validate
  on public.code_generation_patterns;
create trigger code_generation_patterns_validate
before insert or update of pattern on public.code_generation_patterns
for each row execute function private.validate_code_generation_pattern();

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
    or pg_catalog.jsonb_array_length(p_patterns) <> 2 then
    raise exception 'Exactly two code generation patterns are required'
      using errcode = '22023';
  end if;

  update public.code_generation_patterns as current_pattern
  set pattern = supplied_pattern.pattern
  from pg_catalog.jsonb_to_recordset(p_patterns)
    as supplied_pattern(entity_key text, pattern text)
  where current_pattern.entity_key = supplied_pattern.entity_key;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 2 then
    raise exception 'The submitted patterns must include material_group and material_model'
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
    select pg_catalog.count(*)::integer + 1
    into v_max_attempts
    from public.material_groups;
  else
    select pg_catalog.count(*)::integer + 1
    into v_max_attempts
    from public.material_models;
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
    else
      select exists (
        select 1 from public.material_models as existing_row
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

revoke all on function private.validate_code_generation_pattern() from public, anon, authenticated;
revoke all on function private.generate_catalog_code() from public, anon, authenticated;
revoke all on function public.save_code_generation_patterns(jsonb) from public, anon;
grant execute on function public.save_code_generation_patterns(jsonb) to authenticated;

drop trigger if exists material_groups_generate_code on public.material_groups;
create trigger material_groups_generate_code
before insert on public.material_groups
for each row execute function private.generate_catalog_code();

drop trigger if exists material_models_generate_code on public.material_models;
create trigger material_models_generate_code
before insert on public.material_models
for each row execute function private.generate_catalog_code();

notify pgrst, 'reload schema';
