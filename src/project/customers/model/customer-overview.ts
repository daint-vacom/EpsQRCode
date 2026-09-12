import type { Contract } from '../../contracts/model/contract';
import type { ContractChargeBalance } from '../../contracts/model/receivable';

export interface CustomerOverviewContract extends Pick<
  Contract,
  'id' | 'contractCode' | 'name' | 'currencyCode' | 'status'
> {
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueOutstanding: number;
  progressPercent: number;
}

export interface CustomerOverviewSummary {
  currencyCode: string;
  activeContractCount: number;
  terminatedContractCount: number;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueOutstanding: number;
  progressPercent: number;
}

export interface CustomerOverviewData {
  contracts: CustomerOverviewContract[];
  charges: ContractChargeBalance[];
  summary: CustomerOverviewSummary;
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function progressPercent(totalBilled: number, totalPaid: number) {
  if (totalBilled <= 0) return 0;
  return Math.min(100, Math.max(0, (totalPaid / totalBilled) * 100));
}

export function buildCustomerOverviewData(
  contracts: Array<
    Pick<Contract, 'id' | 'contractCode' | 'name' | 'currencyCode' | 'status'>
  >,
  charges: ContractChargeBalance[],
): CustomerOverviewData {
  const todayIso = getTodayIso();
  const contractById = new Map(
    contracts.map((contract) => [contract.id, contract]),
  );
  const contractTotals = new Map<
    string,
    Omit<CustomerOverviewContract, keyof Contract>
  >();

  for (const contract of contracts) {
    contractTotals.set(contract.id, {
      totalAmount: 0,
      paidAmount: 0,
      outstandingAmount: 0,
      overdueOutstanding: 0,
      progressPercent: 0,
    });
  }

  const summaryTotals = {
    currencyCode: contracts[0]?.currencyCode ?? 'VND',
    totalBilled: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    overdueOutstanding: 0,
  };

  for (const charge of charges) {
    if (charge.direction !== 'receivable' || charge.status === 'voided') {
      continue;
    }

    const contract = contractById.get(charge.contractId);
    if (!contract) continue;

    const current = contractTotals.get(contract.id);
    if (!current) continue;

    current.totalAmount += Math.max(0, charge.amount);
    current.paidAmount += Math.max(
      0,
      Math.min(charge.amount, charge.paidAmount),
    );
    if (charge.dueDate <= todayIso) {
      current.outstandingAmount += Math.max(0, charge.outstandingAmount);
    }
    if (charge.dueDate < todayIso) {
      current.overdueOutstanding += Math.max(0, charge.outstandingAmount);
    }

    summaryTotals.totalBilled += Math.max(0, charge.amount);
    summaryTotals.totalPaid += Math.max(
      0,
      Math.min(charge.amount, charge.paidAmount),
    );
    if (charge.dueDate <= todayIso) {
      summaryTotals.totalOutstanding += Math.max(0, charge.outstandingAmount);
    }
    if (charge.dueDate < todayIso) {
      summaryTotals.overdueOutstanding += Math.max(0, charge.outstandingAmount);
    }
  }

  const overviewContracts = contracts
    .map((contract) => {
      const totals = contractTotals.get(contract.id)!;
      return {
        ...contract,
        ...totals,
        progressPercent: progressPercent(totals.totalAmount, totals.paidAmount),
      };
    })
    .sort(
      (left, right) =>
        right.outstandingAmount - left.outstandingAmount ||
        left.name.localeCompare(right.name),
    );

  const summary: CustomerOverviewSummary = {
    ...summaryTotals,
    activeContractCount: contracts.filter(
      (contract) => contract.status === 'active',
    ).length,
    terminatedContractCount: contracts.filter(
      (contract) => contract.status === 'terminated',
    ).length,
    progressPercent: progressPercent(
      summaryTotals.totalBilled,
      summaryTotals.totalPaid,
    ),
  };

  return { contracts: overviewContracts, charges, summary };
}
