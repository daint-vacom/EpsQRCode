import { describe, expect, it } from 'vitest';
import type { Contract } from '../../contracts/model/contract';
import type { ContractChargeBalance } from '../../contracts/model/receivable';
import { buildCustomerOverviewData } from './customer-overview';

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

function charge(
  contractId: string,
  values: Partial<ContractChargeBalance>,
): ContractChargeBalance {
  return {
    id: `${contractId}-charge`,
    tenantId: 'tenant-1',
    customerId: 'customer-1',
    contractId,
    contractVersionId: 'version-1',
    contractVersionLineId: 'line-1',
    direction: 'receivable',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    dueDate: '2026-01-31',
    amount: 0,
    currencyCode: 'VND',
    status: 'open',
    voidReason: null,
    createdAt: '2026-01-01T00:00:00Z',
    paidAmount: 0,
    outstandingAmount: 0,
    ...values,
  };
}

describe('customer overview model', () => {
  it('aggregates payment status and debt by customer contract', () => {
    const result = buildCustomerOverviewData(contracts, [
      charge('contract-1', {
        amount: 1_000_000,
        paidAmount: 250_000,
        outstandingAmount: 750_000,
      }),
      charge('contract-2', {
        amount: 2_000_000,
        paidAmount: 2_000_000,
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

  it('only includes due receivables in the contract outstanding amount', () => {
    const result = buildCustomerOverviewData(contracts, [
      charge('contract-1', {
        dueDate: '2099-01-31',
        amount: 1_000_000,
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
  });
});
