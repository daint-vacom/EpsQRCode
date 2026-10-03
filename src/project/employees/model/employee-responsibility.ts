import type { CustomerStatus } from '@/project/customers/model/customer';
import type { EmployeeRoleOption } from './employee';

export interface EmployeeCustomerOption {
  id: string;
  customerCode: string;
  name: string;
  imageUrl: string | null;
  status: CustomerStatus;
}

export interface EmployeeDistributionChartPoint {
  name: string;
  value: number;
  fill: string;
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
