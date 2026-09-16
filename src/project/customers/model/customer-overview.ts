import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import type { Contract } from '../../contracts/model/contract';
import type { FinanceObligation } from '../../finance/model/finance';
import type {
  PaymentPlanChartPoint,
  PaymentPlanDateRange,
} from '../../shared/model/payment-plan';
import { isCustomerFinanceObligationActual } from './customer-finance';

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

export interface CustomerPaymentPlanSource {
  dueDate: string;
  paidAmount: number;
  outstandingAmount: number;
}

export interface CustomerOverviewData {
  contracts: CustomerOverviewContract[];
  obligations: FinanceObligation[];
  paymentPlanObligations: FinanceObligation[];
  paymentPlanSources: CustomerPaymentPlanSource[];
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
  obligations: FinanceObligation[],
  paymentPlanObligations: FinanceObligation[] = obligations,
  paymentPlanSources: CustomerPaymentPlanSource[] = [],
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

  const actualObligations = obligations.filter((obligation) =>
    isCustomerFinanceObligationActual(obligation, todayIso),
  );
  const postedPaymentPlanObligations = paymentPlanObligations.filter(
    (obligation) =>
      obligation.direction === 'receivable' && obligation.status === 'posted',
  );

  for (const obligation of actualObligations) {
    if (
      obligation.direction !== 'receivable' ||
      obligation.status !== 'posted'
    ) {
      continue;
    }

    const contract = obligation.contractId
      ? contractById.get(obligation.contractId)
      : undefined;
    const current = contract ? contractTotals.get(contract.id) : undefined;

    if (current) {
      current.totalAmount += Math.max(0, obligation.obligationAmount);
      current.paidAmount += Math.max(
        0,
        Math.min(obligation.obligationAmount, obligation.settledAmount),
      );
      current.outstandingAmount += Math.max(0, obligation.outstandingAmount);
      if (
        obligation.dueDate &&
        obligation.dueDate < todayIso &&
        obligation.outstandingAmount > 0
      ) {
        current.overdueOutstanding += Math.max(0, obligation.outstandingAmount);
      }
    }

    summaryTotals.totalBilled += Math.max(0, obligation.obligationAmount);
    summaryTotals.totalPaid += Math.max(
      0,
      Math.min(obligation.obligationAmount, obligation.settledAmount),
    );
    summaryTotals.totalOutstanding += Math.max(0, obligation.outstandingAmount);
    if (
      obligation.dueDate &&
      obligation.dueDate < todayIso &&
      obligation.outstandingAmount > 0
    ) {
      summaryTotals.overdueOutstanding += Math.max(
        0,
        obligation.outstandingAmount,
      );
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

  return {
    contracts: overviewContracts,
    obligations: actualObligations,
    paymentPlanObligations: postedPaymentPlanObligations,
    paymentPlanSources,
    summary,
  };
}

export function buildCustomerPaymentPlanData(
  obligations: FinanceObligation[],
  range: PaymentPlanDateRange,
  contractSources: CustomerPaymentPlanSource[] = [],
): PaymentPlanChartPoint[] {
  const todayIso = new Date().toISOString().slice(0, 10);
  const fromMonth = startOfMonth(parseISO(range.from));
  const toMonth = startOfMonth(parseISO(range.to));
  const months = new Map<string, PaymentPlanChartPoint>();

  for (let month = fromMonth; month <= toMonth; month = addMonths(month, 1)) {
    const monthStart = format(month, 'yyyy-MM-dd');
    months.set(monthStart, {
      monthStart,
      monthLabel: format(month, 'MM/yyyy'),
      paidAmount: 0,
      currentOutstanding: 0,
      overdueOutstanding: 0,
      futureOutstanding: 0,
    });
  }

  const sources: CustomerPaymentPlanSource[] = [
    ...obligations
      .filter(
        (obligation) =>
          obligation.direction === 'receivable' &&
          obligation.status === 'posted' &&
          !(contractSources.length > 0 && obligation.sourceType === 'contract'),
      )
      .map((obligation) => ({
        dueDate: obligation.dueDate ?? obligation.documentDate,
        paidAmount: Math.max(
          0,
          Math.min(obligation.obligationAmount, obligation.settledAmount),
        ),
        outstandingAmount: Math.max(0, obligation.outstandingAmount),
      })),
    ...contractSources,
  ];

  sources
    .filter(
      (source) => source.dueDate >= range.from && source.dueDate <= range.to,
    )
    .forEach((source) => {
      const current = months.get(`${source.dueDate.slice(0, 7)}-01`);
      if (!current) return;

      current.paidAmount += source.paidAmount;
      if (source.dueDate > todayIso) {
        current.futureOutstanding += source.outstandingAmount;
      } else if (source.dueDate < todayIso) {
        current.overdueOutstanding += source.outstandingAmount;
      } else {
        current.currentOutstanding += source.outstandingAmount;
      }
    });

  return [...months.values()];
}
