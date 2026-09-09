create or replace function public.global_search(
  p_tenant_id uuid,
  p_query text,
  p_limit_per_source integer default 5
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_query text := nullif(btrim(p_query), '');
  v_limit integer := least(greatest(coalesce(p_limit_per_source, 5), 1), 5);
  v_can_customers boolean;
  v_can_contracts boolean;
  v_can_employees boolean;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_can_customers := public.has_tenant_permission(p_tenant_id, 'customers:view');
  v_can_contracts := public.has_tenant_permission(p_tenant_id, 'contracts:view');
  v_can_employees := public.has_tenant_permission(
    p_tenant_id,
    'organization:employee:view'
  );

  if v_query is null or char_length(v_query) < 2 then
    return jsonb_build_object(
      'customers', '[]'::jsonb,
      'contracts', '[]'::jsonb,
      'contractTemplates', '[]'::jsonb,
      'employees', '[]'::jsonb
    );
  end if;

  with customer_ranked as (
    select
      customer.id,
      customer.name as title,
      customer.customer_code as code,
      nullif(
        concat_ws(
          ' · ',
          nullif(customer.phone, ''),
          nullif(customer.email, '')
        ),
        ''
      ) as subtitle,
      customer.status::text as status,
      customer.image_url as image_url,
      customer.created_at,
      case
        when extensions.unaccent(lower(customer.customer_code)) = extensions.unaccent(lower(v_query)) then 100
        when extensions.unaccent(lower(customer.name)) = extensions.unaccent(lower(v_query)) then 95
        when extensions.unaccent(lower(customer.customer_code)) like extensions.unaccent(lower(v_query)) || '%' then 90
        when extensions.unaccent(lower(customer.name)) like extensions.unaccent(lower(v_query)) || '%' then 85
        else 70
      end as rank_score,
      row_number() over (
        order by
          case
            when extensions.unaccent(lower(customer.customer_code)) = extensions.unaccent(lower(v_query)) then 100
            when extensions.unaccent(lower(customer.name)) = extensions.unaccent(lower(v_query)) then 95
            when extensions.unaccent(lower(customer.customer_code)) like extensions.unaccent(lower(v_query)) || '%' then 90
            when extensions.unaccent(lower(customer.name)) like extensions.unaccent(lower(v_query)) || '%' then 85
            else 70
          end desc,
          customer.name asc,
          customer.id asc
      ) as row_no
    from public.customers customer
    where customer.tenant_id = p_tenant_id
      and v_can_customers
      and (
        extensions.unaccent(lower(customer.customer_code)) like '%' || extensions.unaccent(lower(v_query)) || '%'
        or extensions.unaccent(lower(customer.name)) like '%' || extensions.unaccent(lower(v_query)) || '%'
        or extensions.unaccent(lower(coalesce(customer.phone, ''))) like '%' || extensions.unaccent(lower(v_query)) || '%'
        or extensions.unaccent(lower(coalesce(customer.email, ''))) like '%' || extensions.unaccent(lower(v_query)) || '%'
      )
  ), customer_results as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'code', code,
          'subtitle', subtitle,
          'status', status,
          'imageUrl', image_url
        ) order by rank_score desc, title asc, id asc
      ),
      '[]'::jsonb
    ) as items
    from customer_ranked
    where row_no <= v_limit
  ), contract_ranked as (
    select
      contract.id,
      contract.name as title,
      contract.contract_code as code,
      customer.name as customer_name,
      customer.customer_code as customer_code,
      contract.status::text as status,
      contract.created_at,
      case
        when extensions.unaccent(lower(contract.contract_code)) = extensions.unaccent(lower(v_query)) then 100
        when extensions.unaccent(lower(contract.name)) = extensions.unaccent(lower(v_query)) then 95
        when extensions.unaccent(lower(contract.contract_code)) like extensions.unaccent(lower(v_query)) || '%' then 90
        when extensions.unaccent(lower(contract.name)) like extensions.unaccent(lower(v_query)) || '%' then 85
        when extensions.unaccent(lower(customer.customer_code)) like extensions.unaccent(lower(v_query)) || '%' then 80
        when extensions.unaccent(lower(customer.name)) like extensions.unaccent(lower(v_query)) || '%' then 78
        else 70
      end as rank_score,
      row_number() over (
        order by
          case
            when extensions.unaccent(lower(contract.contract_code)) = extensions.unaccent(lower(v_query)) then 100
            when extensions.unaccent(lower(contract.name)) = extensions.unaccent(lower(v_query)) then 95
            when extensions.unaccent(lower(contract.contract_code)) like extensions.unaccent(lower(v_query)) || '%' then 90
            when extensions.unaccent(lower(contract.name)) like extensions.unaccent(lower(v_query)) || '%' then 85
            when extensions.unaccent(lower(customer.customer_code)) like extensions.unaccent(lower(v_query)) || '%' then 80
            when extensions.unaccent(lower(customer.name)) like extensions.unaccent(lower(v_query)) || '%' then 78
            else 70
          end desc,
          contract.name asc,
          contract.id asc
      ) as row_no
    from public.contracts contract
    join public.customers customer on customer.id = contract.customer_id
    where contract.tenant_id = p_tenant_id
      and customer.tenant_id = p_tenant_id
      and v_can_contracts
      and (
        extensions.unaccent(lower(contract.contract_code)) like '%' || extensions.unaccent(lower(v_query)) || '%'
        or extensions.unaccent(lower(contract.name)) like '%' || extensions.unaccent(lower(v_query)) || '%'
        or extensions.unaccent(lower(customer.customer_code)) like '%' || extensions.unaccent(lower(v_query)) || '%'
        or extensions.unaccent(lower(customer.name)) like '%' || extensions.unaccent(lower(v_query)) || '%'
      )
  ), contract_results as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'code', code,
          'subtitle', nullif(concat_ws(' · ', customer_code, customer_name), ''),
          'status', status,
          'imageUrl', null
        ) order by rank_score desc, title asc, id asc
      ),
      '[]'::jsonb
    ) as items
    from contract_ranked
    where row_no <= v_limit
  ), template_ranked as (
    select
      template.id,
      template.name as title,
      template.code,
      template.status::text as status,
      template.created_at,
      case
        when extensions.unaccent(lower(template.code)) = extensions.unaccent(lower(v_query)) then 100
        when extensions.unaccent(lower(template.name)) = extensions.unaccent(lower(v_query)) then 95
        when extensions.unaccent(lower(template.code)) like extensions.unaccent(lower(v_query)) || '%' then 90
        when extensions.unaccent(lower(template.name)) like extensions.unaccent(lower(v_query)) || '%' then 85
        else 70
      end as rank_score,
      row_number() over (
        order by
          case
            when extensions.unaccent(lower(template.code)) = extensions.unaccent(lower(v_query)) then 100
            when extensions.unaccent(lower(template.name)) = extensions.unaccent(lower(v_query)) then 95
            when extensions.unaccent(lower(template.code)) like extensions.unaccent(lower(v_query)) || '%' then 90
            when extensions.unaccent(lower(template.name)) like extensions.unaccent(lower(v_query)) || '%' then 85
            else 70
          end desc,
          template.name asc,
          template.id asc
      ) as row_no
    from public.contract_templates template
    where template.tenant_id = p_tenant_id
      and v_can_contracts
      and (
        extensions.unaccent(lower(template.code)) like '%' || extensions.unaccent(lower(v_query)) || '%'
        or extensions.unaccent(lower(template.name)) like '%' || extensions.unaccent(lower(v_query)) || '%'
      )
  ), template_results as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'code', code,
          'subtitle', null,
          'status', status,
          'imageUrl', null
        ) order by rank_score desc, title asc, id asc
      ),
      '[]'::jsonb
    ) as items
    from template_ranked
    where row_no <= v_limit
  ), employee_ranked as (
    select
      employee.id,
      concat_ws(' ', employee.last_name, employee.first_name) as title,
      employee.employee_code as code,
      nullif(
        concat_ws(
          ' · ',
          nullif(employee.department, ''),
          nullif(employee.job_title, ''),
          nullif(employee.phone, '')
        ),
        ''
      ) as subtitle,
      employee.status::text as status,
      profile.avatar_url as image_url,
      employee.created_at,
      case
        when extensions.unaccent(lower(employee.employee_code)) = extensions.unaccent(lower(v_query)) then 100
        when extensions.unaccent(lower(concat_ws(' ', employee.last_name, employee.first_name))) = extensions.unaccent(lower(v_query)) then 95
        when extensions.unaccent(lower(employee.employee_code)) like extensions.unaccent(lower(v_query)) || '%' then 90
        when extensions.unaccent(lower(concat_ws(' ', employee.last_name, employee.first_name))) like extensions.unaccent(lower(v_query)) || '%' then 85
        else 70
      end as rank_score,
      row_number() over (
        order by
          case
            when extensions.unaccent(lower(employee.employee_code)) = extensions.unaccent(lower(v_query)) then 100
            when extensions.unaccent(lower(concat_ws(' ', employee.last_name, employee.first_name))) = extensions.unaccent(lower(v_query)) then 95
            when extensions.unaccent(lower(employee.employee_code)) like extensions.unaccent(lower(v_query)) || '%' then 90
            when extensions.unaccent(lower(concat_ws(' ', employee.last_name, employee.first_name))) like extensions.unaccent(lower(v_query)) || '%' then 85
            else 70
          end desc,
          employee.last_name asc,
          employee.first_name asc,
          employee.id asc
      ) as row_no
    from public.employees employee
    left join public.user_profiles profile on profile.id = employee.user_id
    where employee.tenant_id = p_tenant_id
      and v_can_employees
      and (
        extensions.unaccent(lower(employee.employee_code)) like '%' || extensions.unaccent(lower(v_query)) || '%'
        or extensions.unaccent(lower(concat_ws(' ', employee.last_name, employee.first_name))) like '%' || extensions.unaccent(lower(v_query)) || '%'
        or extensions.unaccent(lower(coalesce(employee.job_title, ''))) like '%' || extensions.unaccent(lower(v_query)) || '%'
        or extensions.unaccent(lower(coalesce(employee.department, ''))) like '%' || extensions.unaccent(lower(v_query)) || '%'
        or extensions.unaccent(lower(coalesce(employee.phone, ''))) like '%' || extensions.unaccent(lower(v_query)) || '%'
      )
  ), employee_results as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'code', code,
          'subtitle', subtitle,
          'status', status,
          'imageUrl', image_url
        ) order by rank_score desc, title asc, id asc
      ),
      '[]'::jsonb
    ) as items
    from employee_ranked
    where row_no <= v_limit
  )
  select jsonb_build_object(
    'customers', (select items from customer_results),
    'contracts', (select items from contract_results),
    'contractTemplates', (select items from template_results),
    'employees', (select items from employee_results)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.global_search(uuid, text, integer) from public, anon;
grant execute on function public.global_search(uuid, text, integer) to authenticated;

notify pgrst, 'reload schema';
