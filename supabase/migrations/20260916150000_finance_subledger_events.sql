-- Additive subledger events. Posted rows remain immutable; corrections are
-- represented as dated, auditable events and never by overwriting history.

alter table public.finance_operations
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

create or replace function public.set_finance_operation_actor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.actor_user_id is null then
    new.actor_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists finance_operations_set_actor on public.finance_operations;
create trigger finance_operations_set_actor
before insert on public.finance_operations
for each row execute function public.set_finance_operation_actor();

create table if not exists public.finance_obligation_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  obligation_id uuid not null references public.finance_obligations(id) on delete restrict,
  amount_delta numeric(18,2) not null,
  effective_date date not null,
  reason text not null,
  operation_id uuid references public.finance_operations(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint finance_obligation_adjustments_amount_check check (amount_delta <> 0),
  constraint finance_obligation_adjustments_reason_check check (length(btrim(reason)) > 0)
);

create index if not exists finance_obligation_adjustments_lookup_idx
  on public.finance_obligation_adjustments(tenant_id, obligation_id, effective_date, id);

create table if not exists public.finance_allocation_reversals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  allocation_id uuid not null references public.finance_allocations(id) on delete restrict,
  amount numeric(18,2) not null,
  effective_date date not null,
  reason text not null,
  operation_id uuid references public.finance_operations(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint finance_allocation_reversals_amount_check check (amount > 0),
  constraint finance_allocation_reversals_reason_check check (length(btrim(reason)) > 0)
);

create index if not exists finance_allocation_reversals_lookup_idx
  on public.finance_allocation_reversals(tenant_id, allocation_id, effective_date, id);

create table if not exists public.finance_refund_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  refund_voucher_line_id uuid not null references public.finance_voucher_lines(id) on delete restrict,
  source_voucher_line_id uuid not null references public.finance_voucher_lines(id) on delete restrict,
  amount numeric(18,2) not null,
  effective_date date not null,
  reason text not null,
  operation_id uuid references public.finance_operations(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint finance_refund_links_amount_check check (amount > 0),
  constraint finance_refund_links_reason_check check (length(btrim(reason)) > 0)
);

create index if not exists finance_refund_links_source_idx
  on public.finance_refund_links(tenant_id, source_voucher_line_id, effective_date, id);

create table if not exists public.finance_voucher_reversals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  voucher_id uuid not null references public.finance_vouchers(id) on delete restrict,
  reversal_effective_date date not null,
  reason text not null,
  operation_id uuid references public.finance_operations(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, voucher_id),
  constraint finance_voucher_reversals_reason_check check (length(btrim(reason)) > 0)
);

create table if not exists public.finance_bank_statements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  statement_date date not null,
  external_reference text not null,
  direction public.finance_movement_direction not null,
  amount numeric(18,2) not null,
  currency_code text not null default 'VND',
  description text not null default '',
  status text not null default 'open',
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default timezone('utc', now()),
  constraint finance_bank_statements_amount_check check (amount > 0),
  constraint finance_bank_statements_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint finance_bank_statements_status_check check (status in ('open', 'reconciled', 'voided')),
  unique (tenant_id, account_id, external_reference)
);

create index if not exists finance_bank_statements_lookup_idx
  on public.finance_bank_statements(tenant_id, account_id, statement_date desc, id desc);

create table if not exists public.finance_bank_reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  statement_id uuid not null references public.finance_bank_statements(id) on delete restrict,
  movement_id uuid not null references public.finance_account_movements(id) on delete restrict,
  matched_amount numeric(18,2) not null,
  matched_at timestamptz not null default timezone('utc', now()),
  matched_by uuid references auth.users(id) on delete set null,
  operation_id uuid references public.finance_operations(id) on delete restrict,
  constraint finance_bank_reconciliation_matches_amount_check check (matched_amount > 0)
);

create index if not exists finance_bank_reconciliation_matches_statement_idx
  on public.finance_bank_reconciliation_matches(tenant_id, statement_id, id);
create index if not exists finance_bank_reconciliation_matches_movement_idx
  on public.finance_bank_reconciliation_matches(tenant_id, movement_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'finance_obligation_adjustments_tenant_obligation_fk'
       and conrelid = 'public.finance_obligation_adjustments'::regclass
  ) then
    alter table public.finance_obligations
      add constraint finance_obligations_tenant_id_unique unique (tenant_id, id);
    alter table public.finance_obligation_adjustments
      add constraint finance_obligation_adjustments_tenant_obligation_fk
      foreign key (tenant_id, obligation_id)
      references public.finance_obligations(tenant_id, id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'finance_allocation_reversals_tenant_allocation_fk'
       and conrelid = 'public.finance_allocation_reversals'::regclass
  ) then
    alter table public.finance_allocations
      add constraint finance_allocations_tenant_id_unique unique (tenant_id, id);
    alter table public.finance_allocation_reversals
      add constraint finance_allocation_reversals_tenant_allocation_fk
      foreign key (tenant_id, allocation_id)
      references public.finance_allocations(tenant_id, id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'finance_refund_links_tenant_refund_line_fk'
       and conrelid = 'public.finance_refund_links'::regclass
  ) then
    alter table public.finance_voucher_lines
      add constraint finance_voucher_lines_tenant_id_unique unique (tenant_id, id);
    alter table public.finance_refund_links
      add constraint finance_refund_links_tenant_refund_line_fk
      foreign key (tenant_id, refund_voucher_line_id)
      references public.finance_voucher_lines(tenant_id, id)
      on delete restrict;
    alter table public.finance_refund_links
      add constraint finance_refund_links_tenant_source_line_fk
      foreign key (tenant_id, source_voucher_line_id)
      references public.finance_voucher_lines(tenant_id, id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'finance_voucher_reversals_tenant_voucher_fk'
       and conrelid = 'public.finance_voucher_reversals'::regclass
  ) then
    alter table public.finance_vouchers
      add constraint finance_vouchers_tenant_id_unique unique (tenant_id, id);
    alter table public.finance_voucher_reversals
      add constraint finance_voucher_reversals_tenant_voucher_fk
      foreign key (tenant_id, voucher_id)
      references public.finance_vouchers(tenant_id, id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'finance_bank_statements_tenant_account_fk'
       and conrelid = 'public.finance_bank_statements'::regclass
  ) then
    alter table public.finance_accounts
      add constraint finance_accounts_tenant_id_unique unique (tenant_id, id);
    alter table public.finance_bank_statements
      add constraint finance_bank_statements_tenant_account_fk
      foreign key (tenant_id, account_id)
      references public.finance_accounts(tenant_id, id)
      on delete restrict;
  end if;
end;
$$;

alter table public.finance_obligation_adjustments enable row level security;
alter table public.finance_allocation_reversals enable row level security;
alter table public.finance_refund_links enable row level security;
alter table public.finance_voucher_reversals enable row level security;
alter table public.finance_bank_statements enable row level security;
alter table public.finance_bank_reconciliation_matches enable row level security;

