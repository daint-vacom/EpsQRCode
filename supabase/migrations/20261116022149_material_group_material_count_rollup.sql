create or replace function public.get_material_group_material_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null
    or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode = '42501';
  end if;

  return (
    with recursive visibility_context as materialized (
      select * from private.current_material_visibility_context()
    ),
    visible_materials as materialized (
      select nullif(material.model_snapshot->>'groupId', '')::uuid as group_id
      from public.materials as material
      cross join visibility_context as visibility
      where (
        visibility.can_view_all
        or coalesce(
          material.owner_party_id,
          nullif(material.owner_snapshot->>'scopePartyId', '')::uuid
        ) = any(visibility.visible_party_ids)
        or (
          material.status = 'loaned'
          and coalesce(
            material.borrower_party_id,
            nullif(material.borrower_snapshot->>'scopePartyId', '')::uuid
          ) = any(visibility.visible_party_ids)
        )
      )
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
        count(visible_materials.group_id)::integer as material_count
      from group_ancestors
      left join visible_materials
        on visible_materials.group_id = group_ancestors.descendant_id
      group by group_ancestors.ancestor_id
    )
    select pg_catalog.jsonb_build_object(
      'counts', coalesce(
        (
          select pg_catalog.jsonb_object_agg(
            counts_by_group.group_id::text,
            counts_by_group.material_count
          )
          from counts_by_group
        ),
        '{}'::jsonb
      ),
      'total', (select count(*)::integer from visible_materials)
    )
  );
end;
$function$;

revoke all on function public.get_material_group_material_counts()
  from public, anon;
grant execute on function public.get_material_group_material_counts()
  to authenticated;

notify pgrst, 'reload schema';
