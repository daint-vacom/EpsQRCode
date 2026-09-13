import { loadCustomFields } from '@/project/data-configuration/api/custom-fields.api';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import {
  getPublicStorageUrl,
  TENANT_ASSETS_BUCKET,
  uploadStorageObject,
} from '@/lib/storage';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  Customer,
  CustomerFormValues,
  CustomerListParams,
  CustomerListResult,
  CustomerListRpcRow,
  CustomerRow,
  CustomerSoftwareAccount,
  CustomerStatus,
} from '../model/customer';
import { mapCustomerRow, normalizeCustomFieldValues } from '../model/customer';
import type {
  CustomerResponsibilityAssignmentInput,
  CustomerResponsibilityFilterOptions,
  CustomerResponsibilityWorkspace,
} from '../model/customer-responsibility';

interface TenantMembershipRow {
  tenant_id: string;
}

interface RegionRow {
  code: string;
  name: string;
}

interface CustomerListRpcResponse {
  items: CustomerListRpcRow[];
  total: number | string;
}

interface EntityCustomDataRow {
  data: Record<string, unknown> | null;
}

interface CustomerSoftwareAccountRpcRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  software_name: string;
  access_url: string;
  username: string;
  password?: string | null;
  account_type: string;
  expires_at: string | null;
  sort_order: number;
  has_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  withoutContact: number;
}

interface CustomerStatisticsSnapshotValues {
  total: number;
  active: number;
  inactive: number;
  uncontacted: number;
}

interface CustomerPreviousMonthStatsResponse {
  snapshotDate: string | null;
  values: CustomerStatisticsSnapshotValues | null;
}

export interface CustomerPreviousMonthStats {
  snapshotDate: string;
  stats: CustomerStats;
}

/** @deprecated Use CustomerStats for the customer list and dashboard metrics. */
export type CustomerStatusStats = CustomerStats;

function queryParams(params: Record<string, string>) {
  return { params };
}

function numberValue(value: number | string | null | undefined) {
  return value == null ? 0 : typeof value === 'number' ? value : Number(value);
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

async function resolveTenantId(userId: string) {
  const memberships = await request<TenantMembershipRow[]>(
    supabaseApi.get(
      '/tenant_members',
      queryParams({
        select: 'tenant_id',
        user_id: `eq.${userId}`,
        status: 'eq.active',
        order: 'created_at.asc',
        limit: '1',
      }),
    ),
  );
  const tenantId = memberships[0]?.tenant_id;
  if (!tenantId) throw new Error('Tài khoản chưa thuộc tenant đang hoạt động.');
  return tenantId;
}

export interface CustomerWorkspace {
  tenantId: string;
  customers: Customer[];
}

export type CustomerSelectOption = Pick<
  Customer,
  'id' | 'customerCode' | 'name' | 'imageUrl'
>;

interface CustomerSelectRow {
  id: string;
  customer_code: string;
  name: string;
  image_url: string | null;
}

export async function loadCustomerSelectOptions(
  userId: string,
  tenantIdOverride?: string,
): Promise<CustomerSelectOption[]> {
  assertSupabaseConfigured();
  const tenantId = tenantIdOverride ?? (await resolveTenantId(userId));
  const rows = await request<CustomerSelectRow[]>(
    supabaseApi.get(
      '/customers',
      queryParams({
        select: 'id,customer_code,name,image_url',
        tenant_id: `eq.${tenantId}`,
        status: 'eq.active',
        order: 'name.asc',
      }),
    ),
  );

  return rows.map((row) => ({
    id: row.id,
    customerCode: row.customer_code,
    name: row.name,
    imageUrl: row.image_url,
  }));
}

export async function loadCustomerRegionOptions() {
  assertSupabaseConfigured();
  const rows = await request<RegionRow[]>(
    supabaseApi.get(
      '/regions',
      queryParams({
        select: 'code,name',
        country_code: 'eq.VN',
        level: 'eq.province',
        is_active: 'eq.true',
        order: 'name.asc',
      }),
    ),
  );

  return rows.map((row) => ({ value: row.code, label: row.name }));
}

export async function loadCustomerCustomFields(
  tenantId: string,
): Promise<CustomField[]> {
  return loadCustomFields(tenantId, 'customer');
}

export async function loadCustomerWorkspace(
  userId: string,
  tenantIdOverride?: string,
): Promise<CustomerWorkspace> {
  assertSupabaseConfigured();
  const tenantId = tenantIdOverride ?? (await resolveTenantId(userId));
  const rows = await request<CustomerRow[]>(
    supabaseApi.get(
      '/customers',
      queryParams({
        select: '*',
        tenant_id: `eq.${tenantId}`,
        order: 'created_at.asc',
      }),
    ),
  );

  return { tenantId, customers: rows.map(mapCustomerRow) };
}

export async function loadCustomerList(
  tenantId: string,
  params: CustomerListParams,
  signal?: AbortSignal,
): Promise<CustomerListResult> {
  assertSupabaseConfigured();
  const response = await request<CustomerListRpcResponse>(
    supabaseApi.post(
      '/rpc/list_customers',
      {
        p_tenant_id: tenantId,
        p_page: params.page,
        p_page_size: params.pageSize,
        p_search: params.search?.trim() || null,
        p_business_types: params.businessTypes ?? [],
        p_statuses: params.statuses ?? [],
        p_tag_ids: params.tagIds ?? [],
        p_field_filters: params.fieldFilters ?? {},
        p_responsible_employee_ids: params.responsibleEmployeeIds ?? [],
      },
      { signal },
    ),
  );

  return {
    customers: response.items.map(mapCustomerRow),
    total: numberValue(response.total),
  };
}

export async function loadCustomerResponsibilityWorkspace(
  tenantId: string,
  customerId: string,
): Promise<CustomerResponsibilityWorkspace> {
  assertSupabaseConfigured();
  return request<CustomerResponsibilityWorkspace>(
    supabaseApi.post('/rpc/get_customer_responsibility_workspace', {
      p_tenant_id: tenantId,
      p_customer_id: customerId,
    }),
  );
}

export async function replaceCustomerResponsibilities(
  tenantId: string,
  customerId: string,
  assignments: CustomerResponsibilityAssignmentInput[],
): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.post('/rpc/replace_customer_responsibilities', {
      p_tenant_id: tenantId,
      p_customer_id: customerId,
      p_assignments: assignments.map((assignment) => ({
        employee_id: assignment.employeeId,
        responsibility_role_ids: assignment.responsibilityRoleIds,
      })),
    }),
  );
}

