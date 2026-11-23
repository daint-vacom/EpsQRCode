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

CREATE OR REPLACE FUNCTION public.list_material_groups()
 RETURNS SETOF material_groups
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select group_row.*
  from public.material_groups as group_row
  where auth.uid() is not null
  order by lower(group_row.name) collate "vi-x-icu", group_row.id;
$function$;

CREATE OR REPLACE FUNCTION public.list_material_models()
 RETURNS SETOF material_models
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select model.*
  from public.material_models as model
  where auth.uid() is not null
  order by
    case when model.is_active then 0 else 1 end,
    lower(model.name) collate "vi-x-icu",
    model.id;
$function$;

CREATE OR REPLACE FUNCTION public.list_material_models_page(p_after_is_active boolean DEFAULT NULL::boolean, p_after_name text DEFAULT NULL::text, p_after_id uuid DEFAULT NULL::uuid, p_page_size integer DEFAULT 200)
 RETURNS SETOF material_models
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select model.*
  from public.material_models as model
  where auth.uid() is not null
    and (
      p_after_id is null
          or model.is_active < p_after_is_active
          or (
            model.is_active = p_after_is_active
            and (
              lower(model.name) collate "vi-x-icu"
                > lower(p_after_name) collate "vi-x-icu"
              or (
                lower(model.name) collate "vi-x-icu"
                  = lower(p_after_name) collate "vi-x-icu"
                and model.id > p_after_id
              )
            )
          )
    )
  order by
    model.is_active desc,
    lower(model.name) collate "vi-x-icu",
    model.id
  limit greatest(1, least(coalesce(p_page_size, 200), 250));
$function$;

CREATE OR REPLACE FUNCTION public.list_material_specifications()
 RETURNS SETOF material_specifications
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select specification.*
  from public.material_specifications as specification
  where auth.uid() is not null
  order by lower(specification.name) collate "vi-x-icu", specification.id;
$function$;

CREATE OR REPLACE FUNCTION public.get_material_group_filter_summary(p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_search text := nullif(btrim(p_search), '');
begin
  if auth.uid() is null then
    raise exception 'Permission denied to view material groups' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'active', count(*) filter (where group_row.is_active)::integer,
      'inactive', count(*) filter (where not group_row.is_active)::integer
    )
    from public.material_groups group_row
    where v_search is null
      or concat_ws(' ', group_row.code, group_row.name, group_row.description)
        ilike '%' || v_search || '%'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_material_model_filter_summary(p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_search text := nullif(btrim(p_filters->>'search'), '');
  v_group uuid := nullif(p_filters->>'groupId', '')::uuid;
begin
  if auth.uid() is null then
    raise exception 'Permission denied to view material models' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'active', count(*) filter (where model.is_active)::integer,
      'inactive', count(*) filter (where not model.is_active)::integer,
      'requiresInspection', count(*) filter (where model.requires_inspection)::integer,
      'notRequiresInspection', count(*) filter (where not model.requires_inspection)::integer
    )
    from public.material_models model
    where (v_group is null or model.group_id = v_group)
      and (
        p_filters->'groupIds' is null
        or exists (
          select 1
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(p_filters->'groupIds') = 'array'
                then p_filters->'groupIds'
              else '[]'::jsonb
            end
          ) as selected_group(group_id)
          where model.group_id::text = selected_group.group_id
        )
      )
      and (
        v_search is null
        or concat_ws(' ', model.code, model.name)
          ilike '%' || v_search || '%'
      )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_material_specification_filter_summary(p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_search text := nullif(btrim(p_search), '');
begin
  if auth.uid() is null then
    raise exception 'Permission denied to view material specifications' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'text', count(*) filter (where specification.data_type = 'text')::integer,
      'number', count(*) filter (where specification.data_type = 'number')::integer,
      'boolean', count(*) filter (where specification.data_type = 'boolean')::integer,
      'date', count(*) filter (where specification.data_type = 'date')::integer,
      'color', count(*) filter (where specification.data_type = 'color')::integer,
      'length', count(*) filter (where specification.data_type = 'length')::integer,
      'weight', count(*) filter (where specification.data_type = 'weight')::integer
    )
    from public.material_specifications specification
    where v_search is null
      or concat_ws(' ', specification.code, specification.name)
        ilike '%' || v_search || '%'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_material_group_model_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Permission denied to view material models' using errcode = '42501';
  end if;

  return (
    with recursive model_counts_by_group as materialized (
      select model.group_id, count(*)::integer as model_count
      from public.material_models as model
      where model.group_id is not null
      group by model.group_id
    ),
    group_ancestors as (
      select group_row.id as descendant_id, group_row.id as ancestor_id
      from public.material_groups as group_row

      union all

      select child.id, group_ancestors.ancestor_id
      from group_ancestors
      join public.material_groups as child
        on child.parent_id = group_ancestors.descendant_id
    ),
    counts_by_group as (
      select
        group_ancestors.ancestor_id as group_id,
        sum(coalesce(model_counts_by_group.model_count, 0))::integer as model_count
      from group_ancestors
      left join model_counts_by_group
        on model_counts_by_group.group_id = group_ancestors.descendant_id
      group by group_ancestors.ancestor_id
    )
    select pg_catalog.jsonb_build_object(
      'counts', coalesce(
        (
          select pg_catalog.jsonb_object_agg(
            counts_by_group.group_id::text,
            counts_by_group.model_count
          )
          from counts_by_group
        ),
        '{}'::jsonb
      ),
      'total', (select count(*)::integer from public.material_models)
    )
  );
end;
$function$;

revoke all on function public.list_custodians(boolean) from public, anon;
grant execute on function public.list_custodians(boolean) to authenticated;
revoke all on function public.list_material_groups() from public, anon;
grant execute on function public.list_material_groups() to authenticated;
revoke all on function public.list_material_models() from public, anon;
grant execute on function public.list_material_models() to authenticated;
revoke all on function public.list_material_models_page(boolean,text,uuid,integer) from public, anon;
grant execute on function public.list_material_models_page(boolean,text,uuid,integer) to authenticated;
revoke all on function public.list_material_specifications() from public, anon;
grant execute on function public.list_material_specifications() to authenticated;
revoke all on function public.get_material_group_filter_summary(text) from public, anon;
grant execute on function public.get_material_group_filter_summary(text) to authenticated;
revoke all on function public.get_material_model_filter_summary(jsonb) from public, anon;
grant execute on function public.get_material_model_filter_summary(jsonb) to authenticated;
revoke all on function public.get_material_specification_filter_summary(text) from public, anon;
grant execute on function public.get_material_specification_filter_summary(text) to authenticated;
revoke all on function public.get_material_group_model_counts() from public, anon;
grant execute on function public.get_material_group_model_counts() to authenticated;
