-- Apply the default list ordering policy from AGENTS.md to existing list RPCs.

CREATE OR REPLACE FUNCTION public.list_employees(p_tenant_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 10, p_search text DEFAULT NULL::text, p_statuses employee_status[] DEFAULT NULL::employee_status[], p_role_ids uuid[] DEFAULT NULL::uuid[], p_account_linked boolean DEFAULT NULL::boolean, p_tag_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 100);
  v_search text := nullif(btrim(p_search), '');
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'organization:employee:view')
  then
    raise exception 'Employee view permission required' using errcode = '42501';
  end if;

  with filtered_employees as (
    select
      employee.id,
      employee.tenant_id,
      employee.user_id,
      employee.employee_code,
      employee.first_name,
      employee.last_name,
      employee.phone,
      employee.status,
      employee.joined_at,
      employee.note,
      coalesce(employee.avatar_url, profile.avatar_url) as avatar_url,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('name', role.name, 'color', role.color)
            order by lower(role.name) collate "vi-x-icu", role.id
          )
          from public.tenant_member_roles member_role
          join public.roles role
            on role.id = member_role.role_id
           and (role.tenant_id is null or role.tenant_id = employee.tenant_id)
           and role.is_active
          where member_role.tenant_id = employee.tenant_id
            and member_role.user_id = employee.user_id
        ),
        '[]'::jsonb
      ) as roles,
      coalesce(
        (
          select jsonb_agg(member_role.role_id order by member_role.role_id)
          from public.tenant_member_roles member_role
          join public.roles role
            on role.id = member_role.role_id
           and (role.tenant_id is null or role.tenant_id = employee.tenant_id)
           and role.is_active
          where member_role.tenant_id = employee.tenant_id
            and member_role.user_id = employee.user_id
        ),
        '[]'::jsonb
      ) as role_ids,
      count(*) over () as total_count
    from public.employees employee
    left join public.user_profiles profile
      on profile.id = employee.user_id
    where employee.tenant_id = p_tenant_id
      and (
        v_search is null
        or employee.employee_code ilike '%' || v_search || '%'
        or concat_ws(' ', employee.last_name, employee.first_name) ilike '%' || v_search || '%'
        or employee.phone ilike '%' || v_search || '%'
      )
      and (
        p_statuses is null or cardinality(p_statuses) = 0
        or employee.status = any(p_statuses)
      )
      and (
        p_role_ids is null or cardinality(p_role_ids) = 0
        or exists (
          select 1
          from public.tenant_member_roles member_role
          where member_role.tenant_id = employee.tenant_id
            and member_role.user_id = employee.user_id
            and member_role.role_id = any(p_role_ids)
        )
      )
      and (
        p_account_linked is null
        or (employee.user_id is not null) = p_account_linked
      )
      and (
        p_tag_ids is null or cardinality(p_tag_ids) = 0
        or exists (
          select 1
          from public.tag_assignments assignment
          where assignment.tenant_id = employee.tenant_id
            and assignment.subject_type = 'employee'
            and assignment.subject_id = employee.id
            and assignment.tag_id = any(p_tag_ids)
        )
      )
  )
  select jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(
          to_jsonb(page_row) - 'total_count'
          order by
            case page_row.status::text when 'active' then 0 when 'inactive' then 2 else 3 end,
            lower(concat_ws(' ', page_row.last_name, page_row.first_name)) collate "vi-x-icu",
            page_row.id asc
        )
        from (
          select *
          from filtered_employees
          order by
            case status::text when 'active' then 0 when 'inactive' then 2 else 3 end,
            lower(concat_ws(' ', last_name, first_name)) collate "vi-x-icu",
            id asc
          offset (v_page - 1) * v_page_size
          limit v_page_size
        ) page_row
      ),
      '[]'::jsonb
    ),
    'total', coalesce((select max(total_count) from filtered_employees), 0)
  ) into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_customer_responsibility_filter_options(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'customers:view')
  then
    raise exception 'Customer view permission required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'employees', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', employee.id,
            'employeeCode', employee.employee_code,
            'displayName', trim(concat(employee.last_name, ' ', employee.first_name)),
            'status', employee.status,
            'avatarUrl', profile.avatar_url,
            'customerCount', (
              select count(distinct assignment.customer_id)
              from (
                select responsible.customer_id
                from public.customer_responsibles responsible
                where responsible.tenant_id = p_tenant_id
                  and responsible.employee_id = employee.id
                union
                select all_role.customer_id
                from public.employee_customer_all_roles all_role
                where all_role.tenant_id = p_tenant_id
                  and all_role.employee_id = employee.id
              ) assignment
            )
          )
          order by
            case employee.status::text when 'active' then 0 when 'inactive' then 2 else 3 end,
            lower(trim(concat(employee.last_name, ' ', employee.first_name))) collate "vi-x-icu",
            employee.id asc
        )
        from public.employees employee
        left join public.user_profiles profile on profile.id = employee.user_id
        where employee.tenant_id = p_tenant_id
          and (
            employee.status = 'active'
            or exists (
              select 1
              from public.customer_responsibles responsible
              where responsible.tenant_id = p_tenant_id
                and responsible.employee_id = employee.id
            )
            or exists (
              select 1
              from public.employee_customer_all_roles all_role
              where all_role.tenant_id = p_tenant_id
                and all_role.employee_id = employee.id
            )
          )
      ),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_customers(p_tenant_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 10, p_search text DEFAULT NULL::text, p_customer_search text DEFAULT NULL::text, p_business_types business_type[] DEFAULT NULL::business_type[], p_contact_search text DEFAULT NULL::text, p_statuses customer_status[] DEFAULT NULL::customer_status[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_field_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  v_address_detail text := nullif(btrim(p_field_filters ->> 'addressDetail'), '');
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
      customer.address_detail,
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
        or customer.address_detail ilike '%' || v_search || '%'
        or custom_data.data::text ilike '%' || v_search || '%'
      )
      and (
        v_customer_search is null
        or customer.customer_code ilike '%' || v_customer_search || '%'
        or customer.name ilike '%' || v_customer_search || '%'
      )
      and (
        v_customer_code is null
        or customer.customer_code ilike '%' || v_customer_code || '%'
      )
      and (
        v_name is null
        or customer.name ilike '%' || v_name || '%'
      )
      and (
        v_business_registration_code is null
        or customer.business_registration_code ilike '%' || v_business_registration_code || '%'
      )
      and (
        v_country_code is null
        or customer.country_code ilike '%' || v_country_code || '%'
      )
      and (
        v_region is null
        or customer.region_code ilike '%' || v_region || '%'
        or customer.region_name ilike '%' || v_region || '%'
      )
      and (
        v_phone is null
        or customer.phone ilike '%' || v_phone || '%'
      )
      and (
        v_email is null
        or customer.email ilike '%' || v_email || '%'
      )
      and (
        v_address_detail is null
        or customer.address_detail ilike '%' || v_address_detail || '%'
      )
      and (
        v_note is null
        or customer.note ilike '%' || v_note || '%'
      )
      and (
        v_contact_search is null
        or customer.phone ilike '%' || v_contact_search || '%'
        or customer.email ilike '%' || v_contact_search || '%'
      )
      and (
        v_field_contact_search is null
        or customer.phone ilike '%' || v_field_contact_search || '%'
        or customer.email ilike '%' || v_field_contact_search || '%'
      )
      and (
        p_business_types is null
        or cardinality(p_business_types) = 0
        or customer.business_type = any(p_business_types)
      )
      and (
        p_statuses is null
        or cardinality(p_statuses) = 0
        or customer.status = any(p_statuses)
      )
      and (
        p_tag_ids is null
        or cardinality(p_tag_ids) = 0
        or exists (
          select 1
          from public.tag_assignments assignment
          where assignment.tenant_id = customer.tenant_id
            and assignment.subject_type = 'customer'
            and assignment.subject_id = customer.id
            and assignment.tag_id = any(p_tag_ids)
        )
      )
      and not exists (
        select 1
        from jsonb_each_text(v_custom_filters) filter_item
        where coalesce(custom_data.data ->> filter_item.key, '')
          not ilike '%' || filter_item.value || '%'
      )
  )
  select jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(
          to_jsonb(page_row) - 'total_count' - 'created_at'
          order by
            case page_row.status::text when 'active' then 0 when 'uncontacted' then 1 when 'inactive' then 2 else 3 end,
            lower(page_row.name) collate "vi-x-icu",
            page_row.id asc
        )
        from (
          select *
          from filtered_customers
          order by
            case status::text when 'active' then 0 when 'uncontacted' then 1 when 'inactive' then 2 else 3 end,
            lower(name) collate "vi-x-icu",
            id asc
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
$function$;

CREATE OR REPLACE FUNCTION public.list_customers_without_tab_summary(p_tenant_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 10, p_search text DEFAULT NULL::text, p_customer_search text DEFAULT NULL::text, p_business_types business_type[] DEFAULT NULL::business_type[], p_contact_search text DEFAULT NULL::text, p_statuses customer_status[] DEFAULT NULL::customer_status[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_field_filters jsonb DEFAULT '{}'::jsonb, p_responsible_employee_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
          order by
            case page_row.status::text when 'active' then 0 when 'uncontacted' then 1 when 'inactive' then 2 else 3 end,
            lower(page_row.name) collate "vi-x-icu",
            page_row.id asc
        )
        from (
          select *
          from filtered_customers
          order by
            case status::text when 'active' then 0 when 'uncontacted' then 1 when 'inactive' then 2 else 3 end,
            lower(name) collate "vi-x-icu",
            id asc
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
$function$;

CREATE OR REPLACE FUNCTION public.list_contract_templates(p_tenant_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 10, p_search text DEFAULT NULL::text, p_template_search text DEFAULT NULL::text, p_statuses contract_template_status[] DEFAULT NULL::contract_template_status[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_line_count_min integer DEFAULT NULL::integer, p_line_count_max integer DEFAULT NULL::integer, p_contract_count_min integer DEFAULT NULL::integer, p_contract_count_max integer DEFAULT NULL::integer, p_version_no_min integer DEFAULT NULL::integer, p_version_no_max integer DEFAULT NULL::integer, p_updated_from date DEFAULT NULL::date, p_updated_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 100);
  v_search text := nullif(btrim(p_search), '');
  v_template_search text := nullif(btrim(p_template_search), '');
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'contracts:view')
  then
    raise exception 'Contract template view permission required' using errcode = '42501';
  end if;

  with filtered_templates as (
    select
      template.id,
      template.tenant_id,
      template.code,
      template.name,
      template.description,
      template.status,
      template.currency_code,
      template.auto_renew_default,
      template.note,
      template.created_by,
      template.created_at,
      template.updated_at,
      latest.version_no as latest_version_no,
      latest.status as latest_version_status,
      coalesce(line_count.total, 0)::integer as line_count,
      coalesce(contract_count.total, 0)::integer as contract_count,
      count(*) over () as total_count
    from public.contract_templates template
    left join lateral (
      select version.version_no, version.status
      from public.contract_template_versions version
      where version.template_id = template.id
      order by version.version_no desc
      limit 1
    ) latest on true
    left join lateral (
      select count(*) as total
      from public.contract_template_version_lines line
      join public.contract_template_versions version
        on version.id = line.template_version_id
      where version.template_id = template.id
        and version.version_no = coalesce(latest.version_no, 0)
    ) line_count on true
    left join lateral (
      select count(*) as total
      from public.contracts contract
      where contract.source_template_id = template.id
    ) contract_count on true
    where template.tenant_id = p_tenant_id
      and (
        v_search is null
        or template.code ilike '%' || v_search || '%'
        or template.name ilike '%' || v_search || '%'
        or template.description ilike '%' || v_search || '%'
      )
      and (
        v_template_search is null
        or template.code ilike '%' || v_template_search || '%'
        or template.name ilike '%' || v_template_search || '%'
      )
      and (
        p_statuses is null
        or cardinality(p_statuses) = 0
        or template.status = any(p_statuses)
      )
      and (
        p_tag_ids is null
        or cardinality(p_tag_ids) = 0
        or exists (
          select 1
          from public.tag_assignments assignment
          where assignment.tenant_id = template.tenant_id
            and assignment.subject_type = 'contract_template'
            and assignment.subject_id = template.id
            and assignment.tag_id = any(p_tag_ids)
        )
      )
      and (
        p_line_count_min is null
        or coalesce(line_count.total, 0) >= p_line_count_min
      )
      and (
        p_line_count_max is null
        or coalesce(line_count.total, 0) <= p_line_count_max
      )
      and (
        p_contract_count_min is null
        or coalesce(contract_count.total, 0) >= p_contract_count_min
      )
      and (
        p_contract_count_max is null
        or coalesce(contract_count.total, 0) <= p_contract_count_max
      )
      and (
        p_version_no_min is null
        or coalesce(latest.version_no, 0) >= p_version_no_min
      )
      and (
        p_version_no_max is null
        or coalesce(latest.version_no, 0) <= p_version_no_max
      )
      and (
        p_updated_from is null
        or template.updated_at::date >= p_updated_from
      )
      and (
        p_updated_to is null
        or template.updated_at::date <= p_updated_to
      )
  )
  select jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(
          to_jsonb(page_row) - 'total_count'
          order by
            case page_row.status::text when 'published' then 0 when 'draft' then 1 when 'archived' then 2 else 3 end,
            lower(page_row.name) collate "vi-x-icu",
            page_row.id asc
        )
        from (
          select *
          from filtered_templates
          order by
            case status::text when 'published' then 0 when 'draft' then 1 when 'archived' then 2 else 3 end,
            lower(name) collate "vi-x-icu",
            id asc
          offset (v_page - 1) * v_page_size
          limit v_page_size
        ) page_row
      ),
      '[]'::jsonb
    ),
    'total', coalesce((select max(total_count) from filtered_templates), 0)
  ) into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_work_items(p_tenant_id uuid, p_assignee_employee_id uuid DEFAULT NULL::uuid, p_search text DEFAULT NULL::text, p_statuses text[] DEFAULT NULL::text[], p_priority text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 200);
  v_search text := nullif(btrim(p_search), '');
