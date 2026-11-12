import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  HandoverActionInput,
  HandoverDocument,
  HandoverFilterSummary,
  HandoverFormValues,
  HandoverHistoryEntry,
  HandoverListFilters,
  HandoverListResult,
  WarehouseHandoverSaveInput,
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

export async function loadHandoverFilterSummary(
  search = '',
  signal?: AbortSignal,
): Promise<HandoverFilterSummary> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/get_handover_filter_summary',
      { p_search: search.trim() || null },
      { signal },
    ),
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

export async function saveWarehouseHandover({
  id,
  values,
}: WarehouseHandoverSaveInput) {
  assertSupabaseConfigured();
  return request<string>(
    supabaseApi.post('/rpc/save_warehouse_handover', {
      p_id: id,
      p_values: values,
    }),
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

export async function completeHandoverOffline(input: {
  id: string;
  expectedVersion: number;
}): Promise<string> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/complete_handover_offline', {
      p_id: input.id,
      p_expected_version: input.expectedVersion,
    }),
  );
}

export interface WarehouseHandoverActionInput {
  id: string;
  action: 'send' | 'approve' | 'confirm' | 'reject' | 'cancel';
  expectedVersion: number;
  note?: string;
  itemResults?: Array<{
    materialId: string;
    outcome: 'received' | 'not_received';
    condition: 'good' | 'damaged';
    note: string;
  }>;
}

export async function actOnWarehouseHandover(
  input: WarehouseHandoverActionInput,
): Promise<string> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/act_on_warehouse_handover', {
      p_id: input.id,
      p_action: input.action,
      p_expected_version: input.expectedVersion,
      p_note: input.note ?? null,
      p_item_results: input.itemResults ?? [],
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
