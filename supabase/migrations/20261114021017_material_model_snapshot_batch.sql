-- Build the canonical material model JSON snapshot for a set of model IDs in
-- one relational pass, including its ordered image array.
create or replace function private.material_model_snapshots(p_model_ids uuid[])
returns table (
  model_id uuid,
  snapshot jsonb
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with requested_models as materialized (
    select distinct requested.model_id
    from pg_catalog.unnest(coalesce(p_model_ids, array[]::uuid[]))
      as requested(model_id)
    where requested.model_id is not null
  ), model_images as materialized (
    select
      image.model_id,
      jsonb_agg(jsonb_build_object(
        'id', image.id,
        'storagePath', image.storage_path,
        'externalUrl', image.external_url,
        'sortOrder', image.sort_order,
        'isCover', image.is_cover
      ) order by image.sort_order, image.id) as images
    from public.material_model_images image
    join requested_models using (model_id)
    group by image.model_id
  )
  select
    model.id,
    jsonb_build_object(
      'id', model.id,
      'code', model.code,
      'name', model.name,
      'groupId', model.group_id,
      'description', coalesce(model.description, ''),
      'manufacturer', coalesce(model.manufacturer, ''),
      'unit', coalesce(model.unit, ''),
      'unitPriceDefault', model.unit_price_default,
      'requiresInspection', model.requires_inspection,
      'inspectionIntervalValue', model.inspection_interval_value,
      'inspectionIntervalUnit', model.inspection_interval_unit,
      'skipInitialInspection', model.skip_initial_inspection,
      'useGroupSafetyInspectionChecklist', model.use_group_safety_inspection_checklist,
      'specifications', coalesce(group_row.specifications, '[]'::jsonb)
        || coalesce(model.specifications, '[]'::jsonb),
      'safetyInspectionChecklist',
        (case when model.use_group_safety_inspection_checklist
          then coalesce(group_row.safety_inspection_checklist, '[]'::jsonb)
          else '[]'::jsonb
        end)
        || coalesce(model_checklist.checklist, '[]'::jsonb),
      'customSpecifications', '[]'::jsonb,
      'externalCodes', model.external_codes,
      'capturedAt', timezone('utc', now()),
      'images', coalesce(model_images.images, '[]'::jsonb)
    )
  from requested_models
  join public.material_models model on model.id = requested_models.model_id
  left join public.material_groups group_row on group_row.id = model.group_id
  left join public.material_model_safety_checklists model_checklist
    on model_checklist.model_id = model.id
  left join model_images on model_images.model_id = model.id
$function$;

revoke all on function private.material_model_snapshots(uuid[])
  from public, anon, authenticated, service_role;

-- Use the batched snapshot builder in the shared visible-material read model.
do $migration$
declare
  v_definition text;
  v_original text;
  v_replacement text;
begin
  v_definition := pg_catalog.pg_get_functiondef(
    'private.current_visible_active_material_model_snapshots(uuid)'::pg_catalog.regprocedure
  );
  v_original := $sql$model_configurations as materialized (
      select
        model_ids.model_id,
        public.material_model_snapshot(model_ids.model_id) as snapshot
      from model_ids
    )$sql$;
  v_replacement := $sql$model_configurations as materialized (
      select *
      from private.material_model_snapshots(
        (select coalesce(pg_catalog.array_agg(model_ids.model_id), array[]::uuid[])
          from model_ids)
      )
    )$sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Visible material model snapshot call was not found';
  end if;
  execute pg_catalog.replace(v_definition, v_original, v_replacement);

  v_definition := pg_catalog.pg_get_functiondef(
    'public.get_material_dashboard_summary(date)'::pg_catalog.regprocedure
  );
  v_original := 'with visibility_context as materialized (select * from private.current_material_visibility_context()), month_series as (';
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Dashboard visibility context CTE was not found';
  end if;
  v_definition := pg_catalog.replace(
    v_definition,
    v_original,
    'with visible_material_snapshots as materialized (' ||
      'select * from private.current_visible_active_material_model_snapshots(null::uuid)' ||
      '), month_series as ('
  );

  v_original := $sql$  ), visible_materials as materialized (
    select
      material.id,
      material.model_id,
      material.status,
      material.created_at,
      material.owner_snapshot,
      material.inspection_settings_override_enabled,
      material.requires_inspection_override,
      material.inspection_interval_value_override,
      material.inspection_interval_unit_override
    from public.materials material
    cross join visibility_context visibility
    where material.is_active
      and (
        visibility.can_view_all
        or coalesce(
          material.owner_party_id,
          nullif(material.owner_snapshot ->> 'scopePartyId', '')::uuid
        ) = any(visibility.visible_party_ids)
        or (
          material.status = 'loaned'
          and coalesce(
            material.borrower_party_id,
            nullif(material.borrower_snapshot ->> 'scopePartyId', '')::uuid
          ) = any(visibility.visible_party_ids)
        )
      )
  ), model_ids as (
    select distinct model_id
    from visible_materials
  ), model_configurations as materialized (
    select
      model_ids.model_id,
      private.material_dashboard_model_snapshot(model_ids.model_id) as model_config
    from model_ids
  ), material_settings as materialized ($sql$;
  v_replacement := $sql$  ), visible_materials as materialized (
    select
      material.id,
      material.model_id,
      material.status,
      material.created_at,
      material.owner_snapshot,
      material.inspection_settings_override_enabled,
      material.requires_inspection_override,
      material.inspection_interval_value_override,
      material.inspection_interval_unit_override
    from public.materials material
    join visible_material_snapshots snapshot_rows
      on snapshot_rows.material_id = material.id
  ), model_configurations as materialized (
    select distinct
      snapshot_rows.model_id,
      snapshot_rows.snapshot as model_config
    from visible_material_snapshots snapshot_rows
  ), material_settings as materialized ($sql$;
  if pg_catalog.strpos(v_definition, v_original) = 0 then
    raise exception 'Dashboard model snapshot CTEs did not match the expected definition';
  end if;
  execute pg_catalog.replace(v_definition, v_original, v_replacement);
end;
$migration$;

-- Keep both helpers private to the API schema while allowing the invoker
-- dashboard to call the guarded visible-material snapshot read model.
revoke all on function private.current_material_visibility_context()
  from public, anon, authenticated, service_role;
revoke all on function private.current_visible_active_material_model_snapshots(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.current_visible_active_material_model_snapshots(uuid)
  to authenticated;