revoke all on public.finance_obligation_adjustments,
  public.finance_allocation_reversals,
  public.finance_refund_links,
  public.finance_voucher_reversals,
  public.finance_bank_statements,
  public.finance_bank_reconciliation_matches
  from anon, authenticated;
grant select on public.finance_obligation_adjustments,
  public.finance_allocation_reversals,
  public.finance_refund_links,
  public.finance_voucher_reversals,
  public.finance_bank_statements,
  public.finance_bank_reconciliation_matches
  to authenticated;

drop policy if exists finance_obligation_adjustments_select on public.finance_obligation_adjustments;
create policy finance_obligation_adjustments_select
  on public.finance_obligation_adjustments for select to authenticated
  using (public.is_tenant_member(tenant_id) and (
    public.has_tenant_permission(tenant_id, 'finance:obligation:view')
    or public.has_tenant_permission(tenant_id, 'finance:report:view')
  ));

drop policy if exists finance_allocation_reversals_select on public.finance_allocation_reversals;
create policy finance_allocation_reversals_select
  on public.finance_allocation_reversals for select to authenticated
  using (public.is_tenant_member(tenant_id) and (
    public.has_tenant_permission(tenant_id, 'finance:obligation:view')
    or public.has_tenant_permission(tenant_id, 'finance:report:view')
  ));

drop policy if exists finance_refund_links_select on public.finance_refund_links;
create policy finance_refund_links_select
  on public.finance_refund_links for select to authenticated
  using (public.is_tenant_member(tenant_id) and (
    public.has_tenant_permission(tenant_id, 'finance:obligation:view')
    or public.has_tenant_permission(tenant_id, 'finance:report:view')
  ));

drop policy if exists finance_voucher_reversals_select on public.finance_voucher_reversals;
create policy finance_voucher_reversals_select
  on public.finance_voucher_reversals for select to authenticated
  using (public.is_tenant_member(tenant_id) and (
    public.has_tenant_permission(tenant_id, 'finance:voucher:view')
    or public.has_tenant_permission(tenant_id, 'finance:report:view')
  ));

drop policy if exists finance_bank_statements_select on public.finance_bank_statements;
create policy finance_bank_statements_select
  on public.finance_bank_statements for select to authenticated
  using (public.is_tenant_member(tenant_id) and (
    public.has_tenant_permission(tenant_id, 'finance:account:view')
    or public.has_tenant_permission(tenant_id, 'finance:report:view')
  ));

drop policy if exists finance_bank_reconciliation_matches_select on public.finance_bank_reconciliation_matches;
create policy finance_bank_reconciliation_matches_select
  on public.finance_bank_reconciliation_matches for select to authenticated
  using (public.is_tenant_member(tenant_id) and (
    public.has_tenant_permission(tenant_id, 'finance:account:view')
    or public.has_tenant_permission(tenant_id, 'finance:report:view')
  ));

create or replace function public.finance_obligation_adjustment_total_as_of(
  p_tenant_id uuid,
  p_obligation_id uuid,
  p_as_of_date date
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(adjustment.amount_delta), 0)::numeric(18,2)
    from public.finance_obligation_adjustments adjustment
   where adjustment.tenant_id = p_tenant_id
     and adjustment.obligation_id = p_obligation_id
     and adjustment.effective_date <= p_as_of_date;
$$;

