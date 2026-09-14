import { describe, expect, it } from 'vitest';
import type { FinanceAccountActivity } from './finance';
import {
  buildFinanceAccountWeeklyTrend,
  buildFinanceCategoryBreakdown,
  getFinanceBalanceBeforeDate,
  summarizeFinanceAccountActivity,
  withFinanceRunningBalances,
} from './finance-analytics';

const row = (
  movementId: string,
  effectiveDate: string,
  direction: FinanceAccountActivity['direction'],
  amount: number,
): FinanceAccountActivity => ({
  movementId,
  accountId: 'account-1',
  accountCode: 'TM-01',
  accountName: 'Quỹ tiền mặt',
  effectiveDate,
  direction,
  amount,
  eventType: 'voucher_posting',
  voucherId: null,
  voucherNo: movementId,
  voucherType: direction === 'in' ? 'receipt' : 'payment',
  partyName: null,
  description: null,
});

describe('finance account analytics', () => {
  it('calculates summaries and running balances from posted movements', () => {
    const rows = [
      row('2', '2026-09-12', 'out', 1000),
      row('1', '2026-09-10', 'in', 5000),
    ];
    const withBalances = withFinanceRunningBalances(10000, rows);

    expect(withBalances.map((item) => item.runningBalance)).toEqual([
      15000, 14000,
    ]);
    expect(summarizeFinanceAccountActivity(10000, rows)).toMatchObject({
      totalReceipt: 5000,
      totalPayment: 1000,
      netChange: 4000,
      closingBalance: 14000,
      transactionCount: 2,
    });
    expect(getFinanceBalanceBeforeDate(10000, rows, '2026-09-12')).toBe(15000);
  });

  it('groups movement amounts by Monday-based week and category', () => {
    const rows = [
      row('1', '2026-09-07', 'in', 5000),
      row('2', '2026-09-09', 'out', 1200),
      row('3', '2026-09-14', 'in', 2000),
    ];
    const trend = buildFinanceAccountWeeklyTrend(10000, rows);

    expect(trend).toEqual([
      {
        periodKey: '2026-09-07',
        periodLabel: '07/09 - 13/09',
        receipt: 5000,
        payment: 1200,
        balance: 13800,
      },
      {
        periodKey: '2026-09-14',
        periodLabel: '14/09 - 20/09',
        receipt: 2000,
        payment: 0,
        balance: 15800,
      },
    ]);

    expect(
      buildFinanceAccountWeeklyTrend(10000, rows, {
        from: '2026-08-31',
        to: '2026-09-20',
        maxPoints: 12,
      }).map((point) => ({
        periodKey: point.periodKey,
        receipt: point.receipt,
        payment: point.payment,
        balance: point.balance,
      })),
    ).toEqual([
      { periodKey: '2026-08-31', receipt: 0, payment: 0, balance: 10000 },
      { periodKey: '2026-09-07', receipt: 5000, payment: 1200, balance: 13800 },
      { periodKey: '2026-09-14', receipt: 2000, payment: 0, balance: 15800 },
    ]);

    expect(
      buildFinanceAccountWeeklyTrend(10000, rows, {
        from: '2026-01-01',
        to: '2026-09-20',
        maxPoints: 4,
      }),
    ).toHaveLength(4);

    expect(
      buildFinanceCategoryBreakdown([
        {
          effectiveDate: '2026-09-07',
          voucherType: 'receipt',
          categoryName: 'Thu khách hàng',
          amount: 5000,
        },
        {
          effectiveDate: '2026-09-08',
          voucherType: 'payment',
          categoryName: 'Chi văn phòng',
          amount: 1200,
        },
        {
          effectiveDate: '2026-09-09',
          voucherType: 'receipt',
          categoryName: 'Thu khách hàng',
          amount: 3000,
        },
      ]),
    ).toEqual([
      {
        name: 'Thu khách hàng',
        value: 8000,
        fill: 'var(--admin-blue-primary)',
      },
      {
        name: 'Chi văn phòng',
        value: 1200,
        fill: 'var(--admin-success-dot)',
      },
    ]);
  });
});
