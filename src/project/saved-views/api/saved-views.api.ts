import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  SavedView,
  SavedViewConfig,
  SavedViewResource,
} from '../model/saved-view';

interface SavedViewRow {
  id: string;
  resource: SavedViewResource;
  name: string;
  config: Record<string, unknown>;
  is_default: boolean;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function queryParams(params: Record<string, string>) {
  return { params };
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

function mapSavedView<TFilters extends object>(
  row: SavedViewRow,
): SavedView<TFilters> {
  return {
    id: row.id,
    resource: row.resource,
    name: row.name,
    config: row.config as unknown as SavedViewConfig<TFilters>,
    isDefault: row.is_default,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadSavedViews<TFilters extends object>(
  resource: SavedViewResource,
  signal?: AbortSignal,
): Promise<SavedView<TFilters>[]> {
  assertSupabaseConfigured();

  const rows = await request<SavedViewRow[]>(
    supabaseApi.get('/saved_views', {
      ...queryParams({
        select:
          'id,resource,name,config,is_default,version,created_by,updated_by,created_at,updated_at',
        resource: `eq.${resource}`,
        order: 'is_default.desc,created_at.asc,name.asc',
      }),
      signal,
    }),
  );

  return rows.map((row) => mapSavedView<TFilters>(row));
}

export async function createSavedView<TFilters extends object>(
  userId: string,
  resource: SavedViewResource,
  name: string,
  config: SavedViewConfig<TFilters>,
): Promise<SavedView<TFilters>> {
  assertSupabaseConfigured();

  const rows = await request<SavedViewRow[]>(
    supabaseApi.post(
      '/saved_views',
      {
        resource,
        name: name.trim(),
        config,
        created_by: userId,
        updated_by: userId,
      },
      {
        headers: { Prefer: 'return=representation' },
      },
    ),
  );
  if (!rows[0]) throw new Error('Không thể tạo chế độ xem.');

  return mapSavedView<TFilters>(rows[0]);
}

export async function updateSavedView<TFilters extends object>(
  userId: string,
  view: SavedView<TFilters>,
  name: string,
  config: SavedViewConfig<TFilters>,
): Promise<SavedView<TFilters>> {
  assertSupabaseConfigured();

  const rows = await request<SavedViewRow[]>(
    supabaseApi.patch(
      '/saved_views',
      {
        name: name.trim(),
        config,
        version: view.version + 1,
        updated_by: userId,
      },
      {
        ...queryParams({
          id: `eq.${view.id}`,
          version: `eq.${view.version}`,
        }),
        headers: { Prefer: 'return=representation' },
      },
    ),
  );
  if (!rows[0]) {
    throw new Error(
      'Chế độ xem đã được cập nhật bởi tài khoản khác. Vui lòng tải lại trang.',
    );
  }

  return mapSavedView<TFilters>(rows[0]);
}

export async function deleteSavedView(viewId: string): Promise<void> {
  assertSupabaseConfigured();
  await supabaseApi.delete('/saved_views', queryParams({ id: `eq.${viewId}` }));
}
