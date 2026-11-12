create or replace function private.material_dashboard_model_snapshot(
  p_model_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('materials:material:view') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.materials material
    where material.model_id = p_model_id
      and material.is_active
      and public.can_view_material_current(material.id)
  ) then
    raise exception 'Material model is not accessible' using errcode = '42501';
  end if;

  return public.material_model_snapshot(p_model_id);
end;
$function$;

revoke all on function private.material_dashboard_model_snapshot(uuid) from public, anon;
grant execute on function private.material_dashboard_model_snapshot(uuid) to authenticated;

do $migration$
declare
  v_definition text;
  v_original_call constant text := 'public.material_model_snapshot(model_ids.model_id)';
begin
  v_definition := pg_catalog.pg_get_functiondef(
    'public.get_material_dashboard_summary(date)'::pg_catalog.regprocedure
  );

  if pg_catalog.strpos(v_definition, v_original_call) = 0 then
    raise exception 'Dashboard summary model lookup was not found';
  end if;

  v_definition := pg_catalog.replace(
    v_definition,
    v_original_call,
    'private.material_dashboard_model_snapshot(model_ids.model_id)'
  );
  execute v_definition;
end;
$migration$;
