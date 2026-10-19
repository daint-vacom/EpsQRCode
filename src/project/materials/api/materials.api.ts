import {
  createSignedStorageUrl,
  removeStorageObjects,
  uploadStorageObject,
} from '@/lib/storage';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  Material,
  MaterialFormValues,
  MaterialHistoryEntry,
  MaterialImage,
  MaterialImageDraft,
  MaterialListFilters,
  MaterialListResult,
  MaterialModelSyncPreview,
} from '../model/material';

export const MATERIAL_IMAGES_BUCKET = 'material-images';

interface MaterialImagePayload {
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  sort_order: number;
  is_cover: boolean;
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadMaterials(
  filters: MaterialListFilters = {},
  signal?: AbortSignal,
): Promise<MaterialListResult> {
  assertSupabaseConfigured();
  const result = await request<MaterialListResult>(
    supabaseApi.post('/rpc/list_materials', { p_filters: filters }, { signal }),
  );
  return {
    ...result,
    items: result.items.map((material) => ({
      ...material,
      images: material.images.map((image) => ({ ...image, url: '' })),
    })),
  };
}

export async function loadMaterial(id: string): Promise<Material> {
  assertSupabaseConfigured();
  const material = await request<Material>(
    supabaseApi.post('/rpc/get_material', { p_id: id }),
  );
  return resolveMaterialImages(material);
}

async function resolveMaterialImages(material: Material): Promise<Material> {
  const images = await Promise.all(
    material.images.map(async (image) => ({
      ...image,
      url:
        image.externalUrl ??
        (image.storageBucket && image.storagePath
          ? await createSignedStorageUrl(
              image.storageBucket,
              image.storagePath,
              3600,
            )
          : ''),
    })),
  );
  return { ...material, images };
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'image';
}

async function uploadMaterialImage(file: File): Promise<string> {
  const path = `objects/${crypto.randomUUID()}/${safeFileName(file.name)}`;
  await uploadStorageObject({
    bucket: MATERIAL_IMAGES_BUCKET,
    path,
    file,
  });
  return path;
}

export async function saveMaterial(
  id: string | null,
  expectedVersion: number | null,
  values: MaterialFormValues,
  images: MaterialImageDraft[],
  previousImages: MaterialImage[],
): Promise<string> {
  assertSupabaseConfigured();
  const uploadedPaths: string[] = [];

  try {
    const imagePayload: MaterialImagePayload[] = [];
    for (const [sortOrder, image] of images.entries()) {
      const storageBucket = image.file
        ? MATERIAL_IMAGES_BUCKET
        : (image.storageBucket ?? null);
      const storagePath = image.file
        ? await uploadMaterialImage(image.file)
        : (image.storagePath ?? null);
      if (image.file && storagePath) uploadedPaths.push(storagePath);
      imagePayload.push({
        storage_bucket: storagePath ? storageBucket : null,
        storage_path: storagePath,
        external_url: storagePath ? null : (image.externalUrl ?? null),
        sort_order: sortOrder,
        is_cover: image.isCover,
      });
    }

    const savedId = await request<string>(
      supabaseApi.post('/rpc/save_material', {
        p_id: id,
        p_expected_version: expectedVersion,
        p_values: {
          ...values,
          specificationOverrideLabels: values.specificationOverrideLabels ?? {},
          images: imagePayload,
        },
      }),
    );

    const retainedPaths = new Set(
      imagePayload
        .filter((image) => image.storage_bucket === MATERIAL_IMAGES_BUCKET)
        .map((image) => image.storage_path)
        .filter((path): path is string => path !== null),
    );
    const removedPaths = previousImages
      .filter((image) => image.storageBucket === MATERIAL_IMAGES_BUCKET)
      .map((image) => image.storagePath)
      .filter(
        (path): path is string => path !== null && !retainedPaths.has(path),
      );
    if (removedPaths.length > 0) {
      await removeStorageObjects(MATERIAL_IMAGES_BUCKET, removedPaths).catch(
        () => undefined,
      );
    }
    return savedId;
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await removeStorageObjects(MATERIAL_IMAGES_BUCKET, uploadedPaths).catch(
        () => undefined,
      );
    }
    throw error;
  }
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
