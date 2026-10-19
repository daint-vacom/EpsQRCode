-- Authorization and optimistic concurrency checks for the materials domain.
-- Run on the isolated EpsQRCode development project; all fixtures roll back.
begin;

do $setup$
declare
  v_actor uuid;
  v_model uuid;
  v_party uuid;
  v_unrepresented uuid;
  v_material uuid;
begin
  select ur.user_id into strict v_actor
  from public.user_roles ur
  join public.roles r on r.id=ur.role_id
  where r.is_active and r.is_system and r.grant_all_permissions
  order by ur.created_at,ur.user_id limit 1;
  select id into strict v_model from public.material_models where is_active order by id limit 1;

  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);

  v_party:=public.save_custodian(null,jsonb_build_object(
    'type','department','code','AUTH-'||gen_random_uuid(),'name','Party đại diện',
    'representativeUserId',v_actor,'isActive',true));
  v_unrepresented:=public.save_custodian(null,jsonb_build_object(
    'type','external','code','AUTH-'||gen_random_uuid(),'name','Party không đại diện','isActive',true));
  v_material:=public.save_material(null,null,jsonb_build_object(
    'code','AUTH-'||gen_random_uuid(),'modelId',v_model,'ownerPartyId',v_party,
    'condition','good','conditionNote','','specificationOverrides','{}'::jsonb));

  perform set_config('test.actor_id',v_actor::text,true);
  perform set_config('test.party_id',v_party::text,true);
  perform set_config('test.unrepresented_party_id',v_unrepresented::text,true);
  perform set_config('test.material_id',v_material::text,true);

end;
$setup$;

set local role authenticated;
do $authenticated_tests$
declare
  v_actor uuid:=current_setting('test.actor_id')::uuid;
  v_material uuid:=current_setting('test.material_id')::uuid;
  v_party uuid:=current_setting('test.party_id')::uuid;
  v_unrepresented uuid:=current_setting('test.unrepresented_party_id')::uuid;
  v_model uuid;
  v_values jsonb;
  v_rejected boolean;
begin
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);

  select model_id into strict v_model from public.materials where id=v_material;
  v_values:=jsonb_build_object('code',(select code from public.materials where id=v_material),
    'modelId',v_model,'ownerPartyId',v_party,'condition','good','conditionNote','',
    'specificationOverrides','{}'::jsonb);

  v_rejected:=false;
  begin
    perform public.save_material(null,null,v_values||jsonb_build_object('code','AUTH-NONREP','ownerPartyId',v_unrepresented));
  exception when insufficient_privilege then v_rejected:=true;
  end;
  assert v_rejected, 'A permitted manager who does not represent the owner cannot create its material';

  v_rejected:=false;
  begin
    perform public.save_material(v_material,0,v_values);
  exception when sqlstate '40001' then v_rejected:=true;
  end;
  assert v_rejected, 'A stale material version must be rejected';

  v_rejected:=false;
  begin
    perform public.save_material(v_material,1,v_values||jsonb_build_object('code','AUTH-RECODE'));
  exception when sqlstate '22023' then v_rejected:=true;
  end;
  assert v_rejected, 'A material code cannot be changed after creation';

end;
$authenticated_tests$;

-- Remove the fixture actor's grants under the postgres test session. The enclosing
-- transaction rolls these changes back, while the RPC check still runs as authenticated.
set local role postgres;
delete from public.user_permission_overrides where user_id=current_setting('test.actor_id')::uuid;
delete from public.user_roles where user_id=current_setting('test.actor_id')::uuid;

set local role authenticated;
do $no_permission_test$
declare v_rejected boolean:=false; v_actor uuid:=current_setting('test.actor_id')::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  begin
    perform public.get_material(current_setting('test.material_id')::uuid);
  exception when insufficient_privilege then v_rejected:=true;
  end;
  assert v_rejected, 'An authenticated account without material view permission cannot read materials';
end $no_permission_test$;

set local role anon;
do $anonymous_test$
declare v_rejected boolean:=false;
begin
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  begin
    perform public.get_material(current_setting('test.material_id')::uuid);
  exception when insufficient_privilege then v_rejected:=true;
  end;
  assert v_rejected, 'Anonymous callers cannot execute protected material RPCs';
end;
$anonymous_test$;

rollback;