begin
  if auth.uid() is null or not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tenant membership required' using errcode = '42501';
  end if;

  return (
    with filtered as (
      select work_item.*
      from public.work_items work_item
      where work_item.tenant_id = p_tenant_id
        and (
          p_assignee_employee_id is null
          or work_item.assignee_employee_id = p_assignee_employee_id
        )
        and (
          p_statuses is null
          or cardinality(p_statuses) = 0
          or work_item.status::text = any(p_statuses)
        )
        and (p_priority is null or work_item.priority::text = p_priority)
        and (
          v_search is null
          or work_item.code ilike '%' || v_search || '%'
          or work_item.title ilike '%' || v_search || '%'
          or work_item.description ilike '%' || v_search || '%'
        )
    ),
    page_rows as (
      select
        work_item.*,
        employee.employee_code as assignee_employee_code,
        concat_ws(' ', employee.last_name, employee.first_name) as assignee_name,
        (
          select count(*)::integer
          from public.work_items child
          where child.tenant_id = work_item.tenant_id
            and child.parent_id = work_item.id
        ) as child_count,
        (
          select count(*)::integer
          from public.work_items child
          where child.tenant_id = work_item.tenant_id
            and child.parent_id = work_item.id
            and child.status = 'completed'
        ) as completed_child_count,
        count(*) over () as total_count
      from filtered work_item
      left join public.employees employee
        on employee.tenant_id = work_item.tenant_id
       and employee.id = work_item.assignee_employee_id
      order by work_item.created_at desc, work_item.id desc
      offset (v_page - 1) * v_page_size
      limit v_page_size
    )
    select jsonb_build_object(
      'items', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', row.id,
              'tenantId', row.tenant_id,
              'code', row.code,
              'parentId', row.parent_id,
              'templateId', row.template_id,
              'title', row.title,
              'description', row.description,
              'status', row.status,
              'priority', row.priority,
              'assigneeEmployeeId', row.assignee_employee_id,
              'assigneeEmployeeCode', row.assignee_employee_code,
              'assigneeName', nullif(row.assignee_name, ''),
              'plannedStartDate', row.planned_start_date,
              'plannedEndDate', row.planned_end_date,
              'plannedStartTime', to_char(row.planned_start_time, 'HH24:MI'),
              'plannedEndTime', to_char(row.planned_end_time, 'HH24:MI'),
              'color', row.color,
              'actualStartedAt', row.actual_started_at,
              'actualCompletedAt', row.actual_completed_at,
              'childCount', row.child_count,
              'completedChildCount', row.completed_child_count,
              'customers', coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', customer.id,
                      'code', customer.customer_code,
                      'name', customer.name
                    ) order by
                      case customer.status::text when 'active' then 0 when 'uncontacted' then 1 when 'inactive' then 2 else 3 end,
                      lower(customer.name) collate "vi-x-icu",
                      customer.id asc
                  )
                  from public.work_item_customers link
                  join public.customers customer
                    on customer.tenant_id = link.tenant_id
                   and customer.id = link.customer_id
                  where link.tenant_id = row.tenant_id
                    and link.work_item_id = row.id
                ),
                '[]'::jsonb
              ),
              'contracts', coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', contract.id,
                      'code', contract.contract_code,
                      'name', contract.name
                    ) order by contract.created_at desc, contract.id desc
                  )
                  from public.work_item_contracts link
                  join public.contracts contract
                    on contract.tenant_id = link.tenant_id
                   and contract.id = link.contract_id
                  where link.tenant_id = row.tenant_id
                    and link.work_item_id = row.id
                ),
                '[]'::jsonb
              )
            ) order by row.created_at desc, row.id desc
          )
          from page_rows row
        ),
        '[]'::jsonb
      ),
      'total', coalesce((select max(total_count) from page_rows), 0)
    )
  );
end;
$function$;

notify pgrst, 'reload schema';
