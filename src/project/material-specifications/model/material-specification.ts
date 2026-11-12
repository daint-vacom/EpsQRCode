import { z } from 'zod';

export const materialSpecificationOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1, 'Vui lòng nhập giá trị gợi ý.'),
  name: z.string().trim().optional(),
});

export const materialSpecificationDataTypeSchema = z.enum([
  'text',
  'number',
  'boolean',
  'date',
  'color',
  'length',
  'weight',
]);

export const MATERIAL_SPECIFICATION_LENGTH_UNITS = [
  'mm',
  'cm',
  'dm',
  'm',
  'km',
] as const;

export const MATERIAL_SPECIFICATION_WEIGHT_UNITS = [
  'mg',
  'g',
  'kg',
  't',
] as const;

export function getMaterialSpecificationUnits(
  dataType: MaterialSpecificationDataType,
): readonly string[] {
  if (dataType === 'length') return MATERIAL_SPECIFICATION_LENGTH_UNITS;
  if (dataType === 'weight') return MATERIAL_SPECIFICATION_WEIGHT_UNITS;
  return [];
}

const defaultValueSchema = z.union([
  z.string(),
  z.boolean(),
  z.array(z.string()),
  z.object({ amount: z.number(), unit: z.string().optional() }),
]);

export const materialSpecificationFormSchema = z
  .object({
    code: z.string().trim(),
    codeMode: z.enum(['auto', 'manual']),
    name: z.string().trim().min(1, 'Vui lòng nhập tên thông số.'),
    dataType: materialSpecificationDataTypeSchema,
    unit: z.string().trim(),
    description: z.string().trim(),
    options: z.array(materialSpecificationOptionSchema),
    defaultValue: defaultValueSchema.nullable(),
  })
  .superRefine((values, context) => {
    if (values.codeMode === 'manual' && !values.code) {
      context.addIssue({
        code: 'custom',
        path: ['code'],
        message: 'Vui lòng nhập mã thông số.',
      });
    }
    const normalizedLabels = values.options.map((option) =>
      option.label.toLocaleLowerCase('vi'),
    );
    if (new Set(normalizedLabels).size !== normalizedLabels.length) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Giá trị gợi ý không được trùng nhau.',
      });
    }

    if (
      values.dataType === 'color' &&
      values.options.some(
        (option) => !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(option.label),
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Mỗi giá trị gợi ý phải là một mã màu hợp lệ.',
      });
    }

    if (
      ['number', 'length', 'weight'].includes(values.dataType) &&
      values.options.some(
        (option) =>
          option.label.trim() !== '' && !Number.isFinite(Number(option.label)),
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Giá trị gợi ý phải là một số hợp lệ.',
      });
    }

    if (
      (values.dataType === 'length' || values.dataType === 'weight') &&
      typeof values.defaultValue === 'object' &&
      values.defaultValue !== null &&
      'amount' in values.defaultValue &&
      !getMaterialSpecificationUnits(values.dataType).includes(values.unit)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['defaultValue'],
        message: 'Vui lòng chọn đơn vị phù hợp với kiểu dữ liệu.',
      });
    }
  });

export type MaterialSpecificationFormValues = z.infer<
  typeof materialSpecificationFormSchema
>;
export type MaterialSpecificationDataType =
  MaterialSpecificationFormValues['dataType'];
export type MaterialSpecificationOption = z.infer<
  typeof materialSpecificationOptionSchema
>;
export type MaterialSpecificationValue =
  | string
  | boolean
  | string[]
  | { amount: number; unit?: string };

export const MATERIAL_SPECIFICATION_DATA_TYPE_CONFIG: Record<
  MaterialSpecificationDataType,
  { supportsSuggestions: boolean; supportsMultipleValues: boolean }
