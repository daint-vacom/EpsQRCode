alter function public.save_material_receipt(uuid, jsonb)
  rename to save_material_receipt_without_receiving_party;
revoke all on function public.save_material_receipt_without_receiving_party(uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.save_material_receipt(p_id uuid, p_values jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_line jsonb;
  v_line_id uuid;
  v_recipient uuid;
  v_sort integer := 0;
  v_history_id uuid;
  v_has_recipients boolean;
  v_existing_receivers jsonb := '[]'::jsonb;
  v_incoming_receivers jsonb;
begin
  if p_id is not null then
    perform 1 from public.material_receipts where id = p_id for update;
    select coalesce(jsonb_agg(line.receiving_party_id order by line.sort_order), '[]'::jsonb)
    into v_existing_receivers
    from public.material_receipt_lines line
    where line.receipt_id = p_id;
  end if;
  select coalesce(
    jsonb_agg(nullif(line.value->>'receivingPartyId', '') order by (line.value->>'sortOrder')::integer nulls last),
    '[]'::jsonb
  ) into v_incoming_receivers
  from jsonb_array_elements(coalesce(p_values->'lines', '[]'::jsonb)) line(value);
  v_has_recipients := exists (
    select 1
    from jsonb_array_elements(coalesce(p_values->'lines', '[]'::jsonb)) line(value)
    where nullif(line.value->>'receivingPartyId', '') is not null
  );
  if not public.has_permission('materials:receipt:manage') and (
    (p_id is null and v_has_recipients)
    or (p_id is not null and v_existing_receivers is distinct from v_incoming_receivers)
  ) then
    raise exception 'Permission denied to assign receiving units on material receipts' using errcode = '42501';
  end if;

  v_id := public.save_material_receipt_without_receiving_party(p_id, p_values);

  for v_line in
    select value
    from jsonb_array_elements(coalesce(p_values->'lines', '[]'::jsonb))
    order by (value->>'sortOrder')::integer nulls last
  loop
    select line.id into v_line_id
    from public.material_receipt_lines line
    where line.receipt_id = v_id and line.sort_order = v_sort
    for update;
    if not found then
      raise exception 'Receipt line could not be matched while saving receiving units' using errcode = '40001';
    end if;

    v_recipient := nullif(v_line->>'receivingPartyId', '')::uuid;
    if v_recipient is not null and not exists (
      select 1 from public.material_custodians party
      where party.id = v_recipient and party.is_active
        and party.type in ('department', 'team', 'person', 'external')
    ) then
      raise exception 'Line % has an invalid or inactive receiving unit', v_sort + 1 using errcode = '22023';
    end if;

    update public.material_receipt_lines
    set receiving_party_id = v_recipient,
        updated_at = timezone('utc', now())
    where id = v_line_id;
    v_sort := v_sort + 1;
  end loop;

  select history.id into v_history_id
  from public.material_receipt_history history
  where history.receipt_id = v_id
  order by history.created_at desc, history.id desc
  limit 1;
  if v_history_id is not null then
    update public.material_receipt_history
    set after_state = public.material_receipt_json(v_id)
    where id = v_history_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_material_receipt(uuid, jsonb) from public, anon;
grant execute on function public.save_material_receipt(uuid, jsonb) to authenticated;
