import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actOnHandover,
  actOnWarehouseHandover,
  completeHandoverOffline,
  loadHandover,
  loadHandoverHistory,
  loadHandovers,
  saveHandover,
  saveWarehouseHandover,
} from '../api/handovers.api';
import type {
  HandoverFormValues,
  HandoverListFilters,
} from '../model/handover';

export const handoverKeys = {
  all: ['project', 'handovers'] as const,
  lists: () => [...handoverKeys.all, 'list'] as const,
  list: (filters: HandoverListFilters) =>
    [...handoverKeys.lists(), filters] as const,
  detail: (id: string) => [...handoverKeys.all, 'detail', id] as const,
  history: (id: string) => [...handoverKeys.all, 'history', id] as const,
};

export function useHandoversQuery(
  filters: HandoverListFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: handoverKeys.list(filters),
    queryFn: ({ signal }) => loadHandovers(filters, signal),
    enabled,
    retry: 0,
  });
}

export function useHandoverQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: handoverKeys.detail(id),
    queryFn: () => loadHandover(id),
    enabled: Boolean(id) && enabled,
    retry: 0,
  });
}

export function useHandoverHistoryQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: handoverKeys.history(id),
    queryFn: ({ signal }) => loadHandoverHistory(id, signal),
    enabled: Boolean(id) && enabled,
    retry: 0,
  });
}

export function useSaveHandoverMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string | null;
      values: HandoverFormValues;
    }) => saveHandover(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: handoverKeys.all });
      queryClient.invalidateQueries({ queryKey: ['project', 'materials'] });
    },
  });
}

export function useSaveWarehouseHandoverMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveWarehouseHandover,
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: handoverKeys.all });
      queryClient.invalidateQueries({ queryKey: ['project', 'materials'] });
      queryClient.invalidateQueries({
        queryKey: ['project', 'material-receipts'],
      });
      if (input.id)
        queryClient.invalidateQueries({
          queryKey: handoverKeys.detail(input.id),
        });
    },
  });
}

export function useHandoverActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: actOnHandover,
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: handoverKeys.all });
      queryClient.invalidateQueries({ queryKey: ['project', 'materials'] });
      queryClient.invalidateQueries({
        queryKey: handoverKeys.detail(input.id),
      });
      queryClient.invalidateQueries({
        queryKey: handoverKeys.history(input.id),
      });
    },
  });
}

export function useCompleteHandoverOfflineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeHandoverOffline,
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: handoverKeys.all });
      queryClient.invalidateQueries({ queryKey: ['project', 'materials'] });
      queryClient.invalidateQueries({
        queryKey: handoverKeys.detail(input.id),
      });
      queryClient.invalidateQueries({
        queryKey: handoverKeys.history(input.id),
      });
    },
  });
}

export function useWarehouseHandoverActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: actOnWarehouseHandover,
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: handoverKeys.all });
      queryClient.invalidateQueries({ queryKey: ['project', 'materials'] });
      queryClient.invalidateQueries({
        queryKey: handoverKeys.detail(input.id),
      });
      queryClient.invalidateQueries({
        queryKey: handoverKeys.history(input.id),
      });
      queryClient.invalidateQueries({
        queryKey: ['project', 'material-receipts'],
      });
    },
  });
}
