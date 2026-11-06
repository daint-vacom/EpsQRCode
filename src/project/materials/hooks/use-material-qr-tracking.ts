import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadMaterialQrTrackingMetrics,
  recordMaterialQrScan,
} from '../api/materials.api';

export const materialQrTrackingKeys = {
  all: ['project', 'material-qr-tracking'] as const,
  metrics: (materialIds: string[]) =>
    [
      ...materialQrTrackingKeys.all,
      'metrics',
      [...materialIds].sort(),
    ] as const,
};

export function useMaterialQrTrackingMetricsQuery(
  materialIds: string[],
  enabled = true,
) {
  return useQuery({
    queryKey: materialQrTrackingKeys.metrics(materialIds),
    queryFn: ({ signal }) => loadMaterialQrTrackingMetrics(materialIds, signal),
    enabled: enabled && materialIds.length > 0,
    retry: 0,
  });
}

export function useRecordMaterialQrScanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (materialId: string) => recordMaterialQrScan(materialId),
    retry: 2,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: materialQrTrackingKeys.all,
      }),
  });
}
