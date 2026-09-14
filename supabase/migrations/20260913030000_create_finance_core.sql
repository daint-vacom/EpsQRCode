-- Thu chi & cong no core. Money mutations are exposed through RPCs below.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_account_type') then create type public.finance_account_type as enum ('cash', 'bank'); end if;
  if not exists (select 1 from pg_type where typname = 'finance_voucher_type') then create type public.finance_voucher_type as enum ('receipt', 'payment'); end if;
  if not exists (select 1 from pg_type where typname = 'finance_party_type') then create type public.finance_party_type as enum ('customer', 'employee', 'other'); end if;
  if not exists (select 1 from pg_type where typname = 'finance_voucher_status') then create type public.finance_voucher_status as enum ('draft', 'posted', 'cancelled', 'reversed'); end if;
  if not exists (select 1 from pg_type where typname = 'finance_handling_type') then create type public.finance_handling_type as enum ('settlement', 'advance', 'direct', 'refund'); end if;
  if not exists (select 1 from pg_type where typname = 'finance_advance_scope') then create type public.finance_advance_scope as enum ('party', 'contract'); end if;
  if not exists (select 1 from pg_type where typname = 'finance_category_direction') then create type public.finance_category_direction as enum ('receipt', 'payment', 'both'); end if;
  if not exists (select 1 from pg_type where typname = 'finance_obligation_direction') then create type public.finance_obligation_direction as enum ('receivable', 'payable'); end if;
  if not exists (select 1 from pg_type where typname = 'finance_obligation_source') then create type public.finance_obligation_source as enum ('contract', 'opening_balance', 'manual', 'commission'); end if;
  if not exists (select 1 from pg_type where typname = 'finance_obligation_status') then create type public.finance_obligation_status as enum ('draft', 'posted', 'voided'); end if;
  if not exists (select 1 from pg_type where typname = 'finance_movement_direction') then create type public.finance_movement_direction as enum ('in', 'out'); end if;
end $$;

alter table public.tag_groups drop constraint if exists tag_groups_kind_check;
alter table public.tag_groups add constraint tag_groups_kind_check check (kind in ('tag', 'software_account_catalog', 'finance_category'));

create sequence public.finance_voucher_no_seq;

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict,
  code text not null, name text not null, account_type public.finance_account_type not null, currency_code text not null default 'VND',
  bank_name text not null default '', bank_account_number text not null default '', bank_account_holder text not null default '',
  opening_date date not null default current_date, opening_balance numeric(18,2) not null default 0, opening_confirmed_at timestamptz,
  opening_confirmed_by uuid references auth.users(id) on delete set null, is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, code), unique (tenant_id, id),
  constraint finance_accounts_code_check check (length(btrim(code)) > 0), constraint finance_accounts_name_check check (length(btrim(name)) > 0),
  constraint finance_accounts_currency_check check (currency_code ~ '^[A-Z]{3}$'), constraint finance_accounts_opening_check check (opening_balance >= 0)
);

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict,
  code text not null, name text not null, parent_id uuid, direction public.finance_category_direction not null default 'both',
  sort_order integer not null default 0, is_active boolean not null default true, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, code), unique (tenant_id, id),
  constraint finance_categories_parent_fk foreign key (tenant_id, parent_id) references public.finance_categories(tenant_id, id) on delete restrict,
  constraint finance_categories_code_check check (length(btrim(code)) > 0), constraint finance_categories_name_check check (length(btrim(name)) > 0)
);

create table public.finance_vouchers (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict,
  voucher_no text, voucher_type public.finance_voucher_type not null, voucher_date date not null, transaction_at timestamptz not null,
  party_type public.finance_party_type not null, customer_id uuid references public.customers(id) on delete restrict, employee_id uuid references public.employees(id) on delete restrict,
  party_name_snapshot text not null default '', contact_name text not null default '', address_snapshot text not null default '',
  account_id uuid not null references public.finance_accounts(id) on delete restrict, currency_code text not null default 'VND', total_amount numeric(18,2) not null default 0,
  description text not null default '', external_reference text not null default '', status public.finance_voucher_status not null default 'draft',
  posted_at timestamptz, posted_by uuid references auth.users(id) on delete set null, reversed_at timestamptz, reversed_by uuid references auth.users(id) on delete set null,
  reversal_effective_date date, reversal_reason text, revision integer not null default 1, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique (tenant_id, voucher_no),
  constraint finance_vouchers_total_check check (total_amount >= 0), constraint finance_vouchers_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint finance_vouchers_revision_check check (revision > 0),
  constraint finance_vouchers_party_check check ((party_type = 'customer' and customer_id is not null and employee_id is null) or (party_type = 'employee' and customer_id is null and employee_id is not null) or (party_type = 'other' and customer_id is null and employee_id is null)),
  constraint finance_vouchers_snapshot_check check (status = 'draft' or length(btrim(party_name_snapshot)) > 0)
);

