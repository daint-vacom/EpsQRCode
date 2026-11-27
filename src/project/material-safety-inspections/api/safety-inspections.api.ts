import {
  createSignedStorageUrl,
  removeStorageObjects,
  uploadStorageObject,
} from '@/lib/storage';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  MaterialSafetyInspectionPlanFilters,
  MaterialSafetyInspectionPlanResult,
  MaterialSafetyInspectionQueueFilters,
  MaterialSafetyInspectionQueueResult,
  MaterialSafetyInspectionType,
  SafetyInspection,
  SafetyInspectionAttachment,
  SafetyInspectionFormValues,
  SafetyInspectionGroupResult,
  SafetyInspectionListFilters,
  SafetyInspectionListResult,
  SafetyInspectionListRow,
  SafetyInspectionListSummary,
  SafetyInspectionTypeOption,
} from '../model/safety-inspection';
import { safetyInspectionFormSchema } from '../model/safety-inspection';

export const MATERIAL_SAFETY_INSPECTIONS_BUCKET = 'material-safety-inspections';

interface SafetyInspectionRow {
  id: string;
  material_id: string;
  inspection_type_id: string;
  inspection_type_name_snapshot: string;
  status: 'in_progress' | 'completed';
  inspected_at: string;
  inspected_by: string;
  inspector_name: string;
  checklist_result: SafetyInspectionGroupResult[];
  overall_note: string;
  overall_result: 'passed' | 'failed' | null;
  attachments: SafetyInspectionAttachment[];
  created_at: string;
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

function toInspectionTimestamp(dateValue: string): string {
  return new Date(`${dateValue}T12:00:00`).toISOString();
}

function mapSafetyInspection(row: SafetyInspectionRow): SafetyInspection {
  return {
    id: row.id,
    materialId: row.material_id,
    inspectionTypeId: row.inspection_type_id,
    inspectionTypeName: row.inspection_type_name_snapshot,
    status: row.status,
    inspectedAt: row.inspected_at,
    inspectorUserId: row.inspected_by,
    inspectorName: row.inspector_name,
    checklistResult: row.checklist_result,
    overallNote: row.overall_note,
    overallResult: row.overall_result,
    attachments: row.attachments ?? [],
    createdAt: row.created_at,
  };
}

const inspectionSelect =
  'id,material_id,inspection_type_id,inspection_type_name_snapshot,status,inspected_at,inspected_by,inspector_name,checklist_result,overall_note,overall_result,attachments,created_at';

export async function loadMaterialSafetyInspections(
  materialId: string,
  signal?: AbortSignal,
  inspectionTypeId?: string,
): Promise<SafetyInspection[]> {
  assertSupabaseConfigured();
  const rows = await request<SafetyInspectionRow[]>(
    supabaseApi.get('/material_safety_inspections', {
      params: {
        select: inspectionSelect,
        material_id: `eq.${materialId}`,
        ...(inspectionTypeId
          ? { inspection_type_id: `eq.${inspectionTypeId}` }
          : {}),
        order: 'inspected_at.desc,id.desc',
      },
      signal,
    }),
  );
  return rows.map(mapSafetyInspection);
}

export async function loadMaterialSafetyInspectionQueue(
  filters: MaterialSafetyInspectionQueueFilters,
  signal?: AbortSignal,
): Promise<MaterialSafetyInspectionQueueResult> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_materials_requiring_safety_inspection',
      { p_filters: filters },
      { signal },
    ),
  );
}

export async function loadMaterialSafetyInspectionPlan(
  filters: MaterialSafetyInspectionPlanFilters,
  signal?: AbortSignal,
): Promise<MaterialSafetyInspectionPlanResult> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/get_material_safety_inspection_plan',
      { p_filters: filters },
      { signal },
    ),
  );
}

export async function loadSafetyInspectionList(
  filters: SafetyInspectionListFilters,
  signal?: AbortSignal,
): Promise<SafetyInspectionListResult<SafetyInspectionListRow>> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_material_safety_inspections',
      { p_filters: filters },
      { signal },
    ),
  );
}

export async function loadSafetyInspectionFilterSummary(
  search: string,
  inspectionTypeId: string,
  signal?: AbortSignal,
): Promise<SafetyInspectionListSummary> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/get_safety_inspection_filter_summary',
      {
        p_search: search.trim() || null,
        p_inspection_type_id: inspectionTypeId || null,
      },
      { signal },
    ),
  );
}

export async function loadMaterialSafetyInspectionTypes(
  materialId: string,
  signal?: AbortSignal,
): Promise<MaterialSafetyInspectionType[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_material_safety_inspection_types_for_material',
      { p_material_id: materialId },
      { signal },
    ),
  );
}

