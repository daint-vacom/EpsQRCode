create or replace function private.validate_material_specification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.data_type = 'list' then
    if pg_catalog.jsonb_typeof(new.options) <> 'array' then
      raise exception 'List specification options must be an array'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(new.options) as option_row(option_value)
      where pg_catalog.jsonb_typeof(option_row.option_value) <> 'object'
        or coalesce(option_row.option_value ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or length(pg_catalog.btrim(coalesce(option_row.option_value ->> 'label', ''))) = 0
    ) then
      raise exception 'Each list option must include a UUID and label'
        using errcode = '22023';
    end if;

    if exists (
      select pg_catalog.lower(pg_catalog.btrim(option_row.option_value ->> 'label'))
      from pg_catalog.jsonb_array_elements(new.options) as option_row(option_value)
      group by pg_catalog.lower(pg_catalog.btrim(option_row.option_value ->> 'label'))
      having count(*) > 1
    ) then
      raise exception 'List option labels must be unique within a specification'
        using errcode = '23505';
    end if;
  else
    new.options := '[]'::jsonb;
  end if;

  if new.data_type <> 'number' then
    new.unit := null;
  end if;

  return new;
end;
$$;

alter table public.material_specifications
  drop constraint if exists material_specifications_default_selection_mode_check,
  drop column if exists default_selection_mode,
  drop column if exists allow_model_selection_override,
  drop column if exists allow_model_options_override;

insert into public.material_specifications (
  code, name, data_type, unit, description, options, default_value
)
values
  (
    'TS-00001', 'Kích thước', 'text', null,
    'Kích thước tổng thể hoặc quy cách đóng gói của vật tư.',
    '[]'::jsonb, null
  ),
  (
    'TS-00002', 'Chiều dài', 'number', 'mm',
    'Chiều dài của vật tư.',
    '[]'::jsonb, null
  ),
  (
    'TS-00003', 'Chiều rộng', 'number', 'mm',
    'Chiều rộng của vật tư.',
    '[]'::jsonb, null
  ),
  (
    'TS-00004', 'Chiều cao', 'number', 'mm',
    'Chiều cao của vật tư.',
    '[]'::jsonb, null
  ),
  (
    'TS-00005', 'Đường kính', 'number', 'mm',
    'Đường kính ngoài của vật tư.',
    '[]'::jsonb, null
  ),
  (
    'TS-00006', 'Khối lượng', 'number', 'kg',
    'Khối lượng của một đơn vị vật tư.',
    '[]'::jsonb, null
  ),
  (
    'TS-00007', 'Chất liệu', 'list', null,
    'Vật liệu chính cấu thành vật tư.',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Inox 304'),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Inox 201'),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Thép carbon'),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Nhôm'),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Đồng'),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Nhựa')
    ), null
  ),
  (
    'TS-00008', 'Màu sắc', 'list', null,
    'Màu sắc hoàn thiện của vật tư.',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Trắng'),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Đen'),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Xám'),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Bạc'),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Xanh dương')
    ), null
  ),
  (
    'TS-00009', 'Điện áp', 'number', 'V',
    'Điện áp định mức của vật tư hoặc thiết bị.',
    '[]'::jsonb, null
  ),
  (
    'TS-00010', 'Công suất', 'number', 'W',
    'Công suất định mức của vật tư hoặc thiết bị.',
    '[]'::jsonb, null
  ),
  (
    'TS-00011', 'Xuất xứ', 'text', null,
    'Quốc gia hoặc khu vực sản xuất vật tư.',
    '[]'::jsonb, null
  )
on conflict do nothing;
