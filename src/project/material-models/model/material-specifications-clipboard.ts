import { materialSpecificationDataTypeSchema } from '@/project/material-specifications/model/material-specification';
import { z } from 'zod';
import type { MaterialModelSpecification } from './material-model';

export const MATERIAL_SPECIFICATIONS_CLIPBOARD_KEY =
  'epsqrcode.material-specifications.clipboard.v1';
export const MATERIAL_SPECIFICATIONS_CLIPBOARD_TYPE =
  'epsqrcode.material-specifications';

const clipboardItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  dataType: materialSpecificationDataTypeSchema,
  isList: z.boolean(),
  isPublic: z.boolean(),
  values: z.array(z.string()),
  valueLabels: z.array(z.string()),
});

export const materialSpecificationsClipboardSchema = z.object({
  type: z.literal(MATERIAL_SPECIFICATIONS_CLIPBOARD_TYPE),
  version: z.literal(1),
  sourceMode: z.literal('model'),
  copiedAt: z.number().int().nonnegative(),
  items: z.array(clipboardItemSchema).min(1),
});

export type MaterialSpecificationsClipboardItem = z.infer<
  typeof clipboardItemSchema
>;
export type MaterialSpecificationsClipboard = z.infer<
  typeof materialSpecificationsClipboardSchema
>;

function createClipboard(
  sourceMode: MaterialSpecificationsClipboard['sourceMode'],
  items: MaterialSpecificationsClipboardItem[],
  copiedAt = Date.now(),
): MaterialSpecificationsClipboard | null {
  if (items.length === 0) return null;

  return {
    type: MATERIAL_SPECIFICATIONS_CLIPBOARD_TYPE,
    version: 1,
    sourceMode,
    copiedAt,
    items,
  };
}

function normalizeValues(values: string[], labels: string[]) {
  return values.flatMap((value, index) => {
    const normalizedValue = value.trim();
    return normalizedValue
      ? [{ value: normalizedValue, label: labels[index]?.trim() ?? '' }]
      : [];
  });
}

export function createModelSpecificationsClipboard(
  specifications: MaterialModelSpecification[],
  copiedAt?: number,
): MaterialSpecificationsClipboard | null {
  const items = specifications.flatMap((specification) => {
    const name = specification.name.trim();
    const normalizedValues = normalizeValues(
      specification.values,
      specification.valueLabels,
    );
    if (!name || normalizedValues.length === 0) return [];

    return [
      {
        id: specification.id,
        name,
        dataType: specification.dataType,
        isList: specification.isList,
        isPublic: specification.isPublic,
        values: normalizedValues.map(({ value }) => value),
        valueLabels: normalizedValues.map(({ label }) => label),
      },
    ];
  });

  return createClipboard('model', items, copiedAt);
}

function getNameKey(name: string) {
  return name
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('vi');
}

function getUniqueSpecificationName(name: string, existingNames: Set<string>) {
  const baseName = name.trim();
  if (!existingNames.has(getNameKey(baseName))) return baseName;

  let suffix = 1;
  while (existingNames.has(getNameKey(`${baseName} (${suffix})`))) {
    suffix += 1;
  }
  return `${baseName} (${suffix})`;
}

function createAppendedSpecification(
  item: MaterialSpecificationsClipboardItem,
  name: string,
): MaterialModelSpecification | null {
  if (item.values.length === 0) return null;

  return {
    id: crypto.randomUUID(),
    name,
    dataType: item.dataType,
    isList: item.isList,
    isPublic: item.isPublic,
    values: item.values,
    valueLabels: item.valueLabels,
  };
}

export function appendClipboardToModelSpecifications(
  existing: MaterialModelSpecification[],
  clipboard: MaterialSpecificationsClipboard,
) {
  const existingNames = new Set(
    existing
      .map((specification) => specification.name.trim())
      .filter(Boolean)
      .map(getNameKey),
  );
  const appended: MaterialModelSpecification[] = [];
  let skipped = 0;

  for (const item of clipboard.items) {
    const name = getUniqueSpecificationName(item.name, existingNames);
    const specification = createAppendedSpecification(item, name);
    if (!specification) {
      skipped += 1;
      continue;
    }
    appended.push(specification);
    existingNames.add(getNameKey(name));
  }

  return { specifications: appended, skipped };
}
