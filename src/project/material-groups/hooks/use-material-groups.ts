import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMaterialGroup,
  deleteMaterialGroup,
  loadMaterialGroups,
  updateMaterialGroup,
} from '../api/material-groups.api';
import type { MaterialGroupFormValues } from '../model/material-group';

export const materialGroupKeys = {
  all: ['project', 'material-groups'] as const,
  list: () => [...materialGroupKeys.all, 'list'] as const,
};

export function useMaterialGroupsQuery() {
  return useQuery({
    queryKey: materialGroupKeys.list(),
    queryFn: ({ signal }) => loadMaterialGroups(signal),
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: materialGroupKeys.all }),
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
