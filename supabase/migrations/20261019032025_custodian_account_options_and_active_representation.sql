-- Narrow account lookup for custodian configuration. Keep user_profiles RLS unchanged.
create or replace function public.list_custodian_account_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('materials:custodian:manage') then
    raise exception 'Permission denied to configure custodian representatives'
      using errcode='42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', profile.id,
      'username', profile.username,
      'displayName', coalesce(
        nullif(btrim(profile.display_name), ''),
        nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
        nullif(btrim(profile.username), ''),
        profile.id::text
      )
    ) order by
      lower(coalesce(nullif(btrim(profile.display_name), ''), profile.username, profile.id::text)) collate "vi-x-icu",
      lower(coalesce(profile.username, '')),
      profile.id)
    from public.user_profiles profile
    where profile.status = 'active'
  ), '[]'::jsonb);
end;
$$;

-- Party representation requires both a current assignment and an active account.
create or replace function public.material_can_represent(p_party_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.material_custodians party
    join public.user_profiles profile on profile.id = auth.uid()
    where party.id = p_party_id
      and party.is_active
      and profile.status = 'active'
      and (party.account_user_id = auth.uid() or party.representative_user_id = auth.uid())
  );
$$;

revoke all on function public.list_custodian_account_options() from public, anon;
grant execute on function public.list_custodian_account_options() to authenticated;
revoke all on function public.material_can_represent(uuid) from public, anon, authenticated;

create or replace function public.list_material_history(p_material_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception 'Permission denied to view material history' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',history.id,'materialId',history.material_id,'actorUserId',history.actor_user_id,
      'actorDisplayName',coalesce(nullif(btrim(profile.display_name),''),
        nullif(btrim(concat_ws(' ',profile.first_name,profile.last_name)),'')),
      'action',history.action,'note',history.note,'fromState',history.from_state,
      'toState',history.to_state,'createdAt',history.created_at
    ) order by history.created_at desc,history.id)
    from public.material_history history
    left join public.user_profiles profile on profile.id=history.actor_user_id
    where history.material_id=p_material_id
  ),'[]'::jsonb);
end;
$$;

create or replace function public.list_handover_history(p_handover_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('materials:handover:view') then
    raise exception 'Permission denied to view handover history' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',history.id,'handoverId',history.handover_id,'actorUserId',history.actor_user_id,
      'actorDisplayName',coalesce(nullif(btrim(profile.display_name),''),
        nullif(btrim(concat_ws(' ',profile.first_name,profile.last_name)),'')),
      'action',history.action,'note',history.note,'fromStatus',history.from_status,
      'toStatus',history.to_status,'createdAt',history.created_at
    ) order by history.created_at,history.id)
    from public.material_handover_history history
    left join public.user_profiles profile on profile.id=history.actor_user_id
    where history.handover_id=p_handover_id
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.list_material_history(uuid),public.list_handover_history(uuid) from public,anon;
grant execute on function public.list_material_history(uuid),public.list_handover_history(uuid) to authenticated;

notify pgrst, 'reload schema';
