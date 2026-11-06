-- QR scan counts for the isolated EpsQRCode development project.
-- Counts are stored separately so tracking does not mutate material records.

create table public.material_qr_scan_counts (
  material_id uuid primary key references public.materials(id) on delete cascade,
  scan_count integer not null default 0 check (scan_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.material_qr_scan_counts enable row level security;
revoke all on public.material_qr_scan_counts from anon, authenticated, public;

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

  insert into public.material_qr_scan_counts as current_count (material_id)
  values (p_id)
  on conflict (material_id) do update
    set scan_count = current_count.scan_count + 1,
        updated_at = timezone('utc', now());

  return true;
end;
$$;

create or replace function public.list_material_qr_tracking(p_material_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not public.has_permission('materials:material:view') then
    raise exception using errcode = '42501',
      message = 'Bạn không có quyền xem theo dõi mã QR.';
  end if;

  return coalesce((
    with requested as (
      select requested_ids.material_id, min(requested_ids.ordinality) as ordinality
      from unnest(coalesce(p_material_ids, '{}'::uuid[]))
        with ordinality as requested_ids(material_id, ordinality)
      group by requested_ids.material_id
    )
    select jsonb_agg(jsonb_build_object(
      'materialId', material.id,
      'scanCount', coalesce(scan_counts.scan_count, 0),
      'lastPrintedAt', print_preferences.last_printed_at
    ) order by requested.ordinality)
    from requested
    join public.materials material
      on material.id = requested.material_id
    left join public.material_qr_scan_counts scan_counts
      on scan_counts.material_id = material.id
    left join public.material_last_label_templates print_preferences
      on print_preferences.material_id = material.id
    where public.can_view_material_current(material.id)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.record_material_qr_scan(uuid) from public;
grant execute on function public.record_material_qr_scan(uuid) to anon, authenticated;
revoke all on function public.list_material_qr_tracking(uuid[]) from public, anon;
grant execute on function public.list_material_qr_tracking(uuid[]) to authenticated;

notify pgrst, 'reload schema';
