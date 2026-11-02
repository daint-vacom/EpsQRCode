import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  MaterialGroup,
  MaterialGroupFormValues,
  MaterialGroupRow,
} from '../model/material-group';
import { mapMaterialGroupRow } from '../model/material-group';

function queryParams(params: Record<string, string>) {
  return { params };
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadMaterialGroups(
  signal?: AbortSignal,
): Promise<MaterialGroup[]> {
  assertSupabaseConfigured();
  const rows = await request<MaterialGroupRow[]>(
    supabaseApi.post('/rpc/list_material_groups', {}, { signal }),
  );
  return rows.map(mapMaterialGroupRow);
}

export async function loadAvailableMaterialGroups(
  signal?: AbortSignal,
): Promise<MaterialGroup[]> {
  assertSupabaseConfigured();
  const rows = await request<MaterialGroupRow[]>(
    supabaseApi.get('/material_groups', {
      ...queryParams({
        select:
          'id,code,name,description,specifications,is_active,created_at,updated_at',
        is_active: 'eq.true',
        order: 'name.asc,id.asc',
      }),
      signal,
    }),
  );
  return rows.map(mapMaterialGroupRow);
}

export async function loadMaterialGroupById(
  id: string,
  signal?: AbortSignal,
): Promise<MaterialGroup> {
  assertSupabaseConfigured();
  const rows = await request<MaterialGroupRow[]>(
    supabaseApi.get('/material_groups', {
      ...queryParams({
        select:
          'id,code,name,description,specifications,is_active,created_at,updated_at',
        id: `eq.${id}`,
      }),
      signal,
    }),
  );
  if (!rows[0]) throw new Error('Không tìm thấy nhóm vật tư.');
  return mapMaterialGroupRow(rows[0]);
}

export async function createMaterialGroup(
  values: MaterialGroupFormValues,
): Promise<void> {
  assertSupabaseConfigured();
  const payload: {
    code?: string;
    name: string;
    description: string | null;
    specifications: MaterialGroupFormValues['specifications'];
  } = {
    name: values.name.trim(),
    description: values.description.trim() || null,
    specifications: values.specifications,
  };
  if (values.codeMode === 'manual') payload.code = values.code.trim();
  await request(supabaseApi.post('/material_groups', payload));
}

export async function updateMaterialGroup(
  id: string,
  values: MaterialGroupFormValues,
): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.patch(
      '/material_groups',
      {
        code: values.code.trim(),
        name: values.name.trim(),
        description: values.description.trim() || null,
        specifications: values.specifications,
      },
      {
        ...queryParams({ id: `eq.${id}` }),
        headers: { Prefer: 'return=minimal' },
      },
    ),
  );
}

export async function updateMaterialGroupAvailability(
  id: string,
  isActive: boolean,
): Promise<Pick<MaterialGroupRow, 'id' | 'is_active' | 'updated_at'>> {
  assertSupabaseConfigured();
  const rows = await request<
    Pick<MaterialGroupRow, 'id' | 'is_active' | 'updated_at'>[]
  >(
    supabaseApi.patch(
      '/material_groups',
      { is_active: isActive },
      {
        ...queryParams({ id: `eq.${id}`, select: 'id,is_active,updated_at' }),
        headers: { Prefer: 'return=representation' },
      },
    ),
  );
  if (!rows[0]) throw new Error('Không tìm thấy nhóm vật tư để cập nhật.');
  return rows[0];
}

export async function deleteMaterialGroup(id: string): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.delete('/material_groups', queryParams({ id: `eq.${id}` })),
  );
}
