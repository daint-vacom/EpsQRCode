-- Replace the legacy customer address field with the composed structured address.
create or replace function public.list_customers(
  p_tenant_id uuid,
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null,
  p_customer_search text default null,
  p_business_types public.business_type[] default null,
  p_contact_search text default null,
  p_statuses public.customer_status[] default null,
  p_tag_ids uuid[] default null,
  p_field_filters jsonb default '{}'::jsonb,
  p_responsible_employee_ids uuid[] default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 100);
  v_search text := nullif(btrim(p_search), '');
  v_customer_search text := nullif(btrim(p_customer_search), '');
  v_contact_search text := nullif(btrim(p_contact_search), '');
  v_field_contact_search text := nullif(btrim(p_field_filters ->> 'contactSearch'), '');
  v_customer_code text := nullif(btrim(p_field_filters ->> 'customerCode'), '');
  v_name text := nullif(btrim(p_field_filters ->> 'name'), '');
  v_business_registration_code text := nullif(btrim(p_field_filters ->> 'businessRegistrationCode'), '');
  v_country_code text := nullif(btrim(p_field_filters ->> 'countryCode'), '');
  v_region text := nullif(btrim(p_field_filters ->> 'region'), '');
  v_phone text := nullif(btrim(p_field_filters ->> 'phone'), '');
  v_email text := nullif(btrim(p_field_filters ->> 'email'), '');
  v_address text := nullif(btrim(p_field_filters ->> 'address'), '');
  v_note text := nullif(btrim(p_field_filters ->> 'note'), '');
  v_custom_filters jsonb := case
    when jsonb_typeof(p_field_filters -> 'customFields') = 'object'
      then p_field_filters -> 'customFields'
    else '{}'::jsonb
  end;
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'customers:view')
  then
    raise exception 'Customer view permission required' using errcode = '42501';
  end if;

  with filtered_customers as (
    select
      customer.id,
      customer.tenant_id,
      customer.customer_code,
      customer.name,
      customer.business_type,
      customer.business_registration_code,
      customer.image_url,
      customer.country_code,
      customer.region_code,
      customer.region_name,
      customer.district_name,
      customer.ward_name,
      customer.street_address,
      customer.phone,
      customer.email,
      customer.contact_name,
      customer.contact_title,
      customer.established_date,
      customer.vat_declaration_period,
      customer.status,
      customer.note,
      customer.created_at,
      customer.updated_at,
      coalesce(custom_data.data, '{}'::jsonb) as custom_fields,
      count(*) over () as total_count
    from public.customers customer
    left join public.entity_custom_data custom_data
      on custom_data.tenant_id = customer.tenant_id
     and custom_data.entity_type = 'customer'
     and custom_data.entity_id = customer.id
    where customer.tenant_id = p_tenant_id
      and (
        v_search is null
        or customer.customer_code ilike '%' || v_search || '%'
        or customer.name ilike '%' || v_search || '%'
        or customer.phone ilike '%' || v_search || '%'
        or customer.email ilike '%' || v_search || '%'
        or concat_ws(', ', nullif(customer.street_address, ''), nullif(customer.region_name, ''), case customer.country_code when 'VN' then 'Việt Nam' when 'US' then 'Hoa Kỳ' when 'JP' then 'Nhật Bản' when 'KR' then 'Hàn Quốc' when 'CN' then 'Trung Quốc' when 'SG' then 'Singapore' when 'TH' then 'Thái Lan' when 'MY' then 'Malaysia' when 'AU' then 'Úc' when 'GB' then 'Vương quốc Anh' when 'DE' then 'Đức' when 'FR' then 'Pháp' when 'CA' then 'Canada' when 'IN' then 'Ấn Độ' when 'ID' then 'Indonesia' when 'PH' then 'Philippines' when 'TW' then 'Đài Loan' when 'HK' then 'Hồng Kông' when 'AE' then 'Các Tiểu vương quốc Ả Rập Thống nhất' when 'IT' then 'Ý' when 'ES' then 'Tây Ban Nha' when 'RU' then 'Nga' when 'BR' then 'Brazil' when 'CH' then 'Thụy Sĩ' when 'SE' then 'Thụy Điển' when 'NZ' then 'New Zealand' else customer.country_code end) ilike '%' || v_search || '%'
        or custom_data.data::text ilike '%' || v_search || '%'
      )
      and (v_customer_search is null or customer.customer_code ilike '%' || v_customer_search || '%' or customer.name ilike '%' || v_customer_search || '%')
      and (v_customer_code is null or customer.customer_code ilike '%' || v_customer_code || '%')
      and (v_name is null or customer.name ilike '%' || v_name || '%')
      and (v_business_registration_code is null or customer.business_registration_code ilike '%' || v_business_registration_code || '%')
      and (v_country_code is null or customer.country_code ilike '%' || v_country_code || '%')
      and (v_region is null or customer.region_code ilike '%' || v_region || '%' or customer.region_name ilike '%' || v_region || '%')
      and (v_phone is null or customer.phone ilike '%' || v_phone || '%')
      and (v_email is null or customer.email ilike '%' || v_email || '%')
      and (v_address is null or concat_ws(', ', nullif(customer.street_address, ''), nullif(customer.region_name, ''), case customer.country_code when 'VN' then 'Việt Nam' when 'US' then 'Hoa Kỳ' when 'JP' then 'Nhật Bản' when 'KR' then 'Hàn Quốc' when 'CN' then 'Trung Quốc' when 'SG' then 'Singapore' when 'TH' then 'Thái Lan' when 'MY' then 'Malaysia' when 'AU' then 'Úc' when 'GB' then 'Vương quốc Anh' when 'DE' then 'Đức' when 'FR' then 'Pháp' when 'CA' then 'Canada' when 'IN' then 'Ấn Độ' when 'ID' then 'Indonesia' when 'PH' then 'Philippines' when 'TW' then 'Đài Loan' when 'HK' then 'Hồng Kông' when 'AE' then 'Các Tiểu vương quốc Ả Rập Thống nhất' when 'IT' then 'Ý' when 'ES' then 'Tây Ban Nha' when 'RU' then 'Nga' when 'BR' then 'Brazil' when 'CH' then 'Thụy Sĩ' when 'SE' then 'Thụy Điển' when 'NZ' then 'New Zealand' else customer.country_code end) ilike '%' || v_address || '%')
      and (v_note is null or customer.note ilike '%' || v_note || '%')
      and (v_contact_search is null or customer.phone ilike '%' || v_contact_search || '%' or customer.email ilike '%' || v_contact_search || '%')
      and (v_field_contact_search is null or customer.phone ilike '%' || v_field_contact_search || '%' or customer.email ilike '%' || v_field_contact_search || '%')
      and (p_business_types is null or cardinality(p_business_types) = 0 or customer.business_type = any(p_business_types))
      and (p_statuses is null or cardinality(p_statuses) = 0 or customer.status = any(p_statuses))
      and (p_tag_ids is null or cardinality(p_tag_ids) = 0 or exists (
        select 1 from public.tag_assignments assignment
        where assignment.tenant_id = customer.tenant_id
          and assignment.subject_type = 'customer'
          and assignment.subject_id = customer.id
          and assignment.tag_id = any(p_tag_ids)
      ))
      and (p_responsible_employee_ids is null or cardinality(p_responsible_employee_ids) = 0 or exists (
        select 1
        from public.customer_responsibles responsible
        where responsible.tenant_id = customer.tenant_id
          and responsible.customer_id = customer.id
          and responsible.employee_id = any(p_responsible_employee_ids)
        union all
        select 1
        from public.employee_customer_all_roles all_role
        where all_role.tenant_id = customer.tenant_id
          and all_role.customer_id = customer.id
          and all_role.employee_id = any(p_responsible_employee_ids)
      ))
      and not exists (
        select 1
        from jsonb_each_text(v_custom_filters) filter_item
        where coalesce(custom_data.data ->> filter_item.key, '') not ilike '%' || filter_item.value || '%'
      )
  )
  select jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(
          to_jsonb(page_row) - 'total_count' - 'created_at'
          order by page_row.created_at asc, page_row.id asc
        )
        from (
          select *
          from filtered_customers
          order by created_at asc, id asc
          offset (v_page - 1) * v_page_size
          limit v_page_size
        ) page_row
      ),
      '[]'::jsonb
    ),
    'total', coalesce((select max(total_count) from filtered_customers), 0)
  ) into v_result;

  return v_result;
