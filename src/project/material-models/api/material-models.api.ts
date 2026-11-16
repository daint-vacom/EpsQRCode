import type { SafetyInspectionChecklistGroup } from '@/project/material-safety-inspections/model/safety-inspection-checklist';
import {
  createSignedStorageUrl,
  removeStorageObjects,
  uploadStorageObject,
} from '@/lib/storage';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  MaterialGroupModelCounts,
  MaterialModel,
  MaterialModelFilterSummary,
  MaterialModelFormValues,
  MaterialModelImage,
  MaterialModelImageDraft,
  MaterialModelRow,
  MaterialPublicDisplaySettings,
} from '../model/material-model';
import {
  DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
  mapMaterialModelRow,
} from '../model/material-model';

export const MATERIAL_MODEL_IMAGES_BUCKET = 'material-model-images';

export interface BulkMaterialModelCreateResult {
  rowNumber: number;
  code: string;
  success: boolean;
  id: string | null;
  error: string | null;
}

interface MaterialModelImageRow {
  id: string;
  model_id: string;
  storage_path: string | null;
  external_url: string | null;
  sort_order: number;
  is_cover: boolean;
}

interface MaterialModelImagePayload {
  storage_path: string | null;
  external_url: string | null;
  is_cover: boolean;
}

interface MaterialModelSafetyChecklistRow {
  model_id: string;
  checklist: SafetyInspectionChecklistGroup[];
}

const MATERIAL_MODEL_CATALOG_PAGE_SIZE = 250;
const MATERIAL_MODEL_RELATED_ROWS_BATCH_SIZE = 100;

function queryParams(params: Record<string, string>) {
  return { params };
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

async function loadImageRows(
  modelIds: string[],
  signal?: AbortSignal,
): Promise<MaterialModelImageRow[]> {
  if (modelIds.length === 0) return [];
  const batches = Array.from(
    {
      length: Math.ceil(
        modelIds.length / MATERIAL_MODEL_RELATED_ROWS_BATCH_SIZE,
      ),
    },
    (_, index) =>
      modelIds.slice(
        index * MATERIAL_MODEL_RELATED_ROWS_BATCH_SIZE,
        (index + 1) * MATERIAL_MODEL_RELATED_ROWS_BATCH_SIZE,
      ),
  );
  return (
    await Promise.all(
      batches.map((batch) =>
        request<MaterialModelImageRow[]>(
          supabaseApi.get(
            '/material_model_images',
            queryParams({
              select:
                'id,model_id,storage_path,external_url,sort_order,is_cover',
              model_id: `in.(${batch.join(',')})`,
              order: 'sort_order.asc,id.asc',
            }),
            { signal },
          ),
        ),
      ),
    )
  ).flat();
}

async function loadSafetyChecklistRows(
  modelIds: string[],
  signal?: AbortSignal,
): Promise<MaterialModelSafetyChecklistRow[]> {
  if (modelIds.length === 0) return [];
  const batches = Array.from(
    {
      length: Math.ceil(
        modelIds.length / MATERIAL_MODEL_RELATED_ROWS_BATCH_SIZE,
      ),
    },
    (_, index) =>
      modelIds.slice(
        index * MATERIAL_MODEL_RELATED_ROWS_BATCH_SIZE,
        (index + 1) * MATERIAL_MODEL_RELATED_ROWS_BATCH_SIZE,
      ),
  );
  return (
    await Promise.all(
      batches.map((batch) =>
        request<MaterialModelSafetyChecklistRow[]>(
          supabaseApi.get(
            '/material_model_safety_checklists',
            queryParams({
              select: 'model_id,checklist',
              model_id: `in.(${batch.join(',')})`,
            }),
            { signal },
          ),
        ),
      ),
    )
  ).flat();
}

async function mapImageRow(
  row: MaterialModelImageRow,
): Promise<MaterialModelImage> {
  const url = row.external_url
    ? row.external_url
    : await createSignedStorageUrl(
        MATERIAL_MODEL_IMAGES_BUCKET,
        row.storage_path!,
        3600,
      );
  return {
    id: row.id,
    storagePath: row.storage_path,
    externalUrl: row.external_url,
    url,
    sortOrder: row.sort_order,
    isCover: row.is_cover,
  };
}

export async function loadMaterialModels(
  signal?: AbortSignal,
): Promise<MaterialModel[]> {
  assertSupabaseConfigured();
  const rows: MaterialModelRow[] = [];
  let cursor: {
    p_after_is_active: boolean | null;
    p_after_name: string | null;
    p_after_id: string | null;
  } = {
    p_after_is_active: null,
    p_after_name: null,
    p_after_id: null,
  };

  while (true) {
    const page = await request<MaterialModelRow[]>(
      supabaseApi.post(
        '/rpc/list_material_models_page',
        {
          ...cursor,
          p_page_size: MATERIAL_MODEL_CATALOG_PAGE_SIZE,
        },
        { signal },
      ),
    );
    rows.push(...page);
    if (page.length < MATERIAL_MODEL_CATALOG_PAGE_SIZE) break;
    const last = page[page.length - 1];
    if (!last) break;
    cursor = {
      p_after_is_active: last.is_active,
      p_after_name: last.name,
      p_after_id: last.id,
    };
  }

  const modelIds = rows.map((row) => row.id);
  const [imageRows, checklistRows] = await Promise.all([
    loadImageRows(modelIds, signal),
    loadSafetyChecklistRows(modelIds, signal),
  ]);
  const checklistsByModelId = new Map(
    checklistRows.map((row) => [row.model_id, row.checklist ?? []]),
  );
  const imagesByModel = new Map<string, MaterialModelImageRow[]>();
  for (const image of imageRows) {
    const current = imagesByModel.get(image.model_id) ?? [];
    current.push(image);
    imagesByModel.set(image.model_id, current);
  }

  return Promise.all(
    rows.map(async (row) => {
      const images = await Promise.all(
        (imagesByModel.get(row.id) ?? []).map(mapImageRow),
      );
      return {
        ...mapMaterialModelRow(row, images),
        safetyInspectionChecklist: checklistsByModelId.get(row.id) ?? [],
      };
    }),
  );
}

export async function loadMaterialModelFilterSummary(
  filters: { search?: string; groupId?: string; groupIds?: string[] } = {},
  signal?: AbortSignal,
): Promise<MaterialModelFilterSummary> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/get_material_model_filter_summary',
      { p_filters: filters },
      { signal },
    ),
  );
}

