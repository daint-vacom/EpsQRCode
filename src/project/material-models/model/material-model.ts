import {
  safetyInspectionChecklistSchema,
  type SafetyInspectionChecklistGroup,
} from '@/project/material-safety-inspections/model/safety-inspection-checklist';
import { materialSpecificationDataTypeSchema } from '@/project/material-specifications/model/material-specification';
import {
  linkedCodesSchema,
  type LinkedCode,
} from '@/project/materials/model/linked-code';
import { z } from 'zod';
import { formatMessage } from '@/lib/validation';

export const materialModelSpecificationSchema = z
  .object({
    id: z.string().uuid(),
    dataType: materialSpecificationDataTypeSchema,
    name: z.string().trim().min(1, 'Vui lòng nhập tên thông số.'),
    isList: z.boolean(),
    isPublic: z.boolean(),
    valueLabels: z.array(z.string().trim()),
    values: z.array(z.string().trim()),
  })
  .superRefine((specification, context) => {
    if (!specification.isList && specification.values.length > 1) {
      context.addIssue({
        code: 'custom',
        path: ['values'],
        message: 'Thông số dạng đơn chỉ được có một giá trị.',
      });
    }
  });

export const materialModelFormSchema = z.object({
  code: z.string().trim(),
  codeMode: z.enum(['auto', 'manual']),
  name: z.string().trim().min(1, 'Vui lòng nhập tên mẫu.'),
  groupId: z.string().min(1, 'Vui lòng chọn nhóm vật tư.'),
  description: z.string().trim(),
  manufacturer: z.string().trim(),
  unit: z.string().trim(),
  unitPriceDefault: z.preprocess(
    (value) =>
      value === '' || value === undefined || value === null ? null : value,
    z.coerce.number().min(0, 'Đơn giá không được âm.').nullable(),
  ),
  linkedCodes: linkedCodesSchema,
  requiresInspection: z.boolean(),
  inspectionIntervalValue: z.coerce
    .number({ error: () => formatMessage('validation.required') })
    .int({ error: () => formatMessage('validation.number.int') })
    .min(1, {
      error: () => formatMessage('validation.number.min', { min: 1 }),
    }),
  inspectionIntervalUnit: z.enum(['day', 'month']),
  skipInitialInspection: z.boolean(),
  useGroupSafetyInspectionChecklist: z.boolean(),
  specifications: z.array(materialModelSpecificationSchema),
  safetyInspectionChecklist: safetyInspectionChecklistSchema,
});

export interface MaterialPublicDisplaySettings {
  basicInfo: boolean;
  specifications: boolean;
}

export const DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS: MaterialPublicDisplaySettings =
  {
    basicInfo: true,
    specifications: true,
  };

export function mapPublicSpecificationSettings(
  specifications: MaterialModelSpecification[],
  overrides: Record<string, boolean> = {},
): Record<string, boolean> {
  return Object.fromEntries(
    specifications.map((specification) => [
      specification.id,
      overrides[specification.id] ?? specification.isPublic,
    ]),
  );
}

export type MaterialModelFormValues = z.infer<typeof materialModelFormSchema>;
export type MaterialModelInspectionIntervalUnit =
  MaterialModelFormValues['inspectionIntervalUnit'];
export type MaterialModelSpecification = z.infer<
  typeof materialModelSpecificationSchema
>;

export interface MaterialGroupModelCounts {
  counts: Record<string, number>;
  total: number;
}

export interface MaterialModel {
  id: string;
  code: string;
  name: string;
  groupId: string | null;
  manufacturer: string;
  unit: string;
  unitPriceDefault: number | null;
  images: MaterialModelImage[];
  imageUrl: string | null;
  description: string;
  externalCodes: string[];
  linkedCodes: LinkedCode[];
  requiresInspection: boolean;
  inspectionIntervalValue: number;
  inspectionIntervalUnit: MaterialModelInspectionIntervalUnit;
  skipInitialInspection: boolean;
  useGroupSafetyInspectionChecklist: boolean;
  specifications: MaterialModelSpecification[];
  safetyInspectionChecklist?: SafetyInspectionChecklistGroup[];
  publicDisplaySettings: MaterialPublicDisplaySettings;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialModelFilterSummary {
  total: number;
  active: number;
  inactive: number;
  requiresInspection: number;
  notRequiresInspection: number;
}

export interface MaterialModelImage {
  id: string;
  storagePath: string | null;
  externalUrl: string | null;
  url: string;
  sortOrder: number;
  isCover: boolean;
}

export interface MaterialModelImageDraft {
  id?: string;
  storagePath?: string | null;
  externalUrl?: string | null;
  url: string;
  sortOrder: number;
  isCover: boolean;
  file?: File;
  previewUrl?: string;
}

export interface MaterialModelRow {
  id: string;
  code: string;
  name: string;
  group_id: string | null;
  description: string | null;
  manufacturer: string | null;
  unit: string | null;
  unit_price_default: number | null;
  external_codes: string[];
  linked_codes: LinkedCode[];
  requires_inspection: boolean;
  inspection_interval_value: number;
  inspection_interval_unit: MaterialModelInspectionIntervalUnit;
  skip_initial_inspection: boolean;
  use_group_safety_inspection_checklist: boolean;
  specifications: MaterialModelSpecification[];
  public_display_settings: MaterialPublicDisplaySettings;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function mapMaterialModelRow(
  row: MaterialModelRow,
  images: MaterialModelImage[] = [],
): MaterialModel {
  const cover = images.find((image) => image.isCover);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    groupId: row.group_id,
    manufacturer: row.manufacturer ?? '',
    unit: row.unit ?? '',
    unitPriceDefault: row.unit_price_default,
    images,
    imageUrl: cover?.url ?? null,
    description: row.description ?? '',
    externalCodes: row.external_codes ?? [],
    linkedCodes: row.linked_codes ?? [],
    requiresInspection: row.requires_inspection,
    inspectionIntervalValue: row.inspection_interval_value,
    inspectionIntervalUnit: row.inspection_interval_unit,
    skipInitialInspection: row.skip_initial_inspection,
    useGroupSafetyInspectionChecklist:
      row.use_group_safety_inspection_checklist,
    specifications: row.specifications,
    safetyInspectionChecklist: [],
    publicDisplaySettings: row.public_display_settings,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
