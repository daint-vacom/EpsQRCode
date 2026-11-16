import type {
  MaterialModelSpecification,
  MaterialPublicDisplaySettings,
} from '@/project/material-models/model/material-model';
import type {
  MaterialCondition,
  MaterialFormValues,
  MaterialImageDraft,
} from '@/project/materials/model/material';
import { z } from 'zod';
import { formatMessage } from '@/lib/validation/messages';

export type MaterialReceiptStatus =
  | 'draft'
  | 'handover'
  | 'completed'
  | 'cancelled';

export interface MaterialReceiptWarehouseSnapshot {
  id: string;
  code: string;
  name: string;
  type: 'warehouse';
}

export interface MaterialReceiptItem {
  id: string;
  materialId: string | null;
  representativeId?: string | null;
  serialNumber: string | null;
  condition: MaterialCondition;
  conditionNote: string | null;
  note: string;
  status: 'active' | 'voided';
  voidReason: string | null;
  material: Record<string, unknown> | null;
  currentSpecificationOverrides?: Record<string, string[]> | null;
  currentSpecificationOverrideLabels?: Record<string, string[]> | null;
}

export interface MaterialReceiptRepresentative {
  id: string;
  materialValues: MaterialFormValues;
  images: MaterialImageDraft[];
  publicDisplaySettings: MaterialPublicDisplaySettings;
  publicSpecificationSettings: Record<string, boolean>;
}

export type MaterialReceiptRepresentativeInput = Omit<
  MaterialReceiptRepresentative,
  'id'
>;

export interface MaterialReceiptLine {
  id: string;
  modelId: string | null;
  model: {
    id?: string;
    code?: string;
    name: string;
    groupId?: string;
    requiresInspection?: boolean;
    externalCodes?: string[];
    specifications?: MaterialModelSpecification[];
  };
  externalCode: string | null;
  quantity: number;
  sortOrder: number;
  specificationOverrides: Record<string, string[]>;
  specificationOverrideLabels: Record<string, string[]>;
  representative?: MaterialReceiptRepresentative | null;
  items: MaterialReceiptItem[];
}

export interface MaterialReceipt {
  id: string;
  code: string;
  status: MaterialReceiptStatus;
  warehouse: MaterialReceiptWarehouseSnapshot;
  warehouseId: string;
  note: string;
  version: number;
  createdBy: string;
  confirmedBy: string | null;
  completedBy: string | null;
  createdAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  totalItems: number;
  receivedItems: number;
  lines: MaterialReceiptLine[];
}

export interface MaterialReceiptNewModel {
  code: string;
  name: string;
  groupId: string;
  description: string;
  requiresInspection: boolean;
  specifications: Array<{ name: string; value: string }>;
}

export interface MaterialReceiptLineInput {
  lineId?: string;
  modelId: string | null;
  newModel?: MaterialReceiptNewModel;
  externalCode: string;
  quantity: number;
  sortOrder: number;
  specificationOverrides: Record<string, string[]>;
  specificationOverrideLabels: Record<string, string[]>;
  representative?: MaterialReceiptRepresentativeInput;
  items: Array<{
    receiptItemId?: string;
    serialNumber: string;
    condition: MaterialCondition;
    conditionNote: string;
    note: string;
  }>;
}

export interface MaterialReceiptFormLine {
  clientId: string;
  lineId: string;
  modelId: string;
  quantity: number;
  condition: MaterialCondition;
  note: string;
  conditionNote: string;
  specificationOverrides: Record<string, string[]>;
  specificationOverrideLabels: Record<string, string[]>;
  items: MaterialReceiptFormUnit[];
}

export interface MaterialReceiptFormUnit {
  receiptItemId?: string;
  serialNumber: string;
  condition: MaterialCondition;
  conditionNote: string;
  note: string;
}

export const materialReceiptFormSchema = z
  .object({
    warehouseId: z.string().min(1, 'Vui lòng chọn kho.'),
    note: z.string(),
    lines: z.array(
      z
        .object({
          clientId: z.string(),
          lineId: z.string(),
          modelId: z.string(),
          quantity: z.number().int().min(1).max(10000),
          condition: z.enum(['good', 'damaged']),
          note: z.string(),
          conditionNote: z.string(),
          specificationOverrides: z.record(z.string(), z.array(z.string())),
          specificationOverrideLabels: z.record(
            z.string(),
            z.array(z.string()),
          ),
          items: z.array(
            z.object({
              receiptItemId: z.string().optional(),
              serialNumber: z.string(),
              condition: z.enum(['good', 'damaged']),
              conditionNote: z.string(),
              note: z.string(),
            }),
          ),
        })
        .superRefine((line, context) => {
          if (!line.modelId) {
            context.addIssue({
              code: 'custom',
              path: ['modelId'],
              message: 'Vui lòng chọn mẫu vật tư.',
            });
          }
        }),
    ),
  })
  .superRefine((values, context) => {
    values.lines.forEach((line) => {
      if (
        line.condition === 'damaged' &&
        !line.note.trim() &&
        !line.conditionNote.trim() &&
        !values.note.trim()
      ) {
        context.addIssue({
          code: 'custom',
          path: ['note'],
          message: formatMessage('receipts.errors.damagedMaterialNote'),
        });
      }
    });
  });

