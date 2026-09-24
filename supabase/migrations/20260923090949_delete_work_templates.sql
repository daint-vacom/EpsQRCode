-- RLS only exposes work-item label-assignment deletion to clients. This
-- security-definer RPC also removes template and child-template assignments,
-- after explicitly verifying the caller belongs to the tenant.
create or replace function public.delete_work_templates(
  p_tenant_id uuid,
  p_template_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_template_ids uuid[];
  v_deleted_count integer;
begin
  if auth.uid() is null
     or not coalesce(public.is_tenant_member(p_tenant_id), false) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;

  select coalesce(array_agg(requested.id order by requested.id), '{}'::uuid[])
  into v_template_ids
  from (
    select distinct requested.id
    from unnest(coalesce(p_template_ids, '{}'::uuid[])) requested(id)
    where requested.id is not null
  ) requested;

  if cardinality(v_template_ids) = 0 then
    return 0;
  end if;

  if exists (
    select 1
    from unnest(v_template_ids) requested(id)
    where not exists (
      select 1
      from public.work_templates template
      where template.tenant_id = p_tenant_id
        and template.id = requested.id
    )
  ) then
    raise exception 'Work template not found for tenant' using errcode = 'P0002';
  end if;

  delete from public.tag_assignments assignment
  where assignment.tenant_id = p_tenant_id
    and (
      (
        assignment.subject_type = 'work_template'
        and assignment.subject_id = any(v_template_ids)
      )
      or (
        assignment.subject_type = 'work_template_item'
        and exists (
          select 1
          from public.work_template_items item
          where item.tenant_id = p_tenant_id
            and item.id = assignment.subject_id
            and item.template_id = any(v_template_ids)
        )
      )
    );

  delete from public.work_templates template
  where template.tenant_id = p_tenant_id
    and template.id = any(v_template_ids);
  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$function$;

revoke all on function public.delete_work_templates(uuid, uuid[])
  from public, anon;
grant execute on function public.delete_work_templates(uuid, uuid[])
  to authenticated;
