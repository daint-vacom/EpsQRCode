-- Employee profile no longer stores organizational title or department.
-- Rebuild the RPCs that project employee data before dropping the columns.

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(function_row.oid)
  into v_definition
  from pg_proc function_row
  join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.proname = 'get_contract_responsible_workspace'
    and pg_get_function_identity_arguments(function_row.oid) = 'p_tenant_id uuid, p_contract_id uuid';

  if v_definition is null then
    raise exception 'Expected get_contract_responsible_workspace function was not found';
  end if;

  v_definition := replace(v_definition, E'\n      employee.job_title,\n', E'\n');
  v_definition := replace(v_definition, E'\n      employee.department,\n', E'\n');
  v_definition := replace(v_definition, E'\n            ''jobTitle'', employee.job_title,\n', E'\n');
  v_definition := replace(v_definition, E'\n            ''department'', employee.department,\n', E'\n');
  execute v_definition;

  select pg_get_functiondef(function_row.oid)
  into v_definition
  from pg_proc function_row
  join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.proname = 'get_customer_responsibility_workspace'
    and pg_get_function_identity_arguments(function_row.oid) = 'p_tenant_id uuid, p_customer_id uuid';

  if v_definition is null then
    raise exception 'Expected get_customer_responsibility_workspace function was not found';
  end if;

  v_definition := replace(v_definition, E'\n      employee.job_title,\n', E'\n');
  v_definition := replace(v_definition, E'\n      employee.department,\n', E'\n');
  v_definition := replace(v_definition, E'\n            ''jobTitle'', employee.job_title,\n', E'\n');
  v_definition := replace(v_definition, E'\n            ''department'', employee.department,\n', E'\n');
  execute v_definition;

  select pg_get_functiondef(function_row.oid)
  into v_definition
  from pg_proc function_row
  join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.proname = 'global_search'
    and pg_get_function_identity_arguments(function_row.oid) = 'p_tenant_id uuid, p_query text, p_limit_per_source integer';

  if v_definition is null then
    raise exception 'Expected global_search function was not found';
  end if;

  v_definition := replace(
    v_definition,
    E'      nullif(\n        concat_ws(\n          '' · '',\n          nullif(employee.department, ''''),\n          nullif(employee.job_title, ''''),\n          nullif(employee.phone, '''')\n        ),\n        ''''\n      ) as subtitle,',
    E'      nullif(employee.phone, '''') as subtitle,'
  );
  v_definition := replace(
    v_definition,
    E'\n        or extensions.unaccent(lower(coalesce(employee.job_title, ''''))) like ''%'' || extensions.unaccent(lower(v_query)) || ''%''\n',
    E'\n'
  );
  v_definition := replace(
    v_definition,
    E'\n        or extensions.unaccent(lower(coalesce(employee.department, ''''))) like ''%'' || extensions.unaccent(lower(v_query)) || ''%''\n',
    E'\n'
  );
  execute v_definition;

  select pg_get_functiondef(function_row.oid)
  into v_definition
  from pg_proc function_row
  join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.proname = 'list_customer_responsibility_filter_options'
    and pg_get_function_identity_arguments(function_row.oid) = 'p_tenant_id uuid';

  if v_definition is null then
    raise exception 'Expected list_customer_responsibility_filter_options function was not found';
  end if;

  v_definition := replace(v_definition, E'\n            ''department'', employee.department,\n', E'\n');
  execute v_definition;

  select pg_get_functiondef(function_row.oid)
  into v_definition
  from pg_proc function_row
  join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.proname = 'list_employees'
    and pg_get_function_identity_arguments(function_row.oid) = 'p_tenant_id uuid, p_page integer, p_page_size integer, p_search text, p_statuses employee_status[], p_role_ids uuid[], p_account_linked boolean, p_tag_ids uuid[]';

  if v_definition is null then
    raise exception 'Expected list_employees function was not found';
  end if;

  v_definition := replace(v_definition, E'\n      employee.job_title,\n', E'\n');
  v_definition := replace(v_definition, E'\n      employee.department,\n', E'\n');
  v_definition := replace(v_definition, E'\n        or employee.job_title ilike ''%'' || v_search || ''%''\n', E'\n');
  v_definition := replace(v_definition, E'\n        or employee.department ilike ''%'' || v_search || ''%''\n', E'\n');
  execute v_definition;

  select pg_get_functiondef(function_row.oid)
  into v_definition
  from pg_proc function_row
  join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.proname = 'update_my_employee_profile'
    and pg_get_function_identity_arguments(function_row.oid) = 'p_tenant_id uuid, p_employee_id uuid, p_employee_code text, p_first_name text, p_last_name text, p_job_title text, p_department text, p_phone text, p_status employee_status, p_joined_at date, p_note text, p_avatar_url text';

  if v_definition is null then
    raise exception 'Expected update_my_employee_profile function was not found';
  end if;

  v_definition := replace(
    v_definition,
    'p_last_name text, p_job_title text, p_department text, p_phone text,',
    'p_last_name text, p_phone text,'
  );
  v_definition := replace(
    v_definition,
    E'  v_can_manage boolean;\n  v_can_edit_profile boolean;',
    E'  v_can_manage boolean;'
  );
  v_definition := replace(
    v_definition,
    E'\n  v_can_edit_profile := v_can_manage or public.has_tenant_permission(\n    p_tenant_id,\n    ''employees:profile:edit''\n  );\n',
    E'\n'
  );
  v_definition := replace(
    v_definition,
    E'\n    job_title = case\n      when v_can_edit_profile then btrim(coalesce(p_job_title, ''''))\n      else employee.job_title\n    end,\n    department = case\n      when v_can_edit_profile then btrim(coalesce(p_department, ''''))\n      else employee.department\n    end,',
    E''
  );

  drop function public.update_my_employee_profile(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    public.employee_status,
    date,
    text,
    text
  );
  execute v_definition;
end;
$$;

alter table public.employees
  drop column job_title,
  drop column department;

revoke execute on function public.get_contract_responsible_workspace(uuid, uuid)
  from public, anon;
grant execute on function public.get_contract_responsible_workspace(uuid, uuid)
  to authenticated;
revoke execute on function public.get_customer_responsibility_workspace(uuid, uuid)
  from public, anon;
grant execute on function public.get_customer_responsibility_workspace(uuid, uuid)
  to authenticated;
revoke execute on function public.global_search(uuid, text, integer)
  from public, anon;
grant execute on function public.global_search(uuid, text, integer)
  to authenticated;
revoke execute on function public.list_customer_responsibility_filter_options(uuid)
  from public, anon;
grant execute on function public.list_customer_responsibility_filter_options(uuid)
  to authenticated;
revoke execute on function public.update_my_employee_profile(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  public.employee_status,
  date,
  text,
  text
)
  from public, anon;
grant execute on function public.update_my_employee_profile(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  public.employee_status,
  date,
  text,
  text
)
  to authenticated;

notify pgrst, 'reload schema';
