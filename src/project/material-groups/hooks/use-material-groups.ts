import { materialModelKeys } from '@/project/material-models/hooks/use-material-models';
import { materialKeys } from '@/project/materials/hooks/use-materials';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/providers/user-provider';
import {
  createMaterialGroup,
  deleteMaterialGroup,
  loadAvailableMaterialGroups,
  loadMaterialGroupById,
  loadMaterialGroupFilterSummary,
  loadMaterialGroups,
  moveMaterialGroup,
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
  filterSummary: (userId: string | null, search: string) =>
    [...materialGroupKeys.all, 'filter-summary', userId, search] as const,
  detail: (id: string) => [...materialGroupKeys.all, 'detail', id] as const,
};

export function useMaterialGroupsQuery(enabled = true) {
  return useQuery({
    queryKey: materialGroupKeys.list(),
    queryFn: ({ signal }) => loadMaterialGroups(signal),
    enabled,
    retry: 0,
  });
}

export function useMaterialGroupFilterSummaryQuery(
  search: string,
  enabled = true,
) {
  const { userId } = useUser();
  return useQuery({
    queryKey: materialGroupKeys.filterSummary(userId, search),
    queryFn: ({ signal }) => loadMaterialGroupFilterSummary(search, signal),
    enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === userId ? previousData : undefined,
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

export function useMaterialGroupQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: materialGroupKeys.detail(id),
    queryFn: ({ signal }) => loadMaterialGroupById(id, signal),
    enabled: enabled && Boolean(id),
    retry: 0,
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: materialGroupKeys.all }),
        queryClient.invalidateQueries({ queryKey: materialModelKeys.all }),
        queryClient.invalidateQueries({ queryKey: materialKeys.all }),
      ]);
    },
  });
}

export function useMoveMaterialGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      moveMaterialGroup(id, parentId),
    onMutate: async ({ id, parentId }) => {
      const queryKey = materialGroupKeys.list();
      await queryClient.cancelQueries({ queryKey });
      const previousGroups =
        queryClient.getQueryData<MaterialGroup[]>(queryKey);
      queryClient.setQueryData<MaterialGroup[]>(queryKey, (current) =>
        current?.map((group) =>
          group.id === id ? { ...group, parentId } : group,
        ),
      );
      return { previousGroups };
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousGroups) return;
      queryClient.setQueryData(
        materialGroupKeys.list(),
        context.previousGroups,
      );
    },
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: materialGroupKeys.all }),
        queryClient.invalidateQueries({ queryKey: materialModelKeys.all }),
        queryClient.invalidateQueries({ queryKey: materialKeys.all }),
      ]);
    },
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
    onSuccess: async (updatedRow) => {
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
      await queryClient.invalidateQueries({
        queryKey: [...materialGroupKeys.all, 'filter-summary'],
      });
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