create table public.finance_voucher_lines (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict,
  voucher_id uuid not null references public.finance_vouchers(id) on delete restrict, line_no integer not null,
  category_id uuid not null, category_name_snapshot text not null default '', description text not null default '',
  amount numeric(18,2) not null, handling_type public.finance_handling_type not null, related_contract_id uuid references public.contracts(id) on delete restrict,
  advance_scope public.finance_advance_scope, created_at timestamptz not null default timezone('utc', now()), unique (voucher_id, line_no), unique (tenant_id, id),
  constraint finance_voucher_lines_category_fk foreign key (tenant_id, category_id) references public.finance_categories(tenant_id, id) on delete restrict,
  constraint finance_voucher_lines_amount_check check (amount > 0), constraint finance_voucher_lines_advance_check check ((handling_type = 'advance' and advance_scope is not null) or (handling_type <> 'advance' and advance_scope is null))
);

create table public.finance_obligations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict, code text not null, description text not null default '',
  party_type public.finance_party_type not null, customer_id uuid references public.customers(id) on delete restrict, employee_id uuid references public.employees(id) on delete restrict, party_name_snapshot text not null,
  direction public.finance_obligation_direction not null, source_type public.finance_obligation_source not null, contract_charge_id uuid unique references public.contract_charges(id) on delete restrict, contract_id uuid references public.contracts(id) on delete restrict,
  category_id uuid references public.finance_categories(id) on delete restrict, document_date date not null, due_date date, original_amount numeric(18,2) not null, currency_code text not null default 'VND', status public.finance_obligation_status not null default 'draft',
  posted_at timestamptz, posted_by uuid references auth.users(id) on delete set null, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, code), constraint finance_obligations_party_check check ((party_type = 'customer' and customer_id is not null and employee_id is null) or (party_type = 'employee' and customer_id is null and employee_id is not null)),
  constraint finance_obligations_amount_check check (original_amount > 0), constraint finance_obligations_contract_check check ((source_type = 'contract' and contract_charge_id is not null and contract_id is not null) or source_type <> 'contract')
);

create table public.finance_allocations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict, voucher_line_id uuid not null references public.finance_voucher_lines(id) on delete restrict, obligation_id uuid not null references public.finance_obligations(id) on delete restrict,
  amount numeric(18,2) not null, effective_date date not null, status text not null default 'active', operation_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default timezone('utc', now()),
  constraint finance_allocations_amount_check check (amount > 0), constraint finance_allocations_status_check check (status in ('active', 'reversed'))
);

create table public.finance_voucher_line_allocation_drafts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict,
  voucher_line_id uuid not null references public.finance_voucher_lines(id) on delete cascade, obligation_id uuid not null references public.finance_obligations(id) on delete restrict,
  amount numeric(18,2) not null, created_at timestamptz not null default timezone('utc', now()),
  constraint finance_allocation_drafts_amount_check check (amount > 0), unique (voucher_line_id, obligation_id)
);

create table public.finance_account_movements (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict, account_id uuid not null references public.finance_accounts(id) on delete restrict,
  effective_date date not null, direction public.finance_movement_direction not null, amount numeric(18,2) not null, voucher_id uuid references public.finance_vouchers(id) on delete restrict, event_type text not null, reversal_of_id uuid unique references public.finance_account_movements(id) on delete restrict, operation_id uuid,
  created_at timestamptz not null default timezone('utc', now()), constraint finance_movements_amount_check check (amount > 0), constraint finance_movements_source_check check (voucher_id is not null)
);

