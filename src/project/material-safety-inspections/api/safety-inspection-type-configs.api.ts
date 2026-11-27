import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  SafetyInspectionConfigScope,
  SafetyInspectionIntervalUnit,
  SafetyInspectionSchedulePreview,
  SafetyInspectionTypeConfigView,
  SaveSafetyInspectionTypeConfigInput,
} from '../model/safety-inspection-type-config';

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadSafetyInspectionTypeConfigs(
  scopeKind: SafetyInspectionConfigScope,
  scopeId: string,
  signal?: AbortSignal,
): Promise<SafetyInspectionTypeConfigView[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_material_safety_inspection_type_configs_for_scope',
      { p_scope_kind: scopeKind, p_scope_id: scopeId },
      { signal },
    ),
  );
}

export async function saveSafetyInspectionTypeConfig(
  input: SaveSafetyInspectionTypeConfigInput,
): Promise<string> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/save_material_safety_inspection_type_config', {
      p_scope_kind: input.scopeKind,
      p_scope_id: input.scopeId,
      p_type_id: input.typeId,
      p_name: input.name,
      p_checklist: input.checklist,
      p_checklist_mode: input.checklistMode,
      p_interval_value: input.intervalValue,
      p_interval_unit: input.intervalUnit,
      p_enabled: input.enabled,
      p_starts_on: input.startsOn,
      p_recalculate: input.recalculate,
      p_expected_preview_token: input.expectedPreviewToken,
    }),
  );
}

export async function previewSafetyInspectionTypeSchedule(
  scopeKind: SafetyInspectionConfigScope,
  scopeId: string,
  typeId: string,
  intervalValue: number,
  intervalUnit: SafetyInspectionIntervalUnit,
  signal?: AbortSignal,
): Promise<SafetyInspectionSchedulePreview> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/preview_material_safety_inspection_due_dates',
      {
        p_scope_kind: scopeKind,
        p_scope_id: scopeId,
        p_type_id: typeId,
        p_interval_value: intervalValue,
        p_interval_unit: intervalUnit,
      },
      { signal },
    ),
  );
}
