create or replace function public.delete_material(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material public.materials%rowtype;
begin
  if auth.uid() is null
    or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode = '42501';
  end if;

  select * into v_material
  from public.materials
  where id = p_id
  for update;
  if not found then
    raise exception 'Material not found' using errcode = 'P0002';
  end if;

  if v_material.reserved_handover_id is not null
    or v_material.active_loan_handover_id is not null
    or exists (
      select 1
      from public.material_handover_items
      where material_id = p_id
    ) then
    raise exception 'Không thể xóa vật tư đã phát sinh phiếu bàn giao'
      using errcode = '55000';
  end if;

  -- Preserve completed handover history by refusing deletion above. For an
  -- unused material, remove its creation/edit history along with the record.
  delete from public.material_history where material_id = p_id;
  delete from public.materials where id = p_id;
end;
$$;

revoke all on function public.delete_material(uuid) from public, anon;
grant execute on function public.delete_material(uuid) to authenticated;

notify pgrst, 'reload schema';
