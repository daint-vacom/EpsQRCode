create table if not exists public.material_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_groups_code_not_blank check (length(btrim(code)) > 0),
  constraint material_groups_name_not_blank check (length(btrim(name)) > 0)
);

create unique index if not exists material_groups_code_ci_uidx
  on public.material_groups (lower(btrim(code)));

create index if not exists material_groups_name_ci_idx
  on public.material_groups (lower(name), id);

create or replace function public.set_material_groups_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger material_groups_set_updated_at
before update on public.material_groups
for each row execute function public.set_material_groups_updated_at();

create or replace function public.list_material_groups()
returns setof public.material_groups
language sql
stable
security invoker
set search_path = ''
as $$
  select group_row.*
  from public.material_groups as group_row
  order by lower(group_row.name) collate "vi-x-icu", group_row.id;
$$;

alter table public.material_groups enable row level security;

revoke all privileges on public.material_groups from anon, authenticated;
grant select, insert, update, delete on public.material_groups to anon, authenticated;

create policy material_groups_select_authenticated
  on public.material_groups for select to anon, authenticated
  using (true);

create policy material_groups_insert_authenticated
  on public.material_groups for insert to anon, authenticated
  with check (true);

create policy material_groups_update_authenticated
  on public.material_groups for update to anon, authenticated
  using (true)
  with check (true);

create policy material_groups_delete_authenticated
  on public.material_groups for delete to anon, authenticated
  using (true);

revoke all on function public.set_material_groups_updated_at() from public, anon, authenticated;
revoke all on function public.list_material_groups() from public;
grant execute on function public.list_material_groups() to anon, authenticated;
