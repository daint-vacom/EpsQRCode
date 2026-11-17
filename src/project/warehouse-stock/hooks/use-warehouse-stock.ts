import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/providers/user-provider';
import {
  loadWarehouseStockReceiptCodes,
  loadWarehouseStockSummary,
} from '../api/warehouse-stock.api';
import type { WarehouseStockSummaryFilters } from '../model/warehouse-stock';

export const warehouseStockKeys = {
  all: ['project', 'warehouse-stock'] as const,
  summary: (userId: string | null, filters: WarehouseStockSummaryFilters) =>
    [...warehouseStockKeys.all, 'summary', userId, filters] as const,
};

export function useWarehouseStockSummaryQuery(
  filters: WarehouseStockSummaryFilters,
  enabled = true,
) {
  const { userId } = useUser();

  return useQuery({
    queryKey: warehouseStockKeys.summary(userId, filters),
    queryFn: ({ signal }) => loadWarehouseStockSummary(filters, signal),
    enabled,
    retry: 0,
  });
}

export function useWarehouseStockReceiptCodesQuery(
  materialIds: string[],
  enabled = true,
) {
  return useQuery({
    queryKey: [...warehouseStockKeys.all, 'receipt-codes', materialIds],
    queryFn: ({ signal }) =>
      loadWarehouseStockReceiptCodes(materialIds, signal),
    enabled: enabled && materialIds.length > 0,
    retry: 0,
  });
}