create or replace function public.finance_allocation_effective_amount_as_of(
  p_tenant_id uuid,
  p_allocation_id uuid,
  p_as_of_date date
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(allocation.amount, 0)
       - coalesce((
           select sum(reversal.amount)
             from public.finance_allocation_reversals reversal
            where reversal.tenant_id = p_tenant_id
              and reversal.allocation_id = p_allocation_id
              and reversal.effective_date <= p_as_of_date
         ), 0)::numeric(18,2)
    from public.finance_allocations allocation
   where allocation.tenant_id = p_tenant_id
     and allocation.id = p_allocation_id
     and allocation.status = 'active';
$$;

create or replace function public.finance_obligation_settled_amount_as_of(
  p_tenant_id uuid,
  p_obligation_id uuid,
  p_as_of_date date
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(
    public.finance_allocation_effective_amount_as_of(
      p_tenant_id, allocation.id, p_as_of_date
    )
  ), 0)::numeric(18,2)
    from public.finance_allocations allocation
   where allocation.tenant_id = p_tenant_id
     and allocation.obligation_id = p_obligation_id
     and allocation.status = 'active'
     and allocation.effective_date <= p_as_of_date;
$$;

create or replace function public.finance_advance_refunded_amount_as_of(
  p_tenant_id uuid,
  p_source_line_id uuid,
  p_as_of_date date
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(refund.amount), 0)::numeric(18,2)
    from public.finance_refund_links refund
   where refund.tenant_id = p_tenant_id
     and refund.source_voucher_line_id = p_source_line_id
     and refund.effective_date <= p_as_of_date;
$$;

create or replace function public.finance_advance_allocated_amount_as_of(
  p_tenant_id uuid,
  p_source_line_id uuid,
  p_as_of_date date
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(
    public.finance_allocation_effective_amount_as_of(
      p_tenant_id, allocation.id, p_as_of_date
    )
  ), 0)::numeric(18,2)
    from public.finance_allocations allocation
   where allocation.tenant_id = p_tenant_id
     and allocation.voucher_line_id = p_source_line_id
     and allocation.status = 'active'
     and allocation.effective_date <= p_as_of_date;
$$;

create or replace view public.finance_obligation_balances as
with adjustments as (
  select obligation_id, tenant_id,
         sum(amount_delta)::numeric(18,2) as adjustment_amount
    from public.finance_obligation_adjustments
   group by tenant_id, obligation_id
), allocations as (
  select allocation.obligation_id, allocation.tenant_id,
         sum(
           allocation.amount - coalesce((
             select sum(reversal.amount)
               from public.finance_allocation_reversals reversal
              where reversal.tenant_id = allocation.tenant_id
                and reversal.allocation_id = allocation.id
           ), 0)
         )::numeric(18,2) as settled_amount
    from public.finance_allocations allocation
   where allocation.status = 'active'
   group by allocation.tenant_id, allocation.obligation_id
)
select obligation.id,
       obligation.tenant_id,
       obligation.code,
       obligation.description,
       obligation.party_type,
       obligation.customer_id,
       obligation.employee_id,
       obligation.party_name_snapshot,
       obligation.direction,
       obligation.source_type,
       obligation.contract_id,
       contract.name as contract_name,
       obligation.document_date,
       obligation.due_date,
       obligation.original_amount,
       obligation.currency_code,
       obligation.status,
       coalesce(allocations.settled_amount, 0)::numeric(18,2) as settled_amount,
       (
         obligation.original_amount + coalesce(adjustments.adjustment_amount, 0)
         - coalesce(allocations.settled_amount, 0)
       )::numeric(18,2) as outstanding_amount,
       obligation.effective_date,
       obligation.recognition_basis
  from public.finance_obligations obligation
  left join adjustments
    on adjustments.tenant_id = obligation.tenant_id
   and adjustments.obligation_id = obligation.id
  left join allocations
    on allocations.tenant_id = obligation.tenant_id
   and allocations.obligation_id = obligation.id
  left join public.contracts contract
    on contract.id = obligation.contract_id
   and contract.tenant_id = obligation.tenant_id;

create or replace function public.get_finance_obligation_balances_as_of(
  p_tenant_id uuid,
  p_as_of_date date,
  p_direction public.finance_obligation_direction default null,
  p_customer_id uuid default null,
  p_currency_code text default null
)
returns table (
  id uuid,
  tenant_id uuid,
  code text,
  description text,
  party_type public.finance_party_type,
  customer_id uuid,
  employee_id uuid,
  party_name_snapshot text,
  direction public.finance_obligation_direction,
  source_type public.finance_obligation_source,
  contract_id uuid,
  contract_name text,
  document_date date,
  effective_date date,
  due_date date,
  recognition_basis text,
  original_amount numeric,
  adjustment_amount numeric,
  obligation_amount numeric,
  settled_amount numeric,
  outstanding_amount numeric,
  currency_code text,
  status public.finance_obligation_status
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_as_of_date is null then
    raise exception 'tenant_id and as_of_date are required' using errcode = '22004';
  end if;
  if p_currency_code is not null and p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'currency_code must be an ISO 4217 code' using errcode = '22023';
  end if;
  if not (
    public.has_tenant_permission(p_tenant_id, 'finance:obligation:view')
    or public.has_tenant_permission(p_tenant_id, 'finance:report:view')
  ) then
    raise exception 'Finance obligation view permission required' using errcode = '42501';
  end if;

  return query
  select balance.id,
         balance.tenant_id,
         balance.code,
         balance.description,
         balance.party_type,
         balance.customer_id,
         balance.employee_id,
         balance.party_name_snapshot,
         balance.direction,
         balance.source_type,
         balance.contract_id,
         balance.contract_name,
         balance.document_date,
         balance.effective_date,
         balance.due_date,
         balance.recognition_basis,
         balance.original_amount,
         coalesce((
           select sum(adjustment.amount_delta)
             from public.finance_obligation_adjustments adjustment
            where adjustment.tenant_id = balance.tenant_id
              and adjustment.obligation_id = balance.id
              and adjustment.effective_date <= p_as_of_date
         ), 0)::numeric(18,2),
         (
           balance.original_amount + coalesce((
             select sum(adjustment.amount_delta)
               from public.finance_obligation_adjustments adjustment
              where adjustment.tenant_id = balance.tenant_id
                and adjustment.obligation_id = balance.id
                and adjustment.effective_date <= p_as_of_date
           ), 0)
         )::numeric(18,2),
         public.finance_obligation_settled_amount_as_of(
           balance.tenant_id, balance.id, p_as_of_date
         ),
         (
           balance.original_amount + coalesce((
             select sum(adjustment.amount_delta)
               from public.finance_obligation_adjustments adjustment
              where adjustment.tenant_id = balance.tenant_id
                and adjustment.obligation_id = balance.id
                and adjustment.effective_date <= p_as_of_date
           ), 0)
           - public.finance_obligation_settled_amount_as_of(
             balance.tenant_id, balance.id, p_as_of_date
           )
         )::numeric(18,2),
         balance.currency_code,
         balance.status
    from public.finance_obligation_balances balance
   where balance.tenant_id = p_tenant_id
     and balance.status = 'posted'
     and balance.effective_date <= p_as_of_date
     and (p_direction is null or balance.direction = p_direction)
     and (p_customer_id is null or balance.customer_id = p_customer_id)
     and (p_currency_code is null or balance.currency_code = p_currency_code)
   order by balance.effective_date, balance.id;
end;
$$;

create or replace function public.get_finance_advance_balances_as_of(
  p_tenant_id uuid,
  p_as_of_date date,
  p_customer_id uuid default null,
  p_currency_code text default null
)
returns table (
  source_line_id uuid,
  voucher_id uuid,
  voucher_no text,
  effective_date date,
  customer_id uuid,
  party_name_snapshot text,
  related_contract_id uuid,
  advance_scope public.finance_advance_scope,
  amount numeric,
  allocated_amount numeric,
  refunded_amount numeric,
  available_amount numeric,
  currency_code text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_as_of_date is null then
    raise exception 'tenant_id and as_of_date are required' using errcode = '22004';
  end if;
  if p_currency_code is not null and p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'currency_code must be an ISO 4217 code' using errcode = '22023';
  end if;
  if not (
    public.has_tenant_permission(p_tenant_id, 'finance:obligation:view')
    or public.has_tenant_permission(p_tenant_id, 'finance:report:view')
  ) then
    raise exception 'Finance advance view permission required' using errcode = '42501';
  end if;

  return query
  select line.id,
         voucher.id,
         voucher.voucher_no,
         voucher.voucher_date,
         voucher.customer_id,
         voucher.party_name_snapshot,
         line.related_contract_id,
         line.advance_scope,
         line.amount,
         public.finance_advance_allocated_amount_as_of(
           p_tenant_id, line.id, p_as_of_date
         ),
         public.finance_advance_refunded_amount_as_of(
           p_tenant_id, line.id, p_as_of_date
         ),
         (
           line.amount
           - public.finance_advance_allocated_amount_as_of(
             p_tenant_id, line.id, p_as_of_date
           )
           - public.finance_advance_refunded_amount_as_of(
             p_tenant_id, line.id, p_as_of_date
           )
         )::numeric(18,2),
         voucher.currency_code
    from public.finance_voucher_lines line
    join public.finance_vouchers voucher
      on voucher.id = line.voucher_id
     and voucher.tenant_id = line.tenant_id
   where line.tenant_id = p_tenant_id
     and voucher.status = 'posted'
     and voucher.voucher_type = 'receipt'
     and voucher.party_type = 'customer'
     and voucher.customer_id is not null
     and voucher.voucher_date <= p_as_of_date
     and line.handling_type = 'advance'
     and (p_customer_id is null or voucher.customer_id = p_customer_id)
     and (p_currency_code is null or voucher.currency_code = p_currency_code)
   order by voucher.voucher_date, line.line_no, line.id;
end;
$$;

create or replace function public.get_customer_finance_summary_as_of(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_as_of_date date,
  p_currency_code text default null
)
returns table (
  tenant_id uuid,
  customer_id uuid,
  currency_code text,
  total_billed numeric,
  total_paid numeric,
  total_outstanding numeric,
  overdue_outstanding numeric,
  unapplied_credit numeric,
  cash_received numeric,
  cash_paid numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_customer_id is null or p_as_of_date is null then
    raise exception 'tenant_id, customer_id and as_of_date are required' using errcode = '22004';
  end if;
  if not (
    public.has_tenant_permission(p_tenant_id, 'finance:obligation:view')
    or public.has_tenant_permission(p_tenant_id, 'finance:report:view')
  ) then
    raise exception 'Finance summary view permission required' using errcode = '42501';
  end if;

  return query
  with obligations as (
    select balance.currency_code,
           sum(balance.original_amount)::numeric(18,2) as total_billed,
           sum(public.finance_obligation_settled_amount_as_of(
             p_tenant_id, balance.id, p_as_of_date
           ))::numeric(18,2) as total_paid,
           sum(
             balance.original_amount
             + coalesce((
               select sum(adjustment.amount_delta)
                 from public.finance_obligation_adjustments adjustment
                where adjustment.tenant_id = p_tenant_id
                  and adjustment.obligation_id = balance.id
                  and adjustment.effective_date <= p_as_of_date
             ), 0)
             - public.finance_obligation_settled_amount_as_of(
               p_tenant_id, balance.id, p_as_of_date
             )
           )::numeric(18,2) as total_outstanding,
           sum(case
             when balance.due_date < p_as_of_date
              and balance.original_amount
                + coalesce((
                  select sum(adjustment.amount_delta)
                    from public.finance_obligation_adjustments adjustment
                   where adjustment.tenant_id = p_tenant_id
                     and adjustment.obligation_id = balance.id
                     and adjustment.effective_date <= p_as_of_date
                ), 0)
                - public.finance_obligation_settled_amount_as_of(
                  p_tenant_id, balance.id, p_as_of_date
                ) > 0
             then balance.original_amount
                + coalesce((
                  select sum(adjustment.amount_delta)
                    from public.finance_obligation_adjustments adjustment
                   where adjustment.tenant_id = p_tenant_id
                     and adjustment.obligation_id = balance.id
                     and adjustment.effective_date <= p_as_of_date
                ), 0)
                - public.finance_obligation_settled_amount_as_of(
                  p_tenant_id, balance.id, p_as_of_date
                )
             else 0
           end)::numeric(18,2) as overdue_outstanding
      from public.finance_obligation_balances balance
     where balance.tenant_id = p_tenant_id
       and balance.customer_id = p_customer_id
       and balance.party_type = 'customer'
       and balance.direction = 'receivable'
       and balance.status = 'posted'
       and balance.effective_date <= p_as_of_date
       and (p_currency_code is null or balance.currency_code = p_currency_code)
     group by balance.currency_code
  ), advances as (
    select voucher.currency_code,
           sum(line.amount)::numeric(18,2) as advance_amount,
           sum(public.finance_advance_allocated_amount_as_of(
             p_tenant_id, line.id, p_as_of_date
           ))::numeric(18,2) as allocated_amount,
           sum(public.finance_advance_refunded_amount_as_of(
             p_tenant_id, line.id, p_as_of_date
           ))::numeric(18,2) as refunded_amount
      from public.finance_vouchers voucher
      join public.finance_voucher_lines line
        on line.voucher_id = voucher.id
       and line.tenant_id = voucher.tenant_id
       and line.handling_type = 'advance'
     where voucher.tenant_id = p_tenant_id
       and voucher.customer_id = p_customer_id
       and voucher.party_type = 'customer'
       and voucher.voucher_type = 'receipt'
       and voucher.status = 'posted'
       and voucher.voucher_date <= p_as_of_date
       and (p_currency_code is null or voucher.currency_code = p_currency_code)
     group by voucher.currency_code
  ), cash as (
    select voucher.currency_code,
           sum(case when movement.direction = 'in' then movement.amount else 0 end)::numeric(18,2) as cash_received,
           sum(case when movement.direction = 'out' then movement.amount else 0 end)::numeric(18,2) as cash_paid
      from public.finance_account_movements movement
      join public.finance_vouchers voucher
        on voucher.id = movement.voucher_id
       and voucher.tenant_id = movement.tenant_id
     where movement.tenant_id = p_tenant_id
       and voucher.customer_id = p_customer_id
       and voucher.party_type = 'customer'
       and movement.effective_date <= p_as_of_date
       and (p_currency_code is null or voucher.currency_code = p_currency_code)
     group by voucher.currency_code
  )
  select p_tenant_id,
         p_customer_id,
         coalesce(obligations.currency_code, advances.currency_code, cash.currency_code),
         coalesce(obligations.total_billed, 0)::numeric(18,2),
         coalesce(obligations.total_paid, 0)::numeric(18,2),
         coalesce(obligations.total_outstanding, 0)::numeric(18,2),
         coalesce(obligations.overdue_outstanding, 0)::numeric(18,2),
         (
           coalesce(advances.advance_amount, 0)
           - coalesce(advances.allocated_amount, 0)
           - coalesce(advances.refunded_amount, 0)
         )::numeric(18,2),
         coalesce(cash.cash_received, 0)::numeric(18,2),
         coalesce(cash.cash_paid, 0)::numeric(18,2)
    from obligations
    full join advances on advances.currency_code = obligations.currency_code
    full join cash on cash.currency_code = coalesce(obligations.currency_code, advances.currency_code);
end;
$$;

create or replace view public.customer_receivable_summary as
with receivables as (
  select balance.tenant_id,
         balance.customer_id,
         balance.currency_code,
         coalesce(sum(
           balance.original_amount
           + public.finance_obligation_adjustment_total_as_of(
             balance.tenant_id, balance.id, current_date
           )
         ), 0)::numeric(18,2) as total_billed,
         coalesce(sum(balance.settled_amount), 0)::numeric(18,2) as total_paid,
         coalesce(sum(balance.outstanding_amount), 0)::numeric(18,2) as total_outstanding,
         coalesce(sum(balance.outstanding_amount) filter (
           where balance.due_date < current_date and balance.outstanding_amount > 0
         ), 0)::numeric(18,2) as overdue_outstanding
    from public.finance_obligation_balances balance
   where balance.status = 'posted'
     and balance.direction = 'receivable'
     and balance.party_type = 'customer'
     and balance.effective_date <= current_date
   group by balance.tenant_id, balance.customer_id, balance.currency_code
), advances as (
  select voucher.tenant_id,
         voucher.customer_id,
         voucher.currency_code,
         coalesce(sum(line.amount), 0)::numeric(18,2) as advance_amount,
         coalesce(sum(public.finance_advance_allocated_amount_as_of(
           voucher.tenant_id, line.id, current_date
         )), 0)::numeric(18,2) as allocated_amount,
         coalesce(sum(public.finance_advance_refunded_amount_as_of(
           voucher.tenant_id, line.id, current_date
         )), 0)::numeric(18,2) as refunded_amount
    from public.finance_vouchers voucher
    join public.finance_voucher_lines line
      on line.voucher_id = voucher.id
     and line.tenant_id = voucher.tenant_id
     and line.handling_type = 'advance'
   where voucher.status = 'posted'
     and voucher.voucher_type = 'receipt'
     and voucher.party_type = 'customer'
     and voucher.customer_id is not null
     and voucher.voucher_date <= current_date
   group by voucher.tenant_id, voucher.customer_id, voucher.currency_code
)
select coalesce(receivables.tenant_id, advances.tenant_id) as tenant_id,
       coalesce(receivables.customer_id, advances.customer_id) as customer_id,
       coalesce(receivables.currency_code, advances.currency_code) as currency_code,
       coalesce(receivables.total_billed, 0)::numeric(18,2) as total_billed,
       coalesce(receivables.total_paid, 0)::numeric(18,2) as total_paid,
       coalesce(receivables.total_outstanding, 0)::numeric(18,2) as total_outstanding,
       coalesce(receivables.overdue_outstanding, 0)::numeric(18,2) as overdue_outstanding,
       (
         coalesce(advances.advance_amount, 0)
         - coalesce(advances.allocated_amount, 0)
         - coalesce(advances.refunded_amount, 0)
       )::numeric(18,2) as unapplied_credit
  from receivables
  full join advances
    on advances.tenant_id = receivables.tenant_id
   and advances.customer_id = receivables.customer_id
   and advances.currency_code = receivables.currency_code;

create or replace function public.create_finance_obligation_adjustment(
  p_tenant_id uuid,
  p_obligation_id uuid,
  p_amount_delta numeric,
  p_effective_date date,
  p_reason text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_existing_type text;
  v_existing_hash text;
  v_existing_result jsonb;
  v_obligation public.finance_obligations;
  v_current_amount numeric(18,2);
  v_settled numeric(18,2);
  v_operation_id uuid := gen_random_uuid();
  v_adjustment_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_tenant_id is null or p_obligation_id is null or p_amount_delta is null
     or p_amount_delta = 0 or p_effective_date is null
     or nullif(btrim(p_reason), '') is null or nullif(btrim(p_request_key), '') is null
  then
    raise exception 'tenant, obligation, non-zero amount, date, reason and request_key are required' using errcode = '22004';
  end if;
  if not public.has_tenant_permission(p_tenant_id, 'finance:obligation:create') then
    raise exception 'Finance obligation create permission required' using errcode = '42501';
  end if;
  v_hash := md5(jsonb_build_object(
    'operation', 'create_finance_obligation_adjustment',
    'tenant_id', p_tenant_id,
    'obligation_id', p_obligation_id,
    'amount_delta', p_amount_delta,
    'effective_date', p_effective_date,
    'reason', btrim(p_reason)
  )::text);
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_request_key, 0));
  select operation_type, request_hash, result_summary into v_existing_type, v_existing_hash, v_existing_result
    from public.finance_operations where tenant_id = p_tenant_id and request_key = p_request_key;
  if found then
    if v_existing_type <> 'create_finance_obligation_adjustment' or v_existing_hash <> v_hash then
      raise exception 'request_key was already used with different data' using errcode = '23505';
    end if;
    return v_existing_result;
  end if;
  if public.finance_period_is_locked(p_tenant_id, p_effective_date) then
    raise exception 'Không thể điều chỉnh trong kỳ đã khóa' using errcode = '23514';
  end if;
  select * into v_obligation from public.finance_obligations
   where id = p_obligation_id and tenant_id = p_tenant_id for update;
  if not found or v_obligation.status <> 'posted' then
    raise exception 'Only a posted obligation can be adjusted' using errcode = 'P0001';
  end if;
  v_current_amount := v_obligation.original_amount
    + public.finance_obligation_adjustment_total_as_of(p_tenant_id, p_obligation_id, p_effective_date);
  v_settled := public.finance_obligation_settled_amount_as_of(p_tenant_id, p_obligation_id, p_effective_date);
  if v_current_amount + p_amount_delta < v_settled then
    raise exception 'Điều chỉnh làm số tiền công nợ thấp hơn số đã phân bổ' using errcode = '23514';
  end if;
  insert into public.finance_obligation_adjustments(
    tenant_id, obligation_id, amount_delta, effective_date, reason, operation_id, created_by
  ) values (
    p_tenant_id, p_obligation_id, p_amount_delta, p_effective_date, btrim(p_reason), v_operation_id, auth.uid()
  ) returning id into v_adjustment_id;
  v_result := jsonb_build_object('id', v_adjustment_id, 'obligationId', p_obligation_id,
    'amountDelta', p_amount_delta, 'effectiveDate', p_effective_date);
  insert into public.finance_operations(
    id, tenant_id, request_key, operation_type, request_hash, result_reference, result_summary
  ) values (
    v_operation_id, p_tenant_id, p_request_key, 'create_finance_obligation_adjustment', v_hash, v_adjustment_id, v_result
  );
  return v_result;
end;
$$;

create or replace function public.reverse_finance_allocation(
  p_tenant_id uuid,
  p_allocation_id uuid,
  p_amount numeric,
  p_effective_date date,
  p_reason text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_existing_type text;
  v_existing_hash text;
  v_existing_result jsonb;
  v_allocation public.finance_allocations;
  v_reversed numeric(18,2);
  v_remaining numeric(18,2);
  v_operation_id uuid := gen_random_uuid();
  v_reversal_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_tenant_id is null or p_allocation_id is null or p_amount is null or p_amount <= 0
     or p_effective_date is null or nullif(btrim(p_reason), '') is null
     or nullif(btrim(p_request_key), '') is null
  then raise exception 'tenant, allocation, positive amount, date, reason and request_key are required' using errcode = '22004'; end if;
  if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:reverse') then
    raise exception 'Finance voucher reverse permission required' using errcode = '42501';
  end if;
  v_hash := md5(jsonb_build_object('operation', 'reverse_finance_allocation', 'tenant_id', p_tenant_id,
    'allocation_id', p_allocation_id, 'amount', p_amount, 'effective_date', p_effective_date,
    'reason', btrim(p_reason))::text);
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_request_key, 0));
  select operation_type, request_hash, result_summary into v_existing_type, v_existing_hash, v_existing_result
    from public.finance_operations where tenant_id = p_tenant_id and request_key = p_request_key;
  if found then
    if v_existing_type <> 'reverse_finance_allocation' or v_existing_hash <> v_hash then
      raise exception 'request_key was already used with different data' using errcode = '23505';
    end if;
    return v_existing_result;
  end if;
  if public.finance_period_is_locked(p_tenant_id, p_effective_date) then
    raise exception 'Không thể đảo phân bổ trong kỳ đã khóa' using errcode = '23514';
  end if;
  select * into v_allocation from public.finance_allocations
   where id = p_allocation_id and tenant_id = p_tenant_id for update;
  if not found or v_allocation.status <> 'active' then
    raise exception 'Allocation is not active' using errcode = 'P0001';
  end if;
  if p_effective_date < v_allocation.effective_date then
    raise exception 'Reversal date cannot be before allocation date' using errcode = '22023';
  end if;
  select coalesce(sum(reversal.amount), 0)::numeric(18,2) into v_reversed
    from public.finance_allocation_reversals reversal
   where reversal.tenant_id = p_tenant_id and reversal.allocation_id = p_allocation_id;
  v_remaining := v_allocation.amount - v_reversed;
  if p_amount > v_remaining then
    raise exception 'Allocation reversal exceeds remaining allocation' using errcode = '22003';
  end if;
  insert into public.finance_allocation_reversals(
    tenant_id, allocation_id, amount, effective_date, reason, operation_id, created_by
  ) values (
    p_tenant_id, p_allocation_id, p_amount, p_effective_date, btrim(p_reason), v_operation_id, auth.uid()
  ) returning id into v_reversal_id;
  v_result := jsonb_build_object('id', v_reversal_id, 'allocationId', p_allocation_id,
    'amount', p_amount, 'effectiveDate', p_effective_date);
  insert into public.finance_operations(
    id, tenant_id, request_key, operation_type, request_hash, result_reference, result_summary
  ) values (
    v_operation_id, p_tenant_id, p_request_key, 'reverse_finance_allocation', v_hash, v_reversal_id, v_result
  );
  return v_result;
end;
$$;

create or replace function public.reverse_finance_voucher(
  p_tenant_id uuid,
  p_voucher_id uuid,
  p_reversal_effective_date date,
  p_reason text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_existing_type text;
  v_existing_hash text;
  v_existing_result jsonb;
  v_voucher public.finance_vouchers;
  v_original_movement public.finance_account_movements;
  v_reverse_movement_id uuid;
  v_operation_id uuid := gen_random_uuid();
  v_reversal_id uuid;
  v_allocation record;
  v_remaining numeric(18,2);
  v_reversed numeric(18,2);
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_tenant_id is null or p_voucher_id is null or p_reversal_effective_date is null
     or nullif(btrim(p_reason), '') is null or nullif(btrim(p_request_key), '') is null
  then raise exception 'tenant, voucher, reversal date, reason and request_key are required' using errcode = '22004'; end if;
  if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:reverse') then
    raise exception 'Finance voucher reverse permission required' using errcode = '42501';
  end if;
  v_hash := md5(jsonb_build_object('operation', 'reverse_finance_voucher', 'tenant_id', p_tenant_id,
    'voucher_id', p_voucher_id, 'reversal_effective_date', p_reversal_effective_date,
    'reason', btrim(p_reason))::text);
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_request_key, 0));
  select operation_type, request_hash, result_summary into v_existing_type, v_existing_hash, v_existing_result
    from public.finance_operations where tenant_id = p_tenant_id and request_key = p_request_key;
  if found then
    if v_existing_type <> 'reverse_finance_voucher' or v_existing_hash <> v_hash then
      raise exception 'request_key was already used with different data' using errcode = '23505';
    end if;
    return v_existing_result;
  end if;
  if public.finance_period_is_locked(p_tenant_id, p_reversal_effective_date) then
    raise exception 'Không thể đảo phiếu trong kỳ đã khóa' using errcode = '23514';
  end if;
  select * into v_voucher from public.finance_vouchers where id = p_voucher_id and tenant_id = p_tenant_id for update;
  if not found or v_voucher.status <> 'posted' then
    raise exception 'Only a posted voucher can be reversed' using errcode = 'P0001';
  end if;
  if p_reversal_effective_date < v_voucher.voucher_date then
    raise exception 'Reversal date cannot be before voucher date' using errcode = '22023';
  end if;
  select * into v_original_movement from public.finance_account_movements
   where tenant_id = p_tenant_id and voucher_id = p_voucher_id and event_type = 'voucher_posting'
   order by created_at, id limit 1 for update;
  if not found then raise exception 'Posted voucher movement not found' using errcode = 'P0002'; end if;
  insert into public.finance_voucher_reversals(
    tenant_id, voucher_id, reversal_effective_date, reason, operation_id, created_by
  ) values (
    p_tenant_id, p_voucher_id, p_reversal_effective_date, btrim(p_reason), v_operation_id, auth.uid()
  ) returning id into v_reversal_id;
  insert into public.finance_account_movements(
    tenant_id, account_id, effective_date, direction, amount, voucher_id, event_type, reversal_of_id, operation_id
  ) values (
    p_tenant_id, v_original_movement.account_id, p_reversal_effective_date,
    case when v_original_movement.direction = 'in' then 'out'::public.finance_movement_direction else 'in'::public.finance_movement_direction end,
    v_original_movement.amount, p_voucher_id, 'voucher_reversal', v_original_movement.id, v_operation_id
  ) returning id into v_reverse_movement_id;
  for v_allocation in
    select allocation.* from public.finance_allocations allocation
     join public.finance_voucher_lines line on line.id = allocation.voucher_line_id and line.tenant_id = allocation.tenant_id
    where allocation.tenant_id = p_tenant_id and line.voucher_id = p_voucher_id and allocation.status = 'active'
    order by allocation.id for update
  loop
    select coalesce(sum(reversal.amount), 0)::numeric(18,2) into v_reversed
      from public.finance_allocation_reversals reversal
     where reversal.tenant_id = p_tenant_id and reversal.allocation_id = v_allocation.id;
    v_remaining := v_allocation.amount - v_reversed;
    if v_remaining > 0 then
      insert into public.finance_allocation_reversals(
        tenant_id, allocation_id, amount, effective_date, reason, operation_id, created_by
      ) values (
        p_tenant_id, v_allocation.id, v_remaining, p_reversal_effective_date,
        'Đảo phiếu: ' || btrim(p_reason), v_operation_id, auth.uid()
      );
    end if;
  end loop;
  update public.finance_vouchers
     set status = 'reversed', reversed_at = timezone('utc', now()), reversed_by = auth.uid(),
         reversal_effective_date = p_reversal_effective_date, reversal_reason = btrim(p_reason)
   where id = p_voucher_id;
  v_result := jsonb_build_object('id', p_voucher_id, 'status', 'reversed',
    'reversalId', v_reversal_id, 'movementId', v_reverse_movement_id);
  insert into public.finance_operations(
    id, tenant_id, request_key, operation_type, request_hash, result_reference, result_summary
  ) values (
    v_operation_id, p_tenant_id, p_request_key, 'reverse_finance_voucher', v_hash, p_voucher_id, v_result
  );
  return v_result;
end;
$$;

create or replace function public.create_finance_advance_refund(
  p_tenant_id uuid,
  p_source_voucher_line_id uuid,
  p_account_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_effective_date date,
  p_reason text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_existing_type text;
  v_existing_hash text;
  v_existing_result jsonb;
  v_source record;
  v_account public.finance_accounts;
  v_category_name text;
  v_allocated numeric(18,2);
  v_refunded numeric(18,2);
  v_available numeric(18,2);
  v_voucher_id uuid := gen_random_uuid();
  v_line_id uuid;
  v_movement_id uuid;
  v_operation_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_tenant_id is null or p_source_voucher_line_id is null or p_account_id is null
     or p_category_id is null or p_amount is null or p_amount <= 0 or p_effective_date is null
     or nullif(btrim(p_reason), '') is null or nullif(btrim(p_request_key), '') is null
  then raise exception 'tenant, source, account, category, positive amount, date, reason and request_key are required' using errcode = '22004'; end if;
  if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:create') then
    raise exception 'Finance voucher create permission required' using errcode = '42501';
  end if;
  v_hash := md5(jsonb_build_object('operation', 'create_finance_advance_refund', 'tenant_id', p_tenant_id,
    'source_voucher_line_id', p_source_voucher_line_id, 'account_id', p_account_id,
    'category_id', p_category_id, 'amount', p_amount, 'effective_date', p_effective_date,
    'reason', btrim(p_reason))::text);
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_request_key, 0));
  select operation_type, request_hash, result_summary into v_existing_type, v_existing_hash, v_existing_result
    from public.finance_operations where tenant_id = p_tenant_id and request_key = p_request_key;
  if found then
    if v_existing_type <> 'create_finance_advance_refund' or v_existing_hash <> v_hash then
      raise exception 'request_key was already used with different data' using errcode = '23505';
    end if;
    return v_existing_result;
  end if;
  if public.finance_period_is_locked(p_tenant_id, p_effective_date) then
    raise exception 'Không thể hoàn ứng trong kỳ đã khóa' using errcode = '23514';
  end if;
  select line.id, line.tenant_id, line.amount, line.related_contract_id, line.advance_scope,
         voucher.id as voucher_id, voucher.status as voucher_status, voucher.voucher_type,
         voucher.customer_id, voucher.party_type, voucher.party_name_snapshot, voucher.currency_code,
         voucher.voucher_date
    into v_source
    from public.finance_voucher_lines line
    join public.finance_vouchers voucher on voucher.id = line.voucher_id and voucher.tenant_id = line.tenant_id
   where line.id = p_source_voucher_line_id and line.tenant_id = p_tenant_id
   for update of line, voucher;
  if not found or v_source.voucher_status <> 'posted' or v_source.voucher_type <> 'receipt'
     or v_source.party_type <> 'customer' or v_source.customer_id is null
     or v_source.advance_scope is null or (select handling_type from public.finance_voucher_lines where id = p_source_voucher_line_id) <> 'advance'
  then raise exception 'Source line must be a posted customer advance receipt' using errcode = 'P0001'; end if;
  if p_effective_date < v_source.voucher_date then raise exception 'Refund date cannot be before source receipt date' using errcode = '22023'; end if;
  select * into v_account from public.finance_accounts where id = p_account_id and tenant_id = p_tenant_id for update;
  if not found or not v_account.is_active then raise exception 'Account is not available' using errcode = 'P0001'; end if;
  if v_account.currency_code <> v_source.currency_code then raise exception 'Refund account currency does not match source advance' using errcode = '23514'; end if;
  select name into v_category_name from public.finance_categories where id = p_category_id and tenant_id = p_tenant_id and is_active;
  if not found then raise exception 'Invalid or inactive finance category' using errcode = '23503'; end if;
  v_allocated := public.finance_advance_allocated_amount_as_of(p_tenant_id, p_source_voucher_line_id, p_effective_date);
  v_refunded := public.finance_advance_refunded_amount_as_of(p_tenant_id, p_source_voucher_line_id, p_effective_date);
  v_available := v_source.amount - v_allocated - v_refunded;
  if p_amount > v_available then raise exception 'Refund exceeds available advance amount' using errcode = '22003'; end if;
  insert into public.finance_vouchers(
    id, tenant_id, voucher_no, voucher_type, voucher_date, transaction_at, party_type, customer_id,
    party_name_snapshot, account_id, currency_code, total_amount, description, status, posted_at, posted_by, created_by
  ) values (
    v_voucher_id, p_tenant_id, to_char(p_effective_date, 'YYYYMMDD') || '-' || lpad(nextval('finance_voucher_no_seq')::text, 6, '0'),
    'payment', p_effective_date, timezone('utc', now()), 'customer', v_source.customer_id,
    v_source.party_name_snapshot, p_account_id, v_source.currency_code, p_amount, btrim(p_reason),
    'posted', timezone('utc', now()), auth.uid(), auth.uid()
  );
  insert into public.finance_voucher_lines(
    id, tenant_id, voucher_id, line_no, category_id, category_name_snapshot, description, amount,
    handling_type, related_contract_id
  ) values (
    gen_random_uuid(), p_tenant_id, v_voucher_id, 1, p_category_id, v_category_name, btrim(p_reason), p_amount,
    'refund', v_source.related_contract_id
  ) returning id into v_line_id;
  insert into public.finance_refund_links(
    tenant_id, refund_voucher_line_id, source_voucher_line_id, amount, effective_date, reason, operation_id, created_by
  ) values (
    p_tenant_id, v_line_id, p_source_voucher_line_id, p_amount, p_effective_date, btrim(p_reason), v_operation_id, auth.uid()
  );
  insert into public.finance_account_movements(
    tenant_id, account_id, effective_date, direction, amount, voucher_id, event_type, operation_id
  ) values (
    p_tenant_id, p_account_id, p_effective_date, 'out', p_amount, v_voucher_id, 'advance_refund', v_operation_id
  ) returning id into v_movement_id;
  v_result := jsonb_build_object('id', v_voucher_id, 'lineId', v_line_id, 'status', 'posted', 'movementId', v_movement_id);
  insert into public.finance_operations(
    id, tenant_id, request_key, operation_type, request_hash, result_reference, result_summary
  ) values (
    v_operation_id, p_tenant_id, p_request_key, 'create_finance_advance_refund', v_hash, v_voucher_id, v_result
  );
  return v_result;
