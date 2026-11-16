create or replace function public.apply_material_model_sync(
  p_id uuid,
  p_expected_version integer,
  p_expected_model_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.materials%rowtype;
  v_before jsonb;
  v_new jsonb;
  v_all_specifications jsonb;
  v_new_overrides jsonb := '{}'::jsonb;
  v_key text;
  v_specification jsonb;
  v_owner_scope uuid;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode = '42501';
  end if;
  select * into v_row from public.materials where id = p_id for update;
  if not found then raise exception 'Material not found' using errcode = 'P0002'; end if;
  if v_row.version is distinct from p_expected_version then
    raise exception 'Material changed; reload before syncing' using errcode = '40001';
  end if;
  if p_expected_model_updated_at is null
    or (select model.updated_at from public.material_models model where model.id = v_row.model_id)
      is distinct from p_expected_model_updated_at then
    raise exception 'Model changed after preview; reload the sync preview' using errcode = '40001';
  end if;
  v_owner_scope := coalesce(v_row.owner_party_id,
    nullif(v_row.owner_snapshot->>'scopePartyId', '')::uuid);
  if not public.material_can_represent(v_owner_scope) then
    raise exception 'You must represent the owner party' using errcode = '42501';
  end if;
  if v_row.reserved_handover_id is not null then
    raise exception 'Material is reserved by an open handover' using errcode = '55000';
  end if;
  v_before := public.material_json(p_id);
  v_new := public.material_model_snapshot(v_row.model_id)
    || jsonb_build_object(
      'customSpecifications', coalesce(v_row.model_snapshot -> 'customSpecifications', '[]'::jsonb),
      'hiddenSpecificationIds', coalesce(v_row.model_snapshot -> 'hiddenSpecificationIds', '[]'::jsonb)
    );
  v_new := jsonb_set(
    v_new,
    '{unit}',
    case
      when jsonb_typeof(v_row.model_snapshot -> 'unit') = 'string'
        then v_row.model_snapshot -> 'unit'
      else coalesce(v_new -> 'unit', to_jsonb(''::text))
    end,
    true
  );
  v_all_specifications := coalesce(v_new -> 'specifications', '[]'::jsonb)
    || coalesce(v_new -> 'customSpecifications', '[]'::jsonb);
  for v_key in select jsonb_object_keys(v_row.specification_overrides) loop
    select specification.value into v_specification
    from jsonb_array_elements(v_all_specifications) specification(value)
    where specification.value->>'id' = v_key;
    if v_specification is null or not public.material_spec_override_is_valid(v_specification, v_row.specification_overrides->v_key) then
      raise exception 'The model removed or changed an overridden specification; resolve overrides before syncing' using errcode = '22023';
    end if;
    v_new_overrides := v_new_overrides || jsonb_build_object(v_key, v_row.specification_overrides->v_key);
  end loop;
  update public.materials set model_snapshot = v_new, specification_overrides = v_new_overrides,
    version = version + 1, updated_at = timezone('utc', now()) where id = p_id;
  insert into public.material_history(material_id, action, note, from_state, to_state)
  values (p_id, 'model_synced', 'Đồng bộ phiên bản mẫu vật tư', v_before, public.material_json(p_id));
  return p_id;
end;
$$;

notify pgrst, 'reload schema';
