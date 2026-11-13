alter table public.material_groups
  add column if not exists parent_id uuid;

alter table public.material_groups
  add constraint material_groups_parent_id_fkey
  foreign key (parent_id)
  references public.material_groups(id)
  on delete restrict;

create index if not exists material_groups_parent_id_idx
  on public.material_groups (parent_id)
  where parent_id is not null;

create or replace function private.prevent_material_group_hierarchy_cycles()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_would_cycle boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Nhóm vật tư không thể là nhóm cha của chính nó.'
      using errcode = '23514';
  end if;

  with recursive ancestors(id, parent_id, visited_ids) as (
    select group_row.id, group_row.parent_id, array[group_row.id]
    from public.material_groups as group_row
    where group_row.id = new.parent_id

    union all

    select parent.id, parent.parent_id, ancestors.visited_ids || parent.id
    from public.material_groups as parent
    join ancestors on parent.id = ancestors.parent_id
    where not parent.id = any(ancestors.visited_ids)
  )
  select exists (select 1 from ancestors where id = new.id)
  into v_would_cycle;

  if v_would_cycle then
    raise exception 'Không thể chuyển nhóm vào chính nhóm con của nó.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_material_group_hierarchy_cycles()
  from public, anon, authenticated;

create trigger material_groups_prevent_hierarchy_cycles
before insert or update of parent_id on public.material_groups
for each row
execute function private.prevent_material_group_hierarchy_cycles();

notify pgrst, 'reload schema';