export async function loadMaterialSafetyInspectionHistoryTypes(
  materialId: string,
  signal?: AbortSignal,
): Promise<SafetyInspectionTypeOption[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_material_safety_inspection_history_types',
      { p_material_id: materialId },
      { signal },
    ),
  );
}

export async function startMaterialSafetyInspectionDraft(
  materialId: string,
  inspectionTypeId: string,
  inspectorName: string,
  inspectedAt: string,
): Promise<string> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/start_material_safety_inspection_draft', {
      p_material_id: materialId,
      p_inspection_type_id: inspectionTypeId,
      p_inspector_name: inspectorName,
      p_inspected_at: inspectedAt,
    }),
  );
}

export async function loadSafetyInspection(
  inspectionId: string,
  signal?: AbortSignal,
): Promise<SafetyInspection | null> {
  assertSupabaseConfigured();
  const rows = await request<SafetyInspectionRow[]>(
    supabaseApi.get('/material_safety_inspections', {
      params: { select: inspectionSelect, id: `eq.${inspectionId}` },
      signal,
    }),
  );
  const row = rows[0];
  if (!row) return null;

  const inspection = mapSafetyInspection(row);
  return {
    ...inspection,
    attachments: await Promise.all(
      inspection.attachments.map(async (attachment) => ({
        ...attachment,
        url: await createSignedStorageUrl(
          MATERIAL_SAFETY_INSPECTIONS_BUCKET,
          attachment.storagePath,
          3600,
        ).catch(() => ''),
      })),
    ),
  };
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'file';
}

function resolveMimeType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').at(-1)?.toLocaleLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  return mimeTypes[extension ?? ''] ?? 'application/octet-stream';
}

export async function saveMaterialSafetyInspection(input: {
  inspectionId: string;
  materialId: string;
  values: SafetyInspectionFormValues;
  attachments: SafetyInspectionAttachment[];
  files: File[];
  complete: boolean;
}): Promise<void> {
  assertSupabaseConfigured();
  const { inspectionId, materialId, values, files, complete } = input;
  const validated = safetyInspectionFormSchema.safeParse(values);
  if (complete && !validated.success) {
    throw new Error('Vui lòng chọn kết quả kiểm tra trước khi hoàn tất phiếu.');
  }

  const retainedAttachments = input.attachments.map(
    ({ url: _url, ...attachment }) => attachment,
  );
  const previousAttachments = await loadSafetyInspection(inspectionId);
  const removedAttachments =
    previousAttachments?.attachments.filter(
      (attachment) =>
        !retainedAttachments.some((retained) => retained.id === attachment.id),
    ) ?? [];
  const uploadedPaths: string[] = [];

  try {
    const newAttachments: SafetyInspectionAttachment[] = [];
    for (const file of files) {
      const storagePath = `${materialId}/${inspectionId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const mimeType = resolveMimeType(file);
      if (mimeType === 'application/octet-stream') {
        throw new Error(`Không hỗ trợ định dạng tệp "${file.name}".`);
      }
      await uploadStorageObject({
        bucket: MATERIAL_SAFETY_INSPECTIONS_BUCKET,
        path: storagePath,
        file: new File([file], file.name, { type: mimeType }),
      });
      uploadedPaths.push(storagePath);
      newAttachments.push({
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        storagePath,
      });
    }

    const updatedRows = await request<Array<{ id: string }>>(
      supabaseApi.patch(
        '/material_safety_inspections',
        {
          inspected_at: toInspectionTimestamp(values.inspectedAt),
          inspector_name: values.inspectorName.trim(),
          checklist_result: values.checklistResult,
          overall_note: values.overallNote.trim(),
          overall_result: complete
            ? values.overallResult
            : (values.overallResult ?? null),
          status: complete ? 'completed' : 'in_progress',
          attachments: [...retainedAttachments, ...newAttachments],
        },
        {
          params: {
            id: `eq.${inspectionId}`,
            status: 'eq.in_progress',
          },
          headers: { Prefer: 'return=representation' },
        },
      ),
    );
    if (!updatedRows.some((row) => row.id === inspectionId)) {
      throw new Error('Phiếu đã được hoàn tất hoặc không còn tồn tại.');
    }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await removeStorageObjects(
        MATERIAL_SAFETY_INSPECTIONS_BUCKET,
        uploadedPaths,
      ).catch(() => undefined);
    }
    throw error;
  }

  const removedPaths = removedAttachments.map(
    (attachment) => attachment.storagePath,
  );
  if (removedPaths.length > 0) {
    await removeStorageObjects(
      MATERIAL_SAFETY_INSPECTIONS_BUCKET,
      removedPaths,
    ).catch(() => undefined);
  }
}
