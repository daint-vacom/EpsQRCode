import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceObligation,
  FinanceVoucher,
  FinanceVoucherDetail,
  FinanceVoucherFormValues,
  FinanceVoucherLineDraft,
} from '../model/finance';
import { numberValue } from '../model/finance';

function queryParams(params: Record<string, string>) {
  return { params };
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

interface VoucherListRow {
  id: string;
  tenant_id: string;
  voucher_no: string | null;
  voucher_type: FinanceVoucher['voucherType'];
  voucher_date: string;
  transaction_at: string;
  party_type: FinanceVoucher['partyType'];
  customer_id: string | null;
  employee_id: string | null;
  party_name_snapshot: string;
  account_id: string;
  account_name: string;
  currency_code: string;
  total_amount: number | string;
  description: string;
  external_reference: string;
  status: FinanceVoucher['status'];
  created_at: string;
  posted_at: string | null;
  line_count: number;
  categories_summary: string;
}

function mapVoucher(row: VoucherListRow): FinanceVoucher {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    voucherNo: row.voucher_no,
    voucherType: row.voucher_type,
    voucherDate: row.voucher_date,
    transactionAt: row.transaction_at,
    partyType: row.party_type,
    customerId: row.customer_id,
    employeeId: row.employee_id,
    partyNameSnapshot: row.party_name_snapshot,
    accountId: row.account_id,
    accountName: row.account_name,
    currencyCode: row.currency_code,
    description: row.description,
    externalReference: row.external_reference,
    categoriesSummary: row.categories_summary,
    lineCount: row.line_count,
    totalAmount: numberValue(row.total_amount),
    status: row.status,
    createdAt: row.created_at,
    postedAt: row.posted_at,
  };
}

export async function loadFinanceVouchers(
  tenantId: string,
  filters: {
    voucherType?: 'all' | 'receipt' | 'payment';
    status?: string;
    keyword?: string;
    from?: string;
    to?: string;
  } = {},
) {
  assertSupabaseConfigured();
  const params: Record<string, string> = {
    select: '*',
    tenant_id: `eq.${tenantId}`,
    order: 'voucher_date.desc,id.desc',
  };
  if (filters.voucherType && filters.voucherType !== 'all')
    params.voucher_type = `eq.${filters.voucherType}`;
  if (filters.status && filters.status !== 'all')
    params.status = `eq.${filters.status}`;
  if (filters.from && filters.to)
    params.and = `(voucher_date.gte.${filters.from},voucher_date.lte.${filters.to})`;
  else if (filters.from) params.voucher_date = `gte.${filters.from}`;
  else if (filters.to) params.voucher_date = `lte.${filters.to}`;
  if (filters.keyword)
    params.or = `(voucher_no.ilike.*${filters.keyword}*,party_name_snapshot.ilike.*${filters.keyword}*,description.ilike.*${filters.keyword}*,external_reference.ilike.*${filters.keyword}*)`;
  const rows = await request<VoucherListRow[]>(
    supabaseApi.get('/finance_voucher_list', queryParams(params)),
  );
  return rows.map(mapVoucher);
}

interface AccountRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  account_type: FinanceAccount['accountType'];
  currency_code: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  opening_date: string;
  opening_balance: number | string;
  balance: number | string;
  is_active: boolean;
}
export async function loadFinanceAccounts(tenantId: string) {
  assertSupabaseConfigured();
  const rows = await request<AccountRow[]>(
    supabaseApi.get(
      '/finance_account_balances',
      queryParams({
        select: '*',
        tenant_id: `eq.${tenantId}`,
        order: 'is_active.desc,code.asc',
      }),
    ),
  );
  return rows.map<FinanceAccount>((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    name: row.name,
    accountType: row.account_type,
    currencyCode: row.currency_code,
    bankName: row.bank_name,
    bankAccountNumber: row.bank_account_number,
    bankAccountHolder: row.bank_account_holder,
    openingDate: row.opening_date,
    openingBalance: numberValue(row.opening_balance),
    balance: numberValue(row.balance),
    isActive: row.is_active,
  }));
}

