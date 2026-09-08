import {
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns';
import type { ContractStatus } from '../../contracts/model/contract';
import type {
  PaymentPlanChartPoint,
  PaymentPlanDateRange,
} from '../../shared/model/payment-plan';

export interface DashboardContractStatusCount {
  status: ContractStatus;
  count: number;
}

export type DashboardMonthlyReceivable = PaymentPlanChartPoint;

export type DashboardPaymentPlanRange = PaymentPlanDateRange;

export function getDashboardPaymentPlanRange(
  today = new Date(),
): DashboardPaymentPlanRange {
  const currentMonth = startOfMonth(today);

  return {
    from: format(addMonths(currentMonth, -6), 'yyyy-MM-dd'),
    to: format(endOfMonth(addMonths(currentMonth, 5)), 'yyyy-MM-dd'),
  };
}

export function getDashboardPaymentPlanMonthRange(
  monthStart: string,
): DashboardPaymentPlanRange {
  const month = startOfMonth(parseISO(monthStart));

  return {
    from: format(month, 'yyyy-MM-dd'),
    to: format(endOfMonth(month), 'yyyy-MM-dd'),
  };
}

export function formatDashboardPaymentPlanRange(
  range: DashboardPaymentPlanRange,
): string {
  return `${format(parseISO(range.from), 'MM/yyyy')} - ${format(parseISO(range.to), 'MM/yyyy')}`;
}

export interface DashboardPaymentPlanContract {
  contractId: string;
  contractCode: string;
  contractName: string;
  customerName: string;
  dueDate: string;
  outstandingAmount: number;
}

export type DashboardReceivableAgingBucket =
  | 'not_due'
  | 'due_today'
  | 'overdue_1_30'
  | 'overdue_31_60'
  | 'overdue_over_60';

export interface DashboardReceivableAging {
  bucket: DashboardReceivableAgingBucket;
  count: number;
  amount: number;
}

export interface DashboardReceivableAgingChartPoint {
  label: string;
  amount: number;
  count: number;
}

export interface DashboardContractStatusChartPoint {
  name: string;
  value: number;
  fill: string;
}

export interface DashboardUpcomingDue {
  contractId: string;
  contractCode: string;
  contractName: string;
  customerName: string;
  dueDate: string;
  outstandingAmount: number;
}

export interface DashboardUpcomingRenewal {
  contractId: string;
  contractCode: string;
  contractName: string;
  customerName: string;
  endDate: string;
}

export interface DashboardStatistics {
  contracts: {
    total: number;
    active: number;
    expiring: number;
    expired: number;
    statusBreakdown: DashboardContractStatusCount[];
  };
  receivables: {
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    overdueOutstanding: number;
  };
  aging: DashboardReceivableAging[];
  upcomingDue: DashboardUpcomingDue[];
  upcomingRenewals: DashboardUpcomingRenewal[];
}
