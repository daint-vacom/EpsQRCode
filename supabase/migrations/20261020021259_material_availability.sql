alter table public.materials
  add column is_active boolean not null default true;

create or replace function public.material_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',m.id,'code',m.code,'modelId',m.model_id,'modelSnapshot',m.model_snapshot,
    'nameOverride',m.name_override,'descriptionOverride',m.description_override,
    'images',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'storageBucket',i.storage_bucket,'storagePath',i.storage_path,
      'externalUrl',i.external_url,'sortOrder',i.sort_order,'isCover',i.is_cover
    ) order by i.sort_order,i.id) from public.material_images i where i.material_id=m.id),'[]'::jsonb),
    'specificationOverrides',m.specification_overrides,
    'specificationOverrideLabels',m.specification_override_labels,
    'serialNumber',m.serial_number,'ownerPartyId',m.owner_party_id,'borrowerPartyId',m.borrower_party_id,
    'condition',m.condition,'note',m.note,'status',m.status,'isActive',m.is_active,
    'activeLoanHandoverId',m.active_loan_handover_id,'reservedHandoverId',m.reserved_handover_id,
    'reservationStatus',m.reservation_status,'version',m.version,
    'createdAt',m.created_at,'updatedAt',m.updated_at
  ) from public.materials m where m.id=p_id
$$;

create or replace function public.set_material_availability(
  p_id uuid,
  p_is_active boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row public.materials%rowtype;
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials' using errcode='42501';
  end if;

  update public.materials
  set is_active=p_is_active,
      version=version+1,
      updated_at=timezone('utc',now())
  where id=p_id
  returning * into v_row;

  if not found then
    raise exception 'Material not found' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'id',v_row.id,
    'isActive',v_row.is_active,
    'updatedAt',v_row.updated_at,
    'version',v_row.version
  );
end $$;

revoke all on function public.set_material_availability(uuid,boolean) from public, anon;
grant execute on function public.set_material_availability(uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
