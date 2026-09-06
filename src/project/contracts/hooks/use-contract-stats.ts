import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/providers/tenant-provider';
import { loadDashboardPaymentPlan } from '../../dashboard/api/dashboard.api';
import { getDashboardPaymentPlanRange } from '../../dashboard/model/dashboard';
import { loadContractStatusStats } from '../api/contracts.api';

export function useContractStats({
  expiringWithinDays = 30,
}: {
  expiringWithinDays?: number;
} = {}) {
  const { tenantId } = useTenant();
  const paymentPlanRange = getDashboardPaymentPlanRange();

  const statusQuery = useQuery({
    queryKey: [
      'project',
      'contracts',
      'statistics',
      tenantId,
      expiringWithinDays,
    ],
    queryFn: ({ signal }) => {
      if (!tenantId) {
        throw new Error('Chưa xác định tenant đang hoạt động.');
      }
      return loadContractStatusStats({ tenantId, expiringWithinDays }, signal);
    },
    enabled: Boolean(tenantId),
  });

  const paymentPlanQuery = useQuery({
    queryKey: [
      'project',
      'contracts',
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
    enabled: Boolean(tenantId),
  });

  return {
    statusQuery,
    paymentPlanQuery,
    paymentPlanRange,
    statusStats: statusQuery.data,
    paymentPlan: paymentPlanQuery.data,
  };
}
