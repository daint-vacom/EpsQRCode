import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMaterialModel,
  deleteMaterialModel,
  loadMaterialModels,
  updateMaterialModel,
  updateMaterialModelAvailability,
} from '../api/material-models.api';
import type {
  MaterialModel,
  MaterialModelFormValues,
} from '../model/material-model';

export const materialModelKeys = {
  all: ['project', 'material-models'] as const,
  list: () => [...materialModelKeys.all, 'list'] as const,
};

export function useMaterialModelsQuery(enabled = true) {
  return useQuery({
    queryKey: materialModelKeys.list(),
    queryFn: ({ signal }) => loadMaterialModels(signal),
    enabled,
    retry: 0,
  });
}

export function useCreateMaterialModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: MaterialModelFormValues) =>
      createMaterialModel(values),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: materialModelKeys.all }),
  });
}

export function useUpdateMaterialModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: MaterialModelFormValues;
    }) => updateMaterialModel(id, values),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: materialModelKeys.all }),
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
    onSuccess: (updatedRow) => {
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
