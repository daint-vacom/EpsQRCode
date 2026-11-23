CREATE OR REPLACE FUNCTION public.list_custodians(p_include_inactive boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return coalesce((
    with global_permissions as materialized (
      select private.has_all_eps_custodian_manage() as can_manage_all_eps
    ),
    permission_flags as materialized (
      select
        party.id,
        public.has_scoped_permission('materials:custodian:view', party.id) as can_view_custodian,
        public.has_scoped_permission('materials:custodian:manage', party.id) as can_manage_custodian,
        public.has_scoped_permission('materials:material:view', party.id) as can_view_material,
        public.has_scoped_permission('materials:material:manage', party.id) as can_manage_material,
        public.has_scoped_permission('materials:handover:view', party.id) as can_view_handover,
        public.has_scoped_permission('materials:handover:manage', party.id) as can_manage_handover,
        public.has_scoped_permission('materials:warehouse:view', party.id) as can_view_warehouse,
        public.has_scoped_permission('materials:warehouse:manage', party.id) as can_manage_warehouse,
        public.has_scoped_permission('materials:receipt:view', party.id) as can_view_receipt,
        public.has_scoped_permission('materials:receipt:manage', party.id) as can_manage_receipt
      from public.material_custodians party
      where (p_include_inactive or party.is_active)
        and not party.is_handover_custom
    )
    select jsonb_agg(jsonb_build_object(
      'id', party.id,
      'type', party.type,
      'code', party.code,
      'name', party.name,
      'parentId', party.parent_id,
      'sourceType', party.source_type,
      'sourceId', party.source_id,
      'canRepresent', public.material_can_represent_account_base(party.id)
        or permission_flags.can_manage_handover
        or permission_flags.can_manage_material
        or permission_flags.can_manage_receipt,
      'canManageMaterial', permission_flags.can_manage_material,
      'canManageHandover', permission_flags.can_manage_handover,
      'canManageRepresentatives', case
        when party.type = 'external' then public.has_permission('organization:external-organization:manage')
        when party.source_type in ('eps_department', 'eps_team')
          then permission_flags.can_manage_custodian or global_permissions.can_manage_all_eps
        else false end,
      'accountUserId', case when permission_flags.can_manage_custodian
        then party.account_user_id else null end,
      'accountUserIds', case
        when permission_flags.can_manage_custodian or global_permissions.can_manage_all_eps
        then case when party.type = 'warehouse' then coalesce((
          select jsonb_agg(assignment.user_id order by assignment.user_id)
          from public.material_warehouse_accounts assignment
          where assignment.warehouse_id = party.id
        ), '[]'::jsonb)
        when party.account_user_id is null then '[]'::jsonb
        else jsonb_build_array(party.account_user_id) end
        when party.type = 'warehouse' and exists (
          select 1 from public.material_warehouse_accounts assignment
          where assignment.warehouse_id = party.id
            and assignment.user_id = (select auth.uid())
        ) then jsonb_build_array((select auth.uid()))
        else '[]'::jsonb end,
      'representativeUserId', case
        when permission_flags.can_manage_custodian or global_permissions.can_manage_all_eps
          then party.representative_user_id else null end,
      'representativeDisplayName', case
        when permission_flags.can_manage_custodian or global_permissions.can_manage_all_eps
          then coalesce(
            nullif(btrim(profile.display_name), ''),
            nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
            nullif(btrim(profile.username), '')
          ) else null end,
      'representativeName', case when permission_flags.can_view_custodian
        or permission_flags.can_manage_custodian
        or permission_flags.can_view_handover
        or permission_flags.can_manage_handover then coalesce(
          nullif(btrim(party.representative_name), ''),
          nullif(btrim(profile.display_name), ''),
          nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), '')
        ) else null end,
      'representativeUserIds', case
        when party.type = 'external' then coalesce((
          select jsonb_agg(representative.user_id order by
            (representative.user_id = party.representative_user_id) desc,
            lower(coalesce(nullif(btrim(rep_profile.display_name), ''),
              nullif(btrim(concat_ws(' ', rep_profile.first_name, rep_profile.last_name)), ''),
              rep_profile.username)) collate "vi-x-icu", rep_profile.id)
          from private.material_custodian_representatives representative
          join public.user_profiles rep_profile on rep_profile.id = representative.user_id
          where representative.custodian_id = party.id
            and rep_profile.status = 'active'
            and rep_profile.account_type = 'external'
            and rep_profile.external_organization_id = party.id
        ), '[]'::jsonb)
        when party.source_type in ('eps_department', 'eps_team') then coalesce((
          select jsonb_agg(representative.user_id order by
            (representative.user_id = party.representative_user_id) desc,
            lower(coalesce(nullif(btrim(rep_profile.display_name), ''),
              nullif(btrim(concat_ws(' ', rep_profile.first_name, rep_profile.last_name)), ''),
              rep_profile.username)) collate "vi-x-icu", rep_profile.id)
          from private.material_custodian_representatives representative
          join public.user_profiles rep_profile on rep_profile.id = representative.user_id
          join private.fake_eps_employees employee on employee.id = rep_profile.eps_employee_id
          where representative.custodian_id = party.id
            and rep_profile.status = 'active'
            and rep_profile.account_type = 'eps'
            and employee.employment_status = 'active'
            and case party.type when 'department'
              then employee.department_id = party.source_id
              else employee.team_id = party.source_id end
        ), '[]'::jsonb)
        else '[]'::jsonb end,
      'representativeAccounts', case
        when party.type = 'external' then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', representative.user_id,
            'username', rep_profile.username,
            'displayName', coalesce(nullif(btrim(rep_profile.display_name), ''),
              nullif(btrim(concat_ws(' ', rep_profile.first_name, rep_profile.last_name)), ''),
              rep_profile.username)
          ) order by lower(coalesce(nullif(btrim(rep_profile.display_name), ''),
            nullif(btrim(concat_ws(' ', rep_profile.first_name, rep_profile.last_name)), ''),
            rep_profile.username)) collate "vi-x-icu", rep_profile.id)
          from private.material_custodian_representatives representative
          join public.user_profiles rep_profile on rep_profile.id = representative.user_id
          where representative.custodian_id = party.id
            and rep_profile.status = 'active'
            and rep_profile.account_type = 'external'
            and rep_profile.external_organization_id = party.id
        ), '[]'::jsonb)
        when party.source_type in ('eps_department', 'eps_team') then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', representative.user_id,
            'username', rep_profile.username,
            'displayName', coalesce(nullif(btrim(rep_profile.display_name), ''),
              nullif(btrim(concat_ws(' ', rep_profile.first_name, rep_profile.last_name)), ''),
              rep_profile.username)
          ) order by lower(coalesce(nullif(btrim(rep_profile.display_name), ''),
            nullif(btrim(concat_ws(' ', rep_profile.first_name, rep_profile.last_name)), ''),
            rep_profile.username)) collate "vi-x-icu", rep_profile.id)
          from private.material_custodian_representatives representative
          join public.user_profiles rep_profile on rep_profile.id = representative.user_id
          join private.fake_eps_employees employee on employee.id = rep_profile.eps_employee_id
          where representative.custodian_id = party.id
            and rep_profile.status = 'active'
            and rep_profile.account_type = 'eps'
            and employee.employment_status = 'active'
            and case party.type when 'department'
              then employee.department_id = party.source_id
              else employee.team_id = party.source_id end
        ), '[]'::jsonb)
        else '[]'::jsonb end,
      'representativeOptions', case
        when party.type = 'external'
          and public.has_permission('organization:external-organization:manage') then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', rep_profile.id,
            'username', rep_profile.username,
            'displayName', coalesce(nullif(btrim(rep_profile.display_name), ''),
              nullif(btrim(concat_ws(' ', rep_profile.first_name, rep_profile.last_name)), ''),
              rep_profile.username)
          ) order by lower(coalesce(nullif(btrim(rep_profile.display_name), ''),
            nullif(btrim(concat_ws(' ', rep_profile.first_name, rep_profile.last_name)), ''),
            rep_profile.username)) collate "vi-x-icu", rep_profile.id)
          from public.user_profiles rep_profile
          where rep_profile.account_type = 'external'
            and rep_profile.external_organization_id = party.id
            and rep_profile.status = 'active'
        ), '[]'::jsonb)
        when party.source_type in ('eps_department', 'eps_team')
          and (permission_flags.can_manage_custodian or global_permissions.can_manage_all_eps) then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', rep_profile.id,
            'username', rep_profile.username,
            'displayName', coalesce(nullif(btrim(rep_profile.display_name), ''),
              nullif(btrim(concat_ws(' ', rep_profile.first_name, rep_profile.last_name)), ''),
              rep_profile.username)
          ) order by lower(coalesce(nullif(btrim(rep_profile.display_name), ''),
            nullif(btrim(concat_ws(' ', rep_profile.first_name, rep_profile.last_name)), ''),
            rep_profile.username)) collate "vi-x-icu", rep_profile.id)
          from public.user_profiles rep_profile
          join private.fake_eps_employees employee on employee.id = rep_profile.eps_employee_id
          where rep_profile.account_type = 'eps'
            and rep_profile.status = 'active'
            and employee.employment_status = 'active'
            and case party.type when 'department'
              then employee.department_id = party.source_id
              else employee.team_id = party.source_id end
        ), '[]'::jsonb)
        else '[]'::jsonb end,
      'phone', case when permission_flags.can_view_custodian
        or permission_flags.can_manage_custodian
        or permission_flags.can_view_handover
        or permission_flags.can_manage_handover then party.phone else null end,
      'email', case when permission_flags.can_view_custodian
        or permission_flags.can_manage_custodian
        or permission_flags.can_view_handover
        or permission_flags.can_manage_handover then party.email else null end,
      'isHandoverCustom', false,
      'handoverScopePartyId', null,
      'isActive', party.is_active,
      'createdAt', party.created_at,
      'updatedAt', party.updated_at
    ) order by case when party.is_active then 0 else 1 end,
      lower(party.name) collate "vi-x-icu", party.id)
    from public.material_custodians party
    join permission_flags on permission_flags.id = party.id
    cross join global_permissions
    left join public.user_profiles profile on profile.id = party.representative_user_id
    where true
  ), '[]'::jsonb);
end;
$function$;

REVOKE ALL ON FUNCTION public.list_eps_organizations() FROM public, anon, authenticated;
DROP FUNCTION public.list_eps_organizations();
REVOKE ALL ON FUNCTION public.list_external_organizations(boolean) FROM public, anon, authenticated;
DROP FUNCTION public.list_external_organizations(boolean);
