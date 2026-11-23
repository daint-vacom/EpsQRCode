import { materialKeys } from '@/project/materials/hooks/use-materials';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/providers/user-provider';
import {
  createMaterialModel,
  createMaterialModelsBulk,
  deleteMaterialModel,
  loadMaterialGroupModelCounts,
  loadMaterialModelFilterSummary,
  loadMaterialModels,
  updateMaterialModel,
  updateMaterialModelAvailability,
  updateMaterialModelLinkedCodes,
} from '../api/material-models.api';
import type {
  MaterialGroupModelCounts,
  MaterialModel,
  MaterialModelFormValues,
  MaterialModelImage,
  MaterialModelImageDraft,
  MaterialPublicDisplaySettings,
} from '../model/material-model';

export const materialModelKeys = {
  all: ['project', 'material-models'] as const,
  list: () => [...materialModelKeys.all, 'list'] as const,
  groupCounts: (userId: string | null) =>
    [...materialModelKeys.all, 'group-counts', userId] as const,
  filterSummary: (
    userId: string | null,
    filters: { search?: string; groupId?: string; groupIds?: string[] },
  ) => [...materialModelKeys.all, 'filter-summary', userId, filters] as const,
};

export function useMaterialModelsQuery(enabled = true) {
  return useQuery({
    queryKey: materialModelKeys.list(),
    queryFn: ({ signal }) => loadMaterialModels(signal),
    enabled,
    retry: 0,
  });
}

export function useMaterialGroupModelCountsQuery(enabled = true) {
  const { userId } = useUser();

  return useQuery<MaterialGroupModelCounts>({
    queryKey: materialModelKeys.groupCounts(userId),
    queryFn: ({ signal }) => loadMaterialGroupModelCounts(signal),
    enabled,
    retry: 0,
  });
}

export function useMaterialModelFilterSummaryQuery(
  filters: { search?: string; groupId?: string; groupIds?: string[] } = {},
  enabled = true,
) {
  const { userId } = useUser();
  return useQuery({
    queryKey: materialModelKeys.filterSummary(userId, filters),
    queryFn: ({ signal }) => loadMaterialModelFilterSummary(filters, signal),
    enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === userId ? previousData : undefined,
    retry: 0,
  });
}

export function useCreateMaterialModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      values,
      images,
      publicDisplaySettings,
    }: {
      values: MaterialModelFormValues;
      images: MaterialModelImageDraft[];
      publicDisplaySettings: MaterialPublicDisplaySettings;
    }) => createMaterialModel(values, images, publicDisplaySettings),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: materialModelKeys.all }),
  });
}

export function useCreateMaterialModelsBulkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMaterialModelsBulk,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: materialModelKeys.all,
        refetchType: 'none',
      }),
  });
}

export function useUpdateMaterialModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      values,
      images,
      previousImages,
      publicDisplaySettings,
    }: {
      id: string;
      values: MaterialModelFormValues;
      images: MaterialModelImageDraft[];
      previousImages: MaterialModelImage[];
      publicDisplaySettings: MaterialPublicDisplaySettings;
    }) =>
      updateMaterialModel(
        id,
        values,
        images,
        previousImages,
        publicDisplaySettings,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: materialModelKeys.all }),
        queryClient.invalidateQueries({ queryKey: materialKeys.all }),
      ]);
    },
  });
}

export function useUpdateMaterialModelLinkedCodesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      linkedCodes,
    }: {
      id: string;
      linkedCodes: MaterialModelFormValues['linkedCodes'];
    }) => updateMaterialModelLinkedCodes(id, linkedCodes),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: materialModelKeys.all }),
        queryClient.invalidateQueries({ queryKey: materialKeys.all }),
      ]);
    },
  });
}

export function useUpdateMaterialModelAvailabilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateMaterialModelAvailability(id, isActive),
    onMutate: async ({ id, isActive }) => {
      const queryKey = materialModelKeys.list();
      await queryClient.cancelQueries({ queryKey });
      const previousIsActive = queryClient
        .getQueryData<MaterialModel[]>(queryKey)
        ?.find((model) => model.id === id)?.isActive;
      queryClient.setQueryData<MaterialModel[]>(queryKey, (current) =>
        current?.map((model) =>
          model.id === id ? { ...model, isActive } : model,
        ),
      );
      return { id, previousIsActive };
    },
    onSuccess: async (updatedRow) => {
      queryClient.setQueryData<MaterialModel[]>(
        materialModelKeys.list(),
        (current) =>
          current?.map((model) =>
            model.id === updatedRow.id
              ? {
                  ...model,
                  isActive: updatedRow.is_active,
                  updatedAt: updatedRow.updated_at,
                }
              : model,
          ),
      );
      await queryClient.invalidateQueries({
        queryKey: [...materialModelKeys.all, 'filter-summary'],
      });
    },
    onError: (_error, _variables, context) => {
      if (!context || context.previousIsActive === undefined) return;
      queryClient.setQueryData<MaterialModel[]>(
        materialModelKeys.list(),
        (current) =>
          current?.map((model) =>
            model.id === context.id
              ? { ...model, isActive: context.previousIsActive! }
              : model,
          ),
      );
    },
  });
}

export function useDeleteMaterialModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMaterialModel(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: materialModelKeys.all }),
  });
}
