import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useUser } from '@/providers/user-provider';
import {
  applyMaterialModelSync,
  createMaterialsBulk,
  deleteMaterials,
  loadGroupedMaterials,
  loadMaterial,
  loadMaterialFilterSummary,
  loadMaterialGroupMaterialCounts,
  loadMaterialHistory,
  loadMaterialQrTrackingFilterSummary,
  loadMaterials,
  loadPublicMaterialDetail,
  previewMaterialModelSync,
  saveMaterial,
  updateMaterialAvailability,
} from '../api/materials.api';
import type {
  ApplyMaterialModelSyncInput,
  Material,
  MaterialFilterSummary,
  MaterialGroupedListResult,
  MaterialGroupingConfig,
  MaterialGroupMaterialCounts,
  MaterialListFilters,
  MaterialPublicDetail,
  SaveMaterialInput,
} from '../model/material';

export const materialKeys = {
  all: ['project', 'materials'] as const,
  lists: () => [...materialKeys.all, 'list'] as const,
  list: (filters: MaterialListFilters) =>
    [...materialKeys.lists(), filters] as const,
  filterSummary: (
    userId: string | null,
    filters: Pick<MaterialListFilters, 'search' | 'status' | 'groupIds'>,
  ) => [...materialKeys.all, 'filter-summary', userId, filters] as const,
  groupMaterialCounts: (userId: string | null) =>
    [...materialKeys.all, 'group-material-counts', userId] as const,
  qrFilterSummary: (
    userId: string | null,
    filters: Pick<MaterialListFilters, 'search' | 'status' | 'ownerPartyId'>,
  ) => [...materialKeys.all, 'qr-filter-summary', userId, filters] as const,
  select: (
    filters: Omit<MaterialListFilters, 'search' | 'page' | 'pageSize'>,
  ) => [...materialKeys.all, 'select', filters] as const,
  detail: (id: string) => [...materialKeys.all, 'detail', id] as const,
  publicDetail: (id: string) =>
    [...materialKeys.all, 'public-detail', id] as const,
  history: (id: string) => [...materialKeys.all, 'history', id] as const,
  syncPreview: (id: string) =>
    [...materialKeys.all, 'sync-preview', id] as const,
};

export function useMaterialFilterSummaryQuery(
  filters: Pick<MaterialListFilters, 'search' | 'status' | 'groupIds'> = {},
  enabled = true,
) {
  const { userId } = useUser();

  return useQuery<MaterialFilterSummary>({
    queryKey: materialKeys.filterSummary(userId, filters),
    queryFn: ({ signal }) => loadMaterialFilterSummary(filters, signal),
    enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === userId ? previousData : undefined,
    retry: 0,
  });
}

export function useMaterialGroupMaterialCountsQuery(enabled = true) {
  const { userId, hasPermission } = useUser();

  return useQuery<MaterialGroupMaterialCounts>({
    queryKey: materialKeys.groupMaterialCounts(userId),
    queryFn: ({ signal }) => loadMaterialGroupMaterialCounts(signal),
    enabled: enabled && hasPermission('materials:material:view'),
    retry: 0,
  });
}

export function useMaterialQrTrackingFilterSummaryQuery(
  filters: Pick<
    MaterialListFilters,
    'search' | 'status' | 'ownerPartyId' | 'groupIds'
  > = {},
  enabled = true,
) {
  const { userId } = useUser();

  return useQuery<MaterialFilterSummary>({
    queryKey: materialKeys.qrFilterSummary(userId, filters),
    queryFn: ({ signal }) =>
      loadMaterialQrTrackingFilterSummary(filters, signal),
    enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === userId ? previousData : undefined,
    retry: 0,
  });
}

export function useMaterialsQuery(
  filters: MaterialListFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: materialKeys.list(filters),
    queryFn: ({ signal }) => loadMaterials(filters, signal),
    enabled,
    retry: 0,
  });
}

