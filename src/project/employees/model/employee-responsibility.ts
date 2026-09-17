import type { EmployeeRoleOption } from './employee';

export interface EmployeeCustomerOption {
  id: string;
  customerCode: string;
  name: string;
  imageUrl: string | null;
  status: 'active' | 'inactive';
}

export interface EmployeeCustomerAssignmentInput {
  customerId: string;
  allRoles: boolean;
  responsibilityRoleIds: string[];
}

export interface EmployeeResponsibilityWorkspace {
  roles: EmployeeRoleOption[];
  customers: EmployeeCustomerOption[];
  assignments: EmployeeCustomerAssignmentInput[];
}
