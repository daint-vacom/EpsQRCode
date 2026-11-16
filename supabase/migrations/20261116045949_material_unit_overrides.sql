-- Keep the selected model's unit as the initial value, then allow each
-- material/receipt representative to save its own unit in model_snapshot.
update public.material_receipt_representatives representative
set material_values = representative.material_values || jsonb_build_object(
  'unit', coalesce(
    (
      select material.model_snapshot ->> 'unit'
      from public.material_receipt_items item
      join public.materials material on material.id = item.material_id
      where item.representative_id = representative.id
      order by item.sort_order, item.id
      limit 1
    ),
    (
      select model.unit
      from public.material_receipt_lines line
      join public.material_models model on model.id = line.model_id
      where line.id = representative.line_id
    ),
    (
      select line.proposed_model ->> 'unit'
      from public.material_receipt_lines line
      where line.id = representative.line_id
    ),
    ''
  )
)
where jsonb_typeof(representative.material_values -> 'unit') is distinct from 'string';

alter function private.apply_material_receipt_representative(uuid, uuid)
  rename to apply_material_receipt_representative_base;
revoke all on function private.apply_material_receipt_representative_base(uuid, uuid)
  from public, anon, authenticated;

create function private.apply_material_receipt_representative(
  p_representative_id uuid,
  p_material_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit text;
begin
  perform private.apply_material_receipt_representative_base(
    p_representative_id,
    p_material_id
  );
  select coalesce(representative.material_values ->> 'unit', '')
  into v_unit
  from public.material_receipt_representatives representative
  where representative.id = p_representative_id;
  update public.materials material
  set model_snapshot = jsonb_set(
    material.model_snapshot,
    '{unit}',
    to_jsonb(coalesce(v_unit, '')),
    true
  )
  where material.id = p_material_id;
end;
$$;
revoke all on function private.apply_material_receipt_representative(uuid, uuid)
  from public, anon, authenticated;

create or replace function private.create_material_receipt_representative()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_warehouse_id uuid;
  v_unit text;
begin
  select receipt.warehouse_id into v_warehouse_id
  from public.material_receipts receipt
  where receipt.id = new.receipt_id;
  select coalesce(model.unit, '') into v_unit
  from public.material_models model
  where model.id = new.model_id;
  insert into public.material_receipt_representatives(
    receipt_id, line_id, model_id, material_values
  )
  values (
    new.receipt_id, new.id, new.model_id,
    jsonb_build_object(
      'code', 'REPRESENTATIVE', 'modelId', new.model_id,
      'ownerPartyId', v_warehouse_id,
      'unit', coalesce(v_unit, ''),
      'specificationOverrides', new.specification_overrides,
      'specificationOverrideLabels', new.specification_override_labels
    )
  )
  on conflict (line_id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_material_receipt_representative()
  from public, anon, authenticated;

create or replace function private.validate_material_receipt_representative_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(new.material_values -> 'unit') is distinct from 'string' then
    raise exception 'Representative unit must be text' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_material_receipt_representative_unit()
  from public, anon, authenticated;

create trigger material_receipt_representative_unit_guard
before insert or update of material_values on public.material_receipt_representatives
for each row execute function private.validate_material_receipt_representative_unit();

alter function public.save_material_with_inspection_settings(
  uuid, integer, jsonb, jsonb, jsonb
) rename to save_material_with_inspection_settings_base;
revoke all on function public.save_material_with_inspection_settings_base(
  uuid, integer, jsonb, jsonb, jsonb
) from public, anon, authenticated;

create function public.save_material_with_inspection_settings(
  p_id uuid,
  p_expected_version integer,
  p_values jsonb,
  p_public_display_settings jsonb,
  p_public_specification_settings jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material_id uuid;
begin
  if jsonb_typeof(p_values -> 'unit') is distinct from 'string' then
    raise exception 'Material unit must be text' using errcode = '22023';
  end if;
  v_material_id := public.save_material_with_inspection_settings_base(
    p_id,
    p_expected_version,
    p_values,
    p_public_display_settings,
    p_public_specification_settings
  );
  update public.materials material
  set model_snapshot = jsonb_set(
    material.model_snapshot,
    '{unit}',
    to_jsonb(btrim(p_values ->> 'unit')),
    true
  )
  where material.id = v_material_id;
  update public.material_history history
  set to_state = public.material_json(v_material_id)
  where history.id = (
    select latest.id
    from public.material_history latest
    where latest.material_id = v_material_id
    order by latest.created_at desc, latest.id desc
    limit 1
  );
  return v_material_id;
end;
$$;
revoke all on function public.save_material_with_inspection_settings(
  uuid, integer, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.save_material_with_inspection_settings(
  uuid, integer, jsonb, jsonb, jsonb
) to authenticated;

notify pgrst, 'reload schema';
