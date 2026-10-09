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

export async function createMaterialGroup(
  values: MaterialGroupFormValues,
): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.post('/material_groups', {
      code: values.code.trim(),
      name: values.name.trim(),
      description: values.description.trim() || null,
    }),
  );
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
      },
      {
        ...queryParams({ id: `eq.${id}` }),
        headers: { Prefer: 'return=minimal' },
      },
    ),
  );
}

export async function deleteMaterialGroup(id: string): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.delete('/material_groups', queryParams({ id: `eq.${id}` })),
  );
}
