import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  MaterialCapitalSource,
  MaterialCapitalSourceRow,
} from '../model/material-capital-source';
import { mapMaterialCapitalSourceRow } from '../model/material-capital-source';

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadMaterialCapitalSources(
  signal?: AbortSignal,
): Promise<MaterialCapitalSource[]> {
  assertSupabaseConfigured();
  const rows = await request<MaterialCapitalSourceRow[]>(
    supabaseApi.get('/material_capital_sources', {
      params: {
        select: 'id,code,name,sort_order,is_active',
        is_active: 'eq.true',
        order: 'sort_order.asc,name.asc,id.asc',
      },
      signal,
    }),
  );
  return rows.map(mapMaterialCapitalSourceRow);
}
