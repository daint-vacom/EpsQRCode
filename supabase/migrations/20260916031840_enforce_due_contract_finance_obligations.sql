-- Contract charges can be persisted as schedule/source rows, but a finance
-- obligation is only created for a charge whose payment date has arrived.
-- Future contract charges remain available to planning/reporting queries.

do $$
begin
  if exists (
    select 1
    from public.finance_obligations obligation
    join public.contract_charges charge
      on charge.id = obligation.contract_charge_id
    where charge.due_date > current_date
      and (
        exists (
          select 1
          from public.finance_allocations allocation
          where allocation.obligation_id = obligation.id
        )
        or exists (
          select 1
          from public.finance_voucher_line_allocation_drafts draft
          where draft.obligation_id = obligation.id
        )
      )
  ) then
    raise exception
      'Cannot remove future contract obligations that already have allocations'
      using errcode = '23514';
  end if;
end;
$$;

delete from public.finance_obligations obligation
using public.contract_charges charge
where charge.id = obligation.contract_charge_id
  and charge.due_date > current_date;

create or replace function public.sync_contract_charge_finance_obligation_for_date(
  p_charge_id uuid,
  p_as_of_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_charge_id is null or p_as_of_date is null then
    raise exception 'charge_id and as_of_date are required' using errcode = '22004';
  end if;

  update public.finance_obligations obligation
  set status = 'voided'::public.finance_obligation_status,
      posted_at = null,
      updated_at = timezone('utc', now())
  where obligation.contract_charge_id = p_charge_id
    and exists (
      select 1
      from public.contract_charges charge
      where charge.id = p_charge_id
        and charge.status = 'voided'
    );

  insert into public.finance_obligations (
    tenant_id,
    code,
    description,
    party_type,
    customer_id,
    party_name_snapshot,
    direction,
    source_type,
    contract_charge_id,
    contract_id,
    document_date,
    due_date,
    original_amount,
    currency_code,
    status,
    posted_at
  )
  select
    charge.tenant_id,
    'contract-charge:' || charge.id::text,
    'Khoản phí hợp đồng ' || to_char(charge.period_start, 'DD/MM/YYYY') ||
      ' - ' || to_char(charge.period_end, 'DD/MM/YYYY'),
    'customer'::public.finance_party_type,
    charge.customer_id,
    coalesce(customer.name, ''),
    line.direction::text::public.finance_obligation_direction,
    'contract'::public.finance_obligation_source,
    charge.id,
    charge.contract_id,
    charge.period_start,
    charge.due_date,
    charge.amount,
    charge.currency_code,
    'posted'::public.finance_obligation_status,
    timezone('utc', now())
  from public.contract_charges charge
  join public.contract_version_lines line
    on line.id = charge.contract_version_line_id
  left join public.customers customer
    on customer.id = charge.customer_id
   and customer.tenant_id = charge.tenant_id
  where charge.id = p_charge_id
    and charge.status <> 'voided'
    and charge.due_date <= p_as_of_date
  on conflict (contract_charge_id) do update set
    description = excluded.description,
    customer_id = excluded.customer_id,
    party_name_snapshot = excluded.party_name_snapshot,
    direction = excluded.direction,
    contract_id = excluded.contract_id,
    document_date = excluded.document_date,
    due_date = excluded.due_date,
    original_amount = excluded.original_amount,
    currency_code = excluded.currency_code,
    status = excluded.status,
    posted_at = excluded.posted_at,
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.sync_contract_charge_finance_obligation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_contract_charge_finance_obligation_for_date(
    new.id,
    current_date
  );
  return new;
end;
$$;

create or replace function public.sync_due_contract_charge_finance_obligations(
  p_as_of_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge record;
  v_synced integer := 0;
begin
  if p_as_of_date is null then
    raise exception 'as_of_date is required' using errcode = '22004';
  end if;

  for v_charge in
    select charge.id
    from public.contract_charges charge
    where charge.status <> 'voided'
      and charge.due_date <= p_as_of_date
      and not exists (
        select 1
        from public.finance_obligations obligation
        where obligation.contract_charge_id = charge.id
          and obligation.status = 'posted'
      )
    order by charge.due_date, charge.id
  loop
    perform public.sync_contract_charge_finance_obligation_for_date(
      v_charge.id,
      p_as_of_date
    );
    v_synced := v_synced + 1;
  end loop;

  return v_synced;
end;
$$;

drop trigger if exists contract_charges_sync_finance_obligation
  on public.contract_charges;
create trigger contract_charges_sync_finance_obligation
  after insert or update of customer_id, contract_id, contract_version_line_id,
    period_start, period_end, due_date, amount, currency_code, status
  on public.contract_charges
  for each row
  execute function public.sync_contract_charge_finance_obligation();

revoke all on function public.sync_contract_charge_finance_obligation_for_date(uuid, date)
  from public, anon, authenticated;
revoke all on function public.sync_due_contract_charge_finance_obligations(date)
  from public, anon, authenticated;

create or replace view public.customer_receivable_summary as
select
  balance.tenant_id,
  balance.customer_id,
  balance.currency_code,
  coalesce(sum(balance.original_amount), 0)::numeric(18, 2) as total_billed,
  coalesce(sum(balance.settled_amount), 0)::numeric(18, 2) as total_paid,
  coalesce(sum(balance.outstanding_amount), 0)::numeric(18, 2) as total_outstanding,
  coalesce(sum(balance.outstanding_amount) filter (
    where balance.due_date < current_date
      and balance.outstanding_amount > 0
  ), 0)::numeric(18, 2) as overdue_outstanding,
  0::numeric(18, 2) as unapplied_credit
from public.finance_obligation_balances balance
where balance.status = 'posted'
  and balance.direction = 'receivable'
  and balance.party_type = 'customer'
  and balance.due_date <= current_date
group by balance.tenant_id, balance.customer_id, balance.currency_code;

alter view public.customer_receivable_summary set (security_invoker = true);
grant select on public.customer_receivable_summary to authenticated;

-- Dashboard totals and aging represent incurred/due debt. Future items remain
-- visible only through the payment-plan endpoint and upcoming-due widget.
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
  all_receivable_balances as (
    select
      balance.contract_id,
      balance.customer_id,
      balance.amount,
      balance.paid_amount,
      balance.due_date,
      balance.outstanding_amount
    from public.contract_charge_balances balance
    where balance.tenant_id = p_tenant_id
      and balance.direction = 'receivable'
      and balance.status <> 'voided'
  ),
  actual_receivable_balances as (
    select *
    from all_receivable_balances
    where due_date <= current_date
  ),
  receivable_totals as (
    select
      coalesce(sum(amount), 0)::numeric(18, 2) as total_billed,
      coalesce(sum(paid_amount), 0)::numeric(18, 2) as total_paid,
      coalesce(sum(outstanding_amount), 0)::numeric(18, 2) as total_outstanding,
      coalesce(sum(outstanding_amount) filter (
        where due_date < current_date and outstanding_amount > 0
      ), 0)::numeric(18, 2) as overdue_outstanding
    from actual_receivable_balances
  ),
  aging_rows as (
    select
      case
        when due_date = current_date then 'due_today'
        when due_date >= current_date - 30 then 'overdue_1_30'
        when due_date >= current_date - 60 then 'overdue_31_60'
        else 'overdue_over_60'
      end as bucket,
      count(*)::integer as count,
      sum(outstanding_amount)::numeric(18, 2) as amount
    from actual_receivable_balances
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
      from all_receivable_balances balance
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
    'aging', aging_breakdown.data,
    'upcomingDue', upcoming_due.data,
    'upcomingRenewals', upcoming_renewals.data
  )
  into v_result
  from contract_totals, contract_status_breakdown, receivable_totals,
    aging_breakdown, upcoming_due, upcoming_renewals;

  return v_result;
end;
$$;

revoke execute on function public.get_dashboard_statistics(uuid)
  from public, anon;
grant execute on function public.get_dashboard_statistics(uuid)
  to authenticated;

do $schedule$
declare
  v_job_id bigint;
begin
  select jobid
    into v_job_id
    from cron.job
   where jobname = 'contract-charge-generation-daily';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'contract-charge-generation-daily',
    '0 1 * * *',
    $$select public.run_contract_charge_generation(current_date); select public.sync_due_contract_charge_finance_obligations(current_date);$$
  );
end;
$schedule$;
