import { describe, expect, it } from 'vitest';
import type { FinanceObligation } from '../../finance/model/finance';
import { groupCustomerFinanceObligations } from './customer-finance';

function obligation(values: Partial<FinanceObligation>): FinanceObligation {
  return {
    id: 'obligation-1',
    tenantId: 'tenant-1',
    code: 'CN-001',
    description: 'Khoản thu',
    partyType: 'customer',
    customerId: 'customer-1',
    employeeId: null,
    partyNameSnapshot: 'Khách hàng',
    direction: 'receivable',
    sourceType: 'contract',
    contractId: 'contract-1',
    contractName: 'Hợp đồng dịch vụ',
    documentDate: '2026-09-16',
    dueDate: '2026-09-16',
    originalAmount: 0,
    adjustmentAmount: 0,
    obligationAmount: 0,
    settledAmount: 0,
    outstandingAmount: 0,
    currencyCode: 'VND',
    status: 'posted',
    ...values,
  };
}

describe('customer finance model', () => {
  it('groups contract obligations from the same billing occurrence', () => {
    const result = groupCustomerFinanceObligations([
      obligation({
        id: 'charge-1',
        code: 'contract-charge:charge-1',
        description: 'Phí dịch vụ',
        originalAmount: 1_000_000,
        obligationAmount: 1_000_000,
        outstandingAmount: 750_000,
        settledAmount: 250_000,
      }),
      obligation({
        id: 'charge-2',
        code: 'contract-charge:charge-2',
        description: 'Phí hỗ trợ',
        originalAmount: 500_000,
        obligationAmount: 500_000,
        outstandingAmount: 500_000,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      originalAmount: 1_500_000,
      settledAmount: 250_000,
      outstandingAmount: 1_250_000,
      componentObligations: expect.arrayContaining([
        expect.objectContaining({ id: 'charge-1' }),
        expect.objectContaining({ id: 'charge-2' }),
      ]),
    });
    expect(result[0].description).toContain('2 khoản cùng kỳ');
  });

  it('keeps manual obligations as separate customer debts', () => {
    const result = groupCustomerFinanceObligations([
      obligation({ id: 'manual-1', sourceType: 'manual', contractId: null }),
      obligation({ id: 'manual-2', sourceType: 'manual', contractId: null }),
    ]);

    expect(result).toHaveLength(2);
  });
});
