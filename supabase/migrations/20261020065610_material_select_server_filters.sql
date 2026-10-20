create or replace function public.list_materials(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page int := greatest(coalesce((p_filters->>'page')::int,1),1);
  v_size int := least(greatest(coalesce((p_filters->>'pageSize')::int,20),1),100);
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view materials' using errcode='42501';
  end if;

  return (
    with filtered as (
      select m.id,m.status,m.name_override,m.model_snapshot
      from public.materials m
      where (nullif(p_filters->>'id','') is null or m.id=(p_filters->>'id')::uuid)
        and (not coalesce((p_filters->>'excludeReserved')::boolean,false) or m.reserved_handover_id is null or m.reserved_handover_id=nullif(p_filters->>'allowReservedByHandoverId','')::uuid)
        and (nullif(p_filters->>'modelId','') is null or m.model_id=(p_filters->>'modelId')::uuid)
        and (nullif(p_filters->>'groupId','') is null or m.model_snapshot->>'groupId'=p_filters->>'groupId')
        and (nullif(p_filters->>'ownerPartyId','') is null or m.owner_party_id=(p_filters->>'ownerPartyId')::uuid)
        and (nullif(p_filters->>'borrowerPartyId','') is null or m.borrower_party_id=(p_filters->>'borrowerPartyId')::uuid)
        and (nullif(p_filters->>'status','') is null or m.status=p_filters->>'status')
        and (nullif(p_filters->>'condition','') is null or m.condition=p_filters->>'condition')
        and (nullif(p_filters->>'search','') is null or concat_ws(' ',m.code,m.serial_number,m.name_override,m.model_snapshot->>'name') ilike '%'||btrim(p_filters->>'search')||'%')
        and (nullif(p_filters->>'updatedFrom','') is null or m.updated_at >= (p_filters->>'updatedFrom')::timestamptz)
        and (nullif(p_filters->>'updatedTo','') is null or m.updated_at < (p_filters->>'updatedTo')::timestamptz + interval '1 day')
    )
    select jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(public.material_json(page.id) order by
        case page.status when 'available' then 0 when 'loaned' then 1 else 2 end,
        lower(coalesce(nullif(btrim(page.name_override),''),page.model_snapshot->>'name','')) collate "vi-x-icu",
        page.id)
      from (
        select f.id,f.status,f.name_override,f.model_snapshot
        from filtered f
        order by case f.status when 'available' then 0 when 'loaned' then 1 else 2 end,
          lower(coalesce(nullif(btrim(f.name_override),''),f.model_snapshot->>'name','')) collate "vi-x-icu",
          f.id
        offset (v_page-1)*v_size limit v_size
      ) page
    ),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',v_page,'pageSize',v_size
    )
  );
end;
$$;
revoke all on function public.list_materials(jsonb) from public,anon;
grant execute on function public.list_materials(jsonb) to authenticated;
