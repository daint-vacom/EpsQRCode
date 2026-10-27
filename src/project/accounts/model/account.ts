import type { RepresentativeAccount } from '@/project/custodians/model/custodian';
import type { RoleColor } from '@/project/model/role-color';
import { z } from 'zod';

export type AccountType = 'eps' | 'external';
export type AccountListType = AccountType | 'unmapped';
export type QrCodeAccountStatus = 'active' | 'suspended' | 'deactivated';

export interface AccountRole {
  name: string;
  color: RoleColor;
}

export interface Account {
  userId: string;
  username: string | null;
  displayName: string;
  accountType: AccountListType;
  epsEmployeeId: string | null;
  epsEmployeeName: string | null;
  epsDepartmentId: string | null;
  epsDepartmentName: string | null;
  epsTeamId: string | null;
  epsTeamName: string | null;
  externalOrganizationId: string | null;
  externalOrganizationName: string | null;
  status: QrCodeAccountStatus;
  roleIds: string[];
  roles: AccountRole[];
  warehouseIds: string[];
  warehouseNames: string[];
}

export interface MyQrCodeAccount {
  userId: string;
  username: string | null;
  displayName: string | null;
  accountType: AccountType | null;
  status: QrCodeAccountStatus;
  roles: AccountRole[];
  epsEmployeeId: string | null;
  epsEmployeeCode: string | null;
  epsEmployeeName: string | null;
  epsEmploymentStatus: 'active' | 'inactive' | null;
  epsDepartmentName: string | null;
  epsTeamName: string | null;
  externalOrganizationName: string | null;
}

export interface FakeEpsEmployee {
  id: string;
  employee_code: string;
  display_name: string;
  email: string | null;
  department_id: string;
  department_name: string;
  team_id: string | null;
  team_name: string | null;
  employment_status: 'active' | 'inactive';
  linked_user_id: string | null;
}

export interface ExternalOrganization {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  representative_user_ids: string[];
  representative_accounts: RepresentativeAccount[];
  representative_options: RepresentativeAccount[];
}

export interface AccountRoleOption {
  id: string;
  code: string;
  name: string;
  is_system: boolean;
}

export interface AccountWarehouseOption {
  id: string;
  code: string;
  name: string;
  address: string;
}

export const accountFormSchema = z
  .object({
    accountType: z.enum(['eps', 'external']),
    epsEmployeeId: z.string(),
    externalOrganizationId: z.string(),
    displayName: z.string().trim(),
    username: z.string().trim(),
    password: z.string(),
    status: z.enum(['active', 'suspended', 'deactivated']),
    roleIds: z.array(z.string()),
    warehouseIds: z.array(z.string()),
  })
  .superRefine((values, context) => {
    if (values.accountType === 'eps' && !values.epsEmployeeId) {
      context.addIssue({
        code: 'custom',
        path: ['epsEmployeeId'],
        message: 'Vui lòng chọn nhân viên EPS.',
      });
    }
    if (values.accountType === 'external' && !values.externalOrganizationId) {
      context.addIssue({
        code: 'custom',
        path: ['externalOrganizationId'],
        message: 'Vui lòng chọn đơn vị ngoài.',
      });
    }
    if (values.accountType === 'external' && !values.displayName) {
      context.addIssue({
        code: 'custom',
        path: ['displayName'],
        message: 'Vui lòng nhập tên hiển thị.',
      });
    }
  });

export type AccountFormValues = z.infer<typeof accountFormSchema>;

export const accountDefaultValues: AccountFormValues = {
  accountType: 'eps',
  epsEmployeeId: '',
  externalOrganizationId: '',
  displayName: '',
  username: '',
  password: '',
  status: 'active',
  roleIds: [],
  warehouseIds: [],
};

export const externalOrganizationFormSchema = z.object({
  code: z.string().trim().min(1, 'Vui lòng nhập mã đơn vị.'),
  name: z.string().trim().min(1, 'Vui lòng nhập tên đơn vị.'),
  isActive: z.boolean(),
});

export type ExternalOrganizationFormValues = z.infer<
  typeof externalOrganizationFormSchema
>;

export const ACCOUNT_PERMISSION_CODES = {
  view: 'organization:account:view',
  manage: 'organization:account:manage',
  externalView: 'organization:external-organization:view',
  externalManage: 'organization:external-organization:manage',
} as const;
