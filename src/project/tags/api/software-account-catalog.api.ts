import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import {
  mapSoftwareAccountCatalogAccountTypes,
  type SoftwareAccountCatalog,
  type SoftwareAccountCatalogFormValues,
  type SoftwareAccountCatalogRpcRow,
} from '../model/software-account-catalog';

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

function mapCatalog(row: SoftwareAccountCatalogRpcRow): SoftwareAccountCatalog {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    groupId: row.group_id,
    name: row.name,
    description: row.description ?? '',
    defaultAccessUrl: row.default_access_url ?? '',
    defaultUsername: row.default_username ?? '',
    defaultPassword: row.default_password ?? '',
    accountTypes: mapSoftwareAccountCatalogAccountTypes(row.account_types),
    sortOrder: row.sort_order,
    isActive: row.is_active,
    hasDefaultPassword: row.has_default_password,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadSoftwareAccountCatalogs(
  tenantId: string,
  includeInactive = true,
): Promise<SoftwareAccountCatalog[]> {
  assertSupabaseConfigured();
  const rows = await request<SoftwareAccountCatalogRpcRow[]>(
    supabaseApi.post('/rpc/list_software_account_catalogs_with_password', {
      p_tenant_id: tenantId,
      p_include_inactive: includeInactive,
    }),
  );
  return rows.map(mapCatalog);
}

export async function saveSoftwareAccountCatalog(
  tenantId: string,
  id: string | undefined,
  values: SoftwareAccountCatalogFormValues,
  sortOrder: number,
): Promise<SoftwareAccountCatalog> {
  assertSupabaseConfigured();
  const rows = await request<SoftwareAccountCatalogRpcRow[]>(
    supabaseApi.post('/rpc/save_software_account_catalog', {
      p_tenant_id: tenantId,
      p_catalog_id: id ?? null,
      p_name: values.name,
      p_description: values.description,
      p_default_access_url: values.defaultAccessUrl,
      p_default_username: values.defaultUsername,
      p_default_password: values.defaultPassword,
      p_account_types: values.accountTypes,
      p_sort_order: sortOrder,
      p_is_active: values.isActive,
    }),
  );
  const row = rows[0];
  if (!row) throw new Error('Không nhận được dữ liệu tài khoản phần mềm.');
  return mapCatalog(row);
}

export async function deleteSoftwareAccountCatalog(id: string): Promise<void> {
  assertSupabaseConfigured();
  await supabaseApi.post('/rpc/delete_software_account_catalog', {
    p_catalog_id: id,
  });
}

export async function reorderSoftwareAccountCatalogs(
  tenantId: string,
  ids: string[],
): Promise<void> {
  assertSupabaseConfigured();
  await supabaseApi.post('/rpc/reorder_software_account_catalogs', {
    p_tenant_id: tenantId,
    p_catalog_ids: ids,
  });
}
