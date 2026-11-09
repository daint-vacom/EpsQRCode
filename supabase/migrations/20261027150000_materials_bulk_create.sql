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
      v_id := public.save_material(null, null, v_item);
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
