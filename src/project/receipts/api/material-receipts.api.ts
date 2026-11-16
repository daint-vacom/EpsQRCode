import { MATERIAL_IMAGES_BUCKET } from '@/project/materials/api/materials.api';
import {
  createSignedStorageUrl,
  removeStorageObjects,
  uploadStorageObject,
} from '@/lib/storage';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  MaterialReceipt,
  MaterialReceiptAdjustmentPreview,
  MaterialReceiptFilterSummary,
  MaterialReceiptHistoryEntry,
  MaterialReceiptItemsResult,
  MaterialReceiptLineInput,
  MaterialReceiptListFilters,
  MaterialReceiptListResult,
  MaterialReceiptRepresentativeInput,
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

export async function loadMaterialReceiptFilterSummary(
  filters: { search?: string; warehouseId?: string } = {},
  signal?: AbortSignal,
): Promise<MaterialReceiptFilterSummary> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/get_material_receipt_filter_summary',
      {
        p_filters: {
          search: filters.search?.trim() || null,
          warehouseId: filters.warehouseId || null,
        },
      },
      { signal },
    ),
  );
}

export async function loadMaterialReceipt(id: string, signal?: AbortSignal) {
  assertSupabaseConfigured();
  const receipt = await request<MaterialReceipt>(
    supabaseApi.post('/rpc/get_material_receipt', { p_id: id }, { signal }),
  );
  return {
    ...receipt,
    lines: await Promise.all(
      receipt.lines.map(async (line) => ({
        ...line,
        representative: line.representative
          ? {
              ...line.representative,
              images: await Promise.all(
                line.representative.images.map(async (image) => ({
                  ...image,
                  url:
                    image.externalUrl ??
                    (image.storageBucket && image.storagePath
                      ? await createSignedStorageUrl(
                          image.storageBucket,
                          image.storagePath,
                          3600,
                        )
                      : image.url),
                })),
              ),
            }
          : null,
      })),
    ),
  };
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
  const previous = id ? await loadMaterialReceipt(id) : null;
  const savedId = await request<string>(
    supabaseApi.post('/rpc/save_material_receipt', {
      p_id: id,
      p_values: values,
    }),
  );
  const savedReceipt = await loadMaterialReceipt(savedId);
  const uploadedPaths: string[] = [];
  try {
    for (const [index, line] of values.lines.entries()) {
      const representative = line.representative;
      const targetLine = savedReceipt.lines[index];
      if (!representative || !targetLine) continue;
      const images = [];
      for (const [sortOrder, image] of representative.images.entries()) {
        let storageBucket = image.storageBucket ?? null;
        let storagePath = image.storagePath ?? null;
        let externalUrl = image.externalUrl ?? null;
        if (image.file) {
          const safeName =
            image.file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) ||
            'image';
          storageBucket = MATERIAL_IMAGES_BUCKET;
          storagePath = `parties/${representative.materialValues.ownerPartyId || savedReceipt.warehouseId}/objects/${crypto.randomUUID()}/${safeName}`;
          await uploadStorageObject({
            bucket: storageBucket,
            path: storagePath,
            file: image.file,
          });
          uploadedPaths.push(storagePath);
          externalUrl = null;
        }
        images.push({
          id: image.id,
          storageBucket,
          storagePath,
          externalUrl: storagePath ? null : externalUrl,
          sortOrder,
          isCover: image.isCover,
        });
      }
      await request<string>(
        supabaseApi.post('/rpc/save_material_receipt_representative', {
          p_receipt_id: savedId,
          p_line_id: targetLine.id,
          p_expected_version: savedReceipt.version,
          p_material_values: representative.materialValues,
          p_images: images,
          p_public_display_settings: representative.publicDisplaySettings,
          p_public_specification_settings:
            representative.publicSpecificationSettings,
          p_reason: null,
        }),
      );
    }
  } catch (error) {
    if (uploadedPaths.length) {
      await removeStorageObjects(MATERIAL_IMAGES_BUCKET, uploadedPaths).catch(
        () => undefined,
      );
    }
    throw error;
  }

  if (previous) {
    const retained = new Set(
      values.lines.flatMap(
        (line) =>
          line.representative?.images
            .filter((image) => image.storageBucket === MATERIAL_IMAGES_BUCKET)
            .map((image) => image.storagePath)
            .filter((path): path is string => Boolean(path)) ?? [],
      ),
    );
    const removed = previous.lines.flatMap((line) =>
      (line.representative?.images ?? [])
        .filter(
          (image) =>
            image.storageBucket === MATERIAL_IMAGES_BUCKET &&
            image.storagePath &&
            !retained.has(image.storagePath),
        )
        .map((image) => image.storagePath as string),
    );
    if (removed.length) {
      await removeStorageObjects(MATERIAL_IMAGES_BUCKET, removed).catch(
        () => undefined,
      );
    }
  }
  return savedId;
}

