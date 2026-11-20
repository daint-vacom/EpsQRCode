-- End-to-end receipt import and ownership workflow. All fixtures are rolled back.
begin;

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  w uuid := gen_random_uuid();
  b_party uuid;
  c_party uuid;
  g uuid := gen_random_uuid();
  m uuid := gen_random_uuid();
  eps_department text := gen_random_uuid()::text;
  req uuid := gen_random_uuid();
  r uuid;
  h1 uuid;
  h2 uuid;
  reserved_material uuid;
  vals jsonb;
  vals_without_images jsonb;
  baseline bigint;
  results jsonb;
  model_code text := 'SMOKE-' || gen_random_uuid();
  staged_path text;
begin
  insert into auth.users(id,email) values (a,a::text || '@example.test'),(b,b::text || '@example.test'),(c,c::text || '@example.test'),(outsider,outsider::text || '@example.test');
  update public.user_profiles set status='active' where id in (a,b,c,outsider);
  insert into private.fake_eps_departments(id,code,name)
  values(eps_department,eps_department,'Test receiving department');
  insert into private.fake_eps_employees(id,employee_code,first_name,department_id)
  values (b::text,b::text,'Receiver B',eps_department),
         (c::text,c::text,'Receiver C',eps_department);
  update public.user_profiles set account_type='eps',eps_employee_id=id::text where id in (b,c);
  insert into public.user_roles(user_id,role_id) select u.id,role.id from unnest(array[a,b,c,outsider]) u(id) cross join public.roles role where role.code='system_admin';
  insert into public.role_permissions(role_id,permission_code,scope)
  select id,'materials:material:view','assigned_warehouses' from public.roles where code='system_admin'
  on conflict (role_id,permission_code) do update set scope=excluded.scope;
  insert into public.role_permissions(role_id,permission_code,scope)
  select id,'materials:handover:manage','all' from public.roles where code='system_admin'
  on conflict (role_id,permission_code) do update set scope=excluded.scope;
  insert into public.material_custodians(id,type,code,name) values(w,'warehouse','W-' || w,'Warehouse');
  select id into strict b_party from public.material_custodians where source_type='eps_person' and source_id=b::text;
  select id into strict c_party from public.material_custodians where source_type='eps_person' and source_id=c::text;
  insert into public.material_warehouses(custodian_id) values(w);
  insert into public.material_warehouse_accounts values(w,a);
  insert into public.material_groups(id,code,name) values(g,'G-' || g,'Test group');
  insert into public.material_models(id,code,name,group_id) values(m,model_code,'Test model',g);
  perform set_config('request.jwt.claim.sub',a::text,true);
  staged_path := format('parties/%s/objects/receipt-imports/%s/%s/line0-image0-photo.png', w, a, req);
  assert private.can_use_material_receipt_import_staging(staged_path, true), 'warehouse manager can stage an image';
  assert not private.can_use_material_receipt_import_staging(
    replace(staged_path, a::text, outsider::text), true
  ), 'warehouse manager cannot use another uploader path';
  insert into storage.objects(bucket_id,name) values('material-images',staged_path);
  assert exists(
    select from jsonb_array_elements(public.list_material_receipt_recipient_options(null)) recipient
    where recipient->>'id'=b_party::text
  ), 'warehouse manager can resolve recipients before selecting a warehouse';
  vals := jsonb_build_object(
    'warehouseId', w,
    'lines', jsonb_build_array(
      jsonb_build_object(
        'sortOrder', 0, 'modelId', m, 'quantity', 2, 'receivingPartyId', b_party,
        'representative', jsonb_build_object(
          'materialValues', jsonb_build_object(
            'modelId', m, 'nameOverride', 'Imported custom name', 'unit', 'piece',
            'ownerPartyId', w, 'unitPriceOverride', 125, 'placedIntoServiceDate', '2025-01-15'
          ),
          'images', jsonb_build_array(jsonb_build_object(
            'storageBucket', 'material-images', 'storagePath', staged_path,
            'isCover', true, 'sortOrder', 0
          ))
        ),
        'items', jsonb_build_array(
          jsonb_build_object(
            'code', model_code || '-002',
            'linkedCodes', jsonb_build_array(jsonb_build_object('label','ERP','value','ERP-001'))
          ),
          jsonb_build_object()
        )
      ),
      jsonb_build_object(
        'sortOrder', 1, 'modelId', m, 'quantity', 1, 'receivingPartyId', c_party,
        'items', jsonb_build_array(jsonb_build_object())
      ),
      jsonb_build_object(
        'sortOrder', 2, 'modelId', m, 'quantity', 1,
        'representative', jsonb_build_object(
          'materialValues', jsonb_build_object('modelId',m,'unit','piece','isActive',false),
          'images', '[]'::jsonb
        ),
        'items', jsonb_build_array(jsonb_build_object())
      )
    )
  );
  vals_without_images := jsonb_set(vals, '{lines,0,representative,images}', '[]'::jsonb);
  select count(*) into baseline from public.material_receipts;
  begin
    perform public.import_material_receipt_from_excel(
      gen_random_uuid(),
      jsonb_set(vals_without_images,'{lines,1,receivingPartyId}',to_jsonb(gen_random_uuid()))
    );
    raise exception 'invalid recipient accepted';
  exception when invalid_parameter_value then null;
  end;
  assert (select count(*) from public.material_receipts)=baseline, 'invalid recipient rolled back';
  begin
    perform public.import_material_receipt_from_excel(
      req,
      jsonb_set(
        vals, '{lines,0,representative,images,0,storagePath}',
        to_jsonb(replace(staged_path, a::text, outsider::text))
      )
    );
    raise exception 'an unauthorized image path was accepted';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.material_receipts)=baseline, 'unauthorized image rolled back';
  r := public.import_material_receipt_from_excel(req,vals);
  assert not private.can_use_material_receipt_import_staging(staged_path, true),
    'attached image is outside staging access';
  begin
    perform public.import_material_receipt_from_excel(gen_random_uuid(),vals_without_images);
    raise exception 'existing warehouse code was accepted';
  exception when unique_violation then null;
  end;
  assert (select count(*) from public.material_receipts)=baseline+1, 'duplicate code rolled back';
  begin
    perform public.import_material_receipt_from_excel(req,vals||'{"note":"changed"}'::jsonb);
    raise exception 'changed request accepted';
  exception when unique_violation then null;
  end;
  assert r = public.import_material_receipt_from_excel(req,vals), 'same request returns receipt';
  assert (select count(*) from public.materials where owner_party_id=w) = 4, '4 new warehouse materials';
  assert (public.list_materials(jsonb_build_object('modelId',m))->>'total')::integer = 0, 'default list excludes warehouse';
  assert (public.list_materials(jsonb_build_object('modelId',m,'ownerKind','warehouse'))->>'total')::integer = 4, 'warehouse list includes warehouse';
  assert exists(select from public.materials where owner_party_id=w and code=model_code || '-002' and linked_codes @> '[{"label":"ERP","value":"ERP-001"}]'::jsonb), 'imported code and linked code';
  assert exists(select from public.materials where owner_party_id=w and name_override='Imported custom name' and unit_price_override=125 and placed_into_service_date='2025-01-15'), 'representative profile';
  assert public.material_receipt_json(r) #>> '{lines,0,receivingPartyId}' = b_party::text, 'recipient survives reload';
  assert public.material_receipt_json(r) #>> '{lines,0,items,0,material,code}' = model_code || '-002', 'material snapshot survives reload';
  assert (select count(*) from public.material_handovers where receipt_id=r and status='pending')=2, 'two pending handovers';
  assert (select count(*) from public.materials where owner_party_id=w and reservation_status='pending')=3, 'three reserved';
  select id into strict h1 from public.material_handovers where receipt_id=r and recipient_party_id=b_party;
  select id into strict h2 from public.material_handovers where receipt_id=r and recipient_party_id=c_party;
  select material_id into reserved_material
  from public.material_handover_items where handover_id=h1 order by material_id limit 1;
  begin
    perform public.save_warehouse_handover(null, jsonb_build_object(
      'mode','warehouse_allocation','warehouseId',w,'recipientPartyId',c_party,'receiptId',r,
      'items',jsonb_build_array(jsonb_build_object('materialId',reserved_material))
    ));
    raise exception 'a pending material was reserved twice';
  exception when object_not_in_prerequisite_state then null;
  end;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.list_material_receipt_recipient_options(null);
    raise exception 'outsider loaded the recipient directory';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.import_material_receipt_from_excel(gen_random_uuid(),vals);
    raise exception 'outsider imported into the warehouse';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.act_on_warehouse_handover(h1,'confirm',2,null,'[]'::jsonb);
    raise exception 'outsider confirmation succeeded';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',b::text,true);
  select jsonb_agg(jsonb_build_object('materialId',material_id,'outcome','received','condition','good')) into results from public.material_handover_items where handover_id=h1;
  perform public.act_on_warehouse_handover(h1,'confirm',2,null,results);
  assert (select count(*) from public.materials where owner_party_id=b_party)=2, 'receiver B owns two';
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform public.act_material_receipt(r,'complete',(select version from public.material_receipts where id=r),null);
  assert (public.material_receipt_json(r)->>'pendingAllocationItems')::integer=1, 'one pending at close';
  select material.id into strict reserved_material
  from public.materials material
  where material.owner_party_id=w and material.reserved_handover_id is null;
  begin
    perform public.save_warehouse_handover(null, jsonb_build_object(
      'mode','warehouse_allocation','warehouseId',w,'recipientPartyId',c_party,'receiptId',r,
      'items',jsonb_build_array(jsonb_build_object('materialId',reserved_material))
    ));
    raise exception 'completed receipt allowed another allocation';
  exception when object_not_in_prerequisite_state then null;
  end;
  perform set_config('request.jwt.claim.sub',c::text,true);
  select jsonb_agg(jsonb_build_object('materialId',material_id,'outcome','received','condition','good')) into results from public.material_handover_items where handover_id=h2;
  perform public.act_on_warehouse_handover(h2,'confirm',2,null,results);
  assert (select count(*) from public.materials where owner_party_id=c_party)=1, 'receiver C owns one after close';
  assert (select count(*) from public.materials where owner_party_id=w)=1, 'one remains in warehouse';
  assert exists(select from public.materials where owner_party_id=w and not is_active),
    'Excel availability is preserved for the warehouse remainder';
  update public.role_permissions permission
  set scope='all'
  from public.roles role
  where role.code='system_admin' and permission.role_id=role.id
    and permission.permission_code='materials:material:view';
  assert (public.list_materials(jsonb_build_object('modelId',m))->>'total')::integer = 3, 'EPS list sees received materials';
  update public.role_permissions permission
  set scope='assigned_warehouses'
  from public.roles role
  where role.code='system_admin' and permission.role_id=role.id
    and permission.permission_code='materials:material:view';
  perform set_config('request.jwt.claim.sub',a::text,true);
  assert (public.list_materials(jsonb_build_object('modelId',m,'ownerKind','warehouse'))->>'total')::integer = 1, 'warehouse list sees remainder';

  vals := jsonb_set(vals, '{lines}', jsonb_build_array(vals->'lines'->1));
  r := public.import_material_receipt_from_excel(gen_random_uuid(), vals);
  select id into strict h2 from public.material_handovers where receipt_id=r;
  perform public.act_on_warehouse_handover(h2,'cancel',2,'Cancelled during test','[]'::jsonb);
  assert exists(
    select 1 from public.material_receipt_items item
    join public.materials material on material.id=item.material_id
    where item.receipt_id=r and material.owner_party_id=w and material.reserved_handover_id is null
  ), 'cancellation releases warehouse material';
end
$$;



rollback;
