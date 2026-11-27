create or replace function public.apply_material_receipt_inline_update_with_registration(
  p_id uuid,
  p_expected_version integer,
  p_preview_token text,
  p_warehouse_id uuid,
  p_note text,
  p_lines jsonb,
  p_cancel_handover_ids jsonb,
  p_request_registration_scope text,
  p_request_registration_party_ids jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.material_receipts%rowtype;
  v_scope text := p_request_registration_scope;
  v_targets jsonb := p_request_registration_party_ids;
  v_party_ids uuid[] := '{}'::uuid[];
  v_saved_id uuid;
begin
  if auth.uid() is null
    or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to manage material receipts'
      using errcode = '42501';
  end if;

  select * into v_receipt
  from public.material_receipts
  where id = p_id
  for update;
  if not found then
    raise exception 'Material receipt not found' using errcode = 'P0002';
  end if;
  if v_receipt.status <> 'handover' then
    raise exception 'Inline updates require a receipt in handover status'
      using errcode = '55000';
  end if;
  if v_receipt.version is distinct from p_expected_version then
    raise exception 'Receipt changed; reload before saving' using errcode = '40001';
  end if;
  if not public.has_scoped_permission(
    'materials:receipt:manage', v_receipt.warehouse_id
  ) then
    raise exception 'Receipt is outside the permitted management scope'
      using errcode = '42501';
  end if;

  if v_scope is null or v_scope not in ('all', 'selected') then
    raise exception 'Invalid receipt request registration scope'
      using errcode = '22023';
  end if;
  if jsonb_typeof(v_targets) is distinct from 'array' then
    raise exception 'Registration targets must be an array'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_targets) item(value)
    where jsonb_typeof(item.value) is distinct from 'string'
  ) then
    raise exception 'Registration target IDs must be strings'
      using errcode = '22023';
  end if;

  if v_scope = 'selected' then
    select coalesce(array_agg(distinct value::uuid), '{}'::uuid[])
    into v_party_ids
    from jsonb_array_elements_text(v_targets) item(value);
    if cardinality(v_party_ids) = 0 then
      raise exception 'Choose at least one EPS department that may request this receipt'
        using errcode = '22023';
    end if;
  elsif jsonb_array_length(v_targets) > 0 then
    raise exception 'Registration targets must be empty when all EPS departments are allowed'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_party_ids) selected(id)
    where not exists (
      select 1
      from public.material_custodians party
      where party.id = selected.id
        and party.is_active
        and party.type = 'department'
        and party.source_type = 'eps_department'
    )
  ) then
    raise exception 'A registration target must be an active EPS department'
      using errcode = '22023';
  end if;

  v_saved_id := public.apply_material_receipt_inline_update(
    p_id,
    p_expected_version,
    p_preview_token,
    p_warehouse_id,
    p_note,
    p_lines,
    p_cancel_handover_ids
  );

  update public.material_receipts
  set request_registration_scope = v_scope
  where id = v_saved_id;
  delete from public.material_receipt_request_targets
  where receipt_id = v_saved_id;
  if v_scope = 'selected' then
    insert into public.material_receipt_request_targets (receipt_id, party_id)
    select v_saved_id, unnest(v_party_ids);
  end if;

  update public.material_receipt_history history
  set after_state = public.material_receipt_json(v_saved_id)
  where history.id = (
    select latest.id
    from public.material_receipt_history latest
    where latest.receipt_id = v_saved_id
    order by latest.created_at desc, latest.id desc
    limit 1
  );

  return v_saved_id;
end;
$$;

revoke all on function public.apply_material_receipt_inline_update_with_registration(
  uuid, integer, text, uuid, text, jsonb, jsonb, text, jsonb
) from public, anon;
grant execute on function public.apply_material_receipt_inline_update_with_registration(
  uuid, integer, text, uuid, text, jsonb, jsonb, text, jsonb
) to authenticated;
