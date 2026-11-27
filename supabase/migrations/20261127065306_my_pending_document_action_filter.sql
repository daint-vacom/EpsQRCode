create or replace function public.list_handovers(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page int := greatest(coalesce((p_filters->>'page')::int, 1), 1);
  v_size int := least(greatest(coalesce((p_filters->>'pageSize')::int, 20), 1), 100);
begin
  if auth.uid() is null or not public.has_permission('materials:handover:view') then
    raise exception 'Permission denied to view handovers' using errcode = '42501';
  end if;
  return (
    with filtered as (
      select handover.id, handover.created_at
      from public.material_handovers handover
      where public.can_view_handover(handover.id)
      and case coalesce(p_filters->>'relationship', '')
        when 'relatedToMe' then private.handover_is_related_to_me(handover)
        when 'needsAction' then handover.status in ('draft', 'pending')
          and (handover.created_by = (select auth.uid()) or private.handover_is_waiting_for_me(handover))
        else true
      end
        and (nullif(p_filters->>'search', '') is null or handover.code ilike '%' || btrim(p_filters->>'search') || '%')
        and (nullif(p_filters->>'status', '') is null or handover.status = p_filters->>'status')
        and (nullif(p_filters->>'type', '') is null or handover.type = p_filters->>'type')
        and (nullif(p_filters->>'senderPartyId', '') is null or handover.sender_party_id = (p_filters->>'senderPartyId')::uuid)
        and (nullif(p_filters->>'recipientPartyId', '') is null or handover.recipient_party_id = (p_filters->>'recipientPartyId')::uuid)
        and (nullif(p_filters->>'receiptId', '') is null or handover.receipt_id = (p_filters->>'receiptId')::uuid)
        and (nullif(p_filters->>'materialId', '') is null or exists (
          select 1 from public.material_handover_items item
          where item.handover_id = handover.id and item.material_id = (p_filters->>'materialId')::uuid
        ))
        and (nullif(p_filters->>'dateFrom', '') is null or handover.created_at >= (p_filters->>'dateFrom')::date)
        and (nullif(p_filters->>'dateTo', '') is null or handover.created_at < (p_filters->>'dateTo')::date + 1)
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(private.scoped_handover_json(page.id) order by page.created_at desc, page.id)
        from (select * from filtered order by created_at desc, id offset (v_page - 1) * v_size limit v_size) page), '[]'::jsonb),
      'total', (select count(*) from filtered), 'page', v_page, 'pageSize', v_size
    )
  );
end;
$$;

create or replace function public.get_handover_filter_summary(p_search text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_search text := nullif(btrim(p_search), '');
begin
  if auth.uid() is null or not public.has_permission('materials:handover:view') then
    raise exception 'Permission denied to view handovers' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'relatedToMe', count(*) filter (where private.handover_is_related_to_me(handover))::integer,
      'needsAction', count(*) filter (where handover.status in ('draft', 'pending')
        and (handover.created_by = (select auth.uid()) or private.handover_is_waiting_for_me(handover)))::integer,
      'draft', count(*) filter (where handover.status = 'draft')::integer,
      'pending', count(*) filter (where handover.status = 'pending')::integer,
      'completed', count(*) filter (where handover.status = 'completed')::integer,
      'rejected', count(*) filter (where handover.status = 'rejected')::integer,
      'cancelled', count(*) filter (where handover.status = 'cancelled')::integer,
      'transfer', count(*) filter (where handover.type = 'transfer')::integer,
      'loan', count(*) filter (where handover.type = 'loan')::integer,
      'return', count(*) filter (where handover.type = 'return')::integer
    )
    from public.material_handovers handover
    where public.can_view_handover(handover.id)
      and (v_search is null or handover.code ilike '%' || v_search || '%')
  );
end;
$$;

