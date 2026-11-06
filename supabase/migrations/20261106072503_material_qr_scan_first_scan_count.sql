-- Count the first recorded QR visit as a scan as well as subsequent visits.

create or replace function public.record_material_qr_scan(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_can_record boolean := false;
begin
  if auth.uid() is null then
    select exists (
      select 1
      from public.materials material
      where material.id = p_id
        and material.is_active
        and material.public_display_settings ->> 'basicInfo' = 'true'
    ) into v_can_record;
  else
    select exists (
      select 1
      from public.materials material
      where material.id = p_id
        and material.is_active
        and (
          material.public_display_settings ->> 'basicInfo' = 'true'
          or (
            public.has_permission('materials:material:view')
            and public.can_view_material_current(material.id)
          )
        )
    ) into v_can_record;
  end if;

  if not v_can_record then
    return false;
  end if;

  insert into public.material_qr_scan_counts as current_count
    (material_id, scan_count)
  values (p_id, 1)
  on conflict (material_id) do update
    set scan_count = current_count.scan_count + 1,
        updated_at = timezone('utc', now());

  return true;
end;
$$;