> = {
  text: { supportsSuggestions: true, supportsMultipleValues: true },
  number: { supportsSuggestions: true, supportsMultipleValues: true },
  boolean: { supportsSuggestions: false, supportsMultipleValues: false },
  date: { supportsSuggestions: false, supportsMultipleValues: false },
  color: { supportsSuggestions: true, supportsMultipleValues: true },
  length: { supportsSuggestions: true, supportsMultipleValues: true },
  weight: { supportsSuggestions: true, supportsMultipleValues: true },
};

export function supportsMaterialSpecificationSuggestions(
  dataType: MaterialSpecificationDataType,
) {
  return MATERIAL_SPECIFICATION_DATA_TYPE_CONFIG[dataType].supportsSuggestions;
}

export function supportsMultipleMaterialSpecificationValues(
  dataType: MaterialSpecificationDataType,
) {
  return MATERIAL_SPECIFICATION_DATA_TYPE_CONFIG[dataType]
    .supportsMultipleValues;
}

export interface MaterialSpecification {
  id: string;
  code: string;
  name: string;
  dataType: MaterialSpecificationDataType;
  unit: string;
  description: string;
  options: MaterialSpecificationOption[];
  defaultValue: MaterialSpecificationValue | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialSpecificationFilterSummary {
  total: number;
  text: number;
  number: number;
  boolean: number;
  date: number;
  color: number;
  length: number;
  weight: number;
}

export interface MaterialSpecificationRow {
  id: string;
  code: string;
  name: string;
  data_type: MaterialSpecificationDataType;
  unit: string | null;
  description: string | null;
  options: MaterialSpecificationOption[];
  default_value: MaterialSpecificationValue | null;
  created_at: string;
  updated_at: string;
}

export const MATERIAL_SPECIFICATION_DATA_TYPES: Record<
  MaterialSpecificationDataType,
  string
> = {
  text: 'Văn bản',
  number: 'Số + đơn vị',
  boolean: 'Có / Không',
  date: 'Ngày tháng',
  color: 'Màu sắc',
  length: 'Độ dài',
  weight: 'Cân nặng',
};

export const materialSpecificationDefaultValues: MaterialSpecificationFormValues =
  {
    code: '',
    codeMode: 'auto',
    name: '',
    dataType: 'text',
    unit: '',
    description: '',
    options: [],
    defaultValue: null,
  };

export function mapMaterialSpecificationRow(
  row: MaterialSpecificationRow,
): MaterialSpecification {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    dataType: row.data_type,
    unit: row.unit ?? '',
    description: row.description ?? '',
    options: row.options ?? [],
    defaultValue: row.default_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMaterialSpecificationToFormValues(
  specification: MaterialSpecification,
): MaterialSpecificationFormValues {
  const defaultValue = specification.defaultValue;
  const mappedDefaultValue = supportsMaterialSpecificationSuggestions(
    specification.dataType,
  )
    ? Array.isArray(defaultValue)
      ? [...defaultValue]
      : typeof defaultValue === 'object' && defaultValue !== null
        ? { ...defaultValue }
        : defaultValue
    : specification.dataType === 'boolean'
      ? typeof defaultValue === 'boolean'
        ? defaultValue
        : null
      : typeof defaultValue === 'string'
        ? defaultValue
        : null;

  return {
    code: specification.code,
    name: specification.name,
    dataType: specification.dataType,
    unit:
      (specification.dataType === 'length' ||
        specification.dataType === 'weight') &&
      typeof specification.defaultValue === 'object' &&
      specification.defaultValue !== null &&
      'unit' in specification.defaultValue
        ? (specification.defaultValue.unit ??
          getMaterialSpecificationUnits(specification.dataType)[0] ??
          '')
        : specification.dataType === 'length' ||
            specification.dataType === 'weight'
          ? (getMaterialSpecificationUnits(specification.dataType)[0] ?? '')
          : specification.unit,
    description: specification.description,
    options: supportsMaterialSpecificationSuggestions(specification.dataType)
      ? specification.options.map((option) => ({ ...option }))
      : [],
    defaultValue: mappedDefaultValue,
    codeMode: 'manual',
  };
}
