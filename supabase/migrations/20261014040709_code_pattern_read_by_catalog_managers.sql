drop policy if exists code_generation_patterns_select_with_permission
  on public.code_generation_patterns;

create policy code_generation_patterns_select_with_permission
on public.code_generation_patterns for select to authenticated
using (
  public.has_permission('organization:custom-field:view')
  or public.has_permission('organization:custom-field:update')
  or (
    entity_key = 'material_group'
    and public.has_permission('material_catalog:material_group:manage')
  )
  or (
    entity_key = 'material_model'
    and public.has_permission('material_catalog:material_model:manage')
  )
);