interface CategoryRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  parent_id: string | null;
  direction: FinanceCategory['direction'];
  sort_order: number;
  is_active: boolean;
}
export async function loadFinanceCategories(tenantId: string) {
  assertSupabaseConfigured();
  const rows = await request<CategoryRow[]>(
    supabaseApi.get(
      '/finance_categories',
      queryParams({
        select: '*',
        tenant_id: `eq.${tenantId}`,
        order: 'sort_order.asc,name.asc',
      }),
    ),
  );
  const byId = new Map(rows.map((row) => [row.id, row.name]));
  return rows.map<FinanceCategory>((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    name: row.name,
    parentId: row.parent_id,
    parentName: row.parent_id ? (byId.get(row.parent_id) ?? '') : '',
    direction: row.direction,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }));
}

interface ObligationRow {
  id: string;
  tenant_id: string;
  code: string;
  description: string;
  party_type: 'customer' | 'employee';
  customer_id: string | null;
  employee_id: string | null;
  party_name_snapshot: string;
  direction: FinanceObligation['direction'];
  source_type: FinanceObligation['sourceType'];
  contract_id: string | null;
  contract_name: string | null;
  document_date: string;
  due_date: string | null;
  original_amount: number | string;
  currency_code: string;
  status: FinanceObligation['status'];
  settled_amount: number | string;
  outstanding_amount: number | string;
}

function mapObligation(row: ObligationRow): FinanceObligation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    description: row.description,
    partyType: row.party_type,
    customerId: row.customer_id,
    employeeId: row.employee_id,
    partyNameSnapshot: row.party_name_snapshot,
    direction: row.direction,
    sourceType: row.source_type,
    contractId: row.contract_id,
    contractName: row.contract_name ?? '',
    documentDate: row.document_date,
    dueDate: row.due_date,
    originalAmount: numberValue(row.original_amount),
    adjustmentAmount: 0,
    obligationAmount: numberValue(row.original_amount),
    settledAmount: numberValue(row.settled_amount),
    outstandingAmount: numberValue(row.outstanding_amount),
    currencyCode: row.currency_code,
    status: row.status,
  };
}

export async function loadFinanceObligationDetail(
  tenantId: string,
  id: string,
) {
  assertSupabaseConfigured();
  const rows = await request<ObligationRow[]>(
    supabaseApi.get(
      '/finance_obligation_balances',
      queryParams({
        select: '*',
        tenant_id: `eq.${tenantId}`,
        id: `eq.${id}`,
        limit: '1',
      }),
    ),
  );
  if (!rows[0]) throw new Error('Không tìm thấy công nợ.');
  return mapObligation(rows[0]);
}
export async function loadFinanceObligations(
  tenantId: string,
  direction: 'receivable' | 'payable' = 'receivable',
) {
  assertSupabaseConfigured();
  const rows = await request<ObligationRow[]>(
    supabaseApi.get(
      '/finance_obligation_balances',
      queryParams({
        select: '*',
        tenant_id: `eq.${tenantId}`,
        direction: `eq.${direction}`,
        status: 'eq.posted',
        order: 'due_date.asc.nullslast,document_date.desc,id.desc',
      }),
    ),
  );
  return rows.map(mapObligation);
}

export interface FinanceCashflowReportRow {
  voucherId: string;
  voucherNo: string | null;
  effectiveDate: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  voucherType: FinanceVoucher['voucherType'];
  categoryId: string;
  categoryName: string;
  amount: number;
  handlingType: FinanceVoucherLineDraft['handlingType'];
  partyName: string;
  description: string;
}

export async function loadFinanceCashflowReport(
  tenantId: string,
  filters: {
    from: string;
    to: string;
    accountId?: string;
    categoryId?: string;
  },
) {
  assertSupabaseConfigured();
  const params: Record<string, string> = {
    select: '*',
    tenant_id: `eq.${tenantId}`,
    and: `(effective_date.gte.${filters.from},effective_date.lte.${filters.to})`,
    order: 'effective_date.desc,voucher_no.desc',
  };
  if (filters.accountId) params.account_id = `eq.${filters.accountId}`;
  if (filters.categoryId) params.category_id = `eq.${filters.categoryId}`;
  const rows = await request<
    Array<{
      voucher_id: string;
      voucher_no: string | null;
      effective_date: string;
      account_id: string;
      account_code: string;
      account_name: string;
      voucher_type: FinanceVoucher['voucherType'];
      category_id: string;
      category_name_snapshot: string;
      amount: number | string;
      handling_type: FinanceVoucherLineDraft['handlingType'];
      party_name_snapshot: string;
      description: string;
    }>
  >(supabaseApi.get('/finance_cashflow_report', queryParams(params)));
  return rows.map<FinanceCashflowReportRow>((row) => ({
    voucherId: row.voucher_id,
    voucherNo: row.voucher_no,
    effectiveDate: row.effective_date,
    accountId: row.account_id,
    accountCode: row.account_code,
    accountName: row.account_name,
    voucherType: row.voucher_type,
    categoryId: row.category_id,
    categoryName: row.category_name_snapshot,
    amount: numberValue(row.amount),
    handlingType: row.handling_type,
    partyName: row.party_name_snapshot,
    description: row.description,
  }));
}

