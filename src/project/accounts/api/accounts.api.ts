import {
  assertSupabaseConfigured,
  supabaseApi,
  supabaseFunctionApi,
} from '@/lib/supabase';
import type {
  Account,
  AccountFilterSummary,
  AccountFormValues,
  AccountRole,
  AccountRoleOption,
  AccountType,
  AccountWarehouseOption,
  ExternalOrganization,
  ExternalOrganizationFilterSummary,
  ExternalOrganizationFormValues,
  FakeEpsEmployee,
  MyQrCodeAccount,
} from '../model/account';

interface AccountRow {
  user_id: string;
  username: string | null;
  display_name: string;
  account_type: AccountType | null;
  eps_employee_id: string | null;
  eps_employee_name: string | null;
  eps_department_id: string | null;
  eps_department_name: string | null;
  eps_team_id: string | null;
  eps_team_name: string | null;
  external_organization_id: string | null;
  external_organization_name: string | null;
  status: Account['status'];
  role_ids: string[];
  roles: AccountRole[];
  warehouse_ids: string[];
  warehouse_names: string[];
}

function request<T>(promise: Promise<unknown>) {
  return promise as Promise<T>;
}

function rpc<T>(name: string, body: Record<string, unknown>) {
  return request<T>(supabaseApi.post(`/rpc/${name}`, body));
}

export async function loadAccounts(search = ''): Promise<Account[]> {
  assertSupabaseConfigured();
  const rows = await rpc<AccountRow[]>('list_qrcode_accounts', {
    p_search: search.trim() || null,
  });
  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    accountType: row.account_type ?? 'unmapped',
    epsEmployeeId: row.eps_employee_id,
    epsEmployeeName: row.eps_employee_name,
    epsDepartmentId: row.eps_department_id,
    epsDepartmentName: row.eps_department_name,
    epsTeamId: row.eps_team_id,
    epsTeamName: row.eps_team_name,
    externalOrganizationId: row.external_organization_id,
    externalOrganizationName: row.external_organization_name,
    status: row.status,
    roleIds: row.role_ids ?? [],
    roles: row.roles,
    warehouseIds: row.warehouse_ids ?? [],
    warehouseNames: row.warehouse_names ?? [],
  }));
}

export async function loadAccountFilterSummary(
  filters: { search?: string; organizationId?: string } = {},
  signal?: AbortSignal,
): Promise<AccountFilterSummary> {
  assertSupabaseConfigured();
  return request<AccountFilterSummary>(
    supabaseApi.post(
      '/rpc/get_qrcode_account_filter_summary',
      {
        p_filters: {
          search: filters.search?.trim() || null,
          organizationId: filters.organizationId || null,
        },
      },
      { signal },
    ),
  );
}

export async function loadMyQrCodeAccount(): Promise<MyQrCodeAccount | null> {
  assertSupabaseConfigured();
  return rpc<MyQrCodeAccount | null>('get_my_qrcode_account', {});
}

export async function loadFakeEpsDirectory(
  search = '',
): Promise<FakeEpsEmployee[]> {
  assertSupabaseConfigured();
  return rpc<FakeEpsEmployee[]>('list_fake_eps_directory', {
    p_search: search.trim() || null,
  });
}

export async function loadExternalOrganizations(
  includeInactive = false,
): Promise<ExternalOrganization[]> {
  assertSupabaseConfigured();
  return rpc<ExternalOrganization[]>('list_external_organizations', {
    p_include_inactive: includeInactive,
  });
}

export async function loadExternalOrganizationFilterSummary(
  search = '',
  signal?: AbortSignal,
): Promise<ExternalOrganizationFilterSummary> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/get_external_organization_filter_summary',
      { p_search: search.trim() || null },
      { signal },
    ),
  );
}

export async function loadAccountRoleOptions(): Promise<AccountRoleOption[]> {
  assertSupabaseConfigured();
  return rpc<AccountRoleOption[]>('list_account_role_options', {});
}

export async function loadAccountWarehouseOptions(): Promise<
  AccountWarehouseOption[]
> {
  assertSupabaseConfigured();
  return rpc<AccountWarehouseOption[]>('list_account_warehouse_options', {});
}

export async function saveAccountAccess(
  userId: string,
  values: AccountFormValues,
): Promise<void> {
  assertSupabaseConfigured();
  await rpc<void>('save_account_access', {
    p_user_id: userId,
    p_account_type: values.accountType,
    p_eps_employee_id:
      values.accountType === 'eps' ? values.epsEmployeeId : null,
    p_external_organization_id:
      values.accountType === 'external' ? values.externalOrganizationId : null,
    p_display_name: values.displayName.trim() || null,
    p_status: values.status,
    p_role_ids: values.roleIds,
    p_warehouse_ids: values.warehouseIds,
  });
}

export async function createAccount(values: AccountFormValues): Promise<void> {
  assertSupabaseConfigured();
  await request<void>(
    supabaseFunctionApi.post('/account-management', {
      action: 'create',
      accountType: values.accountType,
      epsEmployeeId: values.accountType === 'eps' ? values.epsEmployeeId : null,
      externalOrganizationId:
        values.accountType === 'external'
          ? values.externalOrganizationId
          : null,
      displayName: values.displayName,
      username: values.username,
      password: values.password,
      status: values.status,
      roleIds: values.roleIds,
      warehouseIds: values.warehouseIds,
    }),
  );
}

export async function saveExternalOrganization(
  id: string | null,
  values: ExternalOrganizationFormValues,
): Promise<void> {
  assertSupabaseConfigured();
  await rpc<string>('save_external_organization', {
    p_id: id,
    p_code: values.code,
    p_name: values.name,
    p_is_active: values.isActive,
  });
}
