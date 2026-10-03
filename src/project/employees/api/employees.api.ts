import type { CustomerStatus } from '@/project/customers/model/customer';
import { loadCustomFields } from '@/project/data-configuration/api/custom-fields.api';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import {
  getPublicStorageUrl,
  TENANT_ASSETS_BUCKET,
  uploadStorageObject,
} from '@/lib/storage';
import {
  assertSupabaseConfigured,
  supabaseApi,
  supabaseFunctionApi,
} from '@/lib/supabase';
import type {
  Employee,
  EmployeeAvatarRow,
  EmployeeFormValues,
  EmployeeListParams,
  EmployeeListResult,
  EmployeeListRpcRow,
  EmployeeRole,
  EmployeeRoleOption,
  EmployeeRow,
  EmployeeStatus,
} from '../model/employee';
import { mapEmployeeRow } from '../model/employee';
import type {
  EmployeeCustomerAssignmentInput,
  EmployeeResponsibilityWorkspace,
} from '../model/employee-responsibility';

interface TenantMembershipRow {
  tenant_id: string;
}

interface EmployeeRoleAssignmentRow {
  user_id: string;
  role_id: string;
}

interface EmployeeRoleRow {
  id: string;
  name: string;
  color: EmployeeRole['color'];
  is_active: boolean;
  customer_assignable: boolean;
}

interface EmployeeListRpcResponse {
  items: EmployeeListRpcRow[];
  total: number | string;
}

export interface EmployeeAccountResult {
  employee_id: string;
  user_id: string;
  username?: string;
}

interface EntityCustomDataRow {
  data: Record<string, unknown> | null;
}

export interface EmployeeStatusStats {
  total: number;
  active: number;
  inactive: number;
}

