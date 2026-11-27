-- Keep the material-model filter aligned with its effective inspection types.
create function private.material_model_has_active_inspection(p_model_id uuid, p_group_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  with recursive group_chain(id, priority) as (
    select p_group_id, 0 where p_group_id is not null
    union all
    select parent.id, group_chain.priority - 1
    from group_chain
    join public.material_groups child on child.id = group_chain.id
    join public.material_groups parent on parent.id = child.parent_id
  ), scoped as (
    select config.type_id, config.enabled, config.interval_value, config.interval_unit, 1 as priority
    from public.material_safety_inspection_type_configs config
    where config.scope_kind = 'model' and config.scope_id = p_model_id
    union all
    select config.type_id, config.enabled, config.interval_value, config.interval_unit, group_chain.priority
    from group_chain
    join public.material_safety_inspection_type_configs config
      on config.scope_kind = 'group' and config.scope_id = group_chain.id
  )
  select exists (
    select 1
    from scoped
    join public.material_safety_inspection_types type on type.id = scoped.type_id
    where type.archived_at is null
    group by scoped.type_id
    having (array_agg(scoped.enabled order by scoped.priority desc)
        filter (where scoped.enabled is not null))[1] is true
      and bool_or(scoped.interval_value is not null and scoped.interval_unit is not null)
  );
$$;
revoke all on function private.material_model_has_active_inspection(uuid, uuid) from public, anon, authenticated;

create function public.list_material_models_with_inspection_status_page(
  p_after_is_active boolean default null,
  p_after_name text default null,
  p_after_id uuid default null,
  p_page_size integer default 200
)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(model) || jsonb_build_object(
    'has_active_safety_inspection',
    private.material_model_has_active_inspection(model.id, model.group_id)
  )
  from public.list_material_models_page(
    p_after_is_active, p_after_name, p_after_id, p_page_size
  ) as model
  order by model.is_active desc, lower(model.name) collate "vi-x-icu", model.id;
$$;
revoke all on function public.list_material_models_with_inspection_status_page(boolean, text, uuid, integer) from public, anon;
grant execute on function public.list_material_models_with_inspection_status_page(boolean, text, uuid, integer) to authenticated;

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
      'requiresInspection', count(*) filter (where inspection.required)::integer,
      'notRequiresInspection', count(*) filter (where not inspection.required)::integer
    )
    from public.material_models model
    left join lateral (select private.material_model_has_active_inspection(model.id, model.group_id) as required) inspection on true
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

notify pgrst, 'reload schema';