create or replace function public.list_material_receipts(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_page int := greatest(coalesce((p_filters->>'page')::int, 1), 1);
  v_size int := least(greatest(coalesce((p_filters->>'pageSize')::int, 20), 1), 100);
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:view') then
    raise exception 'Permission denied to view receipts' using errcode = '42501';
  end if;
  return (
    with filtered as (
      select receipt.id, receipt.created_at
      from public.material_receipts receipt
      where public.can_view_receipt(receipt.id)
      and case coalesce(p_filters->>'relationship', '')
        when 'relatedToMe' then receipt.created_by = (select auth.uid())
        when 'needsAction' then receipt.created_by = (select auth.uid()) and receipt.status in ('draft', 'handover')
        else true
      end
        and (nullif(p_filters->>'search', '') is null or receipt.code ilike '%' || btrim(p_filters->>'search') || '%')
        and (nullif(p_filters->>'status', '') is null or receipt.status = p_filters->>'status')
        and (nullif(p_filters->>'warehouseId', '') is null or receipt.warehouse_id = (p_filters->>'warehouseId')::uuid)
        and (nullif(p_filters->>'dateFrom', '') is null or receipt.created_at >= (p_filters->>'dateFrom')::date)
        and (nullif(p_filters->>'dateTo', '') is null or receipt.created_at < (p_filters->>'dateTo')::date + 1)
        and (nullif(p_filters->>'materialId', '') is null or exists (
          select 1 from public.material_receipt_items item
          where item.receipt_id = receipt.id and item.material_id = (p_filters->>'materialId')::uuid
        ))
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(public.material_receipt_json(page.id) order by page.created_at desc, page.id)
        from (select * from filtered order by created_at desc, id offset (v_page - 1) * v_size limit v_size) page), '[]'::jsonb),
      'total', (select count(*) from filtered), 'page', v_page, 'pageSize', v_size
    )
  );
end;
$$;

create or replace function public.get_material_receipt_filter_summary(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(p_filters->>'search'), '');
  v_warehouse uuid := nullif(p_filters->>'warehouseId', '')::uuid;
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:view') then
    raise exception 'Permission denied to view receipts' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'relatedToMe', count(*) filter (where receipt.created_by = (select auth.uid()))::integer,
      'needsAction', count(*) filter (where receipt.created_by = (select auth.uid())
        and receipt.status in ('draft', 'handover'))::integer,
      'draft', count(*) filter (where receipt.status = 'draft')::integer,
      'handover', count(*) filter (where receipt.status = 'handover')::integer,
      'completed', count(*) filter (where receipt.status = 'completed')::integer,
      'cancelled', count(*) filter (where receipt.status = 'cancelled')::integer
    )
    from public.material_receipts receipt
    where public.can_view_receipt(receipt.id)
      and (v_warehouse is null or receipt.warehouse_id = v_warehouse)
      and (v_search is null or receipt.code ilike '%' || v_search || '%')
  );
end;
$$;

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
  v_status text := nullif(p_filters ->> 'status', '');
  v_overall_result text := nullif(p_filters ->> 'overallResult', '');
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  with filtered as (
    select
      inspection.id,
      inspection.material_id,
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
    where public.can_view_material_current(material.id)
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
  p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(p_search), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'relatedToMe', count(*) filter (where inspection.created_by = (select auth.uid()))::integer,
      'needsAction', count(*) filter (where inspection.created_by = (select auth.uid())
        and inspection.status = 'in_progress')::integer,
      'inProgress', count(*) filter (where inspection.status = 'in_progress')::integer,
      'completed', count(*) filter (where inspection.status = 'completed')::integer,
      'passed', count(*) filter (where inspection.overall_result = 'passed')::integer,
      'failed', count(*) filter (where inspection.overall_result = 'failed')::integer,
      'noResult', count(*) filter (where inspection.overall_result is null)::integer
    )
    from public.material_safety_inspections inspection
    join public.materials material on material.id = inspection.material_id
    where public.can_view_material_current(material.id)
      and (
        v_search is null
        or material.code ilike '%' || v_search || '%'
        or material.name_override ilike '%' || v_search || '%'
        or material.model_snapshot->>'name' ilike '%' || v_search || '%'
        or inspection.inspector_name ilike '%' || v_search || '%'
      )
  );
end;
$$;
