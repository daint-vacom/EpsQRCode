import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/providers/user-provider';
import {
  actOnMaterialReceipt,
  applyMaterialReceiptAdjustment,
  loadMaterialReceipt,
  loadMaterialReceiptFilterSummary,
  loadMaterialReceiptHistory,
  loadMaterialReceiptItems,
  loadMaterialReceipts,
  previewMaterialReceiptAdjustment,
  saveMaterialReceipt,
} from '../api/material-receipts.api';
import type { MaterialReceiptListFilters } from '../model/material-receipt';

export const materialReceiptKeys = {
  all: ['project', 'material-receipts'] as const,
  lists: () => [...materialReceiptKeys.all, 'list'] as const,
  list: (filters: MaterialReceiptListFilters) =>
    [...materialReceiptKeys.lists(), filters] as const,
  summary: (
    userId: string | null,
    filters: { search?: string; warehouseId?: string },
  ) => [...materialReceiptKeys.all, 'filter-summary', userId, filters] as const,
  detail: (id: string) => [...materialReceiptKeys.all, 'detail', id] as const,
  history: (id: string) => [...materialReceiptKeys.all, 'history', id] as const,
};

export function useMaterialReceiptsQuery(
  filters: MaterialReceiptListFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: materialReceiptKeys.list(filters),
    queryFn: ({ signal }) => loadMaterialReceipts(filters, signal),
    enabled,
    retry: 0,
  });
}

export function useMaterialReceiptFilterSummaryQuery(
  filters: { search?: string; warehouseId?: string },
  enabled = true,
) {
  const { userId } = useUser();
  return useQuery({
    queryKey: materialReceiptKeys.summary(userId, filters),
    queryFn: ({ signal }) => loadMaterialReceiptFilterSummary(filters, signal),
    enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === userId ? previousData : undefined,
    retry: 0,
  });
}

export function useMaterialReceiptQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: materialReceiptKeys.detail(id),
    queryFn: ({ signal }) => loadMaterialReceipt(id, signal),
    enabled: Boolean(id) && enabled,
    retry: 0,
  });
}

export function useMaterialReceiptHistoryQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: materialReceiptKeys.history(id),
    queryFn: ({ signal }) => loadMaterialReceiptHistory(id, signal),
    enabled: Boolean(id) && enabled,
    retry: 0,
  });
}

export function useMaterialReceiptItemsQuery(
  id: string,
  filters: { page: number; pageSize: number; status?: string; search?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: [...materialReceiptKeys.detail(id), 'items', filters],
    queryFn: ({ signal }) => loadMaterialReceiptItems(id, filters, signal),
    enabled: Boolean(id) && enabled,
    retry: 0,
  });
}

function useReceiptMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: materialReceiptKeys.all });
      queryClient.invalidateQueries({ queryKey: ['project', 'materials'] });
      queryClient.invalidateQueries({ queryKey: ['project', 'handovers'] });
      const id = (input as { id?: string }).id;
      if (id) {
        queryClient.invalidateQueries({
          queryKey: materialReceiptKeys.detail(id),
        });
        queryClient.invalidateQueries({
          queryKey: materialReceiptKeys.history(id),
        });
      }
    },
  });
}

export function useSaveMaterialReceiptMutation() {
  return useReceiptMutation(
    (input: {
      id: string | null;
      values: Parameters<typeof saveMaterialReceipt>[1];
    }) => saveMaterialReceipt(input.id, input.values),
  );
}

export function useMaterialReceiptActionMutation() {
  return useReceiptMutation(actOnMaterialReceipt);
}

export function useMaterialReceiptAdjustmentPreviewMutation() {
  return useMutation({ mutationFn: previewMaterialReceiptAdjustment });
}

export function useApplyMaterialReceiptAdjustmentMutation() {
  return useReceiptMutation(applyMaterialReceiptAdjustment);
}