function queryParams(params: Record<string, string>) {
  return { params };
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

function numberValue(value: number | string | null | undefined) {
  return value == null ? 0 : typeof value === 'number' ? value : Number(value);
}

export interface EmployeeWorkspace {
  tenantId: string;
  employees: Employee[];
}

export interface UpdateCurrentEmployeeProfileInput {
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: EmployeeStatus;
  joinedAt: string | null;
  note: string;
  avatarUrl: string | null;
}

export async function loadEmployeeCustomFields(
  tenantId: string,
): Promise<CustomField[]> {
  return loadCustomFields(tenantId, 'employee');
}

function normalizeCustomFieldValues(
  data: Record<string, unknown> | null | undefined,
) {
  return Object.fromEntries(
    Object.entries(data ?? {}).map(([key, value]) => [
      key,
      value == null ? '' : String(value),
    ]),
  );
}

export async function loadEmployeeCustomFieldValues(
  tenantId: string,
  employeeId: string,
): Promise<Record<string, string>> {
  assertSupabaseConfigured();
  const rows = await request<EntityCustomDataRow[]>(
    supabaseApi.get(
      '/entity_custom_data',
      queryParams({
        select: 'data',
        tenant_id: `eq.${tenantId}`,
        entity_type: 'eq.employee',
        entity_id: `eq.${employeeId}`,
        limit: '1',
      }),
    ),
  );

  return normalizeCustomFieldValues(rows[0]?.data);
}

export async function saveEmployeeCustomFieldValues(
  tenantId: string,
  employeeId: string,
  data: Record<string, string>,
): Promise<void> {
  assertSupabaseConfigured();
  await supabaseApi.post(
    '/entity_custom_data',
    {
      tenant_id: tenantId,
      entity_type: 'employee',
      entity_id: employeeId,
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

export async function loadEmployeeList(
  tenantId: string,
  params: EmployeeListParams,
  signal?: AbortSignal,
): Promise<EmployeeListResult> {
  assertSupabaseConfigured();
  const response = await request<EmployeeListRpcResponse>(
    supabaseApi.post(
      '/rpc/list_employees',
      {
        p_tenant_id: tenantId,
        p_page: params.page,
        p_page_size: params.pageSize,
        p_search: params.search?.trim() || null,
        p_statuses: params.statuses ?? [],
        p_role_ids: params.roleIds ?? [],
        p_account_linked: params.accountLinked ?? null,
        p_tag_ids: params.tagIds ?? [],
      },
      { signal },
    ),
  );
  const userIds = response.items
    .map((row) => row.user_id)
    .filter((userId): userId is string => Boolean(userId));
  const profiles = userIds.length
    ? await request<EmployeeAvatarRow[]>(
        supabaseApi.get(
          '/user_profiles',
          queryParams({
            select: 'id,username',
            id: `in.(${userIds.join(',')})`,
          }),
        ),
      )
    : [];
  const usernamesByUserId = new Map(
    profiles.map((profile) => [profile.id, profile.username ?? null]),
  );

  return {
    employees: response.items.map((row) =>
      mapEmployeeRow(
        row,
        row.avatar_url,
        row.roles ?? [],
        row.role_ids ?? [],
        row.user_id ? (usernamesByUserId.get(row.user_id) ?? null) : null,
      ),
    ),
    total: numberValue(response.total),
  };
}

export async function loadEmployeeDetail(
  tenantId: string,
  employeeId: string,
): Promise<Employee | null> {
  assertSupabaseConfigured();
  const rows = await request<EmployeeRow[]>(
    supabaseApi.get(
      '/employees',
      queryParams({
        select: '*',
        tenant_id: `eq.${tenantId}`,
        id: `eq.${employeeId}`,
        limit: '1',
      }),
    ),
  );
  const row = rows[0];
  if (!row) return null;

  const [profiles, assignments, roles] = await Promise.all([
    row.user_id
      ? request<EmployeeAvatarRow[]>(
          supabaseApi.get(
            '/user_profiles',
            queryParams({
              select: 'id,avatar_url,username',
              id: `eq.${row.user_id}`,
              limit: '1',
            }),
          ),
        )
      : Promise.resolve([] as EmployeeAvatarRow[]),
    row.user_id
      ? request<EmployeeRoleAssignmentRow[]>(
          supabaseApi.get(
            '/tenant_member_roles',
            queryParams({
              select: 'user_id,role_id',
              tenant_id: `eq.${tenantId}`,
              user_id: `eq.${row.user_id}`,
            }),
          ),
        )
      : Promise.resolve([] as EmployeeRoleAssignmentRow[]),
    request<EmployeeRoleRow[]>(
      supabaseApi.get(
        '/roles',
        queryParams({
          select: 'id,name,color,is_active,customer_assignable',
          or: `(tenant_id.is.null,tenant_id.eq.${tenantId})`,
          is_active: 'eq.true',
        }),
      ),
    ),
  ]);
  const profile = profiles[0];
  const rolesById = new Map(roles.map((role) => [role.id, role]));
  const employeeRoles = assignments.flatMap((assignment) => {
    const role = rolesById.get(assignment.role_id);
    return role ? [{ name: role.name, color: role.color }] : [];
  });
  const roleIds = assignments
    .filter((assignment) => rolesById.has(assignment.role_id))
    .map((assignment) => assignment.role_id);

  return mapEmployeeRow(
    row,
    row.avatar_url ?? profile?.avatar_url ?? null,
    employeeRoles,
    roleIds,
    profile?.username ?? null,
  );
}

export async function loadEmployeeStatusStats(
  tenantId: string,
  signal?: AbortSignal,
): Promise<EmployeeStatusStats> {
  const [all, active, inactive] = await Promise.all(
    [undefined, 'active', 'inactive'].map((status) =>
      loadEmployeeList(
        tenantId,
        {
          page: 1,
          pageSize: 1,
          statuses: status ? [status as EmployeeStatus] : undefined,
        },
        signal,
      ),
    ),
  );

  return {
    total: all.total,
    active: active.total,
    inactive: inactive.total,
  };
}

export async function loadEmployeeRoleOptions(
  tenantId: string,
): Promise<EmployeeRoleOption[]> {
  assertSupabaseConfigured();
  return request<EmployeeRoleRow[]>(
    supabaseApi.get(
      '/roles',
      queryParams({
        select: 'id,name,color,is_active,customer_assignable',
        or: `(tenant_id.is.null,tenant_id.eq.${tenantId})`,
        is_active: 'eq.true',
        order: 'is_system.desc,sort_order.asc,name.asc',
      }),
    ),
  ).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      isActive: row.is_active,
      customerAssignable: row.customer_assignable,
    })),
  );
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

export async function loadEmployeeWorkspace(
  userId: string,
  tenantIdOverride?: string,
): Promise<EmployeeWorkspace> {
  assertSupabaseConfigured();
  const tenantId = tenantIdOverride ?? (await resolveTenantId(userId));
  const rows = await request<EmployeeRow[]>(
    supabaseApi.get(
      '/employees',
      queryParams({
        select: '*',
        tenant_id: `eq.${tenantId}`,
        order: 'created_at.asc',
      }),
    ),
  );
  const profiles = await request<EmployeeAvatarRow[]>(
    supabaseApi.get(
      '/user_profiles',
      queryParams({ select: 'id,avatar_url,username' }),
    ),
  );
  const profilesByUserId = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );
  const [assignments, roles] = await Promise.all([
    request<EmployeeRoleAssignmentRow[]>(
      supabaseApi.get(
        '/tenant_member_roles',
        queryParams({
          select: 'user_id,role_id',
          tenant_id: `eq.${tenantId}`,
        }),
      ),
    ),
    request<EmployeeRoleRow[]>(
      supabaseApi.get(
        '/roles',
        queryParams({
          select: 'id,name,color,is_active,customer_assignable',
          or: `(tenant_id.is.null,tenant_id.eq.${tenantId})`,
          is_active: 'eq.true',
          order: 'is_system.desc,sort_order.asc,name.asc',
        }),
      ),
    ),
  ]);
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const roleNamesByUserId = new Map<string, EmployeeRole[]>();
  const roleIdsByUserId = new Map<string, string[]>();
  for (const assignment of assignments) {
    const role = roleById.get(assignment.role_id);
    if (!role) continue;
    const userRoles = roleNamesByUserId.get(assignment.user_id) ?? [];
    userRoles.push({ name: role.name, color: role.color });
    roleNamesByUserId.set(assignment.user_id, userRoles);
    const userRoleIds = roleIdsByUserId.get(assignment.user_id) ?? [];
    userRoleIds.push(assignment.role_id);
    roleIdsByUserId.set(assignment.user_id, userRoleIds);
  }

  return {
    tenantId,
    employees: rows.map((row) =>
      mapEmployeeRow(
        row,
        row.avatar_url ??
          (row.user_id
            ? (profilesByUserId.get(row.user_id)?.avatar_url ?? null)
            : null),
        row.user_id ? (roleNamesByUserId.get(row.user_id) ?? []) : [],
        row.user_id ? (roleIdsByUserId.get(row.user_id) ?? []) : [],
        row.user_id
          ? (profilesByUserId.get(row.user_id)?.username ?? null)
          : null,
      ),
    ),
  };
}

