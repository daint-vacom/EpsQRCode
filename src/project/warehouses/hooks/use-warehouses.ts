import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadWarehouseAccountOptions,
  loadWarehouses,
  saveWarehouse,
} from '../api/warehouses.api';
import type { WarehouseFormValues } from '../model/warehouse';

export const warehouseKeys = {
  all: ['project', 'warehouses'] as const,
  list: (includeInactive = false) =>
    [...warehouseKeys.all, 'list', includeInactive] as const,
  accounts: () => [...warehouseKeys.all, 'account-options'] as const,
};

export function useWarehousesQuery(includeInactive = false, enabled = true) {
  return useQuery({
    queryKey: warehouseKeys.list(includeInactive),
    queryFn: ({ signal }) => loadWarehouses(includeInactive, signal),
    enabled,
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
