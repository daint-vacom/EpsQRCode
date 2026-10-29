import { materialSpecificationDataTypeSchema } from '@/project/material-specifications/model/material-specification';
import { z } from 'zod';

export const materialModelSpecificationSchema = z
  .object({
    id: z.string().uuid(),
    dataType: materialSpecificationDataTypeSchema,
    name: z.string().trim().min(1, 'Vui lòng nhập tên thông số.'),
    isList: z.boolean(),
    isPublic: z.boolean(),
    valueLabels: z.array(z.string().trim()),
    values: z
      .array(z.string().trim())
      .min(1, 'Mỗi thông số cần ít nhất một giá trị.')
      .refine((values) => values.some((value) => value.length > 0), {
        message: 'Vui lòng nhập ít nhất một giá trị.',
      }),
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
  externalCodesText: z.string(),
  requiresInspection: z.boolean(),
  specifications: z.array(materialModelSpecificationSchema),
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
export type MaterialModelSpecification = z.infer<
  typeof materialModelSpecificationSchema
>;

export interface MaterialModel {
  id: string;
  code: string;
  name: string;
  groupId: string | null;
  images: MaterialModelImage[];
  imageUrl: string | null;
  description: string;
  externalCodes: string[];
  requiresInspection: boolean;
  specifications: MaterialModelSpecification[];
  publicDisplaySettings: MaterialPublicDisplaySettings;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  external_codes: string[];
  requires_inspection: boolean;
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
    images,
    imageUrl: cover?.url ?? null,
    description: row.description ?? '',
    externalCodes: row.external_codes ?? [],
    requiresInspection: row.requires_inspection,
    specifications: row.specifications,
    publicDisplaySettings: row.public_display_settings,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
