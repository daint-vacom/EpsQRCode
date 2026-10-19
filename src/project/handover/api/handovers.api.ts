import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  HandoverActionInput,
  HandoverDocument,
  HandoverFormValues,
  HandoverHistoryEntry,
  HandoverListFilters,
  HandoverListResult,
} from '../model/handover';

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadHandovers(
  filters: HandoverListFilters = {},
  signal?: AbortSignal,
): Promise<HandoverListResult> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/list_handovers', { p_filters: filters }, { signal }),
  );
}

export async function loadHandover(id: string): Promise<HandoverDocument> {
  assertSupabaseConfigured();
  return request(supabaseApi.post('/rpc/get_handover', { p_id: id }));
}

export async function saveHandover(
  id: string | null,
  values: HandoverFormValues,
): Promise<string> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/save_handover', { p_id: id, p_values: values }),
  );
}

export async function actOnHandover(
  input: HandoverActionInput,
): Promise<string> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/act_on_handover', {
      p_id: input.id,
      p_action: input.action,
      p_expected_version: input.expectedVersion,
      p_note: input.note ?? null,
      p_item_conditions: input.itemConditions ?? [],
    }),
  );
}

export async function loadHandoverHistory(
  id: string,
  signal?: AbortSignal,
): Promise<HandoverHistoryEntry[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_handover_history',
      { p_handover_id: id },
      { signal },
    ),
  );
}
