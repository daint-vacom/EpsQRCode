alter table public.material_groups
  add column if not exists is_active boolean not null default true;
