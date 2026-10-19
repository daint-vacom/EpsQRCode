import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  Material,
  MaterialFormValues,
  MaterialHistoryEntry,
  MaterialListFilters,
  MaterialListResult,
  MaterialModelSyncPreview,
} from '../model/material';

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadMaterials(
  filters: MaterialListFilters = {},
  signal?: AbortSignal,
): Promise<MaterialListResult> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/list_materials', { p_filters: filters }, { signal }),
  );
}

export async function loadMaterial(id: string): Promise<Material> {
  assertSupabaseConfigured();
  return request(supabaseApi.post('/rpc/get_material', { p_id: id }));
}

export async function saveMaterial(
  id: string | null,
  expectedVersion: number | null,
  values: MaterialFormValues,
): Promise<string> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/save_material', {
      p_id: id,
      p_expected_version: expectedVersion,
      p_values: values,
    }),
  );
}

export async function previewMaterialModelSync(
  id: string,
): Promise<MaterialModelSyncPreview> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/preview_material_model_sync', { p_id: id }),
  );
}

export async function applyMaterialModelSync(
  id: string,
  expectedVersion: number,
  expectedModelUpdatedAt: string,
): Promise<string> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/apply_material_model_sync', {
      p_id: id,
      p_expected_version: expectedVersion,
      p_expected_model_updated_at: expectedModelUpdatedAt,
    }),
  );
}

export async function loadMaterialHistory(
  materialId: string,
  signal?: AbortSignal,
): Promise<MaterialHistoryEntry[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_material_history',
      { p_material_id: materialId },
      { signal },
    ),
  );
}