export async function loadMaterialGroupModelCounts(
  signal?: AbortSignal,
): Promise<MaterialGroupModelCounts> {
  assertSupabaseConfigured();
  return request<MaterialGroupModelCounts>(
    supabaseApi.post('/rpc/get_material_group_model_counts', {}, { signal }),
  );
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'image';
}

async function uploadMaterialModelImage(file: File): Promise<string> {
  const path = `objects/${crypto.randomUUID()}/${safeFileName(file.name)}`;
  await uploadStorageObject({
    bucket: MATERIAL_MODEL_IMAGES_BUCKET,
    path,
    file,
  });
  return path;
}

async function loadMaterialImageReferences(
  paths: string[],
): Promise<Set<string>> {
  if (paths.length === 0) return new Set();

  try {
    const rows = await request<Array<{ storage_path: string }>>(
      supabaseApi.get(
        '/material_images',
        queryParams({
          select: 'storage_path',
          storage_bucket: `eq.${MATERIAL_MODEL_IMAGES_BUCKET}`,
          storage_path: `in.(${paths.join(',')})`,
        }),
      ),
    );
    return new Set(rows.map((row) => row.storage_path));
  } catch {
    // Preserve the model objects when material references cannot be checked.
    return new Set(paths);
  }
}

async function saveMaterialModel(
  id: string | null,
  values: MaterialModelFormValues,
  images: MaterialModelImageDraft[],
  previousImages: MaterialModelImage[],
  publicDisplaySettings: MaterialPublicDisplaySettings,
): Promise<string> {
  assertSupabaseConfigured();
  const uploadedPaths: string[] = [];

  try {
    const imagePayload: MaterialModelImagePayload[] = [];
    for (const image of images) {
      const storagePath = image.file
        ? await uploadMaterialModelImage(image.file)
        : (image.storagePath ?? null);
      if (image.file && storagePath) uploadedPaths.push(storagePath);
      imagePayload.push({
        storage_path: storagePath,
        external_url: storagePath ? null : (image.externalUrl ?? null),
        is_cover: image.isCover,
      });
    }

    const savedId = await request<string>(
      supabaseApi.post('/rpc/save_material_model_with_safety_checklist', {
        p_id: id,
        p_code: values.code.trim() || null,
        p_name: values.name.trim(),
        p_group_id: values.groupId,
        p_description: values.description.trim() || null,
        p_requires_inspection: values.requiresInspection,
        p_inspection_interval_value: values.inspectionIntervalValue,
        p_inspection_interval_unit: values.inspectionIntervalUnit,
        p_skip_initial_inspection: values.skipInitialInspection,
        p_use_group_safety_inspection_checklist:
          values.useGroupSafetyInspectionChecklist,
        p_specifications: values.specifications,
        p_images: imagePayload,
        p_external_codes: values.externalCodesText
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
        p_public_display_settings: publicDisplaySettings,
        p_safety_inspection_checklist: values.safetyInspectionChecklist,
        p_manufacturer: values.manufacturer.trim() || null,
        p_unit: values.unit.trim() || null,
        p_unit_price_default: values.unitPriceDefault,
      }),
    );

    const retainedPaths = new Set<string>();
    for (const image of images) {
      if (image.storagePath) retainedPaths.add(image.storagePath);
    }
    for (const path of uploadedPaths) retainedPaths.add(path);
    const removedPaths = previousImages
      .map((image) => image.storagePath)
      .filter(
        (path): path is string => path !== null && !retainedPaths.has(path),
      );
    const referencedPaths = await loadMaterialImageReferences(removedPaths);
    const safeToRemovePaths = removedPaths.filter(
      (path) => !referencedPaths.has(path),
    );
    if (safeToRemovePaths.length > 0) {
      await removeStorageObjects(
        MATERIAL_MODEL_IMAGES_BUCKET,
        safeToRemovePaths,
      ).catch(() => undefined);
    }
    return savedId;
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await removeStorageObjects(
        MATERIAL_MODEL_IMAGES_BUCKET,
        uploadedPaths,
      ).catch(() => undefined);
    }
    throw error;
  }
}

