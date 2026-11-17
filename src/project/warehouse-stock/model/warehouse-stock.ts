export interface WarehouseStockSummaryFilters {
  mode?: 'warehouse' | 'receipt';
  search?: string;
  groupIds?: string[];
  warehouseId?: string;
  receiptId?: string;
}

export interface WarehouseStockSummary {
  total: number;
  warehouses: Record<string, number>;
  groupTotal: number;
  groupCounts: Record<string, number>;
}