export function useGroupedMaterialsQuery(
  filters: Omit<
    MaterialListFilters,
    'page' | 'pageSize' | 'groupBy' | 'groupPage' | 'groupPageSize'
  >,
  config: MaterialGroupingConfig,
  page: number,
  pageSize: number,
  enabled = true,
) {
  const { userId } = useUser();
  const groupedFilters: MaterialListFilters = {
    ...filters,
    groupBy: config,
    groupPage: page,
    groupPageSize: pageSize,
  };
  return useQuery<MaterialGroupedListResult>({
    queryKey: [...materialKeys.all, 'grouped-list', userId, groupedFilters],
    queryFn: ({ signal }) => loadGroupedMaterials(groupedFilters, signal),
    enabled,
    retry: 0,
  });
}

export function useMaterialQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: materialKeys.detail(id),
    queryFn: ({ signal }) => loadMaterial(id, signal),
    enabled: Boolean(id) && enabled,
    retry: 0,
  });
}

export function usePublicMaterialDetailQuery(id: string, enabled = true) {
  return useQuery<MaterialPublicDetail | null>({
    queryKey: materialKeys.publicDetail(id),
    queryFn: ({ signal }) => loadPublicMaterialDetail(id, signal),
    enabled: Boolean(id) && enabled,
    retry: 0,
  });
}
export function useMaterialsByIdsQuery(ids: string[], enabled = true) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: materialKeys.detail(id),
      queryFn: ({ signal }) => loadMaterial(id, signal),
      enabled: Boolean(id) && enabled,
      retry: 0,
    })),
  });
}

export function useMaterialHistoryQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: materialKeys.history(id),
    queryFn: ({ signal }) => loadMaterialHistory(id, signal),
    enabled: Boolean(id) && enabled,
    retry: 0,
  });
}

export function useSaveMaterialMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      expectedVersion,
      values,
      images,
      previousImages,
      publicDisplaySettings,
      publicSpecificationSettings,
    }: SaveMaterialInput) =>
      saveMaterial(
        id,
        expectedVersion,
        values,
        images,
        previousImages,
        publicDisplaySettings,
        publicSpecificationSettings,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: materialKeys.all }),
  });
}

export function useCreateMaterialsBulkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMaterialsBulk,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: materialKeys.all }),
  });
}
export function useUpdateMaterialAvailabilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateMaterialAvailability(id, isActive),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: materialKeys.lists() });
      const previousLists = queryClient.getQueriesData<{
        items: Material[];
        total: number;
        page: number;
        pageSize: number;
      }>({ queryKey: materialKeys.lists() });
      queryClient.setQueriesData<{
        items: Material[];
        total: number;
        page: number;
        pageSize: number;
      }>({ queryKey: materialKeys.lists() }, (current) =>
        current
          ? {
              ...current,
              items: current.items.map((material) =>
                material.id === id ? { ...material, isActive } : material,
              ),
            }
          : current,
      );
      return { previousLists };
    },
    onError: (_error, _variables, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSuccess: (result) => {
      queryClient.setQueriesData<{
        items: Material[];
        total: number;
        page: number;
        pageSize: number;
      }>({ queryKey: materialKeys.lists() }, (current) =>
        current
          ? {
              ...current,
              items: current.items.map((material) =>
                material.id === result.id
                  ? {
                      ...material,
                      isActive: result.isActive,
                      updatedAt: result.updatedAt,
                      version: result.version,
                    }
                  : material,
              ),
            }
          : current,
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: materialKeys.all }),
  });
}

export function useDeleteMaterialMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (materials: Material[]) => deleteMaterials(materials),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: materialKeys.all }),
  });
}

export function usePreviewMaterialModelSyncQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: materialKeys.syncPreview(id),
    queryFn: () => previewMaterialModelSync(id),
    enabled: Boolean(id) && enabled,
    retry: 0,
  });
}

export function useApplyMaterialModelSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      expectedVersion,
      expectedModelUpdatedAt,
    }: ApplyMaterialModelSyncInput) =>
      applyMaterialModelSync(id, expectedVersion, expectedModelUpdatedAt),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: materialKeys.all });
      queryClient.invalidateQueries({
        queryKey: materialKeys.detail(variables.id),
      });
    },
  });
}
