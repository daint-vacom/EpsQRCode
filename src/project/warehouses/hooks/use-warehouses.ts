import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/providers/user-provider';
import {
  loadWarehouseAccountOptions,
  loadWarehouseFilterSummary,
  loadWarehouses,
  saveWarehouse,
} from '../api/warehouses.api';
import type { WarehouseFormValues } from '../model/warehouse';

export const warehouseKeys = {
  all: ['project', 'warehouses'] as const,
  list: (userId: string | null, includeInactive = false) =>
    [...warehouseKeys.all, 'list', userId, includeInactive] as const,
  accounts: () => [...warehouseKeys.all, 'account-options'] as const,
  filterSummary: (userId: string | null, search: string) =>
    [...warehouseKeys.all, 'filter-summary', userId, search] as const,
};

export function useWarehousesQuery(includeInactive = false, enabled = true) {
  const { userId } = useUser();

  return useQuery({
    queryKey: warehouseKeys.list(userId, includeInactive),
    queryFn: ({ signal }) => loadWarehouses(includeInactive, signal),
    enabled,
    retry: 0,
  });
}

export function useWarehouseFilterSummaryQuery(search: string, enabled = true) {
  const { userId } = useUser();
  return useQuery({
    queryKey: warehouseKeys.filterSummary(userId, search),
    queryFn: ({ signal }) => loadWarehouseFilterSummary(search, signal),
    enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === userId ? previousData : undefined,
    retry: 0,
  });
}

export function useWarehouseAccountOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: warehouseKeys.accounts(),
    queryFn: ({ signal }) => loadWarehouseAccountOptions(signal),
    enabled,
    retry: 0,
  });
}

export function useSaveWarehouseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string | null;
      values: WarehouseFormValues;
    }) => saveWarehouse(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
      queryClient.invalidateQueries({ queryKey: ['project', 'custodians'] });
    },
  });
}