export async function loadCurrentEmployeeProfile(
  tenantId: string,
  userId: string,
): Promise<Employee | null> {
  assertSupabaseConfigured();

  const rows = await request<EmployeeRow[]>(
    supabaseApi.get(
      '/employees',
      queryParams({
        select: '*',
        tenant_id: `eq.${tenantId}`,
        user_id: `eq.${userId}`,
        limit: '1',
      }),
    ),
  );

  return rows[0] ? mapEmployeeRow(rows[0], rows[0].avatar_url) : null;
}

export async function updateCurrentEmployeeProfile(
  tenantId: string,
  employeeId: string,
  values: UpdateCurrentEmployeeProfileInput,
): Promise<Employee> {
  assertSupabaseConfigured();

  const rows = await request<EmployeeRow[]>(
    supabaseApi.post('/rpc/update_my_employee_profile', {
      p_tenant_id: tenantId,
      p_employee_id: employeeId,
      p_employee_code: values.employeeCode,
      p_first_name: values.firstName,
      p_last_name: values.lastName,
      p_phone: values.phone,
      p_status: values.status,
      p_joined_at: values.joinedAt,
      p_note: values.note,
      p_avatar_url: values.avatarUrl,
    }),
  );

  if (!rows[0]) {
    throw new Error('Không tìm thấy hồ sơ nhân viên để cập nhật.');
  }

  return mapEmployeeRow(rows[0], rows[0].avatar_url);
}

