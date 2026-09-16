import { describe, expect, it } from 'vitest';
import type { Contract } from '../../contracts/model/contract';
import type { FinanceObligation } from '../../finance/model/finance';
import {
  buildCustomerOverviewData,
  buildCustomerPaymentPlanData,
} from './customer-overview';

const contracts = [
  {
    id: 'contract-1',
    contractCode: 'HD-001',
    name: 'Hợp đồng dịch vụ',
    currencyCode: 'VND',
    status: 'active',
  },
  {
    id: 'contract-2',
    contractCode: 'HD-002',
    name: 'Hợp đồng tư vấn',
    currencyCode: 'VND',
    status: 'active',
  },
  {
    id: 'contract-3',
    contractCode: 'HD-003',
    name: 'Hợp đồng chưa phát sinh',
    currencyCode: 'VND',
    status: 'draft',
  },
] as Array<
  Pick<Contract, 'id' | 'contractCode' | 'name' | 'currencyCode' | 'status'>
>;

function debt(values: Partial<FinanceObligation>): FinanceObligation {
  return {
    id: 'debt-1',
    tenantId: 'tenant-1',
    customerId: 'customer-1',
    partyType: 'customer',
    partyNameSnapshot: 'Khách hàng',
    description: 'Công nợ',
    code: 'CN-001',
    direction: 'receivable',
    sourceType: 'manual',
    contractId: null,
    contractName: '',
    documentDate: '2026-01-01',
    effectiveDate: '2026-01-01',
    dueDate: '2026-01-31',
    recognitionBasis: 'test',
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

describe('customer overview model', () => {
  it('aggregates payment status and debt by customer contract', () => {
    const result = buildCustomerOverviewData(contracts, [
      debt({
        id: 'contract-1-debt',
        contractId: 'contract-1',
        sourceType: 'contract',
        originalAmount: 1_000_000,
        obligationAmount: 1_000_000,
        settledAmount: 250_000,
        outstandingAmount: 750_000,
      }),
      debt({
        id: 'contract-2-debt',
        contractId: 'contract-2',
        sourceType: 'contract',
        originalAmount: 2_000_000,
        obligationAmount: 2_000_000,
        settledAmount: 2_000_000,
        outstandingAmount: 0,
      }),
    ]);

    expect(result.summary).toEqual({
      currencyCode: 'VND',
      activeContractCount: 2,
      terminatedContractCount: 0,
      totalBilled: 3_000_000,
      totalPaid: 2_250_000,
      totalOutstanding: 750_000,
      overdueOutstanding: 750_000,
      unappliedAdvance: 0,
      cashReceived: 0,
      cashPaid: 0,
      progressPercent: 75,
    });
    expect(result.contracts[0]).toMatchObject({
      id: 'contract-1',
      totalAmount: 1_000_000,
      paidAmount: 250_000,
      outstandingAmount: 750_000,
      progressPercent: 25,
    });
  });

  it('excludes future receivables from actual customer debt totals', () => {
    const result = buildCustomerOverviewData(contracts, [
      debt({
        id: 'future-debt',
        contractId: 'contract-1',
        sourceType: 'contract',
        dueDate: '2099-01-31',
        originalAmount: 1_000_000,
        obligationAmount: 1_000_000,
        outstandingAmount: 1_000_000,
      }),
    ]);

    expect(
      result.contracts.find((contract) => contract.id === 'contract-1'),
    ).toMatchObject({
      id: 'contract-1',
      outstandingAmount: 0,
    });
    expect(result.summary.totalOutstanding).toBe(0);
    expect(result.obligations).toHaveLength(0);
  });

  it('includes manual customer debt in the summary but not contract totals', () => {
    const result = buildCustomerOverviewData(contracts, [
      debt({
        id: 'manual-debt',
        description: 'Công nợ ngoài hợp đồng',
        originalAmount: 500_000,
        obligationAmount: 500_000,
        outstandingAmount: 500_000,
      }),
    ]);

    expect(result.summary.totalOutstanding).toBe(500_000);
    expect(
      result.contracts.every((contract) => contract.outstandingAmount === 0),
    ).toBe(true);
  });

  it('uses the as-of finance snapshot for credit and cash metrics', () => {
    const result = buildCustomerOverviewData(
      contracts,
      [
        debt({
          originalAmount: 1_000_000,
          obligationAmount: 1_000_000,
          settledAmount: 250_000,
          outstandingAmount: 750_000,
        }),
      ],
      undefined,
      [],
      {
        currencyCode: 'VND',
        totalBilled: 1_000_000,
        totalPaid: 250_000,
        totalOutstanding: 750_000,
        overdueOutstanding: 0,
        unappliedCredit: 300_000,
        cashReceived: 550_000,
        cashPaid: 0,
      },
    );

    expect(result.summary).toMatchObject({
      totalBilled: 1_000_000,
      totalPaid: 250_000,
      totalOutstanding: 750_000,
      overdueOutstanding: 0,
      unappliedAdvance: 300_000,
      cashReceived: 550_000,
      cashPaid: 0,
    });
  });

  it('treats manually recorded debt without a due date as incurred', () => {
    const result = buildCustomerOverviewData(contracts, [
      debt({
        id: 'manual-no-due-date',
        dueDate: null,
        originalAmount: 500_000,
        obligationAmount: 500_000,
        outstandingAmount: 500_000,
      }),
    ]);

    expect(result.summary.totalOutstanding).toBe(500_000);
    expect(result.obligations).toHaveLength(1);
  });

  it('builds the payment plan from posted contract and manual obligations', () => {
    const result = buildCustomerPaymentPlanData(
      [
        debt({
          id: 'contract-debt',
          dueDate: '2026-09-10',
          obligationAmount: 1_000_000,
          settledAmount: 250_000,
          outstandingAmount: 750_000,
        }),
        debt({
          id: 'manual-debt',
          dueDate: '2026-10-15',
          obligationAmount: 500_000,
          settledAmount: 100_000,
          outstandingAmount: 400_000,
        }),
        debt({
          id: 'draft-debt',
          dueDate: '2026-10-20',
          obligationAmount: 900_000,
          outstandingAmount: 900_000,
          status: 'draft',
        }),
      ],
      { from: '2026-09-01', to: '2026-10-31' },
    );

    expect(result).toEqual([
      {
        monthStart: '2026-09-01',
        monthLabel: '09/2026',
        paidAmount: 250_000,
        currentOutstanding: 0,
        overdueOutstanding: 750_000,
        futureOutstanding: 0,
      },
      {
        monthStart: '2026-10-01',
        monthLabel: '10/2026',
        paidAmount: 100_000,
        currentOutstanding: 0,
        overdueOutstanding: 0,
        futureOutstanding: 400_000,
      },
    ]);
  });

  it('uses contract charge sources for future payment plan rows', () => {
    const result = buildCustomerPaymentPlanData(
      [
        debt({
          id: 'manual-debt',
          dueDate: '2026-10-15',
          obligationAmount: 500_000,
          outstandingAmount: 500_000,
        }),
      ],
      { from: '2026-09-01', to: '2026-10-31' },
      [
        {
          dueDate: '2026-09-30',
          paidAmount: 0,
          outstandingAmount: 1_000_000,
        },
      ],
    );

    expect(result[0]).toMatchObject({
      monthStart: '2026-09-01',
      futureOutstanding: 1_000_000,
    });
    expect(result[1]).toMatchObject({
      monthStart: '2026-10-01',
      futureOutstanding: 500_000,
    });
  });
});
