import { describe, expect, it } from 'vitest';
import type { ContractVersionLine } from './contract';
import {
  buildContractFeePaymentProgressData,
  buildContractPaymentPlanData,
} from './contract-chart';
import type { ContractChargeBalance } from './receivable';

describe('contract chart model', () => {
  it('groups fee payment progress by normalized fee name', () => {
    const charges = [
      {
        contractVersionLineId: 'line-1',
        direction: 'receivable',
        status: 'open',
        amount: 1_000_000,
        paidAmount: 250_000,
      },
      {
        contractVersionLineId: 'line-2',
        direction: 'receivable',
        status: 'open',
        amount: 2_000_000,
        paidAmount: 500_000,
      },
      {
        contractVersionLineId: 'line-3',
        direction: 'payable',
        status: 'open',
        amount: 8_000_000,
        paidAmount: 8_000_000,
      },
      {
        contractVersionLineId: 'line-4',
        direction: 'receivable',
        status: 'voided',
        amount: 8_000_000,
        paidAmount: 8_000_000,
      },
    ] as ContractChargeBalance[];
    const lines = [
      { id: 'line-1', name: 'Phí dịch vụ' },
      { id: 'line-2', name: '  PHÍ   DỊCH VỤ  ' },
      { id: 'line-3', name: 'Khoản phải trả' },
      { id: 'line-4', name: 'Phí dịch vụ' },
    ] as ContractVersionLine[];

    expect(buildContractFeePaymentProgressData(charges, lines)).toEqual([
      {
        feeName: 'Phí dịch vụ',
        paidAmount: 750_000,
        totalAmount: 3_000_000,
      },
    ]);
  });

  it('builds a monthly payment plan from the contract charges in range', () => {
    const charges = [
      {
        contractVersionLineId: 'line-1',
        direction: 'receivable',
        status: 'open',
        dueDate: '2099-01-15',
        amount: 1_000_000,
        paidAmount: 250_000,
        outstandingAmount: 750_000,
      },
      {
        contractVersionLineId: 'line-2',
        direction: 'receivable',
        status: 'open',
        dueDate: '2099-02-15',
        amount: 2_000_000,
        paidAmount: 0,
        outstandingAmount: 2_000_000,
      },
      {
        contractVersionLineId: 'line-3',
        direction: 'receivable',
        status: 'open',
        dueDate: '2099-03-15',
        amount: 4_000_000,
        paidAmount: 0,
        outstandingAmount: 4_000_000,
      },
    ] as ContractChargeBalance[];

    expect(
      buildContractPaymentPlanData(charges, {
        from: '2099-01-01',
        to: '2099-02-28',
      }),
    ).toEqual([
      {
        monthStart: '2099-01-01',
        monthLabel: '01/2099',
        paidAmount: 250_000,
        currentOutstanding: 0,
        overdueOutstanding: 0,
        futureOutstanding: 750_000,
      },
      {
        monthStart: '2099-02-01',
        monthLabel: '02/2099',
        paidAmount: 0,
        currentOutstanding: 0,
        overdueOutstanding: 0,
        futureOutstanding: 2_000_000,
      },
    ]);
  });
});
