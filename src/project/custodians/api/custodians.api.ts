import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type { Custodian, CustodianFormValues } from '../model/custodian';

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadCustodians(
  includeInactive = false,
  signal?: AbortSignal,
): Promise<Custodian[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_custodians',
      { p_include_inactive: includeInactive },
      { signal },
    ),
  );
}

export async function saveCustodian(
  id: string | null,
  values: CustodianFormValues,
): Promise<string> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/save_custodian', { p_id: id, p_values: values }),
  );
}

export interface CustodianAccountOption {
  id: string;
  username: string | null;
  displayName: string;
}

export async function loadCustodianAccountOptions(
  signal?: AbortSignal,
): Promise<CustodianAccountOption[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/list_custodian_account_options', {}, { signal }),
  );
}
