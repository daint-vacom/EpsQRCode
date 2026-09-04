import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { loadCustomerStatusStats } from '../../customers/api/customers.api';
import { loadEmployeeStatusStats } from '../../employees/api/employees.api';
import {
  loadDashboardPaymentPlan,
  loadDashboardPaymentPlanContracts,
  loadDashboardStatistics,
} from '../api/dashboard.api';
import {
  getDashboardPaymentPlanRange,
  type DashboardPaymentPlanRange,
} from '../model/dashboard';

export function useDashboard(
  paymentPlanContractsRange?: DashboardPaymentPlanRange,
) {
  const tenantState = useTenant();
  const { hasPermission } = useUser();
  const tenantId = tenantState.tenantId;
  const canViewContracts = hasPermission('contracts:view');
  const canViewCustomers = hasPermission('customers:view');
  const canViewEmployees = hasPermission('organization:employee:view');
  const paymentPlanRange = getDashboardPaymentPlanRange();

  const dashboardQuery = useQuery({
    queryKey: ['project', 'dashboard', tenantId],
    queryFn: ({ signal }) => {
      if (!tenantId) {
        throw new Error('Chưa xác định tenant đang hoạt động.');
      }
      return loadDashboardStatistics(tenantId, signal);
    },
    enabled: Boolean(tenantId && canViewContracts),
  });

  const paymentPlanQuery = useQuery({
    queryKey: [
      'project',
      'dashboard',
      'payment-plan',
      tenantId,
      paymentPlanRange.from,
      paymentPlanRange.to,
    ],
    queryFn: ({ signal }) => {
      if (!tenantId) {
        throw new Error('Chưa xác định tenant đang hoạt động.');
      }
      return loadDashboardPaymentPlan(tenantId, paymentPlanRange, signal);
    },
    enabled: Boolean(tenantId && canViewContracts),
  });

  const paymentPlanContractsQuery = useQuery({
    queryKey: [
      'project',
      'dashboard',
      'payment-plan-contracts',
      tenantId,
      paymentPlanContractsRange?.from,
      paymentPlanContractsRange?.to,
    ],
    queryFn: ({ signal }) => {
      if (!tenantId) {
        throw new Error('Chưa xác định tenant đang hoạt động.');
      }
      if (!paymentPlanContractsRange) {
        throw new Error('Chưa chọn tháng kế hoạch thu tiền.');
      }
      return loadDashboardPaymentPlanContracts(
        tenantId,
        paymentPlanContractsRange,
        signal,
      );
    },
    enabled: Boolean(tenantId && canViewContracts && paymentPlanContractsRange),
  });

  const customerStatsQuery = useQuery({
    queryKey: ['project', 'dashboard', 'customers', tenantId],
    queryFn: ({ signal }) => {
      if (!tenantId) {
        throw new Error('Chưa xác định tenant đang hoạt động.');
      }
      return loadCustomerStatusStats(tenantId, signal);
    },
    enabled: Boolean(tenantId && canViewCustomers),
  });

  const employeeStatsQuery = useQuery({
    queryKey: ['project', 'dashboard', 'employees', tenantId],
    queryFn: ({ signal }) => {
      if (!tenantId) {
        throw new Error('Chưa xác định tenant đang hoạt động.');
      }
      return loadEmployeeStatusStats(tenantId, signal);
    },
    enabled: Boolean(tenantId && canViewEmployees),
  });

  return {
    tenantQuery: tenantState,
    dashboardQuery,
    paymentPlanQuery,
    paymentPlanContractsQuery,
    customerStatsQuery,
    employeeStatsQuery,
    canViewContracts,
    canViewCustomers,
    canViewEmployees,
    statistics: dashboardQuery.data,
    paymentPlan: paymentPlanQuery.data,
    paymentPlanContracts: paymentPlanContractsQuery.data,
    paymentPlanRange,
    customerStats: customerStatsQuery.data,
    employeeStats: employeeStatsQuery.data,
  };
}
