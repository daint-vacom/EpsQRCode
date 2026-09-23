-- Dùng hệ thống tags chung cho nhãn công việc, giữ nguyên ID và các liên kết hiện có.

update public.tag_groups
set
  name = 'Nhóm công việc',
  description = 'Nhóm hệ thống dành cho các nhãn phân loại công việc.',
  module_code = 'system',
  is_system = true,
  kind = 'tag',
  sort_order = 8,
  is_active = true
where code = 'work-labels';

drop trigger if exists tenants_seed_work_label_catalog_group on public.tenants;
drop function if exists public.seed_work_label_catalog_group_for_tenant();

alter table public.tag_groups
  drop constraint if exists tag_groups_kind_check;

alter table public.tag_groups
  add constraint tag_groups_kind_check
  check (kind in ('tag', 'software_account_catalog', 'finance_category'));

create or replace function public.seed_system_tag_groups_for_tenant()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  insert into public.tag_groups (
    tenant_id, code, name, description, module_code, is_system, kind, sort_order
  )
  values
    (
      new.id, 'employees', 'Nhóm nhân viên',
      'Nhóm hệ thống dành cho các nhãn phân loại nhân viên.',
      'organization', true, 'tag', 5
    ),
    (
      new.id, 'customers', 'Nhóm khách hàng',
      'Nhóm hệ thống dành cho các nhãn phân loại khách hàng.',
      'customers', true, 'tag', 6
    ),
    (
      new.id, 'contracts', 'Nhóm hợp đồng',
      'Nhóm hệ thống dành cho các nhãn phân loại hợp đồng.',
      'contracts', true, 'tag', 7
    ),
    (
      new.id, 'software-accounts', 'Tài khoản phần mềm',
      'Danh mục tài khoản phần mềm mặc định có thể tái sử dụng cho khách hàng.',
      'system', true, 'software_account_catalog', 40
    ),
    (
      new.id, 'work-labels', 'Nhóm công việc',
      'Nhóm hệ thống dành cho các nhãn phân loại công việc.',
      'system', true, 'tag', 8
    )
  on conflict (tenant_id, code) do nothing;

  return new;
end;
$function$;

insert into public.tag_groups (
  tenant_id, code, name, description, module_code, is_system, kind, sort_order
)
select
  tenant.id,
  'work-labels',
  'Nhóm công việc',
  'Nhóm hệ thống dành cho các nhãn phân loại công việc.',
  'system',
  true,
  'tag',
  8
from public.tenants tenant
on conflict (tenant_id, code) do update set
  name = excluded.name,
  description = excluded.description,
  module_code = excluded.module_code,
  is_system = true,
  kind = 'tag',
  sort_order = excluded.sort_order,
  is_active = true;

-- Tên nhãn chỉ cần duy nhất trong cùng nhóm; cùng một tên có thể được dùng
-- độc lập cho các loại đối tượng khác nhau.
drop index if exists public.tags_name_ci_idx;
create unique index tags_group_name_ci_idx
  on public.tags(tenant_id, group_id, lower(name));

do $function$
begin
  if exists (
    select 1
    from public.work_labels work_label
    join public.tags tag
      on tag.tenant_id = work_label.tenant_id
     and tag.code = 'work-label-' || replace(work_label.id::text, '-', '')
  ) then
    raise exception 'Work label migration found a tag code collision';
  end if;

  if exists (
    select 1
    from public.work_labels work_label
    join public.tags tag on tag.id = work_label.id
  ) then
    raise exception 'Work label migration found a tag ID collision';
  end if;
end;
$function$;

insert into public.tags (
  id,
  tenant_id,
  group_id,
  code,
  name,
  color,
  sort_order,
  is_active,
  created_by,
  created_at,
  updated_at,
  description
)
select
  work_label.id,
  work_label.tenant_id,
  tag_group.id,
  'work-label-' || replace(work_label.id::text, '-', ''),
  work_label.name,
  work_label.color,
  row_number() over (
    partition by work_label.tenant_id
    order by work_label.created_at, work_label.id
  ) - 1,
  true,
  work_label.created_by,
  work_label.created_at,
  work_label.updated_at,
  ''
from public.work_labels work_label
join public.tag_groups tag_group
  on tag_group.tenant_id = work_label.tenant_id
 and tag_group.code = 'work-labels'
 and tag_group.kind = 'tag'
