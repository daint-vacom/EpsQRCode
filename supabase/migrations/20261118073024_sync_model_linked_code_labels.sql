-- Keep legacy writes to external_codes visible in the labeled-code editor.
-- Explicit writes that update linked_codes are preserved as supplied.
create or replace function private.sync_material_model_linked_code_labels()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.linked_codes, '[]'::jsonb) = '[]'::jsonb
      and coalesce(cardinality(new.external_codes), 0) > 0 then
      select coalesce(
        jsonb_agg(
          jsonb_build_object('label', 'Mã liên kết', 'value', btrim(code))
          order by ordinality
        ),
        '[]'::jsonb
      )
      into new.linked_codes
      from unnest(new.external_codes) with ordinality as codes(code, ordinality)
      where nullif(btrim(code), '') is not null;
    end if;
  elsif new.external_codes is distinct from old.external_codes
    and new.linked_codes is not distinct from old.linked_codes
    and coalesce(cardinality(new.external_codes), 0) > 0 then
    select coalesce(
      jsonb_agg(
        jsonb_build_object('label', 'Mã liên kết', 'value', btrim(code))
        order by ordinality
      ),
      '[]'::jsonb
    )
    into new.linked_codes
    from unnest(new.external_codes) with ordinality as codes(code, ordinality)
    where nullif(btrim(code), '') is not null;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_material_model_linked_code_labels
  on public.material_models;

create trigger sync_material_model_linked_code_labels
before insert or update of external_codes, linked_codes
on public.material_models
for each row
execute function private.sync_material_model_linked_code_labels();