export function createMaterialModel(
  values: MaterialModelFormValues,
  images: MaterialModelImageDraft[],
  publicDisplaySettings: MaterialPublicDisplaySettings = DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
): Promise<string> {
  return saveMaterialModel(null, values, images, [], publicDisplaySettings);
}

export async function createMaterialModelsBulk(
  values: MaterialModelFormValues[],
): Promise<BulkMaterialModelCreateResult[]> {
  assertSupabaseConfigured();
  return request<BulkMaterialModelCreateResult[]>(
    supabaseApi.post('/rpc/create_material_models_bulk', {
      p_items: values.map((item) => ({
        code: item.code.trim(),
        name: item.name.trim(),
        groupId: item.groupId,
        description: item.description.trim() || null,
        manufacturer: item.manufacturer.trim() || null,
        unit: item.unit.trim() || null,
        unitPriceDefault: item.unitPriceDefault,
        externalCodes: item.externalCodesText
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
        requiresInspection: item.requiresInspection,
        inspectionIntervalValue: item.inspectionIntervalValue,
        inspectionIntervalUnit: item.inspectionIntervalUnit,
        skipInitialInspection: item.skipInitialInspection,
        useGroupSafetyInspectionChecklist:
          item.useGroupSafetyInspectionChecklist,
        specifications: item.specifications,
        safetyInspectionChecklist: item.safetyInspectionChecklist,
      })),
    }),
  );
}

export async function updateMaterialModel(
  id: string,
  values: MaterialModelFormValues,
  images: MaterialModelImageDraft[],
  previousImages: MaterialModelImage[],
  publicDisplaySettings: MaterialPublicDisplaySettings,
): Promise<void> {
  await saveMaterialModel(
    id,
    values,
    images,
    previousImages,
    publicDisplaySettings,
  );
}

export async function updateMaterialModelAvailability(
  id: string,
  isActive: boolean,
): Promise<Pick<MaterialModelRow, 'id' | 'is_active' | 'updated_at'>> {
  assertSupabaseConfigured();
  const rows = await request<
    Pick<MaterialModelRow, 'id' | 'is_active' | 'updated_at'>[]
  >(
    supabaseApi.patch(
      '/material_models',
      { is_active: isActive },
      {
        ...queryParams({ id: `eq.${id}`, select: 'id,is_active,updated_at' }),
        headers: { Prefer: 'return=representation' },
      },
    ),
  );
  if (!rows[0]) throw new Error('Không tìm thấy mẫu vật tư để cập nhật.');
  return rows[0];
}

export async function deleteMaterialModel(id: string): Promise<void> {
  assertSupabaseConfigured();
  const imageRows = await loadImageRows([id]);
  await request(
    supabaseApi.delete('/material_models', queryParams({ id: `eq.${id}` })),
  );
  const paths = imageRows
    .map((image) => image.storage_path)
    .filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    await removeStorageObjects(MATERIAL_MODEL_IMAGES_BUCKET, paths).catch(
      () => undefined,
    );
  }
}
