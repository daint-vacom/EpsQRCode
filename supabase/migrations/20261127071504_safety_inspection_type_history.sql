create or replace function private.list_material_safety_inspections(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(nullif(p_filters ->> 'page', '')::integer, 1), 1);
  v_page_size integer := least(greatest(coalesce(nullif(p_filters ->> 'pageSize', '')::integer, 25), 1), 100);
  v_search text := nullif(pg_catalog.btrim(p_filters ->> 'search'), '');
  v_type_id uuid := nullif(p_filters ->> 'inspectionTypeId', '')::uuid;
  v_status text := nullif(p_filters ->> 'status', '');
  v_overall_result text := nullif(p_filters ->> 'overallResult', '');
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  with visibility_context as materialized (
    select * from private.current_material_visibility_context()
  ), filtered as (
    select
      inspection.id,
      inspection.material_id,
      inspection.inspection_type_id,
      inspection.inspection_type_name_snapshot,
      inspection.inspected_at,
      inspection.inspector_name,
      inspection.status,
      inspection.overall_result,
      material.code as material_code,
      coalesce(
        nullif(pg_catalog.btrim(material.name_override), ''),
        nullif(material.model_snapshot ->> 'name', ''),
        material.code
      ) as material_name
    from public.material_safety_inspections inspection
    join public.materials material on material.id = inspection.material_id
    cross join visibility_context visibility
    where (
      visibility.can_view_all
      or coalesce(material.owner_party_id, nullif(material.owner_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids)
      or (material.status = 'loaned' and coalesce(material.borrower_party_id,
        nullif(material.borrower_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids))
    )
      and (v_type_id is null or inspection.inspection_type_id = v_type_id)
      and case coalesce(p_filters->>'relationship', '')
        when 'relatedToMe' then inspection.created_by = (select auth.uid())
        when 'needsAction' then inspection.created_by = (select auth.uid()) and inspection.status = 'in_progress'
        else true
      end
      and (v_status is null or inspection.status = v_status)
      and (
        v_overall_result is null
        or (v_overall_result = 'none' and inspection.overall_result is null)
        or inspection.overall_result = v_overall_result
      )
      and (
        v_search is null
        or material.code ilike '%' || v_search || '%'
        or material.name_override ilike '%' || v_search || '%'
        or material.model_snapshot ->> 'name' ilike '%' || v_search || '%'
        or inspection.inspector_name ilike '%' || v_search || '%'
        or inspection.inspection_type_name_snapshot ilike '%' || v_search || '%'
      )
  ), page_items as (
    select *
    from filtered
    order by inspected_at desc, id desc
    offset (v_page - 1) * v_page_size
    limit v_page_size
  )
  select pg_catalog.jsonb_build_object(
    'items', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', id,
        'materialId', material_id,
        'inspectionTypeId', inspection_type_id,
        'inspectionTypeName', inspection_type_name_snapshot,
        'materialCode', material_code,
        'materialName', material_name,
        'inspectedAt', inspected_at,
        'inspectorName', inspector_name,
        'status', status,
        'overallResult', overall_result
      ) order by inspected_at desc, id desc)
      from page_items
    ), '[]'::jsonb),
    'total', (select pg_catalog.count(*) from filtered),
    'page', v_page,
    'pageSize', v_page_size
  ) into v_result;

  return v_result;
end;
$$;


create or replace function public.get_safety_inspection_filter_summary(
  p_search text, p_inspection_type_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_search text := nullif(btrim(p_search), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return (
    with visibility_context as materialized (
      select * from private.current_material_visibility_context()
    ), visible_inspections as materialized (
      select inspection.inspection_type_id, inspection.inspection_type_name_snapshot,
        inspection.inspected_at, inspection.id, inspection.created_by,
        inspection.status, inspection.overall_result,
        (
          v_search is null
          or material.code ilike '%' || v_search || '%'
          or material.name_override ilike '%' || v_search || '%'
          or material.model_snapshot ->> 'name' ilike '%' || v_search || '%'
          or inspection.inspector_name ilike '%' || v_search || '%'
          or inspection.inspection_type_name_snapshot ilike '%' || v_search || '%'
        ) as matches_search
      from public.material_safety_inspections inspection
      join public.materials material on material.id = inspection.material_id
      cross join visibility_context visibility
      where (
      visibility.can_view_all
      or coalesce(material.owner_party_id, nullif(material.owner_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids)
      or (material.status = 'loaned' and coalesce(material.borrower_party_id,
        nullif(material.borrower_snapshot ->> 'scopePartyId', '')::uuid) = any(visibility.visible_party_ids))
    )
    ), inspection_types as (
      select distinct on (inspection_type_id)
        inspection_type_id as id, inspection_type_name_snapshot as name
      from visible_inspections
      order by inspection_type_id, inspected_at desc, id desc
    )
    select jsonb_build_object(
      'inspectionTypes', coalesce((select jsonb_agg(jsonb_build_object('id', type.id, 'name', type.name)
        order by lower(type.name) collate "vi-x-icu", type.id) from inspection_types type), '[]'::jsonb),
      'total', count(*)::integer,
      'relatedToMe', count(*) filter (where created_by = v_actor_id)::integer,
      'needsAction', count(*) filter (where created_by = v_actor_id and status = 'in_progress')::integer,
      'inProgress', count(*) filter (where status = 'in_progress')::integer,
      'completed', count(*) filter (where status = 'completed')::integer,
      'passed', count(*) filter (where overall_result = 'passed')::integer,
      'failed', count(*) filter (where overall_result = 'failed')::integer,
      'noResult', count(*) filter (where overall_result is null)::integer
    )
    from visible_inspections
    where matches_search
      and (p_inspection_type_id is null or inspection_type_id = p_inspection_type_id)
  );
end;
$$;
revoke all on function public.get_safety_inspection_filter_summary(text, uuid) from public, anon;
grant execute on function public.get_safety_inspection_filter_summary(text, uuid) to authenticated;

create or replace function public.get_safety_inspection_filter_summary(p_search text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select public.get_safety_inspection_filter_summary(p_search, null::uuid);
$$;

create or replace function public.list_material_safety_inspection_history_types(
  p_material_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.can_view_material_current(p_material_id) then
    raise exception 'Permission denied to view material inspection history' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', type.id, 'name', type.name)
      order by lower(type.name) collate "vi-x-icu", type.id), '[]'::jsonb)
    from (
      select distinct on (inspection.inspection_type_id)
        inspection.inspection_type_id as id, inspection.inspection_type_name_snapshot as name
      from public.material_safety_inspections inspection
      where inspection.material_id = p_material_id
      order by inspection.inspection_type_id, inspection.inspected_at desc, inspection.id desc
    ) type
  );
end;
$$;

revoke all on function public.list_material_safety_inspection_history_types(uuid) from public, anon;
grant execute on function public.list_material_safety_inspection_history_types(uuid) to authenticated;
