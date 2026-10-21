import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  MaterialReceipt,
  MaterialReceiptAdjustmentPreview,
  MaterialReceiptHistoryEntry,
  MaterialReceiptItemsResult,
  MaterialReceiptLineInput,
  MaterialReceiptListFilters,
  MaterialReceiptListResult,
} from '../model/material-receipt';

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadMaterialReceipts(
  filters: MaterialReceiptListFilters = {},
  signal?: AbortSignal,
) {
  assertSupabaseConfigured();
  return request<MaterialReceiptListResult>(
    supabaseApi.post(
      '/rpc/list_material_receipts',
      { p_filters: filters },
      { signal },
    ),
  );
}

export async function loadMaterialReceipt(id: string, signal?: AbortSignal) {
  assertSupabaseConfigured();
  return request<MaterialReceipt>(
    supabaseApi.post('/rpc/get_material_receipt', { p_id: id }, { signal }),
  );
}

export async function saveMaterialReceipt(
  id: string | null,
  values: {
    warehouseId: string;
    note: string;
    expectedVersion?: number;
    lines: MaterialReceiptLineInput[];
  },
) {
  assertSupabaseConfigured();
  return request<string>(
    supabaseApi.post('/rpc/save_material_receipt', {
      p_id: id,
      p_values: values,
    }),
  );
}

export async function actOnMaterialReceipt(input: {
  id: string;
  action: 'confirm' | 'complete' | 'reopen' | 'cancel';
  expectedVersion: number;
  reason?: string;
}) {
  assertSupabaseConfigured();
  return request<string>(
    supabaseApi.post('/rpc/act_material_receipt', {
      p_id: input.id,
      p_action: input.action,
      p_expected_version: input.expectedVersion,
      p_reason: input.reason ?? null,
    }),
  );
}

export async function loadMaterialReceiptHistory(
  id: string,
  signal?: AbortSignal,
) {
  assertSupabaseConfigured();
  return request<MaterialReceiptHistoryEntry[]>(
    supabaseApi.post(
      '/rpc/list_material_receipt_history',
      { p_receipt_id: id },
      { signal },
    ),
  );
}

export async function loadMaterialReceiptItems(
  id: string,
  filters: { page: number; pageSize: number; status?: string; search?: string },
  signal?: AbortSignal,
) {
  assertSupabaseConfigured();
  return request<MaterialReceiptItemsResult>(
    supabaseApi.post(
      '/rpc/list_material_receipt_items',
      {
        p_receipt_id: id,
        p_filters: filters,
      },
      { signal },
    ),
  );
}

export async function previewMaterialReceiptAdjustment(input: {
  id: string;
  expectedVersion: number;
  lines: MaterialReceiptLineInput[];
}) {
  assertSupabaseConfigured();
  return request<MaterialReceiptAdjustmentPreview>(
    supabaseApi.post('/rpc/preview_material_receipt_adjustment', {
      p_id: input.id,
      p_expected_version: input.expectedVersion,
      p_lines: input.lines,
    }),
  );
}

export async function applyMaterialReceiptAdjustment(input: {
  id: string;
  expectedVersion: number;
  previewToken: string;
  lines: MaterialReceiptLineInput[];
  reason: string;
  cancelHandoverIds: string[];
}) {
  assertSupabaseConfigured();
  return request<string>(
    supabaseApi.post('/rpc/apply_material_receipt_adjustment', {
      p_id: input.id,
      p_expected_version: input.expectedVersion,
      p_preview_token: input.previewToken,
      p_lines: input.lines,
      p_reason: input.reason,
      p_cancel_handover_ids: input.cancelHandoverIds,
    }),
  );
}