create table public.finance_operations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict, request_key text not null, operation_type text not null, request_hash text not null, result_reference uuid, result_summary jsonb not null default '{}'::jsonb, recorded_at timestamptz not null default timezone('utc', now()), unique (tenant_id, request_key)
);

create index finance_vouchers_date_idx on public.finance_vouchers(tenant_id, voucher_date desc, id desc);
create index finance_vouchers_status_idx on public.finance_vouchers(tenant_id, status, voucher_type);
create index finance_lines_voucher_idx on public.finance_voucher_lines(tenant_id, voucher_id, line_no);
create index finance_obligations_balance_idx on public.finance_obligations(tenant_id, direction, document_date desc);
create index finance_allocations_obligation_idx on public.finance_allocations(tenant_id, obligation_id, effective_date);
create index finance_allocation_drafts_line_idx on public.finance_voucher_line_allocation_drafts(tenant_id, voucher_line_id);
create index finance_movements_account_idx on public.finance_account_movements(tenant_id, account_id, effective_date, id);

create trigger finance_accounts_set_updated_at before update on public.finance_accounts for each row execute function public.set_updated_at();
create trigger finance_categories_set_updated_at before update on public.finance_categories for each row execute function public.set_updated_at();
create trigger finance_vouchers_set_updated_at before update on public.finance_vouchers for each row execute function public.set_updated_at();
create trigger finance_obligations_set_updated_at before update on public.finance_obligations for each row execute function public.set_updated_at();

create or replace view public.finance_account_balances as select account.id, account.tenant_id, account.code, account.name, account.account_type, account.currency_code, account.bank_name, account.bank_account_number, account.bank_account_holder, account.opening_date, account.opening_balance, account.is_active, (account.opening_balance + coalesce(sum(case when movement.direction = 'in' then movement.amount else -movement.amount end), 0))::numeric(18,2) as balance from public.finance_accounts account left join public.finance_account_movements movement on movement.tenant_id = account.tenant_id and movement.account_id = account.id and movement.effective_date >= account.opening_date group by account.id;
create or replace view public.finance_obligation_balances as select obligation.id, obligation.tenant_id, obligation.code, obligation.description, obligation.party_type, obligation.customer_id, obligation.employee_id, obligation.party_name_snapshot, obligation.direction, obligation.source_type, obligation.contract_id, contract.name as contract_name, obligation.document_date, obligation.due_date, obligation.original_amount, obligation.currency_code, obligation.status, coalesce(sum(allocation.amount) filter (where allocation.status = 'active'), 0)::numeric(18,2) as settled_amount, greatest(obligation.original_amount - coalesce(sum(allocation.amount) filter (where allocation.status = 'active'), 0), 0)::numeric(18,2) as outstanding_amount from public.finance_obligations obligation left join public.contracts contract on contract.id = obligation.contract_id left join public.finance_allocations allocation on allocation.obligation_id = obligation.id group by obligation.id, contract.name;
create or replace view public.finance_voucher_list as select voucher.id, voucher.tenant_id, voucher.voucher_no, voucher.voucher_type, voucher.voucher_date, voucher.transaction_at, voucher.party_type, voucher.customer_id, voucher.employee_id, voucher.party_name_snapshot, voucher.account_id, account.name as account_name, voucher.currency_code, voucher.total_amount, voucher.description, voucher.external_reference, voucher.status, voucher.created_at, voucher.posted_at, count(line.id)::integer as line_count, coalesce(string_agg(distinct line.category_name_snapshot, ', ' order by line.category_name_snapshot), '') as categories_summary from public.finance_vouchers voucher join public.finance_accounts account on account.id = voucher.account_id left join public.finance_voucher_lines line on line.voucher_id = voucher.id group by voucher.id, account.name;
create or replace view public.finance_cashflow_report as select voucher.tenant_id, voucher.id as voucher_id, voucher.voucher_no, voucher.voucher_date as effective_date, voucher.account_id, account.code as account_code, account.name as account_name, voucher.voucher_type, line.category_id, line.category_name_snapshot, line.amount, line.handling_type, voucher.party_name_snapshot, line.description from public.finance_vouchers voucher join public.finance_accounts account on account.id = voucher.account_id join public.finance_voucher_lines line on line.voucher_id = voucher.id and line.tenant_id = voucher.tenant_id where voucher.status = 'posted';
create or replace view public.finance_account_ledger_report as select movement.tenant_id, movement.id as movement_id, movement.account_id, account.code as account_code, account.name as account_name, movement.effective_date, movement.direction, movement.amount, movement.event_type, movement.voucher_id, voucher.voucher_no, voucher.voucher_type, voucher.party_name_snapshot, voucher.description from public.finance_account_movements movement join public.finance_accounts account on account.id = movement.account_id and account.tenant_id = movement.tenant_id left join public.finance_vouchers voucher on voucher.id = movement.voucher_id and voucher.tenant_id = movement.tenant_id;
alter view public.finance_account_balances set (security_invoker = true);
alter view public.finance_obligation_balances set (security_invoker = true);
alter view public.finance_voucher_list set (security_invoker = true);
alter view public.finance_cashflow_report set (security_invoker = true);
alter view public.finance_account_ledger_report set (security_invoker = true);

