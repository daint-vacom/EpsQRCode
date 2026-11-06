import {
  createSignedStorageUrl,
  removeStorageObjects,
  uploadStorageObject,
} from '@/lib/storage';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  SafetyInspection,
  SafetyInspectionAttachment,
  SafetyInspectionFormValues,
  SafetyInspectionGroupResult,
} from '../model/safety-inspection';

export const MATERIAL_SAFETY_INSPECTIONS_BUCKET = 'material-safety-inspections';

interface SafetyInspectionRow {
  id: string;
  material_id: string;
  inspected_at: string;
  inspected_by: string;
  inspector_name: string;
  checklist_result: SafetyInspectionGroupResult[];
  overall_note: string;
  overall_result: 'passed' | 'failed';
  attachments: SafetyInspectionAttachment[];
  created_at: string;
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

function mapSafetyInspection(row: SafetyInspectionRow): SafetyInspection {
  return {
    id: row.id,
    materialId: row.material_id,
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
  'id,material_id,inspected_at,inspected_by,inspector_name,checklist_result,overall_note,overall_result,attachments,created_at';

export async function loadMaterialSafetyInspections(
  materialId: string,
  signal?: AbortSignal,
): Promise<SafetyInspection[]> {
  assertSupabaseConfigured();
  const rows = await request<SafetyInspectionRow[]>(
    supabaseApi.get('/material_safety_inspections', {
      params: {
        select: inspectionSelect,
        material_id: `eq.${materialId}`,
        order: 'inspected_at.desc,id.desc',
      },
      signal,
    }),
  );
  return rows.map(mapSafetyInspection);
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

export async function createMaterialSafetyInspection(
  materialId: string,
  values: SafetyInspectionFormValues,
  files: File[],
): Promise<string> {
  assertSupabaseConfigured();
  if (!values.overallResult) {
    throw new Error('Vui lòng chọn kết quả kiểm định.');
  }
  const inspectionId = crypto.randomUUID();
  const uploadedPaths: string[] = [];

  try {
    const attachments: SafetyInspectionAttachment[] = [];
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
      attachments.push({
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        storagePath,
      });
    }

    await request(
      supabaseApi.post(
        '/material_safety_inspections',
        {
          id: inspectionId,
          material_id: materialId,
          inspected_at: new Date(values.inspectedAt).toISOString(),
          inspector_name: values.inspectorName.trim(),
          checklist_result: values.checklistResult,
          overall_note: values.overallNote.trim(),
          overall_result: values.overallResult,
          attachments,
        },
        { headers: { Prefer: 'return=minimal' } },
      ),
    );

    return inspectionId;
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await removeStorageObjects(
        MATERIAL_SAFETY_INSPECTIONS_BUCKET,
        uploadedPaths,
      ).catch(() => undefined);
    }
    throw error;
  }
}
