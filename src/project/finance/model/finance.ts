import { z } from 'zod';

export const FINANCE_VOUCHER_TYPES = ['receipt', 'payment'] as const;
export type FinanceVoucherType = (typeof FINANCE_VOUCHER_TYPES)[number];
export const FINANCE_VOUCHER_TYPE_LABELS: Record<FinanceVoucherType, string> = {
  receipt: 'Phiếu thu',
  payment: 'Phiếu chi',
};

export const FINANCE_PARTY_TYPES = ['customer', 'employee', 'other'] as const;
export type FinancePartyType = (typeof FINANCE_PARTY_TYPES)[number];
export const FINANCE_PARTY_TYPE_LABELS: Record<FinancePartyType, string> = {
  customer: 'Khách hàng',
  employee: 'Nhân viên',
  other: 'Vãng lai',
};

export const FINANCE_HANDLING_TYPES = [
  'settlement',
  'advance',
  'direct',
  'refund',
] as const;
export type FinanceHandlingType = (typeof FINANCE_HANDLING_TYPES)[number];
export const FINANCE_HANDLING_TYPE_LABELS: Record<FinanceHandlingType, string> =
  {
    settlement: 'Thanh toán công nợ',
    advance: 'Ứng trước',
    direct: 'Thu/chi trực tiếp',
    refund: 'Hoàn tiền',
  };

export const FINANCE_VOUCHER_STATUSES = [
  'draft',
  'posted',
  'cancelled',
  'reversed',
] as const;
export type FinanceVoucherStatus = (typeof FINANCE_VOUCHER_STATUSES)[number];
export const FINANCE_VOUCHER_STATUS_LABELS: Record<
  FinanceVoucherStatus,
  string
> = {
  draft: 'Nháp',
  posted: 'Đã ghi nhận',
  cancelled: 'Đã hủy',
  reversed: 'Đã đảo',
};

export const FINANCE_ACCOUNT_TYPES = ['cash', 'bank'] as const;
export type FinanceAccountType = (typeof FINANCE_ACCOUNT_TYPES)[number];
export const FINANCE_ACCOUNT_TYPE_LABELS: Record<FinanceAccountType, string> = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
};

export const FINANCE_OBLIGATION_DIRECTIONS = ['receivable', 'payable'] as const;
export type FinanceObligationDirection =
  (typeof FINANCE_OBLIGATION_DIRECTIONS)[number];
export const FINANCE_OBLIGATION_DIRECTION_LABELS: Record<
  FinanceObligationDirection,
  string
> = {
  receivable: 'Phải thu',
  payable: 'Phải trả',
};

export const financeVoucherFormSchema = z.object({
  voucherType: z.enum(FINANCE_VOUCHER_TYPES),
  voucherDate: z.string().min(1, 'Vui lòng chọn ngày chứng từ.'),
  transactionAt: z.string().min(1, 'Vui lòng nhập thời điểm giao dịch.'),
  accountId: z.string().uuid('Vui lòng chọn quỹ/tài khoản.'),
  partyType: z.enum(FINANCE_PARTY_TYPES),
  customerId: z.string(),
  employeeId: z.string(),
  partyName: z.string().trim().min(1, 'Vui lòng nhập tên đối tượng.'),
  contactName: z.string().trim(),
  address: z.string().trim(),
  description: z.string().trim(),
  externalReference: z.string().trim(),
});

export type FinanceVoucherFormValues = z.infer<typeof financeVoucherFormSchema>;

export interface FinanceVoucherLineDraft {
  categoryId: string;
  categoryName: string;
  description: string;
  amount: string;
  handlingType: FinanceHandlingType;
  relatedContractId: string;
  advanceScope: 'party' | 'contract' | '';
  allocations: Array<{ obligationId: string; amount: string }>;
}

export interface FinanceVoucher {
  id: string;
  tenantId: string;
  voucherNo: string | null;
  voucherType: FinanceVoucherType;
  voucherDate: string;
  transactionAt: string;
  partyType: FinancePartyType;
  customerId: string | null;
  employeeId: string | null;
  partyNameSnapshot: string;
  accountId: string;
  accountName: string;
  currencyCode: string;
  description: string;
  externalReference: string;
  categoriesSummary: string;
  lineCount: number;
  totalAmount: number;
  status: FinanceVoucherStatus;
  createdAt: string;
  postedAt: string | null;
}

