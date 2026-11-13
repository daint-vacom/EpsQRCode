alter table public.material_receipt_lines
  add column specification_overrides jsonb not null default '{}'::jsonb
  check (jsonb_typeof(specification_overrides) = 'object'),
  add column specification_override_labels jsonb not null default '{}'::jsonb
  check (jsonb_typeof(specification_override_labels) = 'object');

-- This set-based migration backfill has no authenticated request context.
alter table public.material_receipt_lines
  disable trigger material_receipt_lines_scope_guard;

with uniform_line_overrides as (
  select line.id,
    (array_agg(material.specification_overrides))[1] as specification_overrides,
    (array_agg(material.specification_override_labels))[1] as specification_override_labels
  from public.material_receipt_lines line
  join public.material_receipt_items item
    on item.line_id = line.id and item.status = 'active' and item.material_id is not null
  join public.materials material on material.id = item.material_id
  group by line.id
  having count(distinct material.specification_overrides) = 1
    and count(distinct material.specification_override_labels) = 1
)
update public.material_receipt_lines line
set specification_overrides = uniform_line_overrides.specification_overrides,
    specification_override_labels = uniform_line_overrides.specification_override_labels
from uniform_line_overrides
where line.id = uniform_line_overrides.id;

alter table public.material_receipt_lines
  enable trigger material_receipt_lines_scope_guard;

create or replace function private.receipt_line_specification_overrides_valid(
  p_model_id uuid,
  p_overrides jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_specification jsonb;
begin
  if jsonb_typeof(coalesce(p_overrides, '{}'::jsonb)) is distinct from 'object' then
    return false;
  end if;

  for v_entry in
    select key, value
    from jsonb_each(coalesce(p_overrides, '{}'::jsonb))
  loop
    select specification.value into v_specification
    from public.material_models model
    cross join lateral jsonb_array_elements(model.specifications) as specification(value)
    where model.id = p_model_id
      and specification.value->>'id' = v_entry.key;

    if v_specification is null
      or not public.material_spec_override_is_valid(v_specification, v_entry.value) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;
revoke all on function private.receipt_line_specification_overrides_valid(uuid, jsonb)
  from public, anon, authenticated;

create or replace function private.receipt_line_specification_override_labels_valid(
  p_model_id uuid,
  p_overrides jsonb,
  p_labels jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_specification jsonb;
  v_label jsonb;
begin
  if jsonb_typeof(coalesce(p_labels, '{}'::jsonb)) is distinct from 'object' then
    return false;
  end if;
  for v_entry in select key, value from jsonb_each(coalesce(p_labels, '{}'::jsonb)) loop
    if not (coalesce(p_overrides, '{}'::jsonb) ? v_entry.key)
      or jsonb_typeof(v_entry.value) is distinct from 'array'
      or jsonb_array_length(v_entry.value) <> jsonb_array_length(p_overrides->v_entry.key) then
      return false;
    end if;
    select specification.value into v_specification
    from public.material_models model
    cross join lateral jsonb_array_elements(model.specifications) as specification(value)
    where model.id = p_model_id
      and specification.value->>'id' = v_entry.key;
    if v_specification is null or v_specification->>'dataType' is distinct from 'color' then
      return false;
    end if;
    for v_label in select value from jsonb_array_elements(v_entry.value) value loop
      if jsonb_typeof(v_label) is distinct from 'string' then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;
revoke all on function private.receipt_line_specification_override_labels_valid(uuid, jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.material_receipt_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',r.id,'code',r.code,'status',r.status,'warehouse',public.material_party_json(r.warehouse_id),
    'warehouseId',r.warehouse_id,'note',r.note,'version',r.version,
    'createdBy',r.created_by,'confirmedBy',r.confirmed_by,'completedBy',r.completed_by,
    'createdAt',r.created_at,'confirmedAt',r.confirmed_at,'completedAt',r.completed_at,
    'updatedAt',r.updated_at,
    'totalItems',(select count(*) from public.material_receipt_items i where i.receipt_id=r.id and i.status='active'),
    'receivedItems',(select count(distinct i.material_id) from public.material_receipt_items i
      join public.material_handover_items hi on hi.material_id=i.material_id
      join public.material_handovers h on h.id=hi.handover_id and h.receipt_id=r.id and h.status='completed'
      where i.receipt_id=r.id and i.status='active' and hi.receiver_outcome='received'),
    'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'id',l.id,'modelId',l.model_id,'model',case when l.model_id is null then l.proposed_model else jsonb_build_object(
        'id',m.id,'code',m.code,'name',m.name,'groupId',m.group_id,
        'requiresInspection',m.requires_inspection,'externalCodes',m.external_codes,
        'specifications',m.specifications) end,
      'externalCode',l.external_code,'quantity',l.quantity,'sortOrder',l.sort_order,
      'specificationOverrides',l.specification_overrides,
      'specificationOverrideLabels',l.specification_override_labels,
      'items',coalesce((select jsonb_agg(jsonb_build_object(
        'id',i.id,'materialId',i.material_id,'serialNumber',i.serial_number,
        'condition',i.condition,'conditionNote',i.condition_note,'note',i.note,
        'status',i.status,'voidReason',i.void_reason,'material',i.material_snapshot,
        'currentSpecificationOverrides',case when i.material_id is null then null else (
          select material.specification_overrides from public.materials material where material.id=i.material_id
        ) end,
        'currentSpecificationOverrideLabels',case when i.material_id is null then null else (
          select material.specification_override_labels from public.materials material where material.id=i.material_id
        ) end
      ) order by i.sort_order,i.id) from public.material_receipt_items i where i.line_id=l.id),'[]'::jsonb)
    ) order by l.sort_order,l.id) from public.material_receipt_lines l
      left join public.material_models m on m.id=l.model_id where l.receipt_id=r.id),'[]'::jsonb)
  ) from public.material_receipts r where r.id=p_id
