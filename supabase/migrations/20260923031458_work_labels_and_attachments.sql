alter table public.work_items
  add constraint work_items_tenant_id_id_unique unique (tenant_id, id);

create table public.work_labels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  color text not null default '#2563eb',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  constraint work_labels_name_not_blank check (length(btrim(name)) > 0),
  constraint work_labels_name_length check (length(btrim(name)) <= 40),
  constraint work_labels_color_format check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create unique index work_labels_tenant_name_ci_idx
  on public.work_labels(tenant_id, lower(name));

create trigger work_labels_set_updated_at
before update on public.work_labels
for each row execute function public.set_updated_at();

create table public.work_item_labels (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  work_item_id uuid not null,
  label_id uuid not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, work_item_id, label_id),
  constraint work_item_labels_work_fk
    foreign key (tenant_id, work_item_id)
    references public.work_items(tenant_id, id)
    on delete cascade,
  constraint work_item_labels_label_fk
    foreign key (tenant_id, label_id)
    references public.work_labels(tenant_id, id)
    on delete cascade
);

create index work_item_labels_label_idx
  on public.work_item_labels(tenant_id, label_id, work_item_id);

grant select, insert on public.work_labels to authenticated;
grant select, insert, update, delete on public.work_item_labels to authenticated;

alter table public.work_labels enable row level security;
alter table public.work_item_labels enable row level security;

create policy "Tenant members can view work labels"
on public.work_labels for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy "Tenant members can create work labels"
on public.work_labels for insert to authenticated
with check (
  public.is_tenant_member(tenant_id)
  and (created_by is null or created_by = auth.uid())
);

create policy "Tenant members can view work item labels"
on public.work_item_labels for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage work item labels"
on public.work_item_labels for all to authenticated
using (public.is_tenant_member(tenant_id))
with check (
  public.is_tenant_member(tenant_id)
  and (created_by is null or created_by = auth.uid())
);

create or replace function public.replace_work_item_labels(
  p_tenant_id uuid,
  p_work_item_id uuid,
  p_label_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.work_items item
    where item.id = p_work_item_id and item.tenant_id = p_tenant_id
  ) then
    raise exception 'Work item not found for tenant' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_label_ids, '{}'::uuid[])) requested(label_id)
    where not exists (
      select 1 from public.work_labels label
      where label.id = requested.label_id
        and label.tenant_id = p_tenant_id
    )
  ) then
    raise exception 'Work label not found for tenant' using errcode = '23503';
  end if;

  delete from public.work_item_labels
  where tenant_id = p_tenant_id and work_item_id = p_work_item_id;

  insert into public.work_item_labels (
    tenant_id, work_item_id, label_id, created_by
  )
  select p_tenant_id, p_work_item_id, requested.label_id, auth.uid()
  from (
    select distinct label_id
    from unnest(coalesce(p_label_ids, '{}'::uuid[])) requested(label_id)
  ) requested
  on conflict (tenant_id, work_item_id, label_id) do nothing;
end;
$$;

revoke all on function public.replace_work_item_labels(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.replace_work_item_labels(uuid, uuid, uuid[])
  to authenticated;

alter table public.file_links
  drop constraint file_links_subject_type_check;
alter table public.file_links
  add constraint file_links_subject_type_check
  check (subject_type in ('contract', 'work_item'));

create or replace function public.validate_file_link_subject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.subject_type = 'contract'
     and not exists (
       select 1 from public.contracts contract
       where contract.tenant_id = new.tenant_id
         and contract.id = new.subject_id
     ) then
    raise exception 'File link subject contract does not exist for tenant';
  elsif new.subject_type = 'work_item'
     and not exists (
       select 1 from public.work_items item
       where item.tenant_id = new.tenant_id
         and item.id = new.subject_id
     ) then
    raise exception 'File link subject work item does not exist for tenant';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_file_link_subject()
  from public, anon, authenticated;

insert into storage.buckets (id, name, public)
values ('work-attachments', 'work-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists "Work item members can read work attachments" on storage.objects;
create policy "Work item members can read work attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'work-attachments'
  and array_length(storage.foldername(name), 1) = 3
  and exists (
    select 1 from public.work_items item
    where item.tenant_id::text = (storage.foldername(name))[1]
      and item.id::text = (storage.foldername(name))[2]
      and public.is_tenant_member(item.tenant_id)
  )
);

drop policy if exists "Work item members can upload work attachments" on storage.objects;
create policy "Work item members can upload work attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'work-attachments'
  and array_length(storage.foldername(name), 1) = 3
  and exists (
    select 1 from public.work_items item
    where item.tenant_id::text = (storage.foldername(name))[1]
      and item.id::text = (storage.foldername(name))[2]
      and public.is_tenant_member(item.tenant_id)
  )
);

drop policy if exists "Work item members can delete work attachments" on storage.objects;
create policy "Work item members can delete work attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'work-attachments'
  and array_length(storage.foldername(name), 1) = 3
  and exists (
    select 1 from public.work_items item
    where item.tenant_id::text = (storage.foldername(name))[1]
      and item.id::text = (storage.foldername(name))[2]
      and public.is_tenant_member(item.tenant_id)
  )
);
