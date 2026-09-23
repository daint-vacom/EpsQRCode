alter table public.tag_groups
  drop constraint if exists tag_groups_kind_check;

alter table public.tag_groups
  add constraint tag_groups_kind_check
  check (
    kind in (
      'tag',
      'software_account_catalog',
      'finance_category',
      'work_label_catalog'
    )
  );

create or replace function public.seed_work_label_catalog_group_for_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.tag_groups (
    tenant_id,
    code,
    name,
    description,
    module_code,
    is_system,
    kind,
    sort_order
  )
  values (
    new.id,
    'work-labels',
    'Nhóm công việc',
    'Nhóm hệ thống dành cho các nhãn phân loại công việc.',
    'system',
    true,
    'work_label_catalog',
    8
  )
  on conflict (tenant_id, code) do nothing;

  return new;
end;
$$;

drop trigger if exists tenants_seed_work_label_catalog_group on public.tenants;
create trigger tenants_seed_work_label_catalog_group
after insert on public.tenants
for each row execute function public.seed_work_label_catalog_group_for_tenant();

insert into public.tag_groups (
  tenant_id,
  code,
  name,
  description,
  module_code,
  is_system,
  kind,
  sort_order
)
select
  tenant.id,
  'work-labels',
  'Nhóm công việc',
  'Nhóm hệ thống dành cho các nhãn phân loại công việc.',
  'system',
  true,
  'work_label_catalog',
  8
from public.tenants tenant
on conflict (tenant_id, code) do update set
  name = excluded.name,
  description = excluded.description,
  module_code = excluded.module_code,
  is_system = true,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  is_active = true;

grant update, delete on public.work_labels to authenticated;

create policy "Members with tag update can update work labels"
on public.work_labels
for update
to authenticated
using (public.has_tenant_permission(tenant_id, 'system:tag:update'))
with check (public.has_tenant_permission(tenant_id, 'system:tag:update'));

create policy "Members with tag delete can delete work labels"
on public.work_labels
for delete
to authenticated
using (public.has_tenant_permission(tenant_id, 'system:tag:delete'));
