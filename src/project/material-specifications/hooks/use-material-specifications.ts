import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/providers/user-provider';
import {
  createMaterialSpecification,
  deleteMaterialSpecification,
  loadMaterialSpecificationFilterSummary,
  loadMaterialSpecifications,
  updateMaterialSpecification,
} from '../api/material-specifications.api';
import type { MaterialSpecificationFormValues } from '../model/material-specification';

export const materialSpecificationKeys = {
  all: ['project', 'material-specifications'] as const,
  list: () => [...materialSpecificationKeys.all, 'list'] as const,
  filterSummary: (userId: string | null, search: string) =>
    [
      ...materialSpecificationKeys.all,
      'filter-summary',
      userId,
      search,
    ] as const,
};

export function useMaterialSpecificationsQuery(enabled = true) {
  return useQuery({
    queryKey: materialSpecificationKeys.list(),
    queryFn: ({ signal }) => loadMaterialSpecifications(signal),
    enabled,
    retry: 0,
  });
}

export function useMaterialSpecificationFilterSummaryQuery(
  search: string,
  enabled = true,
) {
  const { userId } = useUser();
  return useQuery({
    queryKey: materialSpecificationKeys.filterSummary(userId, search),
    queryFn: ({ signal }) =>
      loadMaterialSpecificationFilterSummary(search, signal),
    enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === userId ? previousData : undefined,
    retry: 0,
  });
}

export function useCreateMaterialSpecificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: MaterialSpecificationFormValues) =>
      createMaterialSpecification(values),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: materialSpecificationKeys.all,
      }),
  });
}

export function useUpdateMaterialSpecificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: MaterialSpecificationFormValues;
    }) => updateMaterialSpecification(id, values),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: materialSpecificationKeys.all,
      }),
  });
}

export function useDeleteMaterialSpecificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMaterialSpecification(id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: materialSpecificationKeys.all,
      }),
  });
}
