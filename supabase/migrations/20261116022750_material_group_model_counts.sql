create or replace function public.get_material_group_model_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null
    or not public.has_permission('material_catalog:material_model:view') then
    raise exception 'Permission denied to view material models' using errcode = '42501';
  end if;

  return (
    with recursive model_counts_by_group as materialized (
      select model.group_id, count(*)::integer as model_count
      from public.material_models as model
      where model.group_id is not null
      group by model.group_id
    ),
    group_ancestors as (
      select group_row.id as descendant_id, group_row.id as ancestor_id
      from public.material_groups as group_row

      union all

      select child.id, group_ancestors.ancestor_id
      from group_ancestors
      join public.material_groups as child
        on child.parent_id = group_ancestors.descendant_id
    ),
    counts_by_group as (
      select
        group_ancestors.ancestor_id as group_id,
        sum(coalesce(model_counts_by_group.model_count, 0))::integer as model_count
      from group_ancestors
      left join model_counts_by_group
        on model_counts_by_group.group_id = group_ancestors.descendant_id
      group by group_ancestors.ancestor_id
    )
    select pg_catalog.jsonb_build_object(
      'counts', coalesce(
        (
          select pg_catalog.jsonb_object_agg(
            counts_by_group.group_id::text,
            counts_by_group.model_count
          )
          from counts_by_group
        ),
        '{}'::jsonb
      ),
      'total', (select count(*)::integer from public.material_models)
    )
  );
end;
$function$;

revoke all on function public.get_material_group_model_counts()
  from public, anon;
grant execute on function public.get_material_group_model_counts()
  to authenticated;

notify pgrst, 'reload schema';
