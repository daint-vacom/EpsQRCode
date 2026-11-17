import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  WarehouseStockSummary,
  WarehouseStockSummaryFilters,
} from '../model/warehouse-stock';

export async function loadWarehouseStockSummary(
  filters: WarehouseStockSummaryFilters,
  signal?: AbortSignal,
): Promise<WarehouseStockSummary> {
  assertSupabaseConfigured();
  return (await supabaseApi.post(
    '/rpc/get_warehouse_stock_summary',
    { p_filters: filters },
    { signal },
  )) as WarehouseStockSummary;
}

export async function loadWarehouseStockReceiptCodes(
  materialIds: string[],
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  assertSupabaseConfigured();
  if (materialIds.length === 0) return {};
  return (await supabaseApi.post(
    '/rpc/get_warehouse_stock_receipt_codes',
    { p_material_ids: materialIds },
    { signal },
  )) as Record<string, string>;
}