function toPayload(values: EmployeeFormValues) {
  return {
    employee_code: values.employeeCode,
    first_name: values.firstName,
    last_name: values.lastName,
    phone: values.phone,
    status: values.status,
    joined_at: values.joinedAt?.toISOString().slice(0, 10) ?? null,
    note: values.note,
    avatar_url: values.imageUrl || null,
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

export async function uploadEmployeeAvatar(
  tenantId: string,
  employeeId: string,
  file: File,
): Promise<string> {
  assertSupabaseConfigured();
  const path = `${tenantId}/employees/${employeeId}/avatar.${fileExtension(file)}`;
  await uploadStorageObject({
    bucket: TENANT_ASSETS_BUCKET,
    path,
    file,
    upsert: true,
  });

  return getPublicStorageUrl(TENANT_ASSETS_BUCKET, path);
}

export async function createEmployee(
  tenantId: string,
  values: EmployeeFormValues,
): Promise<Employee> {
  assertSupabaseConfigured();
  const rows = await request<EmployeeRow[]>(
    supabaseApi.post(
      '/employees',
      { tenant_id: tenantId, ...toPayload(values) },
      { headers: { Prefer: 'return=representation' } },
    ),
  );
  if (!rows[0]) throw new Error('Không thể tạo nhân viên.');
  return mapEmployeeRow(rows[0]);
}

export async function createEmployeeAccount(
  tenantId: string,
  employeeId: string,
  username: string,
  password: string,
): Promise<EmployeeAccountResult> {
  assertSupabaseConfigured();
  return request<EmployeeAccountResult>(
    supabaseFunctionApi.post('/employee-account', {
      action: 'create',
      tenantId,
      employeeId,
      username,
      password,
    }),
  );
}

export async function updateEmployeeUsername(
  tenantId: string,
  employeeId: string,
  username: string,
): Promise<EmployeeAccountResult> {
  assertSupabaseConfigured();
  return request<EmployeeAccountResult>(
    supabaseFunctionApi.post('/employee-account', {
      action: 'update-username',
      tenantId,
      employeeId,
      username,
    }),
  );
}

export async function resetEmployeePassword(
  tenantId: string,
  employeeId: string,
  password: string,
): Promise<EmployeeAccountResult> {
  assertSupabaseConfigured();
  return request<EmployeeAccountResult>(
    supabaseFunctionApi.post('/employee-account', {
      action: 'reset-password',
      tenantId,
      employeeId,
      password,
    }),
  );
}

export async function updateEmployee(
  employeeId: string,
  values: EmployeeFormValues,
): Promise<Employee> {
  assertSupabaseConfigured();
  const rows = await request<EmployeeRow[]>(
    supabaseApi.patch('/employees', toPayload(values), {
      ...queryParams({ id: `eq.${employeeId}` }),
      headers: { Prefer: 'return=representation' },
    }),
  );
  if (!rows[0]) throw new Error('Không tìm thấy nhân viên để cập nhật.');
  return mapEmployeeRow(rows[0]);
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  assertSupabaseConfigured();
  await supabaseApi.delete(
    '/employees',
    queryParams({ id: `eq.${employeeId}` }),
  );
}

export async function updateEmployeeStatus(
  employeeId: string,
  status: EmployeeStatus,
) {
  assertSupabaseConfigured();
  await supabaseApi.patch(
    '/employees',
    { status },
    queryParams({ id: `eq.${employeeId}` }),
  );
}

interface EmployeeRoleOptionRow {
  id: string;
  name: string;
  color: EmployeeRole['color'];
  is_active: boolean;
  customer_assignable: boolean;
}

interface EmployeeResponsibilityWorkspaceRow {
  roles: EmployeeRoleOptionRow[];
  customers: Array<{
    id: string;
    customerCode: string;
    name: string;
    imageUrl: string | null;
    status: CustomerStatus;
  }>;
  assignments: EmployeeCustomerAssignmentInput[];
}

export async function loadEmployeeResponsibilityWorkspace(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeResponsibilityWorkspace> {
  assertSupabaseConfigured();
  const response = await request<EmployeeResponsibilityWorkspaceRow>(
    supabaseApi.post('/rpc/get_employee_responsibility_workspace', {
      p_tenant_id: tenantId,
      p_employee_id: employeeId,
    }),
  );

  return {
    roles: response.roles.map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      isActive: role.is_active,
      customerAssignable: role.customer_assignable,
    })),
    customers: response.customers,
    assignments: response.assignments.map((assignment) => ({
      ...assignment,
      allRoles: assignment.allRoles === true,
    })),
  };
}

export async function saveEmployeeAccess(
  tenantId: string,
  employeeId: string,
  roleIds: string[] | null,
  customerAssignments: EmployeeCustomerAssignmentInput[] | null,
): Promise<void> {
  assertSupabaseConfigured();
  await supabaseApi.post('/rpc/replace_employee_access', {
    p_tenant_id: tenantId,
    p_employee_id: employeeId,
    p_role_ids: roleIds,
    p_customer_assignments:
      customerAssignments?.map((assignment) => ({
        customer_id: assignment.customerId,
        all_roles: assignment.allRoles,
        responsibility_role_ids: assignment.responsibilityRoleIds,
      })) ?? null,
  });
}