insert into public.permission_modules (code, name, description, sort_order, is_active) values ('finance', 'Thu chi & Công nợ', 'Quản lý phiếu thu chi, công nợ, quỹ và báo cáo tài chính.', 45, true) on conflict (code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, is_active = true;
insert into public.permission_groups (module_code, code, name, description, sort_order, is_active) values ('finance', 'finance', 'Tài chính', 'Quyền theo từng nghiệp vụ tài chính.', 10, true) on conflict (module_code, code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, is_active = true;
insert into public.permission_definitions (code, module_code, group_name, group_id, name, action, sensitive, sort_order, tags, is_active) select seed.code, 'finance', 'Tài chính', permission_group.id, seed.name, seed.action, seed.sensitive, seed.sort_order, seed.tags, true from public.permission_groups permission_group cross join (values ('finance:voucher:view', 'Xem sổ thu chi', 'view', false, 10, array['Xem']::text[]), ('finance:voucher:create', 'Lập phiếu thu chi', 'create', false, 20, array['Chỉnh sửa']::text[]), ('finance:voucher:update', 'Sửa phiếu nháp', 'update', false, 30, array['Chỉnh sửa']::text[]), ('finance:voucher:post', 'Ghi nhận phiếu', 'post', true, 40, array['Duyệt']::text[]), ('finance:voucher:cancel', 'Hủy phiếu nháp', 'cancel', false, 50, array['Chỉnh sửa']::text[]), ('finance:voucher:reverse', 'Đảo phiếu', 'reverse', true, 60, array['Duyệt']::text[]), ('finance:obligation:view', 'Xem công nợ', 'view', false, 70, array['Xem']::text[]), ('finance:obligation:create', 'Thêm công nợ', 'create', false, 80, array['Chỉnh sửa']::text[]), ('finance:account:view', 'Xem quỹ và tài khoản', 'view', false, 90, array['Xem']::text[]), ('finance:account:manage', 'Quản lý quỹ và tài khoản', 'manage', true, 100, array['Chỉnh sửa']::text[]), ('finance:category:view', 'Xem khoản mục thu chi', 'view', false, 110, array['Xem']::text[]), ('finance:category:manage', 'Quản lý khoản mục thu chi', 'manage', true, 120, array['Chỉnh sửa']::text[]), ('finance:report:view', 'Xem báo cáo tài chính', 'view', false, 130, array['Xem']::text[]), ('finance:report:export', 'Xuất báo cáo tài chính', 'export', false, 140, array['Xem']::text[])) as seed(code, name, action, sensitive, sort_order, tags) where permission_group.module_code = 'finance' and permission_group.code = 'finance' on conflict (code) do update set module_code = excluded.module_code, group_name = excluded.group_name, group_id = excluded.group_id, name = excluded.name, action = excluded.action, sensitive = excluded.sensitive, sort_order = excluded.sort_order, tags = excluded.tags, is_active = true;
insert into public.role_permissions (role_id, permission_code) select role_record.id, definition.code from public.roles role_record cross join public.permission_definitions definition where role_record.code = 'admin' and definition.module_code = 'finance' and definition.is_active on conflict do nothing;
insert into public.tag_groups (tenant_id, code, name, description, module_code, is_system, sort_order, kind) select tenant.id, 'finance-categories', 'Khoản mục thu chi', 'Danh mục phân loại các dòng phiếu thu chi.', 'finance', true, 35, 'finance_category' from public.tenants tenant on conflict (tenant_id, code) do update set name = excluded.name, description = excluded.description, module_code = excluded.module_code, is_system = true, sort_order = excluded.sort_order, kind = excluded.kind, is_active = true;
insert into public.finance_categories (tenant_id, code, name, direction, sort_order, created_by)
select tenant.id, seed.code, seed.name, seed.direction::public.finance_category_direction, seed.sort_order, auth.uid()
from public.tenants tenant cross join (values
  ('thu-dich-vu', 'Thu dịch vụ', 'receipt', 10),
  ('thu-cong-no', 'Thu công nợ', 'receipt', 20),
  ('chi-van-hanh', 'Chi vận hành', 'payment', 30),
  ('chi-luong', 'Chi lương và phụ cấp', 'payment', 40),
  ('tam-ung', 'Tạm ứng', 'both', 50),
  ('hoan-tien', 'Hoàn tiền', 'both', 60),
  ('khac', 'Thu chi khác', 'both', 90)
) as seed(code, name, direction, sort_order)
on conflict (tenant_id, code) do update set name = excluded.name, direction = excluded.direction, sort_order = excluded.sort_order, is_active = true;

grant select on public.finance_account_balances, public.finance_obligation_balances, public.finance_voucher_list, public.finance_cashflow_report, public.finance_account_ledger_report to authenticated;
grant select, insert, update on public.finance_accounts, public.finance_categories, public.finance_obligations to authenticated;
grant select on public.finance_vouchers, public.finance_voucher_lines, public.finance_allocations, public.finance_account_movements, public.finance_operations to authenticated;
alter table public.finance_accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_vouchers enable row level security;
alter table public.finance_voucher_lines enable row level security;
alter table public.finance_obligations enable row level security;
alter table public.finance_allocations enable row level security;
alter table public.finance_voucher_line_allocation_drafts enable row level security;
alter table public.finance_account_movements enable row level security;
alter table public.finance_operations enable row level security;
create policy finance_accounts_select on public.finance_accounts for select to authenticated using (public.is_tenant_member(tenant_id) and (public.has_tenant_permission(tenant_id, 'finance:account:view') or public.has_tenant_permission(tenant_id, 'finance:report:view')));
create policy finance_accounts_manage on public.finance_accounts for all to authenticated using (public.has_tenant_permission(tenant_id, 'finance:account:manage')) with check (public.has_tenant_permission(tenant_id, 'finance:account:manage'));
create policy finance_categories_select on public.finance_categories for select to authenticated using (public.is_tenant_member(tenant_id) and (public.has_tenant_permission(tenant_id, 'finance:category:view') or public.has_tenant_permission(tenant_id, 'finance:report:view')));
create policy finance_categories_manage on public.finance_categories for all to authenticated using (public.has_tenant_permission(tenant_id, 'finance:category:manage')) with check (public.has_tenant_permission(tenant_id, 'finance:category:manage'));
create policy finance_vouchers_select on public.finance_vouchers for select to authenticated using (public.is_tenant_member(tenant_id) and (public.has_tenant_permission(tenant_id, 'finance:voucher:view') or public.has_tenant_permission(tenant_id, 'finance:report:view')));
create policy finance_voucher_lines_select on public.finance_voucher_lines for select to authenticated using (public.is_tenant_member(tenant_id) and (public.has_tenant_permission(tenant_id, 'finance:voucher:view') or public.has_tenant_permission(tenant_id, 'finance:report:view')));
create policy finance_obligations_select on public.finance_obligations for select to authenticated using (public.is_tenant_member(tenant_id) and (public.has_tenant_permission(tenant_id, 'finance:obligation:view') or public.has_tenant_permission(tenant_id, 'finance:report:view')));
create policy finance_obligations_manage on public.finance_obligations for insert to authenticated with check (public.has_tenant_permission(tenant_id, 'finance:obligation:create'));
create policy finance_allocations_select on public.finance_allocations for select to authenticated using (public.is_tenant_member(tenant_id) and (public.has_tenant_permission(tenant_id, 'finance:obligation:view') or public.has_tenant_permission(tenant_id, 'finance:report:view')));
create policy finance_allocation_drafts_select on public.finance_voucher_line_allocation_drafts for select to authenticated using (public.is_tenant_member(tenant_id) and (public.has_tenant_permission(tenant_id, 'finance:voucher:view') or public.has_tenant_permission(tenant_id, 'finance:report:view')));
create policy finance_movements_select on public.finance_account_movements for select to authenticated using (public.is_tenant_member(tenant_id) and (public.has_tenant_permission(tenant_id, 'finance:account:view') or public.has_tenant_permission(tenant_id, 'finance:report:view')));
create policy finance_operations_select on public.finance_operations for select to authenticated using (public.is_tenant_member(tenant_id));

create or replace function public.save_finance_voucher_draft(p_tenant_id uuid, p_voucher_id uuid, p_payload jsonb, p_revision integer, p_request_key text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_voucher public.finance_vouchers;
  v_line jsonb;
  v_allocation jsonb;
  v_index integer := 0;
  v_category_name text;
  v_hash text := md5(p_payload::text);
begin
  if p_voucher_id is null then
    if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:create') then raise exception 'Finance voucher create permission required' using errcode = '42501'; end if;
  else
    if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:update') then raise exception 'Finance voucher update permission required' using errcode = '42501'; end if;
  end if;
  if nullif(btrim(p_request_key), '') is null then raise exception 'request_key is required' using errcode = '22004'; end if;
  if exists (select 1 from public.finance_operations where tenant_id = p_tenant_id and request_key = p_request_key) then
    if (select request_hash from public.finance_operations where tenant_id = p_tenant_id and request_key = p_request_key) <> v_hash then raise exception 'request_key was already used with different data' using errcode = '23505'; end if;
    return (select result_summary from public.finance_operations where tenant_id = p_tenant_id and request_key = p_request_key);
  end if;
  if p_voucher_id is null then
    insert into public.finance_vouchers (tenant_id, voucher_type, voucher_date, transaction_at, party_type, customer_id, employee_id, party_name_snapshot, contact_name, address_snapshot, account_id, currency_code, description, external_reference, created_by)
    values (p_tenant_id, (p_payload->>'voucherType')::public.finance_voucher_type, (p_payload->>'voucherDate')::date, (p_payload->>'transactionAt')::timestamptz, (p_payload->>'partyType')::public.finance_party_type, nullif(p_payload->>'customerId','')::uuid, nullif(p_payload->>'employeeId','')::uuid, coalesce(p_payload->>'partyName',''), coalesce(p_payload->>'contactName',''), coalesce(p_payload->>'address',''), (p_payload->>'accountId')::uuid, coalesce(p_payload->>'currencyCode','VND'), coalesce(p_payload->>'description',''), coalesce(p_payload->>'externalReference',''), auth.uid()) returning * into v_voucher;
  else
    select * into v_voucher from public.finance_vouchers where id = p_voucher_id and tenant_id = p_tenant_id for update;
    if not found then raise exception 'Voucher not found' using errcode = 'P0002'; end if;
    if v_voucher.status <> 'draft' then raise exception 'Only draft vouchers can be edited' using errcode = 'P0001'; end if;
    if v_voucher.revision <> p_revision then raise exception 'Voucher draft has changed, please reload' using errcode = '40001'; end if;
    update public.finance_vouchers set voucher_type = (p_payload->>'voucherType')::public.finance_voucher_type, voucher_date = (p_payload->>'voucherDate')::date, transaction_at = (p_payload->>'transactionAt')::timestamptz, party_type = (p_payload->>'partyType')::public.finance_party_type, customer_id = nullif(p_payload->>'customerId','')::uuid, employee_id = nullif(p_payload->>'employeeId','')::uuid, party_name_snapshot = coalesce(p_payload->>'partyName',''), contact_name = coalesce(p_payload->>'contactName',''), address_snapshot = coalesce(p_payload->>'address',''), account_id = (p_payload->>'accountId')::uuid, currency_code = coalesce(p_payload->>'currencyCode','VND'), description = coalesce(p_payload->>'description',''), external_reference = coalesce(p_payload->>'externalReference',''), revision = revision + 1 where id = p_voucher_id returning * into v_voucher;
  end if;
  delete from public.finance_voucher_lines where voucher_id = v_voucher.id;
  for v_line in select value from jsonb_array_elements(coalesce(p_payload->'lines', '[]'::jsonb)) loop
    v_index := v_index + 1;
    select name into v_category_name from public.finance_categories where id = (v_line->>'categoryId')::uuid and tenant_id = p_tenant_id and is_active;
    if v_category_name is null then raise exception 'Invalid or inactive finance category' using errcode = '23503'; end if;
    insert into public.finance_voucher_lines (tenant_id, voucher_id, line_no, category_id, category_name_snapshot, description, amount, handling_type, related_contract_id, advance_scope)
    values (p_tenant_id, v_voucher.id, v_index, (v_line->>'categoryId')::uuid, v_category_name, coalesce(v_line->>'description',''), (v_line->>'amount')::numeric, (v_line->>'handlingType')::public.finance_handling_type, nullif(v_line->>'relatedContractId','')::uuid, nullif(v_line->>'advanceScope','')::public.finance_advance_scope);
    for v_allocation in select value from jsonb_array_elements(coalesce(v_line->'allocations', '[]'::jsonb)) loop
      insert into public.finance_voucher_line_allocation_drafts (tenant_id, voucher_line_id, obligation_id, amount) values (p_tenant_id, (select id from public.finance_voucher_lines where voucher_id = v_voucher.id and line_no = v_index), (v_allocation->>'obligationId')::uuid, (v_allocation->>'amount')::numeric);
    end loop;
  end loop;
  update public.finance_vouchers set total_amount = coalesce((select sum(amount) from public.finance_voucher_lines where voucher_id = v_voucher.id), 0) where id = v_voucher.id returning * into v_voucher;
  insert into public.finance_operations (tenant_id, request_key, operation_type, request_hash, result_reference, result_summary) values (p_tenant_id, p_request_key, 'save_voucher_draft', v_hash, v_voucher.id, jsonb_build_object('id', v_voucher.id, 'status', v_voucher.status, 'revision', v_voucher.revision));
  return jsonb_build_object('id', v_voucher.id, 'status', v_voucher.status, 'revision', v_voucher.revision);
end $$;

create or replace function public.post_finance_voucher(p_tenant_id uuid, p_voucher_id uuid, p_request_key text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_voucher public.finance_vouchers;
  v_account public.finance_accounts;
  v_line record;
  v_obligation public.finance_obligations;
  v_total numeric(18,2);
  v_allocated numeric(18,2);
  v_movement_id uuid;
begin
  if not public.has_tenant_permission(p_tenant_id, 'finance:voucher:post') then raise exception 'Finance voucher post permission required' using errcode = '42501'; end if;
  if exists (select 1 from public.finance_operations where tenant_id = p_tenant_id and request_key = p_request_key) then return (select result_summary from public.finance_operations where tenant_id = p_tenant_id and request_key = p_request_key); end if;
  select * into v_voucher from public.finance_vouchers where id = p_voucher_id and tenant_id = p_tenant_id for update;
  if not found or v_voucher.status <> 'draft' then raise exception 'Only a draft voucher can be posted' using errcode = 'P0001'; end if;
  select * into v_account from public.finance_accounts where id = v_voucher.account_id and tenant_id = p_tenant_id for update;
  if not found or not v_account.is_active then raise exception 'Account is not available' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.finance_voucher_lines where voucher_id = v_voucher.id) then raise exception 'Posted voucher requires at least one line' using errcode = '23514'; end if;
  if length(btrim(v_voucher.party_name_snapshot)) = 0 then raise exception 'Party name is required' using errcode = '23514'; end if;
  select sum(amount)::numeric(18,2) into v_total from public.finance_voucher_lines where voucher_id = v_voucher.id;
  if v_voucher.voucher_type = 'payment' and (v_account.opening_balance + coalesce((select sum(case when direction = 'in' then amount else -amount end) from public.finance_account_movements where account_id = v_account.id and effective_date >= v_account.opening_date), 0) - v_total) < 0 then raise exception 'Số dư tài khoản không đủ để ghi nhận phiếu chi' using errcode = '23514'; end if;
  for v_line in select line.* from public.finance_voucher_lines line where line.voucher_id = v_voucher.id loop
    select coalesce(sum(amount), 0)::numeric(18,2) into v_allocated from public.finance_voucher_line_allocation_drafts where voucher_line_id = v_line.id;
    if v_line.handling_type = 'settlement' and v_allocated <> v_line.amount then raise exception 'Tổng phân bổ phải bằng số tiền dòng thanh toán công nợ' using errcode = '23514'; end if;
    if v_line.handling_type <> 'settlement' and v_allocated > 0 then raise exception 'Chỉ dòng thanh toán công nợ được phân bổ' using errcode = '23514'; end if;
    for v_obligation in select obligation.* from public.finance_obligations obligation join public.finance_voucher_line_allocation_drafts draft on draft.obligation_id = obligation.id where draft.voucher_line_id = v_line.id for update loop
      if v_obligation.status <> 'posted' then raise exception 'Công nợ chưa được ghi nhận' using errcode = '23514'; end if;
      if (v_voucher.voucher_type = 'receipt' and v_obligation.direction <> 'receivable') or (v_voucher.voucher_type = 'payment' and v_obligation.direction <> 'payable') then raise exception 'Chiều phiếu không khớp chiều công nợ' using errcode = '23514'; end if;
      if (select coalesce(sum(amount), 0) from public.finance_allocations where obligation_id = v_obligation.id and status = 'active') + (select amount from public.finance_voucher_line_allocation_drafts where voucher_line_id = v_line.id and obligation_id = v_obligation.id) > v_obligation.original_amount then raise exception 'Phân bổ vượt số còn nợ' using errcode = '23514'; end if;
    end loop;
  end loop;
  update public.finance_vouchers set voucher_no = coalesce(voucher_no, to_char(voucher_date, 'YYYYMMDD') || '-' || lpad(nextval('finance_voucher_no_seq')::text, 6, '0')), total_amount = v_total, status = 'posted', posted_at = timezone('utc', now()), posted_by = auth.uid() where id = v_voucher.id returning * into v_voucher;
  insert into public.finance_account_movements (tenant_id, account_id, effective_date, direction, amount, voucher_id, event_type) values (p_tenant_id, v_voucher.account_id, v_voucher.voucher_date, case when v_voucher.voucher_type = 'receipt' then 'in'::public.finance_movement_direction else 'out'::public.finance_movement_direction end, v_total, v_voucher.id, 'voucher_posting') returning id into v_movement_id;
  insert into public.finance_allocations (tenant_id, voucher_line_id, obligation_id, amount, effective_date, created_by) select tenant_id, voucher_line_id, obligation_id, amount, v_voucher.voucher_date, auth.uid() from public.finance_voucher_line_allocation_drafts where tenant_id = p_tenant_id and voucher_line_id in (select id from public.finance_voucher_lines where voucher_id = v_voucher.id);
  delete from public.finance_voucher_line_allocation_drafts where voucher_line_id in (select id from public.finance_voucher_lines where voucher_id = v_voucher.id);
  insert into public.finance_operations (tenant_id, request_key, operation_type, request_hash, result_reference, result_summary) values (p_tenant_id, p_request_key, 'post_voucher', md5(v_voucher.id::text), v_voucher.id, jsonb_build_object('id', v_voucher.id, 'voucherNo', v_voucher.voucher_no, 'status', v_voucher.status, 'movementId', v_movement_id));
  return jsonb_build_object('id', v_voucher.id, 'voucherNo', v_voucher.voucher_no, 'status', v_voucher.status, 'movementId', v_movement_id);
end $$;

revoke all on function public.save_finance_voucher_draft(uuid, uuid, jsonb, integer, text), public.post_finance_voucher(uuid, uuid, text) from public, anon;
grant execute on function public.save_finance_voucher_draft(uuid, uuid, jsonb, integer, text), public.post_finance_voucher(uuid, uuid, text) to authenticated;