$$;
revoke all on function public.material_receipt_json(uuid) from public,anon,authenticated;

alter function public.save_material_receipt(uuid, jsonb)
  rename to save_material_receipt_without_line_specifications;
revoke all on function public.save_material_receipt_without_line_specifications(uuid, jsonb)
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
  v_line_record public.material_receipt_lines%rowtype;
  v_overrides jsonb;
  v_labels jsonb;
  v_sort integer := 0;
  v_history_id uuid;
begin
  v_id := public.save_material_receipt_without_line_specifications(p_id, p_values);

  for v_line in
    select value
    from jsonb_array_elements(coalesce(p_values->'lines', '[]'::jsonb))
    order by (value->>'sortOrder')::integer nulls last
  loop
    select * into v_line_record
    from public.material_receipt_lines line
    where line.receipt_id = v_id and line.sort_order = v_sort
    for update;
    if not found then
      raise exception 'Receipt line could not be matched while saving specifications' using errcode='40001';
    end if;

    v_overrides := coalesce(v_line->'specificationOverrides', '{}'::jsonb);
    v_labels := coalesce(v_line->'specificationOverrideLabels', '{}'::jsonb);
    if not private.receipt_line_specification_overrides_valid(v_line_record.model_id, v_overrides) then
      raise exception 'A receipt line contains an invalid material specification' using errcode='22023';
    end if;
    if not private.receipt_line_specification_override_labels_valid(
      v_line_record.model_id, v_overrides, v_labels) then
      raise exception 'A receipt line contains invalid specification labels' using errcode='22023';
    end if;
    update public.material_receipt_lines
    set specification_overrides = v_overrides,
        specification_override_labels = v_labels,
        updated_at = timezone('utc', now())
    where id = v_line_record.id;
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

alter function public.act_material_receipt(uuid, text, integer, text)
  rename to act_material_receipt_without_line_specifications;
revoke all on function public.act_material_receipt_without_line_specifications(uuid, text, integer, text)
  from public, anon, authenticated;

