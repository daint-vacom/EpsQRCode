-- Fix recursive work_items RLS evaluation when updating a child-linked work item.
-- The parent validation is intentionally isolated in a SECURITY DEFINER helper
-- so the work_items policy does not query work_items through its own policy.

create or replace function public.work_item_parent_belongs_to_tenant(
  p_parent_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_parent_id is null
    or exists (
      select 1
      from public.work_items parent
      where parent.id = p_parent_id
        and parent.tenant_id = p_tenant_id
    );
$$;

revoke all on function public.work_item_parent_belongs_to_tenant(uuid, uuid) from public, anon;
grant execute on function public.work_item_parent_belongs_to_tenant(uuid, uuid) to authenticated;

drop policy if exists "Tenant members can manage work items" on public.work_items;

create policy "Tenant members can manage work items"
on public.work_items for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (
  public.is_tenant_member(tenant_id)
  and public.work_item_parent_belongs_to_tenant(work_items.parent_id, work_items.tenant_id)
  and (
    work_items.template_id is null
    or exists (
      select 1 from public.work_templates template
      where template.id = work_items.template_id
        and template.tenant_id = work_items.tenant_id
    )
  )
  and (
    work_items.assignee_employee_id is null
    or exists (
      select 1 from public.employees employee
      where employee.id = work_items.assignee_employee_id
        and employee.tenant_id = work_items.tenant_id
    )
  )
);
