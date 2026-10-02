create or replace function public.get_customer_tab_summaries(
  p_tenant_id uuid,
  p_customer_ids uuid[]
)
returns table (
  customer_id uuid,
  debt_count integer,
  due_or_overdue_debt_count integer,
  contract_count integer,
  due_or_overdue_contract_count integer,
  responsible_employee_count integer,
  software_account_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_can_view_finance boolean;
  v_can_view_contracts boolean;
  v_can_view_software_accounts boolean;
begin
  if auth.uid() is null
    or p_tenant_id is null
    or not public.has_tenant_permission(p_tenant_id, 'customers:view')
  then
    raise exception 'Customer view permission required' using errcode = '42501';
  end if;

  if coalesce(cardinality(p_customer_ids), 0) > 100 then
    raise exception 'At most 100 customer IDs can be summarized at once'
      using errcode = '22023';
  end if;

  v_can_view_finance :=
    public.has_tenant_permission(p_tenant_id, 'finance:obligation:view')
    or public.has_tenant_permission(p_tenant_id, 'finance:report:view');
  v_can_view_contracts := public.has_tenant_permission(p_tenant_id, 'contracts:view');
  v_can_view_software_accounts := public.has_tenant_permission(
    p_tenant_id,
    'customers:software-account:view'
  );

  return query
  with page_customers as (
    select distinct customer.id
    from unnest(coalesce(p_customer_ids, '{}'::uuid[])) requested(id)
    join public.customers customer
      on customer.id = requested.id
     and customer.tenant_id = p_tenant_id
  ), contract_counts as (
    select contract.customer_id, count(*)::integer as item_count
    from public.contracts contract
    join page_customers customer on customer.id = contract.customer_id
    where v_can_view_contracts
      and contract.tenant_id = p_tenant_id
    group by contract.customer_id
  ), responsible_employees as (
    select responsible.customer_id, responsible.employee_id
    from public.customer_responsibles responsible
    join page_customers customer on customer.id = responsible.customer_id
    where responsible.tenant_id = p_tenant_id
    union
    select all_role.customer_id, all_role.employee_id
    from public.employee_customer_all_roles all_role
    join page_customers customer on customer.id = all_role.customer_id
    where all_role.tenant_id = p_tenant_id
  ), responsible_counts as (
    select responsible.customer_id, count(*)::integer as item_count
    from responsible_employees responsible
    group by responsible.customer_id
  ), software_account_counts as (
    select account.customer_id, count(*)::integer as item_count
    from public.customer_software_accounts account
    join page_customers customer on customer.id = account.customer_id
    where v_can_view_software_accounts
      and account.tenant_id = p_tenant_id
    group by account.customer_id
  ), actual_debts as (
    select obligation.*
    from public.finance_obligations obligation
    join page_customers customer on customer.id = obligation.customer_id
    where v_can_view_finance
      and obligation.tenant_id = p_tenant_id
      and obligation.party_type = 'customer'
      and obligation.direction = 'receivable'
      and obligation.status = 'posted'
      and obligation.effective_date <= current_date
      and (
        obligation.source_type <> 'contract'
        or obligation.due_date <= current_date
      )
  ), debt_groups as (
    select
      debt.customer_id,
      case when debt.source_type = 'contract' then 'contract' else 'obligation' end as group_type,
      case when debt.source_type = 'contract' then debt.contract_id else debt.id end as group_id,
      case when debt.source_type = 'contract' then debt.document_date end as document_date,
      case when debt.source_type = 'contract' then debt.due_date end as due_date,
      debt.currency_code,
      debt.direction
    from actual_debts debt
    group by
      debt.customer_id,
      case when debt.source_type = 'contract' then 'contract' else 'obligation' end,
      case when debt.source_type = 'contract' then debt.contract_id else debt.id end,
      case when debt.source_type = 'contract' then debt.document_date end,
      case when debt.source_type = 'contract' then debt.due_date end,
      debt.currency_code,
      debt.direction
  ), debt_counts as (
    select debt.customer_id, count(*)::integer as item_count
    from debt_groups debt
    group by debt.customer_id
  ), due_debt_components as materialized (
    select
      debt.id,
      debt.customer_id,
      debt.contract_id,
      debt.source_type,
      debt.document_date,
      debt.due_date,
      debt.currency_code,
      debt.direction,
      greatest(
        debt.original_amount + public.finance_obligation_adjustment_total_as_of(
          p_tenant_id,
          debt.id,
          current_date
        ),
        0
      ) as obligation_amount,
      public.finance_obligation_settled_amount_as_of(
        p_tenant_id,
        debt.id,
        current_date
      ) as settled_amount
    from actual_debts debt
    where debt.due_date is not null
      and debt.due_date <= current_date
  ), due_debt_groups as (
    select
      debt.customer_id,
      case when debt.source_type = 'contract' then 'contract' else 'obligation' end as group_type,
      case when debt.source_type = 'contract' then debt.contract_id else debt.id end as group_id,
      case when debt.source_type = 'contract' then debt.document_date end as document_date,
      case when debt.source_type = 'contract' then debt.due_date end as due_date,
      debt.currency_code,
      debt.direction,
      sum(
        debt.obligation_amount
        - greatest(0, least(debt.obligation_amount, debt.settled_amount))
      ) as outstanding_amount
    from due_debt_components debt
    group by
      debt.customer_id,
      case when debt.source_type = 'contract' then 'contract' else 'obligation' end,
      case when debt.source_type = 'contract' then debt.contract_id else debt.id end,
      case when debt.source_type = 'contract' then debt.document_date end,
      case when debt.source_type = 'contract' then debt.due_date end,
      debt.currency_code,
      debt.direction
  ), due_counts as (
    select
      debt.customer_id,
      (count(*) filter (where debt.outstanding_amount > 0))::integer as debt_count,
      (count(distinct debt.group_id) filter (
        where debt.group_type = 'contract'
          and debt.outstanding_amount > 0
      ))::integer as contract_count
    from due_debt_groups debt
    group by debt.customer_id
  )
  select
    customer.id,
    case when v_can_view_finance then coalesce(debt_counts.item_count, 0) end,
    case when v_can_view_finance then coalesce(due_counts.debt_count, 0) end,
    case when v_can_view_contracts then coalesce(contract_counts.item_count, 0) end,
    case when v_can_view_contracts and v_can_view_finance
      then coalesce(due_counts.contract_count, 0)
    end,
    coalesce(responsible_counts.item_count, 0),
    case when v_can_view_software_accounts
      then coalesce(software_account_counts.item_count, 0)
    end
  from page_customers customer
  left join contract_counts on contract_counts.customer_id = customer.id
  left join responsible_counts on responsible_counts.customer_id = customer.id
  left join software_account_counts on software_account_counts.customer_id = customer.id
  left join debt_counts on debt_counts.customer_id = customer.id
  left join due_counts on due_counts.customer_id = customer.id
  order by customer.id;
end;
$$;

revoke all on function public.get_customer_tab_summaries(uuid, uuid[])
  from public, anon;
grant execute on function public.get_customer_tab_summaries(uuid, uuid[])
  to authenticated;

alter function public.list_customers(
  uuid,
  integer,
  integer,
  text,
  text,
  public.business_type[],
  text,
  public.customer_status[],
  uuid[],
  jsonb,
  uuid[]
) rename to list_customers_without_tab_summary;

revoke all on function public.list_customers_without_tab_summary(
  uuid,
  integer,
  integer,
  text,
  text,
  public.business_type[],
  text,
  public.customer_status[],
  uuid[],
  jsonb,
  uuid[]
) from public, anon;
grant execute on function public.list_customers_without_tab_summary(
  uuid,
  integer,
  integer,
  text,
  text,
  public.business_type[],
  text,
  public.customer_status[],
  uuid[],
  jsonb,
  uuid[]
) to authenticated;

create function public.list_customers(
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
security invoker
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_items jsonb;
begin
  v_result := public.list_customers_without_tab_summary(
    p_tenant_id,
    p_page,
    p_page_size,
    p_search,
    p_customer_search,
    p_business_types,
    p_contact_search,
    p_statuses,
    p_tag_ids,
    p_field_filters,
    p_responsible_employee_ids
  );

  with page_rows as (
    select
      page.value as item,
      page.ordinality,
      (page.value ->> 'id')::uuid as customer_id
    from jsonb_array_elements(coalesce(v_result -> 'items', '[]'::jsonb))
      with ordinality as page(value, ordinality)
  ), summaries as (
    select summary.*
    from public.get_customer_tab_summaries(
      p_tenant_id,
      coalesce(
        (select array_agg(page.customer_id) from page_rows page),
        '{}'::uuid[]
      )
    ) summary
  )
  select coalesce(
    jsonb_agg(
      page.item || jsonb_build_object(
        'tab_summary', jsonb_build_object(
          'debt_count', summary.debt_count,
          'due_or_overdue_debt_count', summary.due_or_overdue_debt_count,
          'contract_count', summary.contract_count,
          'due_or_overdue_contract_count', summary.due_or_overdue_contract_count,
          'responsible_employee_count', summary.responsible_employee_count,
          'software_account_count', summary.software_account_count
        )
      )
      order by page.ordinality
    ),
    '[]'::jsonb
  )
  into v_items
  from page_rows page
  join summaries summary on summary.customer_id = page.customer_id;

  return jsonb_set(v_result, '{items}', v_items, true);
end;
$$;

revoke all on function public.list_customers(
  uuid,
  integer,
  integer,
  text,
  text,
  public.business_type[],
  text,
  public.customer_status[],
  uuid[],
  jsonb,
  uuid[]
) from public, anon;
grant execute on function public.list_customers(
  uuid,
  integer,
  integer,
  text,
  text,
  public.business_type[],
  text,
  public.customer_status[],
  uuid[],
  jsonb,
  uuid[]
) to authenticated;

notify pgrst, 'reload schema';
