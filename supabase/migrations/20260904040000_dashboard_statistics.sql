create or replace function public.get_dashboard_statistics(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null
    or not public.has_tenant_permission(p_tenant_id, 'contracts:view')
  then
    raise exception 'Contract view permission required' using errcode = '42501';
  end if;

  with contract_status_options as (
    select status_value.status::text as status
    from unnest(enum_range(null::public.contract_status)) as status_value(status)
  ),
  contract_status_counts as (
    select contract.status::text as status, count(*)::integer as count
    from public.contracts contract
    where contract.tenant_id = p_tenant_id
    group by contract.status
  ),
  contract_status_breakdown as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'status', options.status,
          'count', coalesce(counts.count, 0)
        )
        order by array_position(
          array['active', 'draft', 'suspended', 'expired', 'terminated']::text[],
          options.status
        )
      ),
      '[]'::jsonb
    ) as data
    from contract_status_options options
    left join contract_status_counts counts on counts.status = options.status
  ),
  contract_totals as (
    select
      count(*)::integer as total,
      count(*) filter (where contract.status = 'active')::integer as active,
      count(*) filter (
        where contract.status = 'active'
          and contract.end_date between current_date and current_date + 30
      )::integer as expiring,
      count(*) filter (where contract.status = 'expired')::integer as expired
    from public.contracts contract
    where contract.tenant_id = p_tenant_id
  ),
  receivable_balances as (
    select
      balance.id,
      balance.contract_id,
      balance.customer_id,
      balance.due_date,
      balance.amount,
      balance.paid_amount,
      balance.outstanding_amount
    from public.contract_charge_balances balance
    where balance.tenant_id = p_tenant_id
      and balance.direction = 'receivable'
      and balance.status <> 'voided'
  ),
  receivable_totals as (
    select
      coalesce(sum(amount), 0)::numeric(18, 2) as total_billed,
      coalesce(sum(paid_amount), 0)::numeric(18, 2) as total_paid,
      coalesce(sum(outstanding_amount), 0)::numeric(18, 2) as total_outstanding,
      coalesce(sum(outstanding_amount) filter (
        where due_date < current_date and outstanding_amount > 0
      ), 0)::numeric(18, 2) as overdue_outstanding
    from receivable_balances
  ),
  month_series as (
    select generate_series(
      date_trunc('month', current_date) - interval '6 months',
      date_trunc('month', current_date) + interval '5 months',
      interval '1 month'
    )::date as month_start
  ),
  monthly_charges as (
    select
      date_trunc('month', due_date)::date as month_start,
      sum(paid_amount)::numeric(18, 2) as paid_amount,
      coalesce(sum(outstanding_amount) filter (
        where due_date = current_date
      ), 0)::numeric(18, 2) as current_outstanding,
      coalesce(sum(outstanding_amount) filter (
        where due_date < current_date
      ), 0)::numeric(18, 2) as overdue_outstanding,
      coalesce(sum(outstanding_amount) filter (
        where due_date > current_date
      ), 0)::numeric(18, 2) as future_outstanding
    from receivable_balances
    group by date_trunc('month', due_date)::date
  ),
  monthly_trend as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'monthStart', trend_row.month_start,
          'monthLabel', to_char(trend_row.month_start, 'MM/YYYY'),
          'paidAmount', trend_row.paid_amount,
          'currentOutstanding', trend_row.current_outstanding,
          'overdueOutstanding', trend_row.overdue_outstanding,
          'futureOutstanding', trend_row.future_outstanding
        )
        order by trend_row.month_start
      ),
      '[]'::jsonb
    ) as data
    from (
      select
        months.month_start,
        coalesce(charges.paid_amount, 0)::numeric(18, 2) as paid_amount,
        coalesce(charges.current_outstanding, 0)::numeric(18, 2) as current_outstanding,
        coalesce(charges.overdue_outstanding, 0)::numeric(18, 2) as overdue_outstanding,
        coalesce(charges.future_outstanding, 0)::numeric(18, 2) as future_outstanding
      from month_series months
      left join monthly_charges charges on charges.month_start = months.month_start
    ) trend_row
  ),
  aging_rows as (
    select
      case
        when due_date > current_date then 'not_due'
        when due_date = current_date then 'due_today'
        when due_date >= current_date - 30 then 'overdue_1_30'
        when due_date >= current_date - 60 then 'overdue_31_60'
        else 'overdue_over_60'
      end as bucket,
      count(*)::integer as count,
      sum(outstanding_amount)::numeric(18, 2) as amount
    from receivable_balances
    where outstanding_amount > 0
    group by 1
  ),
  aging_breakdown as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bucket', buckets.bucket,
          'count', coalesce(aging_row.count, 0),
          'amount', coalesce(aging_row.amount, 0)
        )
        order by buckets.sort_order
      ),
      '[]'::jsonb
    ) as data
    from (
      values
        ('not_due', 1),
        ('due_today', 2),
        ('overdue_1_30', 3),
        ('overdue_31_60', 4),
        ('overdue_over_60', 5)
    ) as buckets(bucket, sort_order)
    left join aging_rows aging_row on aging_row.bucket = buckets.bucket
  ),
  upcoming_due as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'contractId', due_row.contract_id,
          'contractCode', due_row.contract_code,
          'contractName', due_row.contract_name,
          'customerName', due_row.customer_name,
          'dueDate', due_row.due_date,
          'outstandingAmount', due_row.outstanding_amount
        )
        order by due_row.due_date, due_row.outstanding_amount desc, due_row.contract_code
      ),
      '[]'::jsonb
    ) as data
    from (
      select
        contract.id as contract_id,
        contract.contract_code,
        contract.name as contract_name,
        customer.name as customer_name,
        min(balance.due_date) as due_date,
        sum(balance.outstanding_amount)::numeric(18, 2) as outstanding_amount
      from receivable_balances balance
      join public.contracts contract on contract.id = balance.contract_id
      join public.customers customer on customer.id = balance.customer_id
      where contract.status = 'active'
        and balance.outstanding_amount > 0
        and balance.due_date between current_date and current_date + 30
      group by contract.id, contract.contract_code, contract.name, customer.name
      order by min(balance.due_date), sum(balance.outstanding_amount) desc
      limit 5
    ) due_row
  ),
  upcoming_renewals as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'contractId', renewal_row.contract_id,
          'contractCode', renewal_row.contract_code,
          'contractName', renewal_row.contract_name,
          'customerName', renewal_row.customer_name,
          'endDate', renewal_row.end_date
        )
        order by renewal_row.end_date, renewal_row.contract_code
      ),
      '[]'::jsonb
    ) as data
    from (
      select
        contract.id as contract_id,
        contract.contract_code,
        contract.name as contract_name,
        customer.name as customer_name,
        contract.end_date
      from public.contracts contract
      join public.customers customer on customer.id = contract.customer_id
      where contract.tenant_id = p_tenant_id
        and contract.status = 'active'
        and contract.end_date between current_date and current_date + 60
      order by contract.end_date, contract.contract_code
      limit 5
    ) renewal_row
  )
  select jsonb_build_object(
    'contracts', jsonb_build_object(
      'total', contract_totals.total,
      'active', contract_totals.active,
      'expiring', contract_totals.expiring,
      'expired', contract_totals.expired,
      'statusBreakdown', contract_status_breakdown.data
    ),
    'receivables', jsonb_build_object(
      'totalBilled', receivable_totals.total_billed,
      'totalPaid', receivable_totals.total_paid,
      'totalOutstanding', receivable_totals.total_outstanding,
      'overdueOutstanding', receivable_totals.overdue_outstanding
    ),
    'monthlyTrend', monthly_trend.data,
    'aging', aging_breakdown.data,
    'upcomingDue', upcoming_due.data,
    'upcomingRenewals', upcoming_renewals.data
  )
  into v_result
  from contract_totals, contract_status_breakdown, receivable_totals,
    monthly_trend, aging_breakdown, upcoming_due, upcoming_renewals;

  return v_result;
end;
$$;

revoke execute on function public.get_dashboard_statistics(uuid)
  from public, anon;
grant execute on function public.get_dashboard_statistics(uuid)
  to authenticated;

notify pgrst, 'reload schema';
