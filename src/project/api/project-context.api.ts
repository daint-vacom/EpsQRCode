import type { RoleColor } from '@/project/model/role-color';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';

interface RoleAssignmentRow {
  role_id: string;
}

interface RoleRow {
  id: string;
  name: string;
  color: RoleColor;
}

export interface ProjectAccountRole {
  name: string;
  color: RoleColor;
}

export interface ProjectContext {
  accountRoles: ProjectAccountRole[];
}

function queryParams(params: Record<string, string>) {
  return { params };
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadProjectContext(
  userId: string,
): Promise<ProjectContext> {
  assertSupabaseConfigured();

  const [assignments, roles] = await Promise.all([
    request<RoleAssignmentRow[]>(
      supabaseApi.get(
        '/user_roles',
        queryParams({
          select: 'role_id',
          user_id: `eq.${userId}`,
        }),
      ),
    ),
    request<RoleRow[]>(
      supabaseApi.get(
        '/roles',
        queryParams({
          select: 'id,name,color',
          is_active: 'eq.true',
          order: 'is_system.desc,sort_order.asc,name.asc',
        }),
      ),
    ),
  ]);

  const assignedRoleIds = new Set(
    assignments.map((assignment) => assignment.role_id),
  );
  const accountRoles = roles
    .filter((role) => assignedRoleIds.has(role.id))
    .map(({ name, color }) => ({ name, color }));

  return {
    accountRoles,
  };
}
