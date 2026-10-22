import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type { RoleColor } from '../model/role-color';
import {
  applySelectedPermissionCodes,
  PERMISSION_TAGS,
  type PermissionDefinitionRow,
  type PermissionGroupRow,
  type PermissionItem,
  type PermissionModule,
  type PermissionModuleRow,
  type PermissionScope,
  type RolePermissionRow,
  type RoleRow,
  type RoleSummary,
  type UserRoleRow,
} from '../model/role-permission';

interface CreateRoleInput {
  code: string;
  name: string;
  color: RoleColor;
  description?: string | null;
  is_system?: boolean;
}

interface UpdateRoleInput {
  name: string;
  description: string | null;
  color: RoleColor;
}

export interface RolePermissionsWorkspace {
  roles: RoleSummary[];
  modulesByRoleId: Record<string, PermissionModule[]>;
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

function queryParams(params: Record<string, string>) {
  return { params };
}

export async function loadRolePermissionsWorkspace(): Promise<RolePermissionsWorkspace> {
  assertSupabaseConfigured();

  const [roles, definitions, modules, groups, rolePermissions, assignments] =
    await Promise.all([
      request<RoleRow[]>(
        supabaseApi.get(
          '/roles',
          queryParams({
            select: '*',
            is_active: 'eq.true',
            order: 'is_system.desc,sort_order.asc,name.asc',
          }),
        ),
      ),
      request<PermissionDefinitionRow[]>(
        supabaseApi.get(
          '/permission_definitions',
          queryParams({
            select: '*',
            is_active: 'eq.true',
            order: 'sort_order.asc,code.asc',
          }),
        ),
      ),
      request<PermissionModuleRow[]>(
        supabaseApi.get(
          '/permission_modules',
          queryParams({
            select: '*',
            is_active: 'eq.true',
            order: 'sort_order.asc,code.asc',
          }),
        ),
      ),
      request<PermissionGroupRow[]>(
        supabaseApi.get(
          '/permission_groups',
          queryParams({
            select: '*',
            is_active: 'eq.true',
            order: 'sort_order.asc,code.asc',
          }),
        ),
      ),
      request<RolePermissionRow[]>(
        supabaseApi.get(
          '/role_permissions',
          queryParams({
            select: 'role_id,permission_code,scope',
          }),
        ),
      ),
      request<UserRoleRow[]>(
        supabaseApi.get(
          '/user_roles',
          queryParams({
            select: 'user_id,role_id',
          }),
        ),
      ),
    ]);

  const permissionGrantsByRoleId = new Map<
    string,
    Map<string, PermissionScope | null>
  >();
  const permissionCodes = new Set(
    definitions.map((definition) => definition.code),
  );

  for (const rolePermission of rolePermissions) {
    if (!permissionCodes.has(rolePermission.permission_code)) continue;
    const grants =
      permissionGrantsByRoleId.get(rolePermission.role_id) ?? new Map();
    grants.set(rolePermission.permission_code, rolePermission.scope);
    permissionGrantsByRoleId.set(rolePermission.role_id, grants);
  }

  const userCountByRoleId = new Map<string, number>();
  for (const assignment of assignments) {
    userCountByRoleId.set(
      assignment.role_id,
      (userCountByRoleId.get(assignment.role_id) ?? 0) + 1,
    );
  }

  const roleSummaries = roles.map<RoleSummary>((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    color: role.color,
    description: role.description ?? '',
    userCount: userCountByRoleId.get(role.id) ?? 0,
    isSystem: role.is_system,
    isActive: role.is_active,
    customerAssignable: role.customer_assignable,
    grantAllPermissions: role.grant_all_permissions,
  }));

  const permissionModules: PermissionModule[] = modules.map((module) => ({
    code: module.code,
    name: module.name,
    description: module.description,
    groups: groups
      .filter((group) => group.module_code === module.code)
      .map((group) => ({
        name: group.name,
        permissions: definitions
          .filter((definition) => definition.group_id === group.id)
          .map<PermissionItem>((definition) => ({
            code: definition.code,
            name: definition.name,
            selected: false,
            scope: null,
            scopeOptions: definition.scope_options.filter(
              (scope): scope is PermissionScope =>
                scope === 'team' ||
                scope === 'department' ||
                scope === 'assigned_warehouses' ||
                scope === 'all',
            ),
            tags: definition.tags.filter(
              (tag): tag is (typeof PERMISSION_TAGS)[number] =>
                PERMISSION_TAGS.includes(tag),
            ),
            sensitive: definition.sensitive,
          })),
      })),
  }));

  const modulesByRoleId = Object.fromEntries(
    roles.map((role) => [
      role.id,
      applySelectedPermissionCodes(
        permissionModules,
        permissionGrantsByRoleId.get(role.id) ?? new Map(),
      ),
    ]),
  );

  return {
    roles: roleSummaries,
    modulesByRoleId,
  };
}

export async function replaceRolePermissions(
  roleId: string,
  selectedGrants: Array<{ code: string; scope: PermissionScope | null }>,
): Promise<void> {
  assertSupabaseConfigured();

  await request<void>(
    supabaseApi.post('/rpc/replace_role_permission_grants', {
      target_role_id: roleId,
      selected_grants: selectedGrants.map((grant) => ({
        code: grant.code,
        scope: grant.scope,
      })),
    }),
  );
}

export async function updateRole(
  roleId: string,
  input: UpdateRoleInput,
): Promise<RoleRow> {
  assertSupabaseConfigured();

  const rows = await request<RoleRow[]>(
    supabaseApi.patch('/roles', input, {
      ...queryParams({ id: `eq.${roleId}` }),
      headers: { Prefer: 'return=representation' },
    }),
  );
  const role = rows[0];

  if (!role) throw new Error('Không tìm thấy vai trò để cập nhật.');
  return role;
}

export async function createRole(input: CreateRoleInput): Promise<RoleRow> {
  assertSupabaseConfigured();

  const rows = await request<RoleRow[]>(
    supabaseApi.post('/roles', input, {
      headers: { Prefer: 'return=representation' },
    }),
  );
  const role = rows[0];

  if (!role) throw new Error('Không thể tạo vai trò mới.');
  return role;
}

export async function deleteRole(roleId: string): Promise<void> {
  assertSupabaseConfigured();

  await request<void>(
    supabaseApi.delete('/roles', queryParams({ id: `eq.${roleId}` })),
  );
}
