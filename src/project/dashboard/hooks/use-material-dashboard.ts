import { useQuery } from '@tanstack/react-query';
import { loadMaterialDashboardSummary } from '../api/material-dashboard.api';

export const materialDashboardKeys = {
  all: ['project', 'material-dashboard'] as const,
  summary: (endMonth: string) =>
    [...materialDashboardKeys.all, 'summary', endMonth] as const,
};

export function useMaterialDashboardSummaryQuery(
  endMonth: string,
  enabled = true,
) {
  return useQuery({
    queryKey: materialDashboardKeys.summary(endMonth),
    queryFn: ({ signal }) => loadMaterialDashboardSummary(endMonth, signal),
    enabled,
    retry: 0,
  });
}
