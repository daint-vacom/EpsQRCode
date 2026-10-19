alter table public.material_models
  add column if not exists requires_inspection boolean not null default false;

create or replace function public.save_material_model(
  p_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_requires_inspection boolean,
  p_images jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_model_id uuid;
begin
  v_model_id := public.save_material_model(
    p_id,
    p_code,
    p_name,
    p_description,
    p_images
  );

  update public.material_models
  set requires_inspection = p_requires_inspection
  where id = v_model_id;

  return v_model_id;
end;
$$;

revoke all on function public.save_material_model(uuid, text, text, text, boolean, jsonb)
  from public, anon;
grant execute on function public.save_material_model(uuid, text, text, text, boolean, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
