-- Editable material QR label templates and per-material last-used selection.
-- This schema is for the isolated EpsQRCode development project.

create table public.material_label_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  width_mm numeric(7,2) not null default 60,
  height_mm numeric(7,2) not null default 35,
  design jsonb not null default '{"version":1,"objects":[]}'::jsonb
    check (jsonb_typeof(design) = 'object'),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id),
  updated_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint material_label_templates_name_not_blank check (length(btrim(name)) > 0),
  constraint material_label_templates_width_range check (width_mm between 20 and 200),
  constraint material_label_templates_height_range check (height_mm between 10 and 120)
);

create unique index material_label_templates_one_active_default_idx
  on public.material_label_templates(is_default)
  where is_active and is_default;
create index material_label_templates_order_idx
  on public.material_label_templates(is_active desc, is_default desc, lower(name) collate "vi-x-icu", id);

create table public.material_last_label_templates (
  material_id uuid primary key references public.materials(id) on delete cascade,
  template_id uuid references public.material_label_templates(id) on delete set null,
  last_printed_at timestamptz not null default timezone('utc', now()),
  updated_by uuid not null default auth.uid() references auth.users(id),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.material_label_templates enable row level security;
alter table public.material_last_label_templates enable row level security;

create policy material_label_templates_view on public.material_label_templates
  for select to authenticated
  using (public.has_permission('materials:material:view'));
create policy material_label_templates_manage on public.material_label_templates
  for all to authenticated
  using (public.has_permission('materials:material:manage'))
  with check (public.has_permission('materials:material:manage'));

create policy material_last_label_templates_view on public.material_last_label_templates
  for select to authenticated
  using (public.has_permission('materials:material:view'));
create policy material_last_label_templates_write on public.material_last_label_templates
  for all to authenticated
  using (public.has_permission('materials:material:view'))
  with check (public.has_permission('materials:material:view'));

revoke all on public.material_label_templates, public.material_last_label_templates from anon, public;
grant select, insert, update, delete on public.material_label_templates to authenticated;
grant select, insert, update, delete on public.material_last_label_templates to authenticated;

create or replace function public.list_material_label_templates()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception using errcode = '42501', message = 'Bạn không có quyền xem mẫu nhãn vật tư.';
  end if;

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', template.id,
        'name', template.name,
        'description', template.description,
        'widthMm', template.width_mm,
        'heightMm', template.height_mm,
        'design', template.design,
        'isDefault', template.is_default,
        'isActive', template.is_active,
        'createdAt', template.created_at,
        'updatedAt', template.updated_at
      ) order by template.is_active desc, template.is_default desc,
        lower(template.name) collate "vi-x-icu", template.id)
      from public.material_label_templates template
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_material_label_template(
  p_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template public.material_label_templates%rowtype;
  v_name text := nullif(btrim(p_payload->>'name'), '');
  v_width numeric := (p_payload->>'widthMm')::numeric;
  v_height numeric := (p_payload->>'heightMm')::numeric;
  v_default boolean := coalesce((p_payload->>'isDefault')::boolean, false);
  v_active boolean := coalesce((p_payload->>'isActive')::boolean, true);
  v_design jsonb := coalesce(p_payload->'design', '{"version":1,"objects":[]}'::jsonb);
begin
  if auth.uid() is null or not public.has_permission('materials:material:manage') then
    raise exception using errcode = '42501', message = 'Bạn không có quyền quản lý mẫu nhãn vật tư.';
  end if;
  if v_name is null then
    raise exception using errcode = '22023', message = 'Tên mẫu nhãn không được để trống.';
  end if;
  if v_width not between 20 and 200 or v_height not between 10 and 120 then
    raise exception using errcode = '22023', message = 'Kích thước mẫu nhãn nằm ngoài giới hạn cho phép.';
  end if;
  if jsonb_typeof(v_design) <> 'object' then
    raise exception using errcode = '22023', message = 'Bố cục mẫu nhãn không hợp lệ.';
  end if;

  if v_default and v_active then
    update public.material_label_templates
    set is_default = false, updated_by = auth.uid(), updated_at = timezone('utc', now())
    where is_default and is_active and id is distinct from p_id;
  end if;

  if p_id is null then
    insert into public.material_label_templates
      (name, description, width_mm, height_mm, design, is_default, is_active, created_by, updated_by)
    values
      (v_name, nullif(btrim(p_payload->>'description'), ''), v_width, v_height,
        v_design, v_default and v_active, v_active, auth.uid(), auth.uid())
    returning * into v_template;
  else
    update public.material_label_templates
    set name = v_name,
        description = nullif(btrim(p_payload->>'description'), ''),
        width_mm = v_width,
        height_mm = v_height,
        design = v_design,
        is_default = v_default and v_active,
        is_active = v_active,
        updated_by = auth.uid(),
        updated_at = timezone('utc', now())
    where id = p_id
    returning * into v_template;
    if not found then
      raise exception using errcode = 'P0002', message = 'Không tìm thấy mẫu nhãn.';
    end if;
  end if;

  if not exists (
    select 1 from public.material_label_templates
    where is_active and is_default
  ) then
    update public.material_label_templates
    set is_default = true, updated_by = auth.uid(), updated_at = timezone('utc', now())
    where id = (
      select id from public.material_label_templates
      where is_active
      order by lower(name) collate "vi-x-icu", id
      limit 1
    );
  end if;

  return jsonb_build_object(
    'id', v_template.id,
    'name', v_template.name,
    'description', v_template.description,
    'widthMm', v_template.width_mm,
    'heightMm', v_template.height_mm,
    'design', v_template.design,
    'isDefault', v_template.is_default,
    'isActive', v_template.is_active,
    'createdAt', v_template.created_at,
    'updatedAt', v_template.updated_at
  );
end;
$$;

create or replace function public.list_material_label_template_preferences(p_material_ids uuid[])
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception using errcode = '42501', message = 'Bạn không có quyền xem lựa chọn mẫu nhãn.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'materialId', preference.material_id,
      'templateId', preference.template_id,
      'lastPrintedAt', preference.last_printed_at
    ) order by preference.material_id)
    from public.material_last_label_templates preference
    where preference.material_id = any(coalesce(p_material_ids, '{}'::uuid[]))
  ), '[]'::jsonb);
