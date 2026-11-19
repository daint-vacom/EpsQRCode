create table private.material_code_generation_counters (
  model_id uuid primary key
    references public.material_models(id) on delete cascade,
  last_value bigint not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table private.material_code_generation_counters enable row level security;
revoke all on private.material_code_generation_counters
  from public, anon, authenticated;

insert into private.material_code_generation_counters (model_id, last_value)
select model.id,
  coalesce(max(
    case
      when suffix.value ~ '^[0-9]{1,18}$' then suffix.value::bigint
      else null
    end
  ), 0)
from public.material_models model
left join public.materials material on material.model_id = model.id
cross join lateral (
  select pg_catalog.substr(
    material.code,
    pg_catalog.char_length(pg_catalog.btrim(model.code)) + 2
  ) as value
) suffix
where material.id is null
  or (
    pg_catalog.lower(pg_catalog.left(
      pg_catalog.btrim(material.code),
      pg_catalog.char_length(pg_catalog.btrim(model.code))
    )) = pg_catalog.lower(pg_catalog.btrim(model.code))
    and pg_catalog.substr(
      pg_catalog.btrim(material.code),
      pg_catalog.char_length(pg_catalog.btrim(model.code)) + 1,
      1
    ) = '-'
  )
group by model.id
on conflict (model_id) do nothing;

create or replace function private.generate_material_code_from_model()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_model_code text;
  v_sequence bigint;
  v_code text;
begin
  if new.code is not null and pg_catalog.length(pg_catalog.btrim(new.code)) > 0 then
    return new;
  end if;

  select pg_catalog.btrim(model.code)
  into v_model_code
  from public.material_models model
  where model.id = new.model_id;

  if v_model_code is null then
    raise exception 'Material model not found' using errcode = 'P0002';
  end if;

  insert into private.material_code_generation_counters (model_id, last_value)
  values (new.model_id, 0)
  on conflict (model_id) do nothing;

  loop
    update private.material_code_generation_counters as counter
    set last_value = counter.last_value + 1,
        updated_at = pg_catalog.timezone('utc', pg_catalog.now())
    where counter.model_id = new.model_id
    returning last_value into v_sequence;

    v_code := v_model_code || '-' || pg_catalog.lpad(v_sequence::text, 3, '0');
    exit when not exists (
      select 1
      from public.materials material
      where pg_catalog.lower(pg_catalog.btrim(material.code)) =
        pg_catalog.lower(pg_catalog.btrim(v_code))
    );
  end loop;

  new.code := v_code;
  return new;
end;
$$;

revoke all on function private.generate_material_code_from_model()
  from public, anon, authenticated;

drop trigger if exists materials_generate_code_from_model on public.materials;
create trigger materials_generate_code_from_model
before insert on public.materials
for each row execute function private.generate_material_code_from_model();

create or replace function public.create_materials_bulk(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_row_number integer := 0;
  v_id uuid;
  v_code text;
  v_error text;
  v_capital_source_id uuid;
  v_results jsonb := '[]'::jsonb;
begin
  if auth.uid() is null
    or not public.has_permission('materials:material:manage') then
    raise exception 'Permission denied to manage materials'
      using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'A batch can contain at most 100 materials'
      using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_row_number := v_row_number + 1;
    v_code := coalesce(v_item->>'code', '');
    begin
      v_capital_source_id := nullif(v_item->>'capitalSourceId', '')::uuid;
      if v_capital_source_id is not null and not exists (
        select 1 from public.material_capital_sources source
        where source.id = v_capital_source_id and source.is_active
      ) then
        raise exception 'Invalid material capital source' using errcode = '22023';
      end if;
      if nullif(v_item->>'unitPriceOverride', '') is not null
        and (v_item->>'unitPriceOverride')::numeric < 0 then
        raise exception 'Material unit price must be nonnegative' using errcode = '22023';
      end if;
      if v_item ? 'isActive' and jsonb_typeof(v_item->'isActive') is distinct from 'boolean' then
        raise exception 'Invalid material availability' using errcode = '22023';
      end if;

      v_id := public.save_material(null, null, v_item);
      update public.materials
      set placed_into_service_date = nullif(v_item->>'placedIntoServiceDate', '')::date,
          capital_source_id = v_capital_source_id,
          unit_price_override = nullif(v_item->>'unitPriceOverride', '')::numeric,
          is_active = coalesce((v_item->>'isActive')::boolean, true)
      where id = v_id;
      perform public.set_material_linked_codes(
        v_id,
        coalesce(v_item->'linkedCodes', '[]'::jsonb)
      );
      update public.material_history history
      set to_state = public.material_json(v_id)
      where history.id = (
        select latest.id from public.material_history latest
        where latest.material_id = v_id
        order by latest.created_at desc, latest.id desc limit 1
      );
      select material.code into v_code
      from public.materials material
      where material.id = v_id;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'rowNumber', v_row_number,
        'code', v_code,
        'success', true,
        'id', v_id,
        'error', null
      ));
    exception when others then
      get stacked diagnostics v_error = message_text;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'rowNumber', v_row_number,
        'code', v_code,
        'success', false,
        'id', null,
        'error', v_error
      ));
    end;
  end loop;
  return v_results;
end;
$$;

revoke all on function public.create_materials_bulk(jsonb) from public, anon;
grant execute on function public.create_materials_bulk(jsonb) to authenticated;

notify pgrst, 'reload schema';
