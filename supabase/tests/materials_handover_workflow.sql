-- Run against the isolated EpsQRCode development project after the domain migration.
-- All fixtures and changes are rolled back. No passwords or access tokens required.
begin;

do $test$
declare
  v_actor uuid;
  v_model uuid;
  v_owner uuid;
  v_borrower uuid;
  v_other uuid;
  v_material uuid;
  v_second uuid;
  v_loan uuid;
  v_return uuid;
  v_transfer uuid;
  v_document jsonb;
  v_preview jsonb;
  v_material_json jsonb;
  v_values jsonb;
  v_rejected boolean;
  v_history_count bigint;
  v_snapshot_name text;
begin
  select ur.user_id into strict v_actor
  from public.user_roles ur join public.roles r on r.id=ur.role_id
  where r.is_active and r.is_system and r.grant_all_permissions limit 1;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  select id into strict v_model from public.material_models where is_active order by id limit 1;

  v_owner := public.save_custodian(null,jsonb_build_object('type','department','code','SMOKE-'||gen_random_uuid(),'name','Đơn vị thử A','representativeUserId',v_actor,'isActive',true));
  v_borrower := public.save_custodian(null,jsonb_build_object('type','team','code','SMOKE-'||gen_random_uuid(),'name','Đơn vị thử B','representativeUserId',v_actor,'isActive',true));
  v_other := public.save_custodian(null,jsonb_build_object('type','external','code','SMOKE-'||gen_random_uuid(),'name','Đơn vị thử C','representativeUserId',v_actor,'isActive',true));
  v_material := public.save_material(p_id => null,p_expected_version => null,p_values => jsonb_build_object(
    'code','SMOKE-'||gen_random_uuid(),'modelId',v_model,'ownerPartyId',v_owner,'condition','good',
    'specificationOverrides','{}'::jsonb,'conditionNote',''));
  v_second := public.save_material(p_id => null,p_expected_version => null,p_values => jsonb_build_object(
    'code','SMOKE-'||gen_random_uuid(),'modelId',v_model,'ownerPartyId',v_owner,'condition','good',
    'specificationOverrides','{}'::jsonb,'conditionNote',''));
  v_values := jsonb_build_object('type','loan','senderPartyId',v_owner,'recipientPartyId',v_borrower,
    'plannedDate',current_date,'dueDate',current_date+7,'attachmentFileIds','[]'::jsonb,
    'items',jsonb_build_array(jsonb_build_object('materialId',v_material,'condition','good','conditionNote','')));
  v_loan := public.save_handover(null,v_values);
  v_material_json := public.get_material(v_material);
  assert v_material_json->>'reservedHandoverId'=v_loan::text, 'Draft must reserve the material immediately';
  assert v_material_json->>'borrowerPartyId' is null, 'Draft must not change custody';

  v_rejected := false;
  begin
    perform public.save_handover(null,v_values);
  exception when others then
    v_rejected := true;
  end;
  assert v_rejected, 'Second draft must not reserve the same material';

  v_document := public.get_handover(v_loan);
  perform public.act_on_handover(v_loan,'send',(v_document->>'version')::integer,null);
  v_document := public.get_handover(v_loan);
  assert v_document->>'status'='pending', 'Send must enter pending';
  perform public.act_on_handover(v_loan,'confirm',(v_document->>'version')::integer,null);
  v_material_json := public.get_material(v_material);
  assert v_material_json->>'ownerPartyId'=v_owner::text, 'Loan must preserve owner';
  assert v_material_json->>'borrowerPartyId'=v_borrower::text, 'Loan must set borrower';
  assert v_material_json->>'reservedHandoverId' is null, 'Confirmation must release reservation';
  assert v_material_json->>'activeLoanHandoverId'=v_loan::text, 'Loan must retain source document';
  select count(*) into v_history_count from public.material_history where material_id=v_material;
  perform public.act_on_handover(v_loan,'confirm',(v_document->>'version')::integer,null);
  assert (select count(*) from public.material_history where material_id=v_material)=v_history_count,
    'Repeated confirmation must not append duplicate history';

  v_rejected := false;
  begin
    perform public.save_handover(null,jsonb_build_object('type','transfer','senderPartyId',v_owner,'recipientPartyId',v_other,
      'plannedDate',current_date,'items',jsonb_build_array(jsonb_build_object('materialId',v_material,'condition','good','conditionNote',''))));
  exception when others then v_rejected := true;
  end;
  assert v_rejected, 'Cannot transfer a borrowed material';

  v_return := public.save_handover(null,jsonb_build_object('type','return','senderPartyId',v_borrower,'recipientPartyId',v_owner,
    'plannedDate',current_date,'items',jsonb_build_array(jsonb_build_object('materialId',v_material,'condition','damaged','conditionNote','Vỏ bị nứt'))));
  v_document := public.get_handover(v_return);
  perform public.act_on_handover(v_return,'send',(v_document->>'version')::integer,null);
  v_document := public.get_handover(v_return);
  perform public.act_on_handover(v_return,'confirm',(v_document->>'version')::integer,null);
  v_material_json := public.get_material(v_material);
  assert v_material_json->>'borrowerPartyId' is null, 'Return clears borrower';
  assert v_material_json->>'activeLoanHandoverId' is null, 'Return closes current loan';
  assert v_material_json->>'condition'='damaged', 'Return records accepted damage';

  v_rejected := false;
  begin
    perform public.save_handover(null,jsonb_build_object('type','transfer','senderPartyId',v_owner,'recipientPartyId',v_other,
      'plannedDate',current_date,'items',jsonb_build_array(jsonb_build_object('materialId',v_material,'condition','damaged','conditionNote',''))));
  exception when others then v_rejected := true;
  end;
  assert v_rejected, 'Damage requires a note';

  v_transfer := public.save_handover(null,jsonb_build_object('type','transfer','senderPartyId',v_owner,'recipientPartyId',v_other,
    'plannedDate',current_date,'items',jsonb_build_array(jsonb_build_object('materialId',v_material,'condition','damaged','conditionNote','Chuyển về sửa chữa'))));
  v_document := public.get_handover(v_transfer);
  perform public.act_on_handover(v_transfer,'cancel',(v_document->>'version')::integer,'Hủy thử nghiệm');
  v_material_json := public.get_material(v_material);
  assert v_material_json->>'reservedHandoverId' is null, 'Cancel releases reservation';
  assert v_material_json->>'ownerPartyId'=v_owner::text, 'Cancel preserves owner';

  v_rejected := false;
  begin
    perform public.save_handover(null,jsonb_build_object('type','transfer','senderPartyId',v_owner,'recipientPartyId',v_other,
      'plannedDate',current_date,'items',jsonb_build_array(
        jsonb_build_object('materialId',v_second,'condition','good','conditionNote',''),
        jsonb_build_object('materialId',v_material,'condition','damaged','conditionNote',''))));
  exception when others then v_rejected := true;
  end;
  assert v_rejected, 'A bad row rejects the entire draft';
  assert public.get_material(v_second)->>'reservedHandoverId' is null, 'Bad draft must not leave a partial reservation';

  v_snapshot_name := v_material_json->'modelSnapshot'->>'name';
  update public.material_models set name=name||' (workflow smoke)' where id=v_model;
  v_material_json := public.get_material(v_material);
  assert v_material_json->'modelSnapshot'->>'name'=v_snapshot_name, 'Model edits must not cascade into existing materials';
  v_preview := public.preview_material_model_sync(v_material);
  perform public.apply_material_model_sync(v_material,(v_material_json->>'version')::integer,(v_preview->>'modelUpdatedAt')::timestamptz);
  v_material_json := public.get_material(v_material);
  assert v_material_json->'modelSnapshot'->>'name'=v_snapshot_name||' (workflow smoke)', 'Explicit sync updates the stored model';

  v_transfer := public.save_handover(null,jsonb_build_object('type','transfer','senderPartyId',v_owner,'recipientPartyId',v_other,
    'plannedDate',current_date,'items',jsonb_build_array(
      jsonb_build_object('materialId',v_second,'condition','good','conditionNote',''),
      jsonb_build_object('materialId',v_material,'condition','damaged','conditionNote','Bàn giao cả hai vật tư'))));
  v_document := public.get_handover(v_transfer);
  perform public.act_on_handover(v_transfer,'send',(v_document->>'version')::integer,null);
  v_document := public.get_handover(v_transfer);
  perform public.act_on_handover(v_transfer,'confirm',(v_document->>'version')::integer,null);
  assert public.get_material(v_material)->>'ownerPartyId'=v_other::text, 'Transfer updates first material owner';
  assert public.get_material(v_second)->>'ownerPartyId'=v_other::text, 'Transfer updates every material owner';
  update public.material_custodians set name='Tên mới sau bàn giao' where id=v_other;
  v_document := public.get_handover(v_transfer);
  assert v_document->'recipientParty'->>'name'='Đơn vị thử C', 'Completed documents preserve party names';
  v_rejected := false;
  begin
    perform public.save_handover(v_transfer,v_values);
  exception when others then v_rejected := true;
  end;
  assert v_rejected, 'Completed documents cannot be edited';

  raise notice 'PASS: draft reservations, loan/send/confirm, idempotency, return/damage, cancel, atomic transfer, model sync, immutable documents';
end;
$test$;

rollback;