end;
$$;

create or replace function public.get_finance_audit_timeline(
  p_tenant_id uuid,
  p_reference_id uuid default null,
  p_limit integer default 100
)
returns table (
  operation_id uuid,
  tenant_id uuid,
  operation_type text,
  request_key text,
  request_hash text,
  result_reference uuid,
  result_summary jsonb,
  actor_user_id uuid,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not (
    public.has_tenant_permission(p_tenant_id, 'finance:report:view')
    or public.has_tenant_permission(p_tenant_id, 'finance:voucher:view')
  ) then raise exception 'Finance audit view permission required' using errcode = '42501'; end if;
  return query
  select operation.id, operation.tenant_id, operation.operation_type, operation.request_key,
         operation.request_hash, operation.result_reference, operation.result_summary,
         operation.actor_user_id, operation.recorded_at
    from public.finance_operations operation
   where operation.tenant_id = p_tenant_id
     and (p_reference_id is null or operation.result_reference = p_reference_id)
   order by operation.recorded_at desc, operation.id desc
   limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

create or replace function public.import_finance_bank_statement(
  p_tenant_id uuid,
  p_account_id uuid,
  p_statement_date date,
  p_external_reference text,
  p_direction public.finance_movement_direction,
  p_amount numeric,
  p_description text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_existing_type text;
  v_existing_hash text;
  v_existing_result jsonb;
  v_account public.finance_accounts;
  v_statement_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_tenant_id is null or p_account_id is null or p_statement_date is null
     or nullif(btrim(p_external_reference), '') is null or p_direction is null or p_amount is null or p_amount <= 0
     or nullif(btrim(p_request_key), '') is null
  then raise exception 'tenant, account, statement date, reference, direction, amount and request_key are required' using errcode = '22004'; end if;
  if not public.has_tenant_permission(p_tenant_id, 'finance:account:manage') then
    raise exception 'Finance account manage permission required' using errcode = '42501';
  end if;
  v_hash := md5(jsonb_build_object('operation', 'import_finance_bank_statement', 'tenant_id', p_tenant_id,
    'account_id', p_account_id, 'statement_date', p_statement_date, 'external_reference', btrim(p_external_reference),
    'direction', p_direction, 'amount', p_amount, 'description', coalesce(p_description, ''))::text);
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_request_key, 0));
  select operation_type, request_hash, result_summary into v_existing_type, v_existing_hash, v_existing_result
    from public.finance_operations where tenant_id = p_tenant_id and request_key = p_request_key;
  if found then
    if v_existing_type <> 'import_finance_bank_statement' or v_existing_hash <> v_hash then
      raise exception 'request_key was already used with different data' using errcode = '23505';
    end if;
    return v_existing_result;
  end if;
  select * into v_account from public.finance_accounts where id = p_account_id and tenant_id = p_tenant_id for update;
  if not found or v_account.account_type <> 'bank' then raise exception 'Statement account must be an active bank account' using errcode = '23514'; end if;
  if not v_account.is_active then raise exception 'Statement account is not active' using errcode = 'P0001'; end if;
  insert into public.finance_bank_statements(
    tenant_id, account_id, statement_date, external_reference, direction, amount, currency_code, description, imported_by
  ) values (
    p_tenant_id, p_account_id, p_statement_date, btrim(p_external_reference), p_direction, p_amount,
    v_account.currency_code, coalesce(p_description, ''), auth.uid()
  ) returning id into v_statement_id;
  v_result := jsonb_build_object('id', v_statement_id, 'status', 'open');
  insert into public.finance_operations(
    tenant_id, request_key, operation_type, request_hash, result_reference, result_summary
  ) values (
    p_tenant_id, p_request_key, 'import_finance_bank_statement', v_hash, v_statement_id, v_result
  );
  return v_result;