export interface FinanceVoucherDetail extends FinanceVoucher {
  contactName: string;
  addressSnapshot: string;
  revision: number;
  lines: FinanceVoucherLine[];
}

export interface FinanceVoucherLine {
  id: string;
  lineNo: number;
  categoryId: string;
  categoryNameSnapshot: string;
  description: string;
  amount: number;
  handlingType: FinanceHandlingType;
  relatedContractId: string | null;
  advanceScope: 'party' | 'contract' | null;
  allocatedAmount: number;
  refundedAmount: number;
  availableAmount: number;
  allocations: Array<{ obligationId: string; amount: string }>;
}

export interface FinanceAccount {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  accountType: FinanceAccountType;
  currencyCode: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  openingDate: string;
  openingBalance: number;
  balance: number;
  isActive: boolean;
}

/**
 * A normalized, posted movement row shared by account detail and reports.
 * `openingBalance` is the balance immediately before the first row in a
 * scoped data set; callers can therefore reuse the analytics helpers for one
 * account or for an account-filtered report window.
 */
export interface FinanceAccountActivity {
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
  voucherType: FinanceVoucherType | null;
  partyName: string | null;
  description: string | null;
  categoryName?: string | null;
  runningBalance?: number;
}

export interface FinanceCategory {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  parentId: string | null;
  parentName: string;
  direction: 'receipt' | 'payment' | 'both';
  sortOrder: number;
  isActive: boolean;
}

export interface FinanceObligation {
  id: string;
  tenantId: string;
  code: string;
  description: string;
  partyType: 'customer' | 'employee';
  customerId: string | null;
  employeeId: string | null;
  partyNameSnapshot: string;
  direction: FinanceObligationDirection;
  sourceType: 'contract' | 'opening_balance' | 'manual' | 'commission';
  contractId: string | null;
  contractName: string;
  documentDate: string;
  dueDate: string | null;
  originalAmount: number;
  adjustmentAmount: number;
  obligationAmount: number;
  settledAmount: number;
  outstandingAmount: number;
  currencyCode: string;
  status: 'draft' | 'posted' | 'voided';
}

export const financeVoucherDefaultValues: FinanceVoucherFormValues = {
  voucherType: 'receipt',
  voucherDate: new Date().toISOString().slice(0, 10),
  transactionAt: new Date().toISOString().slice(0, 16),
  accountId: '',
  partyType: 'customer',
  customerId: '',
  employeeId: '',
  partyName: '',
  contactName: '',
  address: '',
  description: '',
  externalReference: '',
};

export function mapFinanceVoucherToFormValues(
  voucher: FinanceVoucherDetail,
): FinanceVoucherFormValues {
  return {
    voucherType: voucher.voucherType,
    voucherDate: voucher.voucherDate,
    transactionAt: voucher.transactionAt.slice(0, 16),
    accountId: voucher.accountId,
    partyType: voucher.partyType,
    customerId: voucher.customerId ?? '',
    employeeId: voucher.employeeId ?? '',
    partyName: voucher.partyNameSnapshot,
    contactName: voucher.contactName,
    address: voucher.addressSnapshot,
    description: voucher.description,
    externalReference: voucher.externalReference,
  };
}

export function formatFinanceAmount(value: number | string | null | undefined) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(typeof value === 'number' ? value : Number(value) || 0);
}

export function numberValue(value: number | string | null | undefined) {
  return value == null
    ? 0
    : typeof value === 'number'
      ? value
      : Number(value) || 0;
}

export function getFinanceVoucherLineAvailableAmount(
  amount: number | string | null | undefined,
  allocatedAmount: number | string | null | undefined,
  refundedAmount: number | string | null | undefined,
) {
  return Math.max(
    0,
    numberValue(amount) -
      numberValue(allocatedAmount) -
      numberValue(refundedAmount),
  );
}
