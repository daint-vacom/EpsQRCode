import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import {
  EMPTY_GLOBAL_SEARCH_RESULT,
  GLOBAL_SEARCH_LIMIT_PER_SOURCE,
  type GlobalSearchResult,
} from '../model/global-search';

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadGlobalSearch(
  tenantId: string,
  query: string,
  signal?: AbortSignal,
): Promise<GlobalSearchResult> {
  assertSupabaseConfigured();

  const response = await request<Partial<GlobalSearchResult>>(
    supabaseApi.post(
      '/rpc/global_search',
      {
        p_tenant_id: tenantId,
        p_query: query.trim(),
        p_limit_per_source: GLOBAL_SEARCH_LIMIT_PER_SOURCE,
      },
      { signal },
    ),
  );

  return {
    customers: response.customers ?? EMPTY_GLOBAL_SEARCH_RESULT.customers,
    contracts: response.contracts ?? EMPTY_GLOBAL_SEARCH_RESULT.contracts,
    contractTemplates:
      response.contractTemplates ??
      EMPTY_GLOBAL_SEARCH_RESULT.contractTemplates,
    employees: response.employees ?? EMPTY_GLOBAL_SEARCH_RESULT.employees,
  };
}