export async function loadCustomerResponsibilityFilterOptions(
  tenantId: string,
): Promise<CustomerResponsibilityFilterOptions> {
  assertSupabaseConfigured();
  return request<CustomerResponsibilityFilterOptions>(
    supabaseApi.post('/rpc/list_customer_responsibility_filter_options', {
      p_tenant_id: tenantId,
    }),
  );
}

export async function loadCustomerStatusStats(
  tenantId: string,
  signal?: AbortSignal,
): Promise<CustomerStats> {
  return loadCustomerStats(tenantId, signal);
}

export async function loadCustomerStats(
  tenantId: string,
  signal?: AbortSignal,
): Promise<CustomerStats> {
  assertSupabaseConfigured();
  return request<CustomerStats>(
    supabaseApi.post(
      '/rpc/customer_statistics',
      { p_tenant_id: tenantId },
      { signal },
    ),
  );
}

export async function loadCustomerPreviousMonthStats(
  tenantId: string,
  signal?: AbortSignal,
): Promise<CustomerPreviousMonthStats | null> {
  assertSupabaseConfigured();
  const response = await request<CustomerPreviousMonthStatsResponse>(
    supabaseApi.post(
      '/rpc/tenant_statistics_previous_month',
      {
        p_tenant_id: tenantId,
        p_entity: 'customers',
      },
      { signal },
    ),
  );

  if (!response.snapshotDate || !response.values) return null;

  return {
    snapshotDate: response.snapshotDate,
    stats: {
      total: response.values.total,
      active: response.values.active,
      inactive: response.values.inactive,
      withoutContact: response.values.uncontacted,
    },
  };
}

export async function loadCustomerDetail(
  userId: string,
  customerId: string,
  tenantIdOverride?: string,
): Promise<Customer> {
  assertSupabaseConfigured();
  const tenantId = tenantIdOverride ?? (await resolveTenantId(userId));
  const rows = await request<CustomerRow[]>(
    supabaseApi.get(
      '/customers',
      queryParams({
        select: '*',
        tenant_id: `eq.${tenantId}`,
        id: `eq.${customerId}`,
        limit: '1',
      }),
    ),
  );

  const customer = rows[0];
  if (!customer) throw new Error('Không tìm thấy khách hàng.');
  return mapCustomerRow(customer);
}

export async function loadCustomerCustomFieldValues(
  tenantId: string,
  customerId: string,
): Promise<Record<string, string>> {
  assertSupabaseConfigured();
  const rows = await request<EntityCustomDataRow[]>(
    supabaseApi.get(
      '/entity_custom_data',
      queryParams({
        select: 'data',
        tenant_id: `eq.${tenantId}`,
        entity_type: 'eq.customer',
        entity_id: `eq.${customerId}`,
        limit: '1',
      }),
    ),
  );

  return normalizeCustomFieldValues(rows[0]?.data);
}

export async function saveCustomerCustomFieldValues(
  tenantId: string,
  customerId: string,
  data: Record<string, string>,
): Promise<void> {
  assertSupabaseConfigured();
  await supabaseApi.post(
    '/entity_custom_data',
    {
      tenant_id: tenantId,
      entity_type: 'customer',
      entity_id: customerId,
      data,
    },
    {
      ...queryParams({ on_conflict: 'tenant_id,entity_type,entity_id' }),
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
    },
  );
}

