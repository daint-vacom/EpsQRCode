-- Run against the isolated development database after applying the inspection migrations.
-- Requires an active system admin mapped to an EPS employee with a managed party.
begin;

do $$
declare
  v_actor uuid;
  v_party uuid;
  v_root uuid := gen_random_uuid();
  v_root_model uuid := gen_random_uuid();
  v_root_material uuid := gen_random_uuid();
  v_code text := 'INSPECTION-SMOKE-' || gen_random_uuid();
  v_type uuid := gen_random_uuid();
  v_group_a uuid := gen_random_uuid();
  v_group_b uuid := gen_random_uuid();
  v_model_a uuid := gen_random_uuid();
  v_model_b uuid := gen_random_uuid();
  v_material_a uuid := gen_random_uuid();
  v_material_b uuid := gen_random_uuid();
  v_draft uuid;
  v_checklist jsonb := '[{"id":"81000000-0000-4000-8000-000000000001","name":"Quarter","criteria":[{"id":"82000000-0000-4000-8000-000000000001","content":"Smoke criterion"}]}]';
  v_summary jsonb;
  v_second_type uuid := gen_random_uuid();
begin
  select profile.id into strict v_actor
  from public.user_profiles profile
  join public.user_roles assignment on assignment.user_id = profile.id
  join public.roles role on role.id = assignment.role_id
  where profile.status = 'active' and profile.account_type = 'eps'
    and role.is_active and role.is_system and role.grant_all_permissions
  order by profile.id limit 1;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_actor, 'role', 'authenticated')::text, true);

  select party.id into strict v_party
  from public.material_custodians party
  where party.is_active
    and public.has_scoped_permission('materials:material:manage', party.id)
    and public.has_scoped_permission('materials:material:view', party.id)
  order by party.id limit 1;

  insert into public.material_groups(id, code, name)
  values (v_root, v_code, 'Inspection smoke test');
  insert into public.material_models(id, code, name, group_id)
  values (v_root_model, v_code, 'Inspection smoke test', v_root);
  insert into public.materials(id, code, model_id, model_snapshot, owner_party_id)
  values (v_root_material, v_code, v_root_model, public.material_model_snapshot(v_root_model), v_party);

  insert into public.material_groups(id,code,name,parent_id) values
    (v_group_a,v_code || '-A','Preview A',v_root),
    (v_group_b,v_code || '-B','Preview B',v_root);
  insert into public.material_models(id,code,name,group_id) values
    (v_model_a,v_code || '-A','Preview A',v_group_a),
    (v_model_b,v_code || '-B','Preview B',v_group_b);
  insert into public.materials(id,code,model_id,model_snapshot,owner_party_id) values
    (v_material_a,v_code || '-A',v_model_a,public.material_model_snapshot(v_model_a),v_party),
    (v_material_b,v_code || '-B',v_model_b,public.material_model_snapshot(v_model_b),v_party);
  perform public.save_material_safety_inspection_type_config('group',v_root,v_type,'Preview quarterly',v_checklist,'replace',1,'month',true,date '2026-01-31');
  if (select count(*) from public.material_safety_inspection_schedules where type_id=v_type and due_date=date '2026-01-31') <> 3 then
    raise exception 'Inherited type did not initialize 3 schedules';
  end if;
  perform public.save_material_safety_inspection_type_config('group',v_root,v_type,'Preview quarterly',v_checklist,'replace',2,'month',true,date '2026-01-31');
  if (select count(*) from public.material_safety_inspection_schedules where type_id=v_type and due_date=date '2026-01-31') <> 3 then
    raise exception 'Default update changed current due dates';
  end if;
  perform public.save_material_safety_inspection_type_config('group',v_group_a,v_type,null,null,'replace',4,'month',null,null);
  if (select name from private.effective_material_safety_inspection_types(v_material_a) where type_id=v_type)
      is distinct from 'Preview quarterly' then
    raise exception 'Lower cadence override changed inherited name';
  end if;
  v_summary := public.preview_material_safety_inspection_due_dates('group',v_root,v_type,3,'month');
  if v_summary->>'total' is distinct from '2'
    or exists(select 1 from jsonb_array_elements(v_summary->'items') item
      where item->>'materialId'=v_material_a::text or item->>'newDueDate'<>'2026-04-30') then
    raise exception 'Incorrect preview scope or deadline %', v_summary;
  end if;
  update public.material_safety_inspection_schedules set due_date=date '2026-02-01'
    where material_id=v_material_b and type_id=v_type;
  begin
    perform public.save_material_safety_inspection_type_config('group',v_root,v_type,'Preview quarterly',v_checklist,'replace',3,'month',true,date '2026-01-31',true,v_summary->>'token');
    raise exception 'Stale preview accepted';
  exception when serialization_failure then
    null;
  end;
  v_summary := public.preview_material_safety_inspection_due_dates('group',v_root,v_type,3,'month');
  perform public.save_material_safety_inspection_type_config('group',v_root,v_type,'Preview quarterly',v_checklist,'replace',3,'month',true,date '2026-01-31',true,v_summary->>'token');
  if (select count(*) from public.material_safety_inspection_schedules where type_id=v_type and due_date=date '2026-04-30' and material_id in (v_root_material,v_material_b)) <> 2
     or (select due_date from public.material_safety_inspection_schedules where type_id=v_type and material_id=v_material_a) is distinct from date '2026-01-31' then
    raise exception 'Recalculation changed the wrong rows';
  end if;
  perform public.save_material_safety_inspection_type_config(
    'model', v_model_a, v_second_type, 'Second checklist', v_checklist,
    'replace', 1, 'quarter', true, date '2026-03-31');
  v_draft := public.start_material_safety_inspection_draft(v_material_a,v_type,'Inspection Smoke','2026-02-28T12:00:00+07:00');
  if (select due_date from public.material_safety_inspection_schedules where type_id=v_type and material_id=v_material_a) is distinct from date '2026-01-31' then
    raise exception 'Draft changed due date';
  end if;
  update public.material_safety_inspections set status='completed',overall_result='passed', checklist_result=jsonb_set(checklist_result,'{0,criteria,0,passed}','true')
    where id=v_draft;
  if (select due_date from public.material_safety_inspection_schedules where type_id=v_type and material_id=v_material_a) is distinct from date '2026-06-28' then
    raise exception 'Completion did not apply the effective 4-month cadence';
  end if;
  if (select due_date from public.material_safety_inspection_schedules
      where type_id = v_second_type and material_id = v_material_a) is distinct from date '2026-03-31' then
    raise exception 'Completion changed another type on the same material';
  end if;
  if (select due_date from public.material_safety_inspection_schedules where type_id=v_type and material_id=v_material_b) is distinct from date '2026-04-30' then
    raise exception 'Completion changed another material schedule';
  end if;
  perform public.save_material_safety_inspection_type_config(
    'material', v_material_a, v_type, null, null, 'replace', 6, 'month', null, null);
  if (select interval_value from private.effective_material_safety_inspection_types(v_material_a)
      where type_id = v_type) is distinct from 6 then
    raise exception 'Material cadence override did not win';
  end if;

  perform public.save_material_safety_inspection_type_config(
    'material', v_material_a, v_second_type, null, null, 'replace', null, null,
    null, date '2026-04-15');
  if (select due_date from public.material_safety_inspection_schedules
      where material_id = v_material_a and type_id = v_second_type) is distinct from date '2026-04-15' then
    raise exception 'Explicit first due date was not applied for the material';
  end if;

  if private.add_safety_inspection_interval(date '2026-12-31', 1, 'quarter') <> date '2027-03-31' then
    raise exception 'Quarter schedule did not roll over to the next year';
  end if;

  if has_table_privilege('authenticated', 'public.material_safety_inspections', 'INSERT')
    or has_table_privilege('authenticated', 'public.material_safety_inspection_type_configs', 'UPDATE') then
    raise exception 'Inspection data can bypass its RPC write contract';
  end if;

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform public.preview_material_safety_inspection_due_dates('group', v_root, v_type, 3, 'month');
    raise exception 'Unauthorised actor could preview material due dates';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