on conflict (id) do nothing;

insert into public.tag_assignments (
  tenant_id,
  tag_id,
  subject_type,
  subject_id,
  created_by,
  created_at
)
select
  work_item_label.tenant_id,
  work_item_label.label_id,
  'work_item',
  work_item_label.work_item_id,
  work_item_label.created_by,
  work_item_label.created_at
from public.work_item_labels work_item_label
on conflict (tenant_id, tag_id, subject_type, subject_id) do nothing;

drop policy if exists "Tenant members can view work labels" on public.work_labels;
drop policy if exists "Tenant members can create work labels" on public.work_labels;
drop policy if exists "Members with tag update can update work labels" on public.work_labels;
drop policy if exists "Members with tag delete can delete work labels" on public.work_labels;
drop policy if exists "Tenant members can view work item labels" on public.work_item_labels;
drop policy if exists "Tenant members can manage work item labels" on public.work_item_labels;

create policy "Tenant members can view work tag group"
on public.tag_groups
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
  and code = 'work-labels'
  and kind = 'tag'
  and is_active
);

create policy "Tenant members can view work tags"
on public.tags
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
  and is_active
  and exists (
    select 1
    from public.tag_groups tag_group
    where tag_group.tenant_id = tags.tenant_id
      and tag_group.id = tags.group_id
      and tag_group.code = 'work-labels'
      and tag_group.kind = 'tag'
      and tag_group.is_active
  )
);

create policy "Tenant members can create work tags"
on public.tags
for insert
to authenticated
with check (
  public.is_tenant_member(tenant_id)
  and (created_by is null or created_by = auth.uid())
  and exists (
    select 1
    from public.tag_groups tag_group
    where tag_group.tenant_id = tags.tenant_id
      and tag_group.id = tags.group_id
      and tag_group.code = 'work-labels'
      and tag_group.kind = 'tag'
      and tag_group.is_active
  )
);

create policy "Tenant members can view work tag assignments"
on public.tag_assignments
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
  and subject_type = 'work_item'
  and exists (
    select 1
    from public.tags tag
    join public.tag_groups tag_group
      on tag_group.tenant_id = tag.tenant_id
     and tag_group.id = tag.group_id
    where tag.tenant_id = tag_assignments.tenant_id
      and tag.id = tag_assignments.tag_id
      and tag_group.code = 'work-labels'
      and tag_group.kind = 'tag'
      and tag_group.is_active
  )
);

create policy "Tenant members can add work tag assignments"
on public.tag_assignments
for insert
to authenticated
with check (
  public.is_tenant_member(tenant_id)
  and subject_type = 'work_item'
  and (created_by is null or created_by = auth.uid())
  and exists (
    select 1
    from public.work_items item
    where item.tenant_id = tag_assignments.tenant_id
      and item.id = tag_assignments.subject_id
  )
  and exists (
    select 1
    from public.tags tag
    join public.tag_groups tag_group
      on tag_group.tenant_id = tag.tenant_id
     and tag_group.id = tag.group_id
    where tag.tenant_id = tag_assignments.tenant_id
      and tag.id = tag_assignments.tag_id
      and tag_group.code = 'work-labels'
      and tag_group.kind = 'tag'
      and tag_group.is_active
      and tag.is_active
  )
);

create policy "Tenant members can remove work tag assignments"
on public.tag_assignments
for delete
to authenticated
using (
  public.is_tenant_member(tenant_id)
  and subject_type = 'work_item'
  and exists (
    select 1
    from public.tags tag
    join public.tag_groups tag_group
      on tag_group.tenant_id = tag.tenant_id
     and tag_group.id = tag.group_id
    where tag.tenant_id = tag_assignments.tenant_id
      and tag.id = tag_assignments.tag_id
      and tag_group.code = 'work-labels'
      and tag_group.kind = 'tag'
  )
);

create or replace function public.validate_work_item_tag_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.subject_type = 'work_item' and (
    not exists (
      select 1
      from public.work_items item
      where item.tenant_id = new.tenant_id
        and item.id = new.subject_id
    )
    or not exists (
      select 1
      from public.tags tag
      join public.tag_groups tag_group
        on tag_group.tenant_id = tag.tenant_id
       and tag_group.id = tag.group_id
      where tag.tenant_id = new.tenant_id
        and tag.id = new.tag_id
        and tag_group.code = 'work-labels'
        and tag_group.kind = 'tag'
        and tag_group.is_active
        and tag.is_active
    )
  ) then
    raise exception 'Work item tag assignment must reference an active work item and work label in the same tenant'
      using errcode = '23503';
  end if;

  return new;
