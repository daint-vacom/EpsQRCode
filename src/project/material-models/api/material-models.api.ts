import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  MaterialModel,
  MaterialModelFormValues,
  MaterialModelRow,
} from '../model/material-model';
import { mapMaterialModelRow } from '../model/material-model';

function queryParams(params: Record<string, string>) {
  return { params };
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadMaterialModels(
  signal?: AbortSignal,
): Promise<MaterialModel[]> {
  assertSupabaseConfigured();
  const rows = await request<MaterialModelRow[]>(
    supabaseApi.post('/rpc/list_material_models', {}, { signal }),
  );
  return rows.map(mapMaterialModelRow);
}

export async function createMaterialModel(
  values: MaterialModelFormValues,
): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.post('/material_models', {
      code: values.code.trim(),
      name: values.name.trim(),
      image_url: values.imageUrl.trim() || null,
      description: values.description.trim() || null,
    }),
  );
}

export async function updateMaterialModel(
  id: string,
  values: MaterialModelFormValues,
): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.patch(
      '/material_models',
      {
        code: values.code.trim(),
        name: values.name.trim(),
        image_url: values.imageUrl.trim() || null,
        description: values.description.trim() || null,
      },
      {
        ...queryParams({ id: `eq.${id}` }),
        headers: { Prefer: 'return=minimal' },
      },
    ),
  );
}

export async function updateMaterialModelAvailability(
  id: string,
  isActive: boolean,
): Promise<Pick<MaterialModelRow, 'id' | 'is_active' | 'updated_at'>> {
  assertSupabaseConfigured();
  const rows = await request<
    Pick<MaterialModelRow, 'id' | 'is_active' | 'updated_at'>[]
  >(
    supabaseApi.patch(
      '/material_models',
      { is_active: isActive },
      {
        ...queryParams({ id: `eq.${id}`, select: 'id,is_active,updated_at' }),
        headers: { Prefer: 'return=representation' },
      },
    ),
  );
  if (!rows[0]) throw new Error('Không tìm thấy mẫu vật tư để cập nhật.');
  return rows[0];
}

export async function deleteMaterialModel(id: string): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.delete('/material_models', queryParams({ id: `eq.${id}` })),
  );
}
