create or replace function public.preview_material_receipt_inline_update(
  p_id uuid,
  p_expected_version integer,
  p_warehouse_id uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_receipt public.material_receipts%rowtype;
  v_base jsonb;
  v_extra_item_ids uuid[] := '{}'::uuid[];
  v_rebuild_recipient_ids uuid[] := '{}'::uuid[];
  v_extra_blocked jsonb := '[]'::jsonb;
  v_completed_blocked jsonb := '[]'::jsonb;
  v_extra_handovers jsonb := '[]'::jsonb;
  v_blocked jsonb;
  v_handovers jsonb;
  v_token text;
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to manage material receipts' using errcode = '42501';
  end if;

  select * into v_receipt
  from public.material_receipts
  where id = p_id;
  if not found then
    raise exception 'Material receipt not found' using errcode = 'P0002';
  end if;
  if v_receipt.version is distinct from p_expected_version then
    raise exception 'Receipt changed; reload before previewing' using errcode = '40001';
  end if;
  if v_receipt.status <> 'handover' then
    raise exception 'Inline updates require a receipt in handover status' using errcode = '55000';
  end if;
  if p_warehouse_id is null or not exists (
    select 1
    from public.material_warehouses warehouse
    join public.material_custodians custodian on custodian.id = warehouse.custodian_id
    where warehouse.custodian_id = p_warehouse_id
      and custodian.type = 'warehouse'
      and custodian.is_active
  ) then
    raise exception 'Choose an active warehouse' using errcode = '22023';
  end if;
  if not public.has_scoped_permission('materials:receipt:manage', v_receipt.warehouse_id)
    or not public.has_scoped_permission('materials:receipt:manage', p_warehouse_id) then
    raise exception 'Receipt is outside the permitted management scope' using errcode = '42501';
  end if;
  if p_warehouse_id <> v_receipt.warehouse_id and not public.material_can_represent(p_warehouse_id) then
    raise exception 'You must represent the new warehouse to move this receipt' using errcode = '42501';
  end if;

  v_base := public.preview_material_receipt_adjustment(p_id, p_expected_version, p_lines);

  select coalesce(array_agg(distinct item.id order by item.id), '{}'::uuid[])
  into v_extra_item_ids
  from public.material_receipt_items item
  join public.material_receipt_lines line on line.id = item.line_id
  where item.receipt_id = p_id
    and item.status = 'active'
    and (
      p_warehouse_id <> v_receipt.warehouse_id
      or exists (
        select 1
        from jsonb_array_elements(p_lines) incoming(value)
        where nullif(incoming.value->>'lineId', '')::uuid = line.id
          and nullif(incoming.value->>'receivingPartyId', '')::uuid
            is distinct from line.receiving_party_id
      )
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'receiptItemId', item.id,
    'materialId', material.id,
    'code', material.code,
    'reason', case
      when material.id is null then 'Vật tư trong phiếu không còn tồn tại'
      when not material.is_active then 'Vật tư đã bị vô hiệu'
      when material.owner_party_id is distinct from v_receipt.warehouse_id
        then 'Vật tư đã rời kho nhận'
      when material.status <> 'available' or material.active_loan_handover_id is not null
        then 'Vật tư không còn khả dụng tại kho'
      when exists (
        select 1
        from public.material_handover_items handover_item
        join public.material_handovers handover on handover.id = handover_item.handover_id
        where handover_item.material_id = material.id
          and handover.status = 'completed'
      ) then 'Vật tư đã được xác nhận trong phiếu bàn giao'
      else null
    end
  ) order by item.id) filter (where item.id is not null and (
    material.id is null
    or not material.is_active
    or material.owner_party_id is distinct from v_receipt.warehouse_id
    or material.status <> 'available'
    or material.active_loan_handover_id is not null
    or exists (
      select 1
      from public.material_handover_items handover_item
      join public.material_handovers handover on handover.id = handover_item.handover_id
      where handover_item.material_id = material.id
        and handover.status = 'completed'
    )
  )), '[]'::jsonb)
  into v_extra_blocked
  from public.material_receipt_items item
  left join public.materials material on material.id = item.material_id
  where item.id = any(v_extra_item_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'receiptItemId', item.id,
    'materialId', material.id,
    'code', material.code,
    'reason', 'Vật tư đã có phiếu bàn giao hoàn tất'
  ) order by item.id), '[]'::jsonb)
  into v_completed_blocked
  from public.material_receipt_items item
  join public.materials material on material.id = item.material_id
  where item.receipt_id = p_id
    and item.status = 'active'
    and exists (
      select 1
      from public.material_handover_items handover_item
      join public.material_handovers handover on handover.id = handover_item.handover_id
      where handover_item.material_id = material.id
        and handover.status = 'completed'
    )
    and (
      not exists (
        select 1
        from jsonb_array_elements(p_lines) incoming(value)
        cross join lateral jsonb_array_elements(coalesce(incoming.value->'items', '[]'::jsonb)) desired(value)
        where nullif(desired.value->>'receiptItemId', '')::uuid = item.id
      )
      or exists (
        select 1
        from jsonb_array_elements(p_lines) incoming(value)
        cross join lateral jsonb_array_elements(coalesce(incoming.value->'items', '[]'::jsonb)) desired(value)
        where nullif(desired.value->>'receiptItemId', '')::uuid = item.id
          and (
            item.serial_number is distinct from nullif(btrim(desired.value->>'serialNumber'), '')
            or item.condition is distinct from coalesce(desired.value->>'condition', 'good')
            or item.condition_note is distinct from nullif(btrim(desired.value->>'conditionNote'), '')
            or item.note is distinct from btrim(coalesce(desired.value->>'note', ''))
          )
      )
    );

  select coalesce(array_agg(distinct recipient_id order by recipient_id), '{}'::uuid[])
  into v_rebuild_recipient_ids
  from (
    select nullif(incoming.value->>'receivingPartyId', '')::uuid as recipient_id
    from jsonb_array_elements(p_lines) incoming(value)
    left join public.material_receipt_lines line
      on line.id = nullif(incoming.value->>'lineId', '')::uuid
      and line.receipt_id = p_id
    where nullif(incoming.value->>'receivingPartyId', '') is not null
      and (
        p_warehouse_id <> v_receipt.warehouse_id
        or exists (
          select 1
          from jsonb_array_elements(coalesce(incoming.value->'items', '[]'::jsonb)) desired(value)
          where nullif(desired.value->>'receiptItemId', '') is null
        )
        or line.receiving_party_id is distinct from nullif(incoming.value->>'receivingPartyId', '')::uuid
      )
    union all
    select line.receiving_party_id
    from jsonb_array_elements(p_lines) incoming(value)
    join public.material_receipt_lines line
      on line.id = nullif(incoming.value->>'lineId', '')::uuid
    where line.receipt_id = p_id
      and line.receiving_party_id is not null
      and line.receiving_party_id is distinct from nullif(incoming.value->>'receivingPartyId', '')::uuid
  ) recipients
  where recipient_id is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', handover.id,
    'code', handover.code,
    'status', handover.status,
    'version', handover.version
  ) order by handover.created_at desc, handover.id), '[]'::jsonb)
  into v_extra_handovers
  from (
    select distinct handover.id, handover.code, handover.status, handover.version, handover.created_at
    from public.material_handovers handover
    left join public.material_handover_items handover_item on handover_item.handover_id = handover.id
    left join public.material_receipt_items item
      on item.material_id = handover_item.material_id and item.receipt_id = p_id
    where (item.id = any(v_extra_item_ids)
      or (handover.receipt_id = p_id and handover.recipient_party_id = any(v_rebuild_recipient_ids)))
      and handover.status in ('draft', 'pending', 'awaiting_warehouse_approval')
  ) handover;

  select coalesce(jsonb_agg(blocked.value order by blocked.value->>'receiptItemId'), '[]'::jsonb)
  into v_blocked
  from (
    select distinct on (value->>'receiptItemId') value
    from (
      select value from jsonb_array_elements(coalesce(v_base->'blockedItems', '[]'::jsonb)) base_blocked(value)
      union all
      select value from jsonb_array_elements(v_extra_blocked) extra_blocked(value)
      union all
      select value from jsonb_array_elements(v_completed_blocked) completed_blocked(value)
    ) all_blocked
    order by value->>'receiptItemId'
  ) blocked;

  select coalesce(jsonb_agg(handover.value order by handover.value->>'code'), '[]'::jsonb)
  into v_handovers
  from (
    select distinct on (value->>'id') value
    from (
      select value from jsonb_array_elements(coalesce(v_base->'affectedHandovers', '[]'::jsonb)) base_handover(value)
      union all
      select value from jsonb_array_elements(v_extra_handovers) extra_handover(value)
    ) all_handovers
    order by value->>'id'
  ) handover;

  if jsonb_array_length(v_handovers) > 0 and (
    not public.has_permission('materials:handover:manage')
    or not public.material_can_represent(p_warehouse_id)
  ) then
    raise exception 'You must manage handovers and represent the warehouse to rebuild affected allocations' using errcode = '42501';
  end if;

  v_token := md5(
    coalesce(v_base->>'previewToken', '') || ':' || p_warehouse_id::text || ':' || p_lines::text
  );
  return v_base || jsonb_build_object(
    'previewToken', v_token,
    'basePreviewToken', v_base->>'previewToken',
    'warehouseId', p_warehouse_id,
    'warehouseChanged', p_warehouse_id <> v_receipt.warehouse_id,
    'affectedHandovers', v_handovers,
    'blockedItems', v_blocked
  );
end;
$$;

