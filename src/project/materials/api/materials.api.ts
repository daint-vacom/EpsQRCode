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
    items: await Promise.all(
      result.items.map((material) => resolveMaterialImages(material, true)),
    ),
  };
}

export async function loadMaterial(
  id: string,
  signal?: AbortSignal,
): Promise<Material> {
  assertSupabaseConfigured();
  const material = await request<Material>(
    supabaseApi.post('/rpc/get_material', { p_id: id }, { signal }),
  );
  return resolveMaterialImages(material);
}

async function resolveMaterialImages(
  material: Material,
  coverOnly = false,
): Promise<Material> {
  const images = await Promise.all(
    material.images.map(async (image) => {
      if (coverOnly && !image.isCover) return { ...image, url: '' };
      return {
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
      };
    }),
  );
  return { ...material, images };
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'image';
}

async function uploadMaterialImage(
  file: File,
  ownerPartyId: string,
): Promise<string> {
  const path = `parties/${ownerPartyId}/objects/${crypto.randomUUID()}/${safeFileName(file.name)}`;
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
        ? await uploadMaterialImage(image.file, values.ownerPartyId)
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

export async function updateMaterialAvailability(
  id: string,
  isActive: boolean,
): Promise<Pick<Material, 'id' | 'isActive' | 'updatedAt' | 'version'>> {
  assertSupabaseConfigured();
  return request<Pick<Material, 'id' | 'isActive' | 'updatedAt' | 'version'>>(
    supabaseApi.post('/rpc/set_material_availability', {
      p_id: id,
      p_is_active: isActive,
    }),
  );
}

export async function deleteMaterial(material: Material): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.post('/rpc/delete_material', { p_id: material.id }),
  );
  const imagePaths = material.images
    .filter((image) => image.storageBucket === MATERIAL_IMAGES_BUCKET)
    .map((image) => image.storagePath)
    .filter((path): path is string => Boolean(path));
  if (imagePaths.length > 0) {
    await removeStorageObjects(MATERIAL_IMAGES_BUCKET, imagePaths).catch(
      () => undefined,
    );
  }
}

export async function deleteMaterials(materials: Material[]): Promise<void> {
  const results = await Promise.allSettled(materials.map(deleteMaterial));
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failure) throw failure.reason;
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