export type MaterialReceiptFormValues = z.infer<
  typeof materialReceiptFormSchema
>;

export interface MaterialReceiptListFilters {
  search?: string;
  status?: MaterialReceiptStatus;
  warehouseId?: string;
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface MaterialReceiptListResult {
  items: MaterialReceipt[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MaterialReceiptFilterSummary {
  total: number;
  draft: number;
  handover: number;
  completed: number;
  cancelled: number;
}

export interface MaterialReceiptHistoryEntry {
  id: string;
  actorUserId: string;
  actorDisplayName: string | null;
  action:
    | 'created'
    | 'updated'
    | 'confirm'
    | 'complete'
    | 'reopen'
    | 'cancel'
    | 'adjusted';
  reason: string | null;
  fromStatus: MaterialReceiptStatus | null;
  toStatus: MaterialReceiptStatus | null;
  createdAt: string;
  beforeState: unknown;
  afterState: unknown;
}

export interface MaterialReceiptItemRow {
  id: string;
  receiptId: string;
  lineId: string;
  materialId: string | null;
  materialCode: string | null;
  materialName: string | null;
  modelCode: string | null;
  modelName: string | null;
  serialNumber: string | null;
  condition: MaterialCondition;
  conditionNote: string | null;
  note: string;
  status: 'active' | 'voided';
  voidReason: string | null;
  receiverOutcome: 'pending' | 'received' | 'not_received';
}

export interface MaterialReceiptItemsResult {
  items: MaterialReceiptItemRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MaterialReceiptAdjustmentPreview {
  receiptId: string;
  receiptVersion: number;
  previewToken: string;
  addCount: number;
  removeCount: number;
  removedItems: Array<{
    id: string;
    materialId: string | null;
    code: string | null;
  }>;
  affectedHandovers: Array<{
    id: string;
    code: string;
    status: string;
    version: number;
  }>;
  blockedItems: Array<{
    receiptItemId: string;
    materialId: string;
    code: string;
    reason: string;
  }>;
}

export const MATERIAL_RECEIPT_PERMISSION_CODES = {
  view: 'materials:receipt:view',
  manage: 'materials:receipt:manage',
} as const;

export function createMaterialReceiptLine(): MaterialReceiptFormLine {
  return {
    clientId: crypto.randomUUID(),
    lineId: '',
    modelId: '',
    quantity: 1,
    condition: 'good',
    note: '',
    conditionNote: '',
    specificationOverrides: {},
    specificationOverrideLabels: {},
    items: [
      { serialNumber: '', condition: 'good', conditionNote: '', note: '' },
    ],
  };
}

export function toMaterialReceiptLineInputs(
  values: MaterialReceiptFormValues,
  keepIds: boolean,
  preserveUnitConditions = false,
  representatives: Record<string, MaterialReceiptRepresentativeInput> = {},
): MaterialReceiptLineInput[] {
  return values.lines.map((line, sortOrder) => {
    const representative = representatives[line.clientId];
    return {
      ...(keepIds && line.lineId ? { lineId: line.lineId } : {}),
      modelId: line.modelId || null,
      externalCode: '',
      quantity: line.quantity,
      sortOrder,
      specificationOverrides: line.specificationOverrides,
      specificationOverrideLabels: line.specificationOverrideLabels,
      ...(representative?.materialValues.modelId === line.modelId
        ? { representative }
        : {}),
      items: Array.from({ length: line.quantity }, (_, index) => {
        const item = line.items[index] ?? {
          serialNumber: '',
          condition: line.condition,
          conditionNote: line.conditionNote,
          note: '',
        };
        const condition = preserveUnitConditions
          ? item.condition
          : line.condition;
        return {
          ...(keepIds && item.receiptItemId
            ? { receiptItemId: item.receiptItemId }
            : {}),
          serialNumber: item.serialNumber,
          condition,
          conditionNote:
            condition === 'damaged'
              ? item.conditionNote ||
                line.conditionNote ||
                line.note ||
                values.note
              : '',
          note: item.note || line.note,
        };
      }),
    };
  });
}
