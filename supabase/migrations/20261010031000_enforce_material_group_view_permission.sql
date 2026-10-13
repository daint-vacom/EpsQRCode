-- Remove the legacy authenticated SELECT policy and require the view permission.
drop policy if exists material_groups_select_authenticated
  on public.material_groups;
drop policy if exists material_groups_select_with_permission
  on public.material_groups;

create policy material_groups_select_with_permission
on public.material_groups for select to authenticated
using (public.has_permission('material_catalog:material_group:view'));

notify pgrst, 'reload schema';
