import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  Warehouse,
  WarehouseAccountOption,
  WarehouseFormValues,
} from '../model/warehouse';

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadWarehouses(
  includeInactive = false,
  signal?: AbortSignal,
): Promise<Warehouse[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_material_warehouses',
      { p_include_inactive: includeInactive },
      { signal },
    ),
  );
}

export async function saveWarehouse(
  id: string | null,
  values: WarehouseFormValues,
): Promise<string> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/save_material_warehouse', {
      p_id: id,
      p_values: values,
    }),
  );
}

export async function loadWarehouseAccountOptions(
  signal?: AbortSignal,
): Promise<WarehouseAccountOption[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/list_custodian_account_options', {}, { signal }),
  );
}