export async function saveMaterialReceiptRepresentative(input: {
  receiptId: string;
  lineId: string;
  expectedVersion: number;
  warehouseId: string;
  representative: MaterialReceiptRepresentativeInput;
  reason?: string;
}) {
  assertSupabaseConfigured();
  const previous = await loadMaterialReceipt(input.receiptId);
  const previousImages =
    previous.lines.find((line) => line.id === input.lineId)?.representative
      ?.images ?? [];
  const uploadedPaths: string[] = [];
  try {
    const images = [];
    for (const [sortOrder, image] of input.representative.images.entries()) {
      let storageBucket = image.storageBucket ?? null;
      let storagePath = image.storagePath ?? null;
      let externalUrl = image.externalUrl ?? null;
      if (image.file) {
        const safeName =
          image.file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) ||
          'image';
        storageBucket = MATERIAL_IMAGES_BUCKET;
        storagePath = `parties/${input.representative.materialValues.ownerPartyId || input.warehouseId}/objects/${crypto.randomUUID()}/${safeName}`;
        await uploadStorageObject({
          bucket: storageBucket,
          path: storagePath,
          file: image.file,
        });
        uploadedPaths.push(storagePath);
        externalUrl = null;
      }
      images.push({
        id: image.id,
        storageBucket,
        storagePath,
        externalUrl: storagePath ? null : externalUrl,
        sortOrder,
        isCover: image.isCover,
      });
    }
    const savedId = await request<string>(
      supabaseApi.post('/rpc/save_material_receipt_representative', {
        p_receipt_id: input.receiptId,
        p_line_id: input.lineId,
        p_expected_version: input.expectedVersion,
        p_material_values: input.representative.materialValues,
        p_images: images,
        p_public_display_settings: input.representative.publicDisplaySettings,
        p_public_specification_settings:
          input.representative.publicSpecificationSettings,
        p_reason: input.reason ?? null,
      }),
    );
    const savedReceipt = await loadMaterialReceipt(input.receiptId);
    const retainedPaths = new Set(
      savedReceipt.lines.flatMap((line) =>
        (line.representative?.images ?? [])
          .filter((image) => image.storageBucket === MATERIAL_IMAGES_BUCKET)
          .map((image) => image.storagePath)
          .filter((path): path is string => Boolean(path)),
      ),
    );
    const removedPaths = previousImages
      .filter(
        (image) =>
          image.storageBucket === MATERIAL_IMAGES_BUCKET &&
          image.storagePath &&
          !retainedPaths.has(image.storagePath),
      )
      .map((image) => image.storagePath as string);
    if (removedPaths.length) {
      await removeStorageObjects(MATERIAL_IMAGES_BUCKET, removedPaths).catch(
        () => undefined,
      );
    }
    return savedId;
  } catch (error) {
    if (uploadedPaths.length) {
      await removeStorageObjects(MATERIAL_IMAGES_BUCKET, uploadedPaths).catch(
        () => undefined,
      );
    }
    throw error;
  }
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