end;
$$;

create or replace function public.reconcile_finance_bank_statement(
  p_tenant_id uuid,
  p_statement_id uuid,
  p_movement_id uuid,
  p_amount numeric,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_existing_type text;
  v_existing_hash text;
  v_existing_result jsonb;
  v_statement public.finance_bank_statements;
  v_movement public.finance_account_movements;
  v_matched_statement numeric(18,2);
  v_matched_movement numeric(18,2);
  v_match_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_tenant_id is null or p_statement_id is null or p_movement_id is null or p_amount is null or p_amount <= 0
     or nullif(btrim(p_request_key), '') is null then raise exception 'tenant, statement, movement, positive amount and request_key are required' using errcode = '22004'; end if;
  if not public.has_tenant_permission(p_tenant_id, 'finance:account:manage') then
    raise exception 'Finance account manage permission required' using errcode = '42501';
  end if;
  v_hash := md5(jsonb_build_object('operation', 'reconcile_finance_bank_statement', 'tenant_id', p_tenant_id,
    'statement_id', p_statement_id, 'movement_id', p_movement_id, 'amount', p_amount)::text);
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_request_key, 0));
  select operation_type, request_hash, result_summary into v_existing_type, v_existing_hash, v_existing_result
    from public.finance_operations where tenant_id = p_tenant_id and request_key = p_request_key;
  if found then
    if v_existing_type <> 'reconcile_finance_bank_statement' or v_existing_hash <> v_hash then
      raise exception 'request_key was already used with different data' using errcode = '23505';
    end if;
    return v_existing_result;
  end if;
  select * into v_statement from public.finance_bank_statements where id = p_statement_id and tenant_id = p_tenant_id for update;
  select * into v_movement from public.finance_account_movements where id = p_movement_id and tenant_id = p_tenant_id for update;
  if not found then raise exception 'Statement or movement not found' using errcode = 'P0002'; end if;
  if v_statement.status <> 'open' then raise exception 'Bank statement is not open for reconciliation' using errcode = 'P0001'; end if;
  if v_statement.account_id <> v_movement.account_id or v_statement.direction <> v_movement.direction then
    raise exception 'Statement and movement account/direction do not match' using errcode = '23514';
  end if;
  if p_amount > v_statement.amount - coalesce((select sum(matched_amount) from public.finance_bank_reconciliation_matches where statement_id = p_statement_id and tenant_id = p_tenant_id), 0)
     or p_amount > v_movement.amount - coalesce((select sum(matched_amount) from public.finance_bank_reconciliation_matches where movement_id = p_movement_id and tenant_id = p_tenant_id), 0)
  then raise exception 'Reconciliation amount exceeds unmatched amount' using errcode = '22003'; end if;
  insert into public.finance_bank_reconciliation_matches(
    tenant_id, statement_id, movement_id, matched_amount, matched_by
  ) values (p_tenant_id, p_statement_id, p_movement_id, p_amount, auth.uid()) returning id into v_match_id;
  v_matched_statement := coalesce((select sum(matched_amount) from public.finance_bank_reconciliation_matches where statement_id = p_statement_id and tenant_id = p_tenant_id), 0);
  if v_matched_statement = v_statement.amount then
    update public.finance_bank_statements set status = 'reconciled' where id = p_statement_id;
  end if;
  v_result := jsonb_build_object('id', v_match_id, 'statementId', p_statement_id, 'movementId', p_movement_id, 'amount', p_amount);
  insert into public.finance_operations(
    tenant_id, request_key, operation_type, request_hash, result_reference, result_summary
  ) values (
    p_tenant_id, p_request_key, 'reconcile_finance_bank_statement', v_hash, v_match_id, v_result
  );
  return v_result;
