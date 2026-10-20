import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyMaterialModelSync,
  loadMaterial,
  loadMaterialHistory,
  loadMaterials,
  previewMaterialModelSync,
  saveMaterial,
} from '../api/materials.api';
import type {
  ApplyMaterialModelSyncInput,
  MaterialListFilters,
  SaveMaterialInput,
} from '../model/material';

export const materialKeys = {
  all: ['project', 'materials'] as const,
  lists: () => [...materialKeys.all, 'list'] as const,
  list: (filters: MaterialListFilters) =>
    [...materialKeys.lists(), filters] as const,
  select: (
    filters: Omit<MaterialListFilters, 'search' | 'page' | 'pageSize'>,
  ) => [...materialKeys.all, 'select', filters] as const,
  detail: (id: string) => [...materialKeys.all, 'detail', id] as const,
  history: (id: string) => [...materialKeys.all, 'history', id] as const,
  syncPreview: (id: string) =>
    [...materialKeys.all, 'sync-preview', id] as const,
};

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

export function useMaterialQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: materialKeys.detail(id),
    queryFn: () => loadMaterial(id),
    enabled: Boolean(id) && enabled,
    retry: 0,
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
    }: SaveMaterialInput) =>
      saveMaterial(id, expectedVersion, values, images, previousImages),
    onSuccess: () =>
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
