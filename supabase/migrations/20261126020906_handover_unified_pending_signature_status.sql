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
        and (nullif(p_filters->>'search', '') is null or handover.code ilike '%' || btrim(p_filters->>'search') || '%')
        and (
          nullif(p_filters->>'status', '') is null
          or (p_filters->>'status' = 'pending' and handover.status in ('pending', 'awaiting_warehouse_approval'))
          or handover.status = p_filters->>'status'
        )
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

revoke all on function public.list_handovers(jsonb) from public, anon;
grant execute on function public.list_handovers(jsonb) to authenticated;

create or replace function public.get_handover_filter_summary(
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
  if auth.uid() is null or not public.has_permission('materials:handover:view') then
    raise exception 'Permission denied to view handovers' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'draft', count(*) filter (where handover.status = 'draft')::integer,
      'pending', count(*) filter (where handover.status in ('pending', 'awaiting_warehouse_approval'))::integer,
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

revoke all on function public.get_handover_filter_summary(text) from public, anon;
grant execute on function public.get_handover_filter_summary(text) to authenticated;

notify pgrst, 'reload schema';
