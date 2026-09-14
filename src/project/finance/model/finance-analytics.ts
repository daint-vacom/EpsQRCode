import type { FinanceAccountActivity, FinanceVoucherType } from './finance';

export interface FinanceAccountCashflowEntry {
  effectiveDate: string;
  voucherType: FinanceVoucherType;
  categoryName: string;
  amount: number;
}

export interface FinanceAccountSummary {
  openingBalance: number;
  totalReceipt: number;
  totalPayment: number;
  netChange: number;
  closingBalance: number;
  transactionCount: number;
  receiptCount: number;
  paymentCount: number;
}

export interface FinanceAccountTrendPoint {
  periodKey: string;
  periodLabel: string;
  receipt: number;
  payment: number;
  balance: number;
}

export interface FinanceAccountLedgerTableRow extends FinanceAccountActivity {
  categoryName: string | null;
}

export interface FinanceAccountCategoryPoint {
  name: string;
  value: number;
  fill: string;
}

export interface FinanceAccountTrendOptions {
  from?: string;
  to?: string;
  maxPoints?: number;
}

const CATEGORY_COLORS = [
  'var(--admin-blue-primary)',
  'var(--admin-success-dot)',
  'var(--admin-amber-primary)',
  'var(--admin-red-primary)',
  'var(--admin-blue-light)',
  'var(--admin-neutral-400)',
] as const;

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(value: Date) {
  return `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekStart(value: string) {
  const date = parseDate(value);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
}

function compareActivityRows(
  a: FinanceAccountActivity,
  b: FinanceAccountActivity,
) {
  return (
    a.effectiveDate.localeCompare(b.effectiveDate) ||
    (a.voucherNo ?? '').localeCompare(b.voucherNo ?? '') ||
    a.movementId.localeCompare(b.movementId)
  );
}

export function summarizeFinanceAccountActivity(
  openingBalance: number,
  rows: FinanceAccountActivity[],
): FinanceAccountSummary {
  const totalReceipt = rows.reduce(
    (sum, row) => sum + (row.direction === 'in' ? row.amount : 0),
    0,
  );
  const totalPayment = rows.reduce(
    (sum, row) => sum + (row.direction === 'out' ? row.amount : 0),
    0,
  );
  const receiptCount = rows.filter((row) => row.direction === 'in').length;
  const paymentCount = rows.length - receiptCount;

  return {
    openingBalance,
    totalReceipt,
    totalPayment,
    netChange: totalReceipt - totalPayment,
    closingBalance: openingBalance + totalReceipt - totalPayment,
    transactionCount: rows.length,
    receiptCount,
    paymentCount,
  };
}

export function getFinanceBalanceBeforeDate(
  openingBalance: number,
  rows: FinanceAccountActivity[],
  from: string,
) {
  return rows.reduce(
    (balance, row) =>
      row.effectiveDate < from
        ? balance + (row.direction === 'in' ? row.amount : -row.amount)
        : balance,
    openingBalance,
  );
}

export function withFinanceRunningBalances(
  openingBalance: number,
  rows: FinanceAccountActivity[],
): FinanceAccountActivity[] {
  let balance = openingBalance;
  return [...rows].sort(compareActivityRows).map((row) => {
    balance += row.direction === 'in' ? row.amount : -row.amount;
    return { ...row, runningBalance: balance };
  });
}

export function buildFinanceAccountWeeklyTrend(
  openingBalance: number,
  rows: FinanceAccountActivity[],
  options: FinanceAccountTrendOptions = {},
): FinanceAccountTrendPoint[] {
  const sortedRows = [...rows].sort(compareActivityRows);
  const firstDate = options.from ?? sortedRows[0]?.effectiveDate;
  const lastDate =
    options.to ?? sortedRows[sortedRows.length - 1]?.effectiveDate;
  if (!firstDate || !lastDate || firstDate > lastDate) return [];

  const firstWeek = getWeekStart(firstDate);
  const lastWeek = getWeekStart(lastDate);
  const points = new Map<string, FinanceAccountTrendPoint>();
  const cursor = new Date(firstWeek);
  while (cursor <= lastWeek) {
    const periodKey = toDateKey(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    points.set(periodKey, {
      periodKey,
      periodLabel: formatShortDate(cursor) + ' - ' + formatShortDate(weekEnd),
      receipt: 0,
      payment: 0,
      balance: openingBalance,
    });
    cursor.setDate(cursor.getDate() + 7);
  }

  let balance = openingBalance;

  sortedRows.forEach((row) => {
    balance += row.direction === 'in' ? row.amount : -row.amount;
    const point = points.get(toDateKey(getWeekStart(row.effectiveDate)));
    if (!point) return;
    point.receipt += row.direction === 'in' ? row.amount : 0;
    point.payment += row.direction === 'out' ? row.amount : 0;
    point.balance = balance;
  });

  let lastBalance = openingBalance;
  const completePoints = [...points.values()].map((point) => {
    if (point.receipt || point.payment) lastBalance = point.balance;
    else point.balance = lastBalance;
    return point;
  });
  const maxPoints = options.maxPoints ?? 12;
  return completePoints.length > maxPoints
    ? completePoints.slice(-maxPoints)
    : completePoints;
}

export function buildFinanceCategoryBreakdown(
  rows: FinanceAccountCashflowEntry[],
  direction?: FinanceVoucherType,
): FinanceAccountCategoryPoint[] {
  const totals = new Map<string, number>();
  rows
    .filter((row) => !direction || row.voucherType === direction)
    .forEach((row) => {
      const category = row.categoryName || 'Chưa phân loại';
      totals.set(category, (totals.get(category) ?? 0) + row.amount);
    });

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value,
      fill: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));
}
