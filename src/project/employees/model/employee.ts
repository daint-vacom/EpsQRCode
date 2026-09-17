import { z } from 'zod';
import type { RoleColor } from '../../model/role-color';

export const EMPLOYEE_STATUSES = ['active', 'inactive'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Còn làm việc',
  inactive: 'Ngừng làm việc',
};

const employeeCustomFieldValuesSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    return Object.fromEntries(
      Object.entries(value).map(([key, fieldValue]) => [
        key,
        fieldValue == null ? '' : String(fieldValue),
      ]),
    );
  },
  z.record(z.string(), z.string()),
);

export type EmployeeAccountFilter = 'all' | 'linked' | 'unlinked';

export interface EmployeeListFilters {
  statuses: EmployeeStatus[];
  roleIds: string[];
  accountLinked: EmployeeAccountFilter;
  tagIds: string[];
}

export const EMPLOYEE_LIST_INITIAL_FILTERS: EmployeeListFilters = {
  statuses: [],
  roleIds: [],
  accountLinked: 'all',
  tagIds: [],
};

export const employeeFormSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập mã nhân viên.')
    .regex(/^[A-Za-z0-9-]+$/, 'Mã chỉ gồm chữ, số và dấu gạch ngang.'),
  firstName: z.string().trim().min(1, 'Vui lòng nhập tên nhân viên.'),
  lastName: z.string().trim(),
  phone: z.string().trim(),
  status: z.enum(EMPLOYEE_STATUSES),
  joinedAt: z.date().nullable(),
  note: z.string().trim().max(500, 'Ghi chú không được quá 500 ký tự.'),
  imageUrl: z.string().trim(),
  roleIds: z.array(z.string()),
  customFields: employeeCustomFieldValuesSchema,
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export interface EmployeeRole {
  name: string;
  color: RoleColor;
}

export interface EmployeeRoleOption {
  id: string;
  name: string;
  color: RoleColor;
  isActive: boolean;
  customerAssignable: boolean;
}

export interface Employee {
  id: string;
  tenantId: string;
  userId: string | null;
  avatarUrl: string | null;
  roles: EmployeeRole[];
  roleIds: string[];
  employeeCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  status: EmployeeStatus;
  joinedAt: string | null;
  note: string;
  accountLinked: boolean;
}

export interface EmployeeRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  employee_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: EmployeeStatus;
  joined_at: string | null;
  note: string;
  avatar_url?: string | null;
}

export interface EmployeeListRpcRow extends EmployeeRow {
  avatar_url: string | null;
  roles: EmployeeRole[];
  role_ids?: string[];
}

export interface EmployeeListParams {
  page: number;
  pageSize: number;
  search?: string;
  statuses?: EmployeeStatus[];
  roleIds?: string[];
  accountLinked?: boolean;
  tagIds?: string[];
}

export interface EmployeeListResult {
  employees: Employee[];
  total: number;
}

export interface EmployeeAvatarRow {
  id: string;
  avatar_url: string | null;
}

export const emptyEmployeeForm: EmployeeFormValues = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  phone: '',
  status: 'active',
  joinedAt: null,
  note: '',
  imageUrl: '',
  roleIds: [],
  customFields: {},
};

export function mapEmployeeRow(
  row: EmployeeRow,
  avatarUrl: string | null = null,
  roles: EmployeeRole[] = [],
  roleIds: string[] = [],
): Employee {
  const displayName = [row.last_name, row.first_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    avatarUrl: avatarUrl ?? row.avatar_url ?? null,
    roles,
    roleIds,
    employeeCode: row.employee_code,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: displayName || row.employee_code,
    phone: row.phone,
    status: row.status,
    joinedAt: row.joined_at,
    note: row.note,
    accountLinked: Boolean(row.user_id),
  };
}

export function mapEmployeeToFormValues(
  employee: Employee,
): EmployeeFormValues {
  return {
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    phone: employee.phone,
    status: employee.status,
    joinedAt: employee.joinedAt
      ? new Date(`${employee.joinedAt}T00:00:00`)
      : null,
    note: employee.note,
    imageUrl: employee.avatarUrl ?? '',
    roleIds: [...employee.roleIds],
    customFields: {},
  };
}
