import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMaterialGroup,
  deleteMaterialGroup,
  loadAvailableMaterialGroups,
  loadMaterialGroups,
  updateMaterialGroup,
  updateMaterialGroupAvailability,
} from '../api/material-groups.api';
import type {
  MaterialGroup,
  MaterialGroupFormValues,
} from '../model/material-group';

export const materialGroupKeys = {
  all: ['project', 'material-groups'] as const,
  list: () => [...materialGroupKeys.all, 'list'] as const,
  available: () => [...materialGroupKeys.all, 'available'] as const,
};

export function useMaterialGroupsQuery(enabled = true) {
  return useQuery({
    queryKey: materialGroupKeys.list(),
    queryFn: ({ signal }) => loadMaterialGroups(signal),
    enabled,
    retry: 0,
  });
}

export function useAvailableMaterialGroupsQuery(enabled = true) {
  return useQuery({
    queryKey: materialGroupKeys.available(),
    queryFn: ({ signal }) => loadAvailableMaterialGroups(signal),
    enabled,
    retry: 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateMaterialGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: MaterialGroupFormValues) =>
      createMaterialGroup(values),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: materialGroupKeys.all }),
  });
}

export function useUpdateMaterialGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: MaterialGroupFormValues;
    }) => updateMaterialGroup(id, values),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: materialGroupKeys.all }),
  });
}

export function useUpdateMaterialGroupAvailabilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateMaterialGroupAvailability(id, isActive),
    onMutate: async ({ id, isActive }) => {
      const queryKey = materialGroupKeys.list();
      await queryClient.cancelQueries({ queryKey });
      const previousIsActive = queryClient
        .getQueryData<MaterialGroup[]>(queryKey)
        ?.find((group) => group.id === id)?.isActive;
      queryClient.setQueryData<MaterialGroup[]>(queryKey, (current) =>
        current?.map((group) =>
          group.id === id ? { ...group, isActive } : group,
        ),
      );
      return { id, previousIsActive };
    },
    onSuccess: (updatedRow) => {
      queryClient.setQueryData<MaterialGroup[]>(
        materialGroupKeys.list(),
        (current) =>
          current?.map((group) =>
            group.id === updatedRow.id
              ? {
                  ...group,
                  isActive: updatedRow.is_active,
                  updatedAt: updatedRow.updated_at,
                }
              : group,
          ),
      );
    },
    onError: (_error, _variables, context) => {
      const previousIsActive = context?.previousIsActive;
      if (!context || previousIsActive === undefined) return;
      queryClient.setQueryData<MaterialGroup[]>(
        materialGroupKeys.list(),
        (current) =>
          current?.map((group) =>
            group.id === context.id
              ? { ...group, isActive: previousIsActive }
              : group,
          ),
      );
    },
  });
}

export function useDeleteMaterialGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMaterialGroup(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: materialGroupKeys.all }),
  });
}