end;
$$;
-- Preserve legacy free-form address details in the street line before removing the old column.
update public.customers
set street_address = case
  when nullif(btrim(street_address), '') is null then btrim(address_detail)
  when position(lower(btrim(address_detail)) in lower(btrim(street_address))) > 0 then street_address
  when position(lower(btrim(street_address)) in lower(btrim(address_detail))) > 0 then btrim(address_detail)
  else concat_ws(', ', nullif(btrim(street_address), ''), nullif(btrim(address_detail), ''))
end
where nullif(btrim(address_detail), '') is not null;

update public.customers customer
set region_name = region.name
from public.regions region
where customer.country_code = 'VN'
  and region.country_code = customer.country_code
  and region.code = customer.region_code
  and nullif(btrim(customer.region_name), '') is null;

-- Rename saved customer-view filter and column identifiers to the new address key.
update public.tenant_saved_views
set config = jsonb_set(
  jsonb_set(
    jsonb_set(
      config,
      '{filters}',
      (
        (coalesce(config -> 'filters', '{}'::jsonb) - 'addressDetail')
        || case
          when coalesce(config -> 'filters', '{}'::jsonb) ? 'addressDetail'
            and not (coalesce(config -> 'filters', '{}'::jsonb) ? 'address')
            then jsonb_build_object('address', config -> 'filters' -> 'addressDetail')
          else '{}'::jsonb
        end
      ),
      true
    ),
    '{columnVisibility}',
    (
      (coalesce(config -> 'columnVisibility', '{}'::jsonb) - 'addressDetail')
      || case
        when coalesce(config -> 'columnVisibility', '{}'::jsonb) ? 'addressDetail'
          and not (coalesce(config -> 'columnVisibility', '{}'::jsonb) ? 'address')
          then jsonb_build_object('address', config -> 'columnVisibility' -> 'addressDetail')
        else '{}'::jsonb
      end
    ),
    true
  ),
  '{columnOrder}',
  case
    when jsonb_typeof(config -> 'columnOrder') = 'array' then (
      select coalesce(
        jsonb_agg(
          to_jsonb(case when item.value = 'addressDetail' then 'address' else item.value end)
          order by item.ordinality
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements_text(config -> 'columnOrder') with ordinality as item(value, ordinality)
    )
    else coalesce(config -> 'columnOrder', '[]'::jsonb)
  end,
  true
)
where resource = 'customers'
  and (
    coalesce(config -> 'filters', '{}'::jsonb) ? 'addressDetail'
    or coalesce(config -> 'columnVisibility', '{}'::jsonb) ? 'addressDetail'
    or coalesce(config -> 'columnOrder', '[]'::jsonb) ? 'addressDetail'
  );

alter table public.customers drop column address_detail;

notify pgrst, 'reload schema';