end;
$$;

revoke execute on function public.finance_obligation_adjustment_total_as_of(uuid, uuid, date),
  public.finance_allocation_effective_amount_as_of(uuid, uuid, date),
  public.finance_obligation_settled_amount_as_of(uuid, uuid, date),
  public.finance_advance_refunded_amount_as_of(uuid, uuid, date),
  public.finance_advance_allocated_amount_as_of(uuid, uuid, date)
  from public, anon, authenticated;
revoke execute on function public.create_finance_obligation_adjustment(uuid, uuid, numeric, date, text, text),
  public.reverse_finance_allocation(uuid, uuid, numeric, date, text, text),
  public.reverse_finance_voucher(uuid, uuid, date, text, text),
  public.create_finance_advance_refund(uuid, uuid, uuid, uuid, numeric, date, text, text),
  public.get_finance_audit_timeline(uuid, uuid, integer),
  public.import_finance_bank_statement(uuid, uuid, date, text, public.finance_movement_direction, numeric, text, text),
  public.reconcile_finance_bank_statement(uuid, uuid, uuid, numeric, text)
  from public, anon;
grant execute on function public.create_finance_obligation_adjustment(uuid, uuid, numeric, date, text, text),
  public.reverse_finance_allocation(uuid, uuid, numeric, date, text, text),
  public.reverse_finance_voucher(uuid, uuid, date, text, text),
  public.create_finance_advance_refund(uuid, uuid, uuid, uuid, numeric, date, text, text),
  public.get_finance_audit_timeline(uuid, uuid, integer),
  public.import_finance_bank_statement(uuid, uuid, date, text, public.finance_movement_direction, numeric, text, text),
  public.reconcile_finance_bank_statement(uuid, uuid, uuid, numeric, text)
  to authenticated;

grant select on public.finance_obligation_balances, public.customer_receivable_summary to authenticated;
alter view public.finance_obligation_balances set (security_invoker = true);
alter view public.customer_receivable_summary set (security_invoker = true);