end;
$function$;

revoke all on function public.validate_work_item_tag_assignment()
  from public, anon, authenticated;

drop trigger if exists tag_assignments_validate_work_item
  on public.tag_assignments;
create trigger tag_assignments_validate_work_item
before insert or update on public.tag_assignments
for each row execute function public.validate_work_item_tag_assignment();

create or replace function public.prevent_moving_assigned_work_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.group_id is distinct from old.group_id
     and exists (
       select 1
       from public.tag_assignments assignment
       where assignment.tenant_id = old.tenant_id
         and assignment.tag_id = old.id
         and assignment.subject_type = 'work_item'
     )
     and not exists (
       select 1
       from public.tag_groups tag_group
       where tag_group.tenant_id = new.tenant_id
         and tag_group.id = new.group_id
         and tag_group.code = 'work-labels'
         and tag_group.kind = 'tag'
     ) then
    raise exception 'A tag assigned to work items cannot be moved out of the work label group'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.prevent_moving_assigned_work_tag()
  from public, anon, authenticated;

drop trigger if exists tags_prevent_moving_assigned_work_tag on public.tags;
create trigger tags_prevent_moving_assigned_work_tag
before update of group_id on public.tags
for each row execute function public.prevent_moving_assigned_work_tag();

create or replace function public.replace_work_item_labels(
  p_tenant_id uuid,
  p_work_item_id uuid,
  p_label_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.work_items item
    where item.id = p_work_item_id
      and item.tenant_id = p_tenant_id
  ) then
    raise exception 'Work item not found for tenant' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_label_ids, '{}'::uuid[])) requested(label_id)
    where requested.label_id is null
       or not exists (
         select 1
         from public.tags tag
         join public.tag_groups tag_group
           on tag_group.tenant_id = tag.tenant_id
          and tag_group.id = tag.group_id
         where tag.tenant_id = p_tenant_id
           and tag.id = requested.label_id
           and tag.is_active
           and tag_group.code = 'work-labels'
           and tag_group.kind = 'tag'
           and tag_group.is_active
       )
  ) then
    raise exception 'Work label not found for tenant' using errcode = '23503';
  end if;

  delete from public.tag_assignments assignment
  where assignment.tenant_id = p_tenant_id
    and assignment.subject_type = 'work_item'
    and assignment.subject_id = p_work_item_id
    and exists (
      select 1
      from public.tags tag
      join public.tag_groups tag_group
        on tag_group.tenant_id = tag.tenant_id
       and tag_group.id = tag.group_id
      where tag.tenant_id = assignment.tenant_id
        and tag.id = assignment.tag_id
        and tag_group.code = 'work-labels'
        and tag_group.kind = 'tag'
    );

  insert into public.tag_assignments (
    tenant_id, tag_id, subject_type, subject_id, created_by
  )
  select p_tenant_id, requested.label_id, 'work_item', p_work_item_id, auth.uid()
  from (
    select distinct label_id
    from unnest(coalesce(p_label_ids, '{}'::uuid[])) requested(label_id)
  ) requested
  on conflict (tenant_id, tag_id, subject_type, subject_id) do nothing;
end;
$function$;

revoke all on function public.replace_work_item_labels(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.replace_work_item_labels(uuid, uuid, uuid[])
  to authenticated;

create or replace function public.cleanup_work_item_tag_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from public.tag_assignments assignment
  where assignment.tenant_id = old.tenant_id
    and assignment.subject_type = 'work_item'
    and assignment.subject_id = old.id;
  return old;
end;
$function$;

revoke all on function public.cleanup_work_item_tag_assignments()
  from public, anon, authenticated;

drop trigger if exists work_items_cleanup_tag_assignments on public.work_items;
create trigger work_items_cleanup_tag_assignments
before delete on public.work_items
for each row execute function public.cleanup_work_item_tag_assignments();

drop table public.work_item_labels;
drop table public.work_labels;

alter table public.work_items
  drop constraint if exists work_items_tenant_id_id_unique;
