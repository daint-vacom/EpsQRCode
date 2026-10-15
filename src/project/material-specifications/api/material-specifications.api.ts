import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  MaterialSpecification,
  MaterialSpecificationFormValues,
  MaterialSpecificationRow,
} from '../model/material-specification';
import { mapMaterialSpecificationRow } from '../model/material-specification';

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

function toPayload(values: MaterialSpecificationFormValues) {
  const isMeasurement = ['number', 'length', 'weight'].includes(
    values.dataType,
  );
  const defaultValue = values.defaultValue;
  const valueUnit =
    values.dataType === 'length' || values.dataType === 'weight'
      ? values.unit
      : values.unit.trim() || undefined;
  let normalizedDefaultValue: MaterialSpecificationFormValues['defaultValue'] =
    null;
  if (Array.isArray(defaultValue)) {
    const validOptionIds = new Set(values.options.map((option) => option.id));
    normalizedDefaultValue = defaultValue.filter((value) =>
      validOptionIds.has(value),
    );
  } else if (
    values.dataType === 'text' ||
    values.dataType === 'date' ||
    values.dataType === 'color'
  ) {
    normalizedDefaultValue =
      typeof defaultValue === 'string' ? defaultValue : null;
  } else if (values.dataType === 'boolean') {
    normalizedDefaultValue =
      typeof defaultValue === 'boolean' ? defaultValue : null;
  } else if (isMeasurement) {
    normalizedDefaultValue =
      typeof defaultValue === 'object' &&
      defaultValue !== null &&
      'amount' in defaultValue
        ? { amount: defaultValue.amount, unit: valueUnit || undefined }
        : null;
  }
  return {
    name: values.name.trim(),
    data_type: values.dataType,
    unit: values.dataType === 'number' ? values.unit.trim() || null : null,
    description: values.description.trim() || null,
    options: values.options,
    default_value: normalizedDefaultValue,
  };
}

export async function loadMaterialSpecifications(
  signal?: AbortSignal,
): Promise<MaterialSpecification[]> {
  assertSupabaseConfigured();
  const rows = await request<MaterialSpecificationRow[]>(
    supabaseApi.post('/rpc/list_material_specifications', {}, { signal }),
  );
  return rows.map(mapMaterialSpecificationRow);
}

export async function createMaterialSpecification(
  values: MaterialSpecificationFormValues,
): Promise<void> {
  assertSupabaseConfigured();
  const payload: ReturnType<typeof toPayload> & { code?: string } =
    toPayload(values);
  if (values.codeMode === 'manual') payload.code = values.code.trim();
  await request(supabaseApi.post('/material_specifications', payload));
}

export async function updateMaterialSpecification(
  id: string,
  values: MaterialSpecificationFormValues,
): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.patch(
      '/material_specifications',
      { code: values.code.trim(), ...toPayload(values) },
      {
        params: { id: `eq.${id}` },
        headers: { Prefer: 'return=minimal' },
      },
    ),
  );
}

export async function deleteMaterialSpecification(id: string): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.delete('/material_specifications', {
      params: { id: `eq.${id}` },
    }),
  );
}