end;
$$;

create or replace function public.save_material_label_template_preferences(
  p_material_ids uuid[],
  p_template_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('materials:material:view') then
    raise exception using errcode = '42501', message = 'Bạn không có quyền lưu mẫu nhãn đã chọn.';
  end if;
  if not exists (
    select 1 from public.material_label_templates
    where id = p_template_id and is_active
  ) then
    raise exception using errcode = 'P0002', message = 'Mẫu nhãn không còn hoạt động.';
  end if;

  insert into public.material_last_label_templates
    (material_id, template_id, last_printed_at, updated_by, updated_at)
  select distinct material.id, p_template_id, timezone('utc', now()), auth.uid(), timezone('utc', now())
  from unnest(coalesce(p_material_ids, '{}'::uuid[])) as requested(id)
  join public.materials material on material.id = requested.id
  on conflict (material_id) do update
    set template_id = excluded.template_id,
        last_printed_at = excluded.last_printed_at,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.list_material_label_templates() from public, anon;
revoke all on function public.save_material_label_template(uuid, jsonb) from public, anon;
revoke all on function public.list_material_label_template_preferences(uuid[]) from public, anon;
revoke all on function public.save_material_label_template_preferences(uuid[], uuid) from public, anon;
grant execute on function public.list_material_label_templates() to authenticated;
grant execute on function public.save_material_label_template(uuid, jsonb) to authenticated;
grant execute on function public.list_material_label_template_preferences(uuid[]) to authenticated;
grant execute on function public.save_material_label_template_preferences(uuid[], uuid) to authenticated;

insert into public.material_label_templates
  (id, name, description, width_mm, height_mm, design, is_default, is_active)
values
  ('a1000000-0000-4000-8000-000000000001', 'Nhãn vật tư tiêu chuẩn',
    'Mẫu nhãn mặc định, có mã QR và thông tin định danh vật tư.', 60, 35,
    '{"version":1,"objects":[]}'::jsonb, true, true);
