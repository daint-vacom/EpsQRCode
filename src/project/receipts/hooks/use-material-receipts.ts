import { warehouseStockKeys } from '@/project/warehouse-stock/hooks/use-warehouse-stock';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/providers/user-provider';
import {
  actOnMaterialReceipt,
  applyMaterialReceiptAdjustment,
  applyMaterialReceiptInlineUpdate,
  importMaterialReceiptFromExcel,
  loadAvailableMaterialReceiptRequests,
  loadMaterialReceipt,
  loadMaterialReceiptFilterSummary,
  loadMaterialReceiptHistory,
  loadMaterialReceiptItems,
  loadMaterialReceipts,
  previewMaterialReceiptAdjustment,
  previewMaterialReceiptInlineUpdate,
  saveMaterialReceipt,
  saveMaterialReceiptRepresentative,
} from '../api/material-receipts.api';
import type { MaterialReceiptExcelImportValues } from '../api/material-receipts.api';
import type { MaterialReceiptListFilters } from '../model/material-receipt';

export const materialReceiptKeys = {
  all: ['project', 'material-receipts'] as const,
  lists: () => [...materialReceiptKeys.all, 'list'] as const,
  list: (filters: MaterialReceiptListFilters) =>
    [...materialReceiptKeys.lists(), filters] as const,
  requestable: (filters: {
    search?: string;
    page?: number;
    pageSize?: number;
  }) => [...materialReceiptKeys.lists(), 'requestable', filters] as const,
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

export function useAvailableMaterialReceiptRequestsQuery(
  filters: { search?: string; page?: number; pageSize?: number } = {},
  enabled = true,
) {
  const { userId } = useUser();
  return useQuery({
    queryKey: [...materialReceiptKeys.requestable(filters), userId],
    queryFn: ({ signal }) =>
      loadAvailableMaterialReceiptRequests(filters, signal),
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
      queryClient.invalidateQueries({ queryKey: warehouseStockKeys.all });
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

export function useImportMaterialReceiptFromExcelMutation() {
  return useReceiptMutation(
    (input: {
      actorUserId: string;
      values: MaterialReceiptExcelImportValues;
    }) => importMaterialReceiptFromExcel(input.actorUserId, input.values),
  );
}

export function useSaveMaterialReceiptRepresentativeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveMaterialReceiptRepresentative,
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({
        queryKey: materialReceiptKeys.detail(input.receiptId),
      });
      queryClient.invalidateQueries({ queryKey: materialReceiptKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['project', 'materials'] });
      queryClient.invalidateQueries({ queryKey: ['project', 'handovers'] });
    },
  });
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

export function useMaterialReceiptInlineUpdatePreviewMutation() {
  return useMutation({ mutationFn: previewMaterialReceiptInlineUpdate });
}

export function useApplyMaterialReceiptInlineUpdateMutation() {
  return useReceiptMutation(applyMaterialReceiptInlineUpdate);
}