export interface FinanceAccountLedgerReportRow {
  movementId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  effectiveDate: string;
  direction: 'in' | 'out';
  amount: number;
  eventType: string;
  voucherId: string | null;
  voucherNo: string | null;
  voucherType: FinanceVoucher['voucherType'] | null;
  partyName: string | null;
  description: string | null;
}

export async function loadFinanceAccountLedgerReport(
  tenantId: string,
  accountId: string,
  from: string,
  to: string,
) {
  assertSupabaseConfigured();
  const params: Record<string, string> = {
    select: '*',
    tenant_id: `eq.${tenantId}`,
    account_id: `eq.${accountId}`,
    and: `(effective_date.gte.${from},effective_date.lte.${to})`,
    order: 'effective_date.asc,movement_id.asc',
  };
  const rows = await request<
    Array<{
      movement_id: string;
      account_id: string;
      account_code: string;
      account_name: string;
      effective_date: string;
      direction: 'in' | 'out';
      amount: number | string;
      event_type: string;
      voucher_id: string | null;
      voucher_no: string | null;
      voucher_type: FinanceVoucher['voucherType'] | null;
      party_name_snapshot: string | null;
      description: string | null;
    }>
  >(supabaseApi.get('/finance_account_ledger_report', queryParams(params)));
  return rows.map<FinanceAccountLedgerReportRow>((row) => ({
    movementId: row.movement_id,
    accountId: row.account_id,
    accountCode: row.account_code,
    accountName: row.account_name,
    effectiveDate: row.effective_date,
    direction: row.direction,
    amount: numberValue(row.amount),
    eventType: row.event_type,
    voucherId: row.voucher_id,
    voucherNo: row.voucher_no,
    voucherType: row.voucher_type,
    partyName: row.party_name_snapshot,
    description: row.description,
  }));
}

export async function saveFinanceVoucherDraft(
  tenantId: string,
  id: string | null,
  revision: number,
  values: FinanceVoucherFormValues,
  lines: FinanceVoucherLineDraft[],
  currencyCode = 'VND',
) {
  assertSupabaseConfigured();
  const response = await request<{
    id: string;
    status: string;
    revision: number;
  }>(
    supabaseApi.post('/rpc/save_finance_voucher_draft', {
      p_tenant_id: tenantId,
      p_voucher_id: id,
      p_revision: revision,
      p_request_key: crypto.randomUUID(),
      p_payload: {
        voucherType: values.voucherType,
        voucherDate: values.voucherDate,
        transactionAt: new Date(values.transactionAt).toISOString(),
        accountId: values.accountId,
        partyType: values.partyType,
        customerId: values.customerId,
        employeeId: values.employeeId,
        partyName: values.partyName,
        contactName: values.contactName,
        address: values.address,
        description: values.description,
        externalReference: values.externalReference,
        currencyCode,
        lines,
      },
    }),
  );
  return response;
}

export async function postFinanceVoucher(tenantId: string, id: string) {
  assertSupabaseConfigured();
  return request<{ id: string; voucherNo: string; status: string }>(
    supabaseApi.post('/rpc/post_finance_voucher', {
      p_tenant_id: tenantId,
      p_voucher_id: id,
      p_request_key: crypto.randomUUID(),
    }),
  );
}

export async function createFinanceAccount(
  tenantId: string,
  values: {
    code: string;
    name: string;
    accountType: 'cash' | 'bank';
    bankName: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
  },
) {
  assertSupabaseConfigured();
  await supabaseApi.post('/finance_accounts', {
    tenant_id: tenantId,
    code: values.code.trim(),
    name: values.name.trim(),
    account_type: values.accountType,
    bank_name: values.bankName.trim(),
    bank_account_number: values.bankAccountNumber.trim(),
    bank_account_holder: values.bankAccountHolder.trim(),
    currency_code: 'VND',
  });
}