function mapCustomerSoftwareAccount(
  row: CustomerSoftwareAccountRpcRow,
): CustomerSoftwareAccount {
  return {
    id: row.id,
    softwareName: row.software_name,
    accessUrl: row.access_url,
    username: row.username,
    password: row.password ?? '',
    accountType: row.account_type,
    expiresAt: row.expires_at,
    hasPassword: row.has_password,
  };
}

export async function loadCustomerSoftwareAccounts(
  customerId: string,
): Promise<CustomerSoftwareAccount[]> {
  assertSupabaseConfigured();
  const rows = await request<CustomerSoftwareAccountRpcRow[]>(
    supabaseApi.post('/rpc/list_customer_software_accounts_with_password', {
      p_customer_id: customerId,
    }),
  );

  return rows.map(mapCustomerSoftwareAccount);
}

export async function replaceCustomerSoftwareAccounts(
  customerId: string,
  rows: CustomerSoftwareAccount[],
): Promise<CustomerSoftwareAccount[]> {
  assertSupabaseConfigured();
  const savedRows = await request<CustomerSoftwareAccountRpcRow[]>(
    supabaseApi.post('/rpc/replace_customer_software_accounts', {
      p_customer_id: customerId,
      p_rows: rows.map((row, sortOrder) => ({
        ...(row.id ? { id: row.id } : {}),
        softwareName: row.softwareName,
        accessUrl: row.accessUrl,
        username: row.username,
        password: row.password,
        accountType: row.accountType,
        expiresAt: row.expiresAt,
        sortOrder,
      })),
    }),
  );

  return savedRows.map(mapCustomerSoftwareAccount);
}

function toPayload(values: CustomerFormValues) {
  return {
    customer_code: values.customerCode,
    name: values.name,
    business_type: values.businessType,
    business_registration_code: values.businessRegistrationCode,
    image_url: values.imageUrl || null,
    country_code: values.countryCode,
    region_code: values.regionCode || null,
    region_name: values.regionName,
    district_name: values.districtName,
    ward_name: values.wardName,
    street_address: values.streetAddress,
    phone: values.phone,
    email: values.email,
    address_detail: values.addressDetail,
    contact_name: values.contactName,
    contact_title: values.contactTitle,
    established_date:
      values.establishedDate?.toISOString().slice(0, 10) ?? null,
    vat_declaration_period: values.vatDeclarationPeriod,
    status: values.status,
  };
}

function fileExtension(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension && /^[a-z0-9]+$/.test(extension)) return extension;

  return file.type === 'image/png'
    ? 'png'
    : file.type === 'image/webp'
      ? 'webp'
      : 'jpg';
}

export async function uploadCustomerImage(
  tenantId: string,
  customerId: string,
  file: File,
): Promise<string> {
  assertSupabaseConfigured();

  const path = `${tenantId}/customers/${customerId}/image.${fileExtension(file)}`;
  await uploadStorageObject({
    bucket: TENANT_ASSETS_BUCKET,
    path,
    file,
    upsert: true,
  });

  return getPublicStorageUrl(TENANT_ASSETS_BUCKET, path);
}

export async function createCustomer(
  tenantId: string,
  values: CustomerFormValues,
): Promise<Customer> {
  assertSupabaseConfigured();
  const rows = await request<CustomerRow[]>(
    supabaseApi.post(
      '/customers',
      { tenant_id: tenantId, ...toPayload(values) },
      { headers: { Prefer: 'return=representation' } },
    ),
  );
  if (!rows[0]) throw new Error('Không thể tạo khách hàng.');
  return mapCustomerRow(rows[0]);
}

export async function updateCustomer(
  customerId: string,
  values: CustomerFormValues,
): Promise<Customer> {
  assertSupabaseConfigured();
  const rows = await request<CustomerRow[]>(
    supabaseApi.patch('/customers', toPayload(values), {
      ...queryParams({ id: `eq.${customerId}` }),
      headers: { Prefer: 'return=representation' },
    }),
  );
  if (!rows[0]) throw new Error('Không tìm thấy khách hàng để cập nhật.');
  return mapCustomerRow(rows[0]);
}

export async function updateCustomerStatus(
  customerId: string,
  status: CustomerStatus,
): Promise<Customer> {
  assertSupabaseConfigured();
  const rows = await request<CustomerRow[]>(
    supabaseApi.patch(
      '/customers',
      { status },
      {
        ...queryParams({ id: `eq.${customerId}` }),
        headers: { Prefer: 'return=representation' },
      },
    ),
  );
  if (!rows[0]) throw new Error('Không tìm thấy khách hàng để cập nhật.');
  return mapCustomerRow(rows[0]);
}

export async function deleteCustomer(customerId: string): Promise<void> {
  assertSupabaseConfigured();
  await supabaseApi.delete(
    '/customers',
    queryParams({ id: `eq.${customerId}` }),
  );
}
