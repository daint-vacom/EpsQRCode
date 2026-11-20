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
    join public.material_handover_items handover_item on handover_item.handover_id = handover.id
    join public.material_receipt_items item on item.material_id = handover_item.material_id
    where item.id = any(v_extra_item_ids)
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

create or replace function public.apply_material_receipt_inline_update(
  p_id uuid,
  p_expected_version integer,
  p_preview_token text,
  p_warehouse_id uuid,
  p_note text,
  p_lines jsonb,
  p_cancel_handover_ids jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.material_receipts%rowtype;
  v_preview jsonb;
  v_base_preview jsonb;
  v_expected_cancel_ids uuid[] := '{}'::uuid[];
  v_requested_cancel_ids uuid[] := '{}'::uuid[];
  v_rebuild_recipient_ids uuid[] := '{}'::uuid[];
  v_handover record;
  v_recipient uuid;
  v_handover_id uuid;
  v_item record;
  v_before_material jsonb;
  v_after_material jsonb;
  v_group_items jsonb;
  v_base_reason constant text := 'Cập nhật trực tiếp từ phiếu nhập';
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to manage material receipts' using errcode = '42501';
  end if;
  select * into v_receipt from public.material_receipts where id = p_id for update;
  if not found then
    raise exception 'Material receipt not found' using errcode = 'P0002';
  end if;
  if v_receipt.status <> 'handover' then
    raise exception 'Inline updates require a receipt in handover status' using errcode = '55000';
  end if;
  if v_receipt.version is distinct from p_expected_version then
    raise exception 'Receipt changed; reload before saving' using errcode = '40001';
  end if;
  if jsonb_typeof(p_cancel_handover_ids) is distinct from 'array' then
    raise exception 'Handover confirmations must be an array' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_cancel_handover_ids) item(value)
    where jsonb_typeof(item.value) is distinct from 'string'
  ) then
    raise exception 'Handover IDs must be strings' using errcode = '22023';
  end if;

  perform 1 from public.materials material
  where material.id in (
    select item.material_id from public.material_receipt_items item
    where item.receipt_id = p_id and item.material_id is not null
  )
  order by material.id for update;
  perform 1 from public.material_handovers handover
  where handover.id in (
    select handover_item.handover_id
    from public.material_handover_items handover_item
    join public.material_receipt_items item on item.material_id = handover_item.material_id
    where item.receipt_id = p_id
    union
    select related.id from public.material_handovers related where related.receipt_id = p_id
  )
  order by handover.id for update;

  v_preview := public.preview_material_receipt_inline_update(
    p_id, p_expected_version, p_warehouse_id, p_lines
  );
  if v_preview->>'previewToken' is distinct from p_preview_token then
    raise exception 'Receipt inventory or linked handovers changed; refresh the preview' using errcode = '40001';
  end if;
  if jsonb_array_length(v_preview->'blockedItems') > 0 then
    raise exception 'Some receipt items cannot be changed; review the blocked items' using errcode = '55000';
  end if;

  select coalesce(array_agg(distinct value::uuid order by value::uuid), '{}'::uuid[])
  into v_requested_cancel_ids
  from jsonb_array_elements_text(p_cancel_handover_ids) item(value);
  select coalesce(array_agg((item.value->>'id')::uuid order by (item.value->>'id')::uuid), '{}'::uuid[])
  into v_expected_cancel_ids
  from jsonb_array_elements(v_preview->'affectedHandovers') item(value);
  if v_requested_cancel_ids is distinct from v_expected_cancel_ids then
    raise exception 'Confirm every affected open handover before saving' using errcode = '55000';
  end if;

  v_base_preview := public.preview_material_receipt_adjustment(p_id, p_expected_version, p_lines);
  select coalesce(array_agg((item.value->>'id')::uuid order by (item.value->>'id')::uuid), '{}'::uuid[])
  into v_expected_cancel_ids
  from jsonb_array_elements(v_base_preview->'affectedHandovers') item(value);

  select coalesce(array_agg(distinct recipient_id order by recipient_id), '{}'::uuid[])
  into v_rebuild_recipient_ids
  from (
    select line.receiving_party_id as recipient_id
    from public.material_receipt_lines line
    join jsonb_array_elements(p_lines) incoming(value)
      on nullif(incoming.value->>'lineId', '')::uuid = line.id
    where line.receipt_id = p_id
      and line.receiving_party_id is distinct from nullif(incoming.value->>'receivingPartyId', '')::uuid
    union all
    select nullif(incoming.value->>'receivingPartyId', '')::uuid
    from jsonb_array_elements(p_lines) incoming(value)
    join public.material_receipt_lines line
      on line.id = nullif(incoming.value->>'lineId', '')::uuid
    where line.receipt_id = p_id
      and line.receiving_party_id is distinct from nullif(incoming.value->>'receivingPartyId', '')::uuid
      and nullif(incoming.value->>'receivingPartyId', '') is not null
    union all
    select nullif(incoming.value->>'receivingPartyId', '')::uuid
    from jsonb_array_elements(p_lines) incoming(value)
    where nullif(incoming.value->>'receivingPartyId', '') is not null
      and (
        nullif(incoming.value->>'lineId', '') is null
        or exists (
          select 1 from jsonb_array_elements(coalesce(incoming.value->'items', '[]'::jsonb)) desired(value)
          where nullif(desired.value->>'receiptItemId', '') is null
        )
      )
    union all
    select handover.recipient_party_id
    from jsonb_array_elements(v_preview->'affectedHandovers') affected(value)
    join public.material_handovers handover on handover.id = (affected.value->>'id')::uuid
    where handover.recipient_party_id is not null
    union all
    select nullif(incoming.value->>'receivingPartyId', '')::uuid
    from jsonb_array_elements(p_lines) incoming(value)
    where p_warehouse_id <> v_receipt.warehouse_id
      and nullif(incoming.value->>'receivingPartyId', '') is not null
  ) recipients
  where recipient_id is not null;

  if cardinality(v_rebuild_recipient_ids) > 0 and not public.has_permission('materials:handover:manage') then
    raise exception 'Permission denied to update linked warehouse allocations' using errcode = '42501';
  end if;
  if p_warehouse_id <> v_receipt.warehouse_id
    and not public.has_scoped_permission('materials:receipt:manage', p_warehouse_id) then
    raise exception 'The new warehouse is outside the permitted management scope' using errcode = '42501';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_lines) incoming(value)
    where nullif(incoming.value->>'receivingPartyId', '') is not null
      and not exists (
        select 1 from public.material_custodians party
        where party.id = nullif(incoming.value->>'receivingPartyId', '')::uuid
          and party.is_active
          and party.type in ('department', 'team', 'person', 'external')
      )
  ) then
    raise exception 'A receiving unit is inactive or invalid' using errcode = '22023';
  end if;

  perform public.apply_material_receipt_adjustment(
    p_id,
    p_expected_version,
    v_base_preview->>'previewToken',
    p_lines,
    v_base_reason,
    to_jsonb(v_expected_cancel_ids)
  );

  perform set_config('app.materials_warehouse_transition', 'true', true);
  for v_handover in
    select handover.*
    from jsonb_array_elements(v_preview->'affectedHandovers') affected(value)
    join public.material_handovers handover on handover.id = (affected.value->>'id')::uuid
    where not (handover.id = any(v_expected_cancel_ids))
      and handover.status in ('draft', 'pending', 'awaiting_warehouse_approval')
    order by handover.id
    for update of handover
  loop
    update public.material_handovers
    set status = 'cancelled', version = version + 1
    where id = v_handover.id;
    update public.materials
    set reserved_handover_id = null, reservation_status = null,
        version = version + 1, updated_at = timezone('utc', now())
    where reserved_handover_id = v_handover.id;
    insert into public.material_handover_history(
      handover_id, actor_user_id, action, from_status, to_status, note
    ) values (
      v_handover.id, auth.uid(), 'cancelled', v_handover.status, 'cancelled',
      'Hủy do cập nhật trực tiếp từ phiếu nhập ' || v_receipt.code
    );
  end loop;

  if p_warehouse_id <> v_receipt.warehouse_id then
    for v_item in
      select material.id
      from public.material_receipt_items item
      join public.materials material on material.id = item.material_id
      where item.receipt_id = p_id and item.status = 'active'
        and material.owner_party_id = v_receipt.warehouse_id
      order by material.id for update of material
    loop
      v_before_material := public.material_json(v_item.id);
      update public.materials
      set owner_party_id = p_warehouse_id, version = version + 1,
          updated_at = timezone('utc', now())
      where id = v_item.id;
      v_after_material := public.material_json(v_item.id);
      insert into public.material_history(
        material_id, actor_user_id, action, note, from_state, to_state
      ) values (
        v_item.id, auth.uid(), 'updated',
        'Đổi kho theo phiếu nhập ' || v_receipt.code,
        v_before_material, v_after_material
      );
      update public.material_receipt_items
      set material_snapshot = v_after_material, updated_at = timezone('utc', now())
      where material_id = v_item.id and receipt_id = p_id;
    end loop;
  end if;

  update public.material_receipt_lines line
  set receiving_party_id = nullif(incoming.value->>'receivingPartyId', '')::uuid,
      updated_at = timezone('utc', now())
  from jsonb_array_elements(p_lines) with ordinality incoming(value, ordinal)
  where line.receipt_id = p_id
    and line.sort_order = nullif(incoming.value->>'sortOrder', '')::integer;

  update public.material_receipts
  set warehouse_id = p_warehouse_id,
      note = btrim(coalesce(p_note, '')),
      version = version + 1,
      updated_at = timezone('utc', now())
  where id = p_id;

  if cardinality(v_rebuild_recipient_ids) > 0 then
    for v_recipient in
      select distinct line.receiving_party_id
      from public.material_receipt_lines line
      where line.receipt_id = p_id
        and line.receiving_party_id = any(v_rebuild_recipient_ids)
      order by line.receiving_party_id
    loop
      select coalesce(jsonb_agg(jsonb_build_object(
        'materialId', material.id,
        'condition', item.condition,
        'note', coalesce(item.condition_note, item.note)
      ) order by line.sort_order, item.sort_order, item.id), '[]'::jsonb)
      into v_group_items
      from public.material_receipt_lines line
      join public.material_receipt_items item on item.line_id = line.id and item.status = 'active'
      join public.materials material on material.id = item.material_id
      where line.receipt_id = p_id
        and line.receiving_party_id = v_recipient
        and material.owner_party_id = p_warehouse_id
        and material.is_active
        and material.status = 'available'
        and material.reserved_handover_id is null
        and material.active_loan_handover_id is null;

      if jsonb_array_length(v_group_items) > 0 then
        v_handover_id := public.save_warehouse_handover(null, jsonb_build_object(
          'mode', 'warehouse_allocation',
          'warehouseId', p_warehouse_id,
          'recipientPartyId', v_recipient,
          'receiptId', p_id,
          'note', 'Phân bổ cập nhật từ phiếu nhập ' || v_receipt.code,
          'items', v_group_items
        ));
        perform public.act_on_warehouse_handover(v_handover_id, 'send', 1, null, '[]'::jsonb);
      end if;
    end loop;
  end if;

  update public.material_receipt_history history
  set after_state = public.material_receipt_json(p_id)
  where history.id = (
    select latest.id from public.material_receipt_history latest
    where latest.receipt_id = p_id
    order by latest.created_at desc, latest.id desc
    limit 1
  );
  return p_id;
end;
$$;

revoke all on function public.preview_material_receipt_inline_update(uuid, integer, uuid, jsonb)
  from public, anon;
grant execute on function public.preview_material_receipt_inline_update(uuid, integer, uuid, jsonb)
  to authenticated;
revoke all on function public.apply_material_receipt_inline_update(uuid, integer, text, uuid, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.apply_material_receipt_inline_update(uuid, integer, text, uuid, text, jsonb, jsonb)
  to authenticated;
