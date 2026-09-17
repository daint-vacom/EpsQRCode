export const CUSTOMER_RESPONSIBILITY_FILTER_MODES = [
  'group',
  'employee',
] as const;

export type CustomerResponsibilityFilterMode =
  (typeof CUSTOMER_RESPONSIBILITY_FILTER_MODES)[number];

export interface CustomerResponsibilityRole {
  id: string;
  code: string;
  name: string;
  description: string;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
}

export interface CustomerResponsibilityEmployee {
  id: string;
  userId: string | null;
  employeeCode: string;
  displayName: string;
  status: 'active' | 'inactive';
  avatarUrl: string | null;
  roleIds: string[];
}

export interface CustomerResponsibilityAssignment {
  employeeId: string;
  allRoles: boolean;
  responsibilityRoleIds: string[];
  assignedBy: string | null;
  createdAt: string;
}

export interface CustomerResponsibilityWorkspace {
  roles: CustomerResponsibilityRole[];
  employees: CustomerResponsibilityEmployee[];
  assignments: CustomerResponsibilityAssignment[];
}

export interface CustomerResponsibilityAssignmentInput {
  employeeId: string;
  allRoles: boolean;
  responsibilityRoleIds: string[];
}

export interface CustomerResponsibilityFilterEmployee {
  id: string;
  employeeCode: string;
  displayName: string;
  status: 'active' | 'inactive';
  avatarUrl: string | null;
  customerCount: number;
}

export interface CustomerResponsibilityFilterOptions {
  employees: CustomerResponsibilityFilterEmployee[];
}