export async function createFinanceObligation(
  tenantId: string,
  values: {
    code: string;
    description: string;
    customerId: string;
    partyNameSnapshot: string;
    direction: 'receivable' | 'payable';
    documentDate: string;
    dueDate: string;
    originalAmount: number;
  },
) {
  assertSupabaseConfigured();
  await supabaseApi.post('/finance_obligations', {
    tenant_id: tenantId,
    code: values.code.trim(),
    description: values.description.trim(),
    party_type: 'customer',
    customer_id: values.customerId,
    party_name_snapshot: values.partyNameSnapshot.trim(),
    direction: values.direction,
    source_type: 'manual',
    document_date: values.documentDate,
    due_date: values.dueDate || null,
    original_amount: values.originalAmount,
    currency_code: 'VND',
    status: 'posted',
    posted_at: new Date().toISOString(),
  });
}

export async function loadFinanceVoucherDetail(
  tenantId: string,
  id: string,
): Promise<FinanceVoucherDetail> {
  assertSupabaseConfigured();
  const [voucherRows, voucherHeadRows, lineRows] = await Promise.all([
    request<VoucherListRow[]>(
      supabaseApi.get(
        '/finance_voucher_list',
        queryParams({
          select: '*',
          tenant_id: `eq.${tenantId}`,
          id: `eq.${id}`,
          limit: '1',
        }),
      ),
    ),
    request<
      Array<{
        contact_name: string;
        address_snapshot: string;
        revision: number;
      }>
    >(
      supabaseApi.get(
        '/finance_vouchers',
        queryParams({
          select: 'contact_name,address_snapshot,revision',
          tenant_id: `eq.${tenantId}`,
          id: `eq.${id}`,
          limit: '1',
        }),
      ),
    ),
    request<
      Array<{
        id: string;
        line_no: number;
        category_id: string;
        category_name_snapshot: string;
        description: string;
        amount: number | string;
        handling_type: FinanceVoucherDetail['lines'][number]['handlingType'];
        related_contract_id: string | null;
        advance_scope: 'party' | 'contract' | null;
      }>
    >(
      supabaseApi.get(
        '/finance_voucher_lines',
        queryParams({
          select: '*',
          tenant_id: `eq.${tenantId}`,
          voucher_id: `eq.${id}`,
          order: 'line_no.asc',
        }),
      ),
    ),
  ]);
  const voucher = voucherRows[0];
  if (!voucher) throw new Error('Không tìm thấy phiếu.');
  const voucherHead = voucherHeadRows[0];
  const allocationDraftRows = lineRows.length
    ? await request<
        Array<{
          voucher_line_id: string;
          obligation_id: string;
          amount: number | string;
        }>
      >(
        supabaseApi.get(
          '/finance_voucher_line_allocation_drafts',
          queryParams({
            select: 'voucher_line_id,obligation_id,amount',
            tenant_id: `eq.${tenantId}`,
            voucher_line_id: `in.(${lineRows.map((row) => row.id).join(',')})`,
          }),
        ),
      )
    : [];
  return {
    ...mapVoucher(voucher),
    contactName: voucherHead?.contact_name ?? '',
    addressSnapshot: voucherHead?.address_snapshot ?? '',
    revision: voucherHead?.revision ?? 1,
    lines: lineRows.map((row) => ({
      id: row.id,
      lineNo: row.line_no,
      categoryId: row.category_id,
      categoryNameSnapshot: row.category_name_snapshot,
      description: row.description,
      amount: numberValue(row.amount),
      handlingType: row.handling_type,
      relatedContractId: row.related_contract_id,
      advanceScope: row.advance_scope,
      allocatedAmount: allocationDraftRows
        .filter((draft) => draft.voucher_line_id === row.id)
        .reduce((sum, draft) => sum + numberValue(draft.amount), 0),
      refundedAmount: 0,
      availableAmount: numberValue(row.amount),
      allocations: allocationDraftRows
        .filter((draft) => draft.voucher_line_id === row.id)
        .map((draft) => ({
          obligationId: draft.obligation_id,
          amount: String(numberValue(draft.amount)),
        })),
    })),
  };
}
