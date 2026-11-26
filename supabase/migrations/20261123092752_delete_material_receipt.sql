create or replace function public.delete_material_receipt(
  p_id uuid,
  p_expected_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.material_receipts%rowtype;
  v_material_ids uuid[];
begin
  if auth.uid() is null or not public.has_permission('materials:receipt:manage') then
    raise exception 'Permission denied to manage material receipts' using errcode = '42501';
  end if;

  select * into v_receipt
  from public.material_receipts
  where id = p_id
  for update;
  if not found then
    raise exception 'Material receipt not found' using errcode = 'P0002';
  end if;
  if not public.has_scoped_permission('materials:receipt:manage', v_receipt.warehouse_id) then
    raise exception 'Receipt is outside the permitted warehouse scope' using errcode = '42501';
  end if;
  if v_receipt.version is distinct from p_expected_version then
    raise exception 'Receipt changed; reload before deleting' using errcode = '40001';
  end if;

  select coalesce(array_agg(distinct item.material_id) filter (where item.material_id is not null), '{}'::uuid[])
  into v_material_ids
  from public.material_receipt_items item
  where item.receipt_id = p_id;

  perform material.id
  from public.materials material
  join public.material_receipt_items item on item.material_id = material.id
  where item.receipt_id = p_id
  for update of material;

  if exists (
    select 1
    from public.material_receipt_items item
    join public.material_safety_inspections inspection on inspection.material_id = item.material_id
    where item.receipt_id = p_id and item.material_id is not null
  ) then
    raise exception 'Không thể xóa vật tư trong phiếu nhập vì đã có phiếu kiểm định an toàn' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.material_receipt_items item
    join public.material_handover_items handover_item on handover_item.material_id = item.material_id
    join public.material_handovers handover on handover.id = handover_item.handover_id
    where item.receipt_id = p_id and handover.receipt_id is distinct from p_id
  ) then
    raise exception 'Không thể xóa vật tư vì đang được sử dụng trong phiếu bàn giao khác' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.material_handovers handover
    join public.material_handover_items handover_item on handover_item.handover_id = handover.id
    where handover.receipt_id = p_id
      and not exists (
        select 1 from public.material_receipt_items item
        where item.receipt_id = p_id and item.material_id = handover_item.material_id
      )
  ) then
    raise exception 'Không thể xóa phiếu bàn giao liên kết vì phiếu có vật tư ngoài phiếu nhập này' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.material_receipt_items item
    join public.materials material on material.id = item.material_id
    where item.receipt_id = p_id
      and ((material.reserved_handover_id is not null and not exists (
          select 1 from public.material_handovers handover
          where handover.id = material.reserved_handover_id and handover.receipt_id = p_id
        ))
        or (material.active_loan_handover_id is not null and not exists (
          select 1 from public.material_handovers handover
          where handover.id = material.active_loan_handover_id and handover.receipt_id = p_id
        )))
  ) then
    raise exception 'Không thể xóa vật tư vì đang có phiếu bàn giao khác giữ hoặc mượn vật tư' using errcode = '55000';
  end if;

  update public.materials material
  set reserved_handover_id = null,
      reservation_status = null,
      active_loan_handover_id = null,
      borrower_party_id = null,
      status = 'available'
  where material.id = any(v_material_ids);

  delete from private.material_receipt_import_reserved_codes reserved
  using public.material_receipt_import_requests request
  where request.receipt_id = p_id
    and reserved.actor_user_id = request.actor_user_id
    and reserved.request_id = request.request_id;
  delete from public.material_receipt_import_requests where receipt_id = p_id;

  delete from public.material_handovers where receipt_id = p_id;
  delete from public.material_receipt_history where receipt_id = p_id;
  delete from public.material_history where material_id = any(v_material_ids);
  delete from public.material_receipt_items where receipt_id = p_id;
  delete from public.materials material
  where material.id = any(v_material_ids);
  delete from public.material_receipts where id = p_id;
  return p_id;
end;
$$;

revoke all on function public.delete_material_receipt(uuid, integer) from public, anon;
grant execute on function public.delete_material_receipt(uuid, integer) to authenticated;

drop function if exists public.preview_material_receipt_adjustment(uuid, integer, jsonb);
drop function if exists public.apply_material_receipt_adjustment(uuid, integer, text, jsonb, text, jsonb);

notify pgrst, 'reload schema';
