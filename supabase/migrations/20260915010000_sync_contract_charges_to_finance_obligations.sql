-- Contract charges remain the billing-period source. Their financial balance is
-- owned by finance_obligations/finance_allocations after this migration.

create index if not exists finance_obligations_customer_idx
  on public.finance_obligations(tenant_id, customer_id, direction, document_date desc);

create or replace function public.sync_contract_charge_finance_obligation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_name text;
begin
  select customer.name
    into v_customer_name
    from public.customers customer
   where customer.id = new.customer_id
     and customer.tenant_id = new.tenant_id;

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
  values (
    new.tenant_id,
    'contract-charge:' || new.id::text,
    'Khoản phí hợp đồng ' || to_char(new.period_start, 'DD/MM/YYYY') ||
      ' - ' || to_char(new.period_end, 'DD/MM/YYYY'),
    'customer',
    new.customer_id,
    coalesce(v_customer_name, ''),
    case when new.contract_version_line_id is not null then
      (select line.direction::text::public.finance_obligation_direction
         from public.contract_version_lines line
        where line.id = new.contract_version_line_id)
      else 'receivable'::public.finance_obligation_direction
    end,
    'contract',
    new.id,
    new.contract_id,
    new.period_start,
    new.due_date,
    new.amount,
    new.currency_code,
    case when new.status = 'voided' then 'voided' else 'posted' end::public.finance_obligation_status,
    case when new.status = 'voided' then null else timezone('utc', now()) end
  )
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

  return new;
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
  'customer',
  charge.customer_id,
  coalesce(customer.name, ''),
  line.direction::text::public.finance_obligation_direction,
  'contract',
  charge.id,
  charge.contract_id,
  charge.period_start,
  charge.due_date,
  charge.amount,
  charge.currency_code,
  case when charge.status = 'voided' then 'voided' else 'posted' end::public.finance_obligation_status,
  case when charge.status = 'voided' then null else timezone('utc', now()) end
from public.contract_charges charge
join public.contract_version_lines line
  on line.id = charge.contract_version_line_id
left join public.customers customer
  on customer.id = charge.customer_id
 and customer.tenant_id = charge.tenant_id
on conflict (contract_charge_id) do nothing;

create or replace view public.contract_charge_finance_balances as
select
  charge.id,
  charge.tenant_id,
  charge.customer_id,
  charge.contract_id,
  charge.contract_version_id,
  charge.contract_version_line_id,
  line.direction,
  charge.period_start,
  charge.period_end,
  charge.due_date,
  charge.amount,
  charge.currency_code,
  charge.status,
  charge.void_reason,
  charge.created_at,
  coalesce(balance.settled_amount, 0)::numeric(18, 2) as paid_amount,
  coalesce(balance.outstanding_amount, charge.amount)::numeric(18, 2) as outstanding_amount
from public.contract_charges charge
join public.contract_version_lines line
  on line.id = charge.contract_version_line_id
left join public.finance_obligations obligation
  on obligation.contract_charge_id = charge.id
left join public.finance_obligation_balances balance
  on balance.id = obligation.id;

alter view public.contract_charge_finance_balances set (security_invoker = true);
grant select on public.contract_charge_finance_balances to authenticated;

create or replace view public.contract_charge_balances as
select
  balance.id,
  balance.tenant_id,
  balance.customer_id,
  balance.contract_id,
  balance.contract_version_id,
  balance.contract_version_line_id,
  balance.period_start,
  balance.period_end,
  balance.due_date,
  balance.amount,
  balance.currency_code,
  case
    when balance.status = 'voided' then 'voided'::public.contract_charge_status
    when balance.paid_amount >= balance.amount then 'paid'::public.contract_charge_status
    when balance.paid_amount > 0 then 'partially_paid'::public.contract_charge_status
    when balance.due_date < current_date then 'overdue'::public.contract_charge_status
    else 'open'::public.contract_charge_status
  end as status,
  balance.void_reason,
  balance.created_at,
  balance.paid_amount,
  balance.outstanding_amount,
  balance.direction
from public.contract_charge_finance_balances balance;

alter view public.contract_charge_balances set (security_invoker = true);

create or replace view public.customer_receivable_summary as
select
  balance.tenant_id,
  balance.customer_id,
  balance.currency_code,
  coalesce(sum(balance.original_amount), 0)::numeric(18, 2) as total_billed,
  coalesce(sum(balance.settled_amount), 0)::numeric(18, 2) as total_paid,
  coalesce(sum(balance.outstanding_amount), 0)::numeric(18, 2) as total_outstanding,
  coalesce(sum(
    balance.outstanding_amount
  ) filter (where balance.due_date < current_date and balance.outstanding_amount > 0), 0)::numeric(18, 2) as overdue_outstanding,
  0::numeric(18, 2) as unapplied_credit
from public.finance_obligation_balances balance
where balance.status = 'posted'
  and balance.direction = 'receivable'
  and balance.party_type = 'customer'
group by balance.tenant_id, balance.customer_id, balance.currency_code;

alter view public.customer_receivable_summary set (security_invoker = true);

-- The finance voucher flow now owns all settlements. Remove the pre-production
-- payment RPCs and storage after replacing their compatibility views above.
drop function if exists public.record_contract_payment_scoped(
  uuid, uuid, uuid, text, numeric, timestamptz,
  public.customer_payment_method, text, text, jsonb, text, date, date
);
drop function if exists public.record_contract_payment(
  uuid, uuid, uuid, text, numeric, timestamptz,
  public.customer_payment_method, text, text, jsonb, text, date, date
);
drop function if exists public.record_contract_period_payment_scoped(
  uuid, uuid, uuid, date, date, date, numeric, text, timestamptz,
  public.customer_payment_method, text, text, jsonb
);
drop function if exists public.record_contract_period_payment(
  uuid, uuid, uuid, date, date, date, numeric, text, timestamptz,
  public.customer_payment_method, text, text, jsonb
);
drop function if exists public.list_contract_payment_candidates_scoped(
  uuid, uuid, text, date, date
);
drop function if exists public.list_contract_payment_candidates(
  uuid, uuid, text, date, date
);
drop function if exists public.get_contract_payment_period_count(uuid, uuid);
drop function if exists public.record_customer_payment(
  uuid, uuid, numeric, text, timestamptz,
  public.customer_payment_method, text, text
);

drop table if exists public.customer_payment_allocations;
drop table if exists public.customer_payments;
drop type if exists public.customer_payment_method;
drop type if exists public.customer_payment_status;

revoke all on function public.sync_contract_charge_finance_obligation() from public, anon;
