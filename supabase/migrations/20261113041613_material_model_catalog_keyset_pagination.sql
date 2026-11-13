create index if not exists material_models_active_name_vi_id_idx
  on public.material_models (
    is_active desc,
    (lower(name) collate "vi-x-icu"),
    id
  );

create or replace function public.list_material_models_page(
  p_after_is_active boolean default null,
  p_after_name text default null,
  p_after_id uuid default null,
  p_page_size integer default 200
)
returns setof public.material_models
language sql
stable
security invoker
set search_path = ''
as $$
  select model.*
  from public.material_models as model
  where p_after_id is null
    or model.is_active < p_after_is_active
    or (
      model.is_active = p_after_is_active
      and (
        lower(model.name) collate "vi-x-icu"
          > lower(p_after_name) collate "vi-x-icu"
        or (
          lower(model.name) collate "vi-x-icu"
            = lower(p_after_name) collate "vi-x-icu"
          and model.id > p_after_id
        )
      )
    )
  order by
    model.is_active desc,
    lower(model.name) collate "vi-x-icu",
    model.id
  limit greatest(1, least(coalesce(p_page_size, 200), 250));
$$;

revoke all on function public.list_material_models_page(boolean, text, uuid, integer)
  from public, anon;
grant execute on function public.list_material_models_page(boolean, text, uuid, integer)
  to authenticated;
