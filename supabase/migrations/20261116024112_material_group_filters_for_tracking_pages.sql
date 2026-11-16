do $migration$
declare
  v_definition text;
  v_original text;
  v_replacement text;
begin
  v_definition := pg_catalog.pg_get_functiondef(
    'public.get_material_qr_tracking_filter_summary(jsonb)'::pg_catalog.regprocedure
  );
  v_original := $sql$        and (
          v_owner is null
          or material.owner_party_id = v_owner
          or material.owner_snapshot->>'departmentId' = v_owner::text
          or material.owner_snapshot->>'teamId' = v_owner::text
          or material.owner_snapshot->>'employeeId' = v_owner::text
        )
    )
    select jsonb_build_object($sql$;
  v_replacement := $sql$        and (
          v_owner is null
          or material.owner_party_id = v_owner
          or material.owner_snapshot->>'departmentId' = v_owner::text
          or material.owner_snapshot->>'teamId' = v_owner::text
          or material.owner_snapshot->>'employeeId' = v_owner::text
        )
        and (
          p_filters->'groupIds' is null
          or exists (
            select 1
            from pg_catalog.jsonb_array_elements_text(
              case
                when pg_catalog.jsonb_typeof(p_filters->'groupIds') = 'array'
                  then p_filters->'groupIds'
                else '[]'::jsonb
              end
            ) as selected_group(group_id)
            where material.model_snapshot->>'groupId' = selected_group.group_id
          )
        )
    )
    select jsonb_build_object($sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'QR tracking filter summary owner predicate was not found';
  end if;
  execute pg_catalog.replace(v_definition, v_original, v_replacement);

  v_definition := pg_catalog.pg_get_functiondef(
    'private.list_materials_requiring_safety_inspection(jsonb)'::pg_catalog.regprocedure
  );
  v_original := 'with current_models as (';
  v_replacement := 'with recursive current_models as (';
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection queue current_models CTE was not found';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_original, v_replacement);

  v_original := $sql$    select
      current_models.*,
      case
        when inspection_settings_override_enabled$sql$;
  v_replacement := $sql$    select
      current_models.*,
      nullif(current_models.model_config ->> 'groupId', '')::uuid as group_id,
      case
        when inspection_settings_override_enabled$sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection queue effective_settings projection was not found';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_original, v_replacement);

  v_original := $sql$      effective_settings.name,
      effective_settings.created_at,
      effective_settings.interval_value,$sql$;
  v_replacement := $sql$      effective_settings.name,
      effective_settings.created_at,
      effective_settings.group_id,
      effective_settings.interval_value,$sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection queue scheduled projection was not found';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_original, v_replacement);

  v_original := $sql$  ), status_filtered as (
    select *
    from filtered
    where v_status is null or status = v_status
  ), page_items as ($sql$;
  v_replacement := $sql$  ), group_ancestors as (
    select group_row.id as descendant_id, group_row.id as ancestor_id
    from public.material_groups as group_row

    union all

    select child.id, group_ancestors.ancestor_id
    from group_ancestors
    join public.material_groups as child
      on child.parent_id = group_ancestors.descendant_id
  ), group_counts_by_group as (
    select
      group_ancestors.ancestor_id as group_id,
      pg_catalog.count(filtered.id)::integer as material_count
    from group_ancestors
    left join filtered
      on filtered.group_id = group_ancestors.descendant_id
    group by group_ancestors.ancestor_id
  ), group_filtered as (
    select *
    from filtered
    where p_filters->'groupIds' is null
      or exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(
          case
            when pg_catalog.jsonb_typeof(p_filters->'groupIds') = 'array'
              then p_filters->'groupIds'
            else '[]'::jsonb
          end
        ) as selected_group(group_id)
        where filtered.group_id::text = selected_group.group_id
      )
  ), status_filtered as (
    select *
    from group_filtered
    where v_status is null or status = v_status
  ), page_items as ($sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection queue filtered CTE boundary was not found';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_original, v_replacement);

  v_original := $sql$    'summary', pg_catalog.jsonb_build_object($sql$;
  v_replacement := $sql$    'groupCounts', coalesce(
      (
        select pg_catalog.jsonb_object_agg(
          group_counts_by_group.group_id::text,
          group_counts_by_group.material_count
        )
        from group_counts_by_group
      ),
      '{}'::jsonb
    ),
    'groupCountsTotal',
      (select pg_catalog.count(*)::integer from filtered),
    'summary', pg_catalog.jsonb_build_object($sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection queue summary JSON field was not found';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_original, v_replacement);

  v_original := $sql$      'due', (select pg_catalog.count(*)::integer from filtered where status = 'due'),
      'upcoming', (select pg_catalog.count(*)::integer from filtered where status = 'upcoming'),
      'inProgress', (select pg_catalog.count(*)::integer from filtered where status = 'in_progress')$sql$;
  v_replacement := $sql$      'due', (select pg_catalog.count(*)::integer from group_filtered where status = 'due'),
      'upcoming', (select pg_catalog.count(*)::integer from group_filtered where status = 'upcoming'),
      'inProgress', (select pg_catalog.count(*)::integer from group_filtered where status = 'in_progress')$sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection queue summary status counts were not found';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_original, v_replacement);

  v_original := $sql$'total', (select pg_catalog.count(*)::integer from filtered)$sql$;
  v_replacement := $sql$'total', (select pg_catalog.count(*)::integer from group_filtered)$sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection queue summary total was not found';
  end if;
  execute pg_catalog.replace(v_definition, v_original, v_replacement);

  v_definition := pg_catalog.pg_get_functiondef(
    'private.get_material_safety_inspection_plan(jsonb)'::pg_catalog.regprocedure
  );
  v_original := $sql$from private.current_visible_active_material_model_snapshots(v_owner_party_id) model_snapshot
    join public.materials material on material.id = model_snapshot.material_id$sql$;
  v_replacement := $sql$from private.current_visible_active_material_model_snapshots(v_owner_party_id) model_snapshot
    join public.materials material on material.id = model_snapshot.material_id
    where p_filters->'groupIds' is null
      or exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(
          case
            when pg_catalog.jsonb_typeof(p_filters->'groupIds') = 'array'
              then p_filters->'groupIds'
            else '[]'::jsonb
          end
        ) as selected_group(group_id)
        where model_snapshot.snapshot->>'groupId' = selected_group.group_id
      )$sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Inspection plan owner predicate was not found';
  end if;
  execute pg_catalog.replace(v_definition, v_original, v_replacement);
end;
$migration$;

notify pgrst, 'reload schema';