create or replace function public.act_material_receipt(
  p_id uuid,
  p_action text,
  p_expected_version integer,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_receipt_code text;
  v_line record;
  v_item record;
  v_before jsonb;
  v_after jsonb;
  v_history_id uuid;
begin
  v_id := public.act_material_receipt_without_line_specifications(
    p_id, p_action, p_expected_version, p_reason);

  if p_action = 'confirm' then
    select code into v_receipt_code from public.material_receipts where id = p_id;
    for v_line in
      select line.id, line.specification_overrides, line.specification_override_labels
      from public.material_receipt_lines line
      where line.receipt_id = p_id
      order by line.sort_order, line.id
    loop
      for v_item in
        select item.id as receipt_item_id, item.material_id
        from public.material_receipt_items item
        where item.line_id = v_line.id
          and item.status = 'active'
          and item.material_id is not null
      loop
        if exists (
          select 1 from public.materials material
          where material.id = v_item.material_id
            and (
              material.specification_overrides is distinct from v_line.specification_overrides
              or material.specification_override_labels is distinct from v_line.specification_override_labels
            )
        ) then
          select public.material_json(v_item.material_id) into v_before;
          update public.materials
          set specification_overrides = v_line.specification_overrides,
              specification_override_labels = v_line.specification_override_labels,
              version = version + 1,
              updated_at = timezone('utc', now())
          where id = v_item.material_id;
          v_after := public.material_json(v_item.material_id);
          update public.material_receipt_items
          set material_snapshot = v_after,
              updated_at = timezone('utc', now())
          where id = v_item.receipt_item_id;
          insert into public.material_history(
            material_id, actor_user_id, action, note, from_state, to_state)
          values(
            v_item.material_id, auth.uid(), 'updated',
            'Áp dụng thông số theo dòng nhập ' || v_receipt_code,
            v_before, v_after);
        end if;
      end loop;
    end loop;

    select history.id into v_history_id
    from public.material_receipt_history history
    where history.receipt_id = p_id
    order by history.created_at desc, history.id desc
    limit 1;
    if v_history_id is not null then
      update public.material_receipt_history
      set after_state = public.material_receipt_json(p_id)
      where id = v_history_id;
    end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.act_material_receipt(uuid, text, integer, text) from public, anon;
grant execute on function public.act_material_receipt(uuid, text, integer, text) to authenticated;

alter function public.apply_material_receipt_adjustment(uuid, integer, text, jsonb, text, jsonb)
  rename to apply_material_receipt_adjustment_without_line_specifications;
revoke all on function public.apply_material_receipt_adjustment_without_line_specifications(
  uuid, integer, text, jsonb, text, jsonb) from public, anon, authenticated;

create or replace function public.apply_material_receipt_adjustment(
  p_id uuid,
  p_expected_version integer,
  p_preview_token text,
  p_lines jsonb,
  p_reason text,
  p_cancel_handover_ids jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_receipt_code text;
  v_line jsonb;
  v_line_id uuid;
  v_line_record public.material_receipt_lines%rowtype;
  v_item record;
  v_overrides jsonb;
  v_labels jsonb;
  v_before jsonb;
  v_after jsonb;
  v_history_id uuid;
  v_specifications_changed boolean;
  v_sort integer := 0;
begin
  v_id := public.apply_material_receipt_adjustment_without_line_specifications(
    p_id, p_expected_version, p_preview_token, p_lines, p_reason, p_cancel_handover_ids);
  select code into v_receipt_code from public.material_receipts where id = p_id;

  for v_line in
    select value from jsonb_array_elements(p_lines)
    order by (value->>'sortOrder')::integer nulls last
  loop
    v_line_id := nullif(v_line->>'lineId', '')::uuid;
    if v_line_id is null then
      select line.id into v_line_id
      from public.material_receipt_lines line
      where line.receipt_id = p_id and line.sort_order = v_sort;
    end if;
    select * into v_line_record
    from public.material_receipt_lines line
    where line.id = v_line_id and line.receipt_id = p_id
    for update;
    if not found then
      raise exception 'Receipt line could not be matched while applying specifications' using errcode='40001';
    end if;

    v_overrides := coalesce(v_line->'specificationOverrides', '{}'::jsonb);
    v_labels := coalesce(v_line->'specificationOverrideLabels', '{}'::jsonb);
    if not private.receipt_line_specification_overrides_valid(v_line_record.model_id, v_overrides) then
      raise exception 'A receipt line contains an invalid material specification' using errcode='22023';
    end if;
    if not private.receipt_line_specification_override_labels_valid(
      v_line_record.model_id, v_overrides, v_labels) then
      raise exception 'A receipt line contains invalid specification labels' using errcode='22023';
    end if;
    v_specifications_changed :=
      v_line_record.specification_overrides is distinct from v_overrides
      or v_line_record.specification_override_labels is distinct from v_labels;
    update public.material_receipt_lines
    set specification_overrides = v_overrides,
        specification_override_labels = v_labels,
        updated_at = timezone('utc', now())
    where id = v_line_record.id;

    for v_item in
      select item.id as receipt_item_id, item.material_id
      from public.material_receipt_items item
      where item.line_id = v_line_record.id
        and item.status = 'active'
        and item.material_id is not null
      order by item.id
      for update
    loop
      if v_specifications_changed and exists (
        select 1
        from public.material_handover_items handover_item
        join public.material_handovers handover on handover.id = handover_item.handover_id
        where handover_item.material_id = v_item.material_id
          and handover.status = 'completed'
          and exists (
            select 1 from public.materials material
            where material.id = v_item.material_id
              and (
                material.specification_overrides is distinct from v_overrides
                or material.specification_override_labels is distinct from v_labels
              )
          )
      ) then
        raise exception 'A material with completed handover history cannot have its specification rewritten' using errcode='55000';
      end if;
      if v_specifications_changed and exists (
        select 1 from public.materials material
        where material.id = v_item.material_id
          and (
            material.specification_overrides is distinct from v_overrides
            or material.specification_override_labels is distinct from v_labels
          )
      ) then
        select public.material_json(v_item.material_id) into v_before;
        update public.materials
        set specification_overrides = v_overrides,
            specification_override_labels = v_labels,
            version = version + 1,
            updated_at = timezone('utc', now())
        where id = v_item.material_id;
        v_after := public.material_json(v_item.material_id);
        update public.material_receipt_items
        set material_snapshot = v_after,
            updated_at = timezone('utc', now())
        where id = v_item.receipt_item_id;
        insert into public.material_history(
          material_id, actor_user_id, action, note, from_state, to_state)
        values(
          v_item.material_id, auth.uid(), 'updated',
          'Điều chỉnh thông số theo phiếu nhập ' || v_receipt_code || ': ' || btrim(p_reason),
          v_before, v_after);
      end if;
    end loop;
    v_sort := v_sort + 1;
  end loop;

  select history.id into v_history_id
  from public.material_receipt_history history
  where history.receipt_id = p_id
  order by history.created_at desc, history.id desc
  limit 1;
  if v_history_id is not null then
    update public.material_receipt_history
    set after_state = public.material_receipt_json(p_id)
    where id = v_history_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.apply_material_receipt_adjustment(
  uuid, integer, text, jsonb, text, jsonb) from public, anon;
grant execute on function public.apply_material_receipt_adjustment(
  uuid, integer, text, jsonb, text, jsonb) to authenticated;
