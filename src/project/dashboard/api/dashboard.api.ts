import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type { ContractStatus } from '../../contracts/model/contract';
import type {
  DashboardPaymentPlanContract,
  DashboardPaymentPlanRange,
  DashboardReceivableAgingBucket,
  DashboardStatistics,
} from '../model/dashboard';

interface DashboardStatisticsRpcResponse {
  contracts: {
    total: number | string;
    active: number | string;
    expiring: number | string;
    expired: number | string;
    statusBreakdown: Array<{
      status: ContractStatus;
      count: number | string;
    }>;
  };
  receivables: {
    totalBilled: number | string;
    totalPaid: number | string;
    totalOutstanding: number | string;
    overdueOutstanding: number | string;
  };
  aging: Array<{
    bucket: DashboardReceivableAgingBucket;
    count: number | string;
    amount: number | string;
  }>;
  upcomingDue: Array<{
    contractId: string;
    contractCode: string;
    contractName: string;
    customerName: string;
    dueDate: string;
    outstandingAmount: number | string;
  }>;
  upcomingRenewals: Array<{
    contractId: string;
    contractCode: string;
    contractName: string;
    customerName: string;
    endDate: string;
  }>;
}

interface DashboardPaymentPlanRpcResponse {
  monthStart: string;
  monthLabel: string;
  paidAmount: number | string;
  currentOutstanding: number | string;
  overdueOutstanding: number | string;
  futureOutstanding: number | string;
}

interface DashboardPaymentPlanContractRpcResponse {
  contractId: string;
  contractCode: string;
  contractName: string;
  customerName: string;
  dueDate: string;
  outstandingAmount: number | string;
}

function numberValue(value: number | string | null | undefined): number {
  return value == null ? 0 : typeof value === 'number' ? value : Number(value);
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadDashboardStatistics(
  tenantId: string,
  signal?: AbortSignal,
): Promise<DashboardStatistics> {
  assertSupabaseConfigured();

  const response = await request<DashboardStatisticsRpcResponse>(
    supabaseApi.post(
      '/rpc/get_dashboard_statistics',
      { p_tenant_id: tenantId },
      { signal },
    ),
  );

  return {
    contracts: {
      total: numberValue(response.contracts?.total),
      active: numberValue(response.contracts?.active),
      expiring: numberValue(response.contracts?.expiring),
      expired: numberValue(response.contracts?.expired),
      statusBreakdown: (response.contracts?.statusBreakdown ?? []).map(
        (item) => ({ status: item.status, count: numberValue(item.count) }),
      ),
    },
    receivables: {
      totalBilled: numberValue(response.receivables?.totalBilled),
      totalPaid: numberValue(response.receivables?.totalPaid),
      totalOutstanding: numberValue(response.receivables?.totalOutstanding),
      overdueOutstanding: numberValue(response.receivables?.overdueOutstanding),
    },
    aging: (response.aging ?? []).map((item) => ({
      bucket: item.bucket,
      count: numberValue(item.count),
      amount: numberValue(item.amount),
    })),
    upcomingDue: (response.upcomingDue ?? []).map((item) => ({
      contractId: item.contractId,
      contractCode: item.contractCode,
      contractName: item.contractName,
      customerName: item.customerName,
      dueDate: item.dueDate,
      outstandingAmount: numberValue(item.outstandingAmount),
    })),
    upcomingRenewals: (response.upcomingRenewals ?? []).map((item) => ({
      contractId: item.contractId,
      contractCode: item.contractCode,
      contractName: item.contractName,
      customerName: item.customerName,
      endDate: item.endDate,
    })),
  };
}

export async function loadDashboardPaymentPlan(
  tenantId: string,
  range: DashboardPaymentPlanRange,
  signal?: AbortSignal,
) {
  assertSupabaseConfigured();

  const response = await request<DashboardPaymentPlanRpcResponse[]>(
    supabaseApi.post(
      '/rpc/get_dashboard_payment_plan',
      {
        p_tenant_id: tenantId,
        p_from: range.from,
        p_to: range.to,
      },
      { signal },
    ),
  );

  return (response ?? []).map((item) => ({
    monthStart: item.monthStart,
    monthLabel: item.monthLabel,
    paidAmount: numberValue(item.paidAmount),
    currentOutstanding: numberValue(item.currentOutstanding),
    overdueOutstanding: numberValue(item.overdueOutstanding),
    futureOutstanding: numberValue(item.futureOutstanding),
  }));
}

export async function loadDashboardPaymentPlanContracts(
  tenantId: string,
  range: DashboardPaymentPlanRange,
  signal?: AbortSignal,
): Promise<DashboardPaymentPlanContract[]> {
  assertSupabaseConfigured();

  const response = await request<DashboardPaymentPlanContractRpcResponse[]>(
    supabaseApi.post(
      '/rpc/get_dashboard_payment_plan_contracts',
      {
        p_tenant_id: tenantId,
        p_from: range.from,
        p_to: range.to,
      },
      { signal },
    ),
  );

  return (response ?? []).map((item) => ({
    contractId: item.contractId,
    contractCode: item.contractCode,
    contractName: item.contractName,
    customerName: item.customerName,
    dueDate: item.dueDate,
    outstandingAmount: numberValue(item.outstandingAmount),
  }));
}
