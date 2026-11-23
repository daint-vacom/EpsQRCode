import { MATERIAL_IMAGES_BUCKET } from '@/project/materials/api/materials.api';
import {
  createSignedStorageUrl,
  getStorageItem,
  removeStorageObjects,
  setStorageItem,
  uploadStorageObject,
} from '@/lib/storage';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  MaterialReceipt,
  MaterialReceiptAdjustmentPreview,
  MaterialReceiptFilterSummary,
  MaterialReceiptHistoryEntry,
  MaterialReceiptInlineUpdatePreview,
  MaterialReceiptItemsResult,
  MaterialReceiptLineInput,
  MaterialReceiptListFilters,
  MaterialReceiptListResult,
  MaterialReceiptRepresentativeInput,
  MaterialReceiptRequestListResult,
  MaterialReceiptSelectResult,
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

export async function loadAvailableMaterialReceiptRequests(
  filters: { search?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) {
  assertSupabaseConfigured();
  return request<MaterialReceiptRequestListResult>(
    supabaseApi.post(
      '/rpc/list_available_material_receipt_requests',
      { p_filters: filters },
      { signal },
    ),
  );
}

export async function loadMaterialReceiptOptions(
  filters: {
    search?: string;
    statuses?: Array<'draft' | 'handover'>;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal,
): Promise<MaterialReceiptSelectResult> {
  assertSupabaseConfigured();
  return request<MaterialReceiptSelectResult>(
    supabaseApi.post(
      '/rpc/list_incomplete_material_receipt_options',
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
    requestRegistrationScope: 'all' | 'selected';
    requestRegistrationPartyIds: string[];
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

type MaterialReceiptExcelLineInput = MaterialReceiptLineInput & {
  receivingPartyId: string | null;
  items: Array<
    MaterialReceiptLineInput['items'][number] & {
      code?: string;
      linkedCodes: Array<{ label: string; value: string }>;
    }
  >;
};

export interface MaterialReceiptExcelImportValues {
  warehouseId: string;
  note: string;
  requestRegistrationScope: 'all' | 'selected';
  requestRegistrationPartyIds: string[];
  lines: MaterialReceiptExcelLineInput[];
}

const inMemoryReceiptImportRequestIds = new Map<string, string>();

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
}

function isStorageObjectAlreadyPresent(error: unknown) {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return false;
  }
  const response = (error as { response?: { status?: number } }).response;
  return response?.status === 409;
}

async function materialReceiptImportFingerprint(
  values: MaterialReceiptExcelImportValues,
) {
  const lines = await Promise.all(
    values.lines.map(async (line) => ({
      ...line,
      representative: line.representative
        ? {
            ...line.representative,
            images: await Promise.all(
              line.representative.images.map(async (image) => ({
                id: image.id,
                fileName: image.file?.name ?? null,
                fileType: image.file?.type ?? null,
                storageBucket: image.storageBucket ?? null,
                storagePath: image.storagePath ?? null,
                externalUrl: image.externalUrl ?? null,
                sortOrder: image.sortOrder,
                isCover: image.isCover,
                fileHash: image.file
                  ? toHex(
                      await crypto.subtle.digest(
                        'SHA-256',
                        await image.file.arrayBuffer(),
                      ),
                    )
                  : null,
              })),
            ),
          }
        : undefined,
    })),
  );
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      warehouseId: values.warehouseId,
      note: values.note,
      requestRegistrationScope: values.requestRegistrationScope,
      requestRegistrationPartyIds: values.requestRegistrationPartyIds,
      lines,
    }),
  );
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

/** Saves an Excel receipt and its pending allocations in one idempotent RPC. */
export async function importMaterialReceiptFromExcel(
  actorUserId: string,
  values: MaterialReceiptExcelImportValues,
) {
  assertSupabaseConfigured();
  const fingerprint = await materialReceiptImportFingerprint(values);
  const requestStorageKey = `material-receipt-excel-request:${actorUserId}:${fingerprint}`;
  let requestId =
    getStorageItem<string>(requestStorageKey) ??
    inMemoryReceiptImportRequestIds.get(requestStorageKey);
  if (!requestId) {
    requestId = crypto.randomUUID();
    inMemoryReceiptImportRequestIds.set(requestStorageKey, requestId);
    setStorageItem(requestStorageKey, requestId);
  }

  const uploadedPaths: string[] = [];
  const lines = await Promise.all(
    values.lines.map(async (line, lineIndex) => {
      const representative = line.representative;
      if (!representative) return line;
      const images = await Promise.all(
        representative.images.map(async (image, imageIndex) => {
          let storageBucket = image.storageBucket ?? null;
          let storagePath = image.storagePath ?? null;
          let externalUrl = image.externalUrl ?? null;
          if (image.file) {
            const safeName =
              image.file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100) ||
              'image';
            storageBucket = MATERIAL_IMAGES_BUCKET;
            storagePath = `parties/${values.warehouseId}/objects/receipt-imports/${actorUserId}/${requestId}/line${lineIndex}-image${imageIndex}-${safeName}`;
            externalUrl = null;
            try {
              await uploadStorageObject({
                bucket: storageBucket,
                path: storagePath,
                file: image.file,
              });
            } catch (error) {
              // A previous attempt with this content/request key may already
              // have staged the file. The deterministic path binds that object
              // to the same fingerprint, so a storage 409 is safe to reuse.
              if (!isStorageObjectAlreadyPresent(error)) throw error;
            }
            uploadedPaths.push(storagePath);
          }
          return {
            ...(image.id ? { id: image.id } : {}),
            storageBucket,
            storagePath,
            externalUrl: storagePath ? null : externalUrl,
            sortOrder: imageIndex,
            isCover: image.isCover,
          };
        }),
      );
      return {
        ...line,
        representative: { ...representative, images },
      };
    }),
  );

  try {
    const receiptId = await request<string>(
      supabaseApi.post('/rpc/import_material_receipt_from_excel', {
        p_request_id: requestId,
        p_values: { ...values, lines },
      }),
    );
    try {
      globalThis.localStorage.removeItem(requestStorageKey);
    } catch {
      // The RPC result is authoritative if browser storage is unavailable.
    }
    inMemoryReceiptImportRequestIds.delete(requestStorageKey);
    return receiptId;
  } catch (error) {
    const response =
      typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { status?: number } }).response
        : undefined;
    const isDefinitiveClientFailure = Boolean(
      response?.status &&
      response.status >= 400 &&
      response.status < 500 &&
      ![408, 425, 429].includes(response.status),
    );
    if (isDefinitiveClientFailure) {
      try {
        globalThis.localStorage.removeItem(requestStorageKey);
      } catch {
        // Best effort; a subsequent retry still reuses the server request key.
      }
      inMemoryReceiptImportRequestIds.delete(requestStorageKey);
      if (uploadedPaths.length) {
        await removeStorageObjects(MATERIAL_IMAGES_BUCKET, uploadedPaths).catch(
          () => undefined,
        );
      }
    }
    // Preserve the request key and staged paths for network/5xx retries. A
    // retry with the same content reuses both and cannot create a second receipt.
    throw error;
  }
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

export async function previewMaterialReceiptInlineUpdate(input: {
  id: string;
  expectedVersion: number;
  warehouseId: string;
  lines: MaterialReceiptLineInput[];
}) {
  assertSupabaseConfigured();
  return request<MaterialReceiptInlineUpdatePreview>(
    supabaseApi.post('/rpc/preview_material_receipt_inline_update', {
      p_id: input.id,
      p_expected_version: input.expectedVersion,
      p_warehouse_id: input.warehouseId,
      p_lines: input.lines,
    }),
  );
}

export async function applyMaterialReceiptInlineUpdate(input: {
  id: string;
  expectedVersion: number;
  previewToken: string;
  warehouseId: string;
  note: string;
  lines: MaterialReceiptLineInput[];
  cancelHandoverIds: string[];
}) {
  assertSupabaseConfigured();
  return request<string>(
    supabaseApi.post('/rpc/apply_material_receipt_inline_update', {
      p_id: input.id,
      p_expected_version: input.expectedVersion,
      p_preview_token: input.previewToken,
      p_warehouse_id: input.warehouseId,
      p_note: input.note,
      p_lines: input.lines,
      p_cancel_handover_ids: input.cancelHandoverIds,
    }),
  );
}
