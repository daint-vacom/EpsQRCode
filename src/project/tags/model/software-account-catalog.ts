import { z } from 'zod';

export const softwareAccountCatalogFormSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên phần mềm.'),
  description: z.string().trim().max(500, 'Mô tả không được quá 500 ký tự.'),
  defaultAccessUrl: z
    .string()
    .trim()
    .url('Địa chỉ truy cập không hợp lệ.')
    .or(z.literal('')),
  defaultUsername: z.string().trim(),
  defaultPassword: z.string(),
  accountTypes: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Vui lòng nhập loại tài khoản.'),
        isDefault: z.boolean(),
      }),
    )
    .refine(
      (rows) => rows.filter((row) => row.isDefault).length <= 1,
      'Chỉ được chọn một loại tài khoản mặc định.',
    ),
  isActive: z.boolean(),
});

export type SoftwareAccountCatalogFormValues = z.infer<
  typeof softwareAccountCatalogFormSchema
>;

export interface SoftwareAccountCatalog {
  id: string;
  tenantId: string;
  groupId: string;
  name: string;
  description: string;
  defaultAccessUrl: string;
  defaultUsername: string;
  defaultPassword: string;
  accountTypes: SoftwareAccountCatalogAccountType[];
  sortOrder: number;
  isActive: boolean;
  hasDefaultPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SoftwareAccountCatalogRpcRow {
  id: string;
  tenant_id: string;
  group_id: string;
  name: string;
  description: string;
  default_access_url: string;
  default_username: string;
  default_password: string | null;
  account_types: unknown;
  sort_order: number;
  is_active: boolean;
  has_default_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface SoftwareAccountCatalogAccountType {
  name: string;
  isDefault: boolean;
}

export function getSoftwareAccountCatalogDefaultAccountType(
  catalog: Pick<SoftwareAccountCatalog, 'accountTypes'>,
): string {
  return (
    catalog.accountTypes.find((accountType) => accountType.isDefault)?.name ??
    catalog.accountTypes[0]?.name ??
    ''
  );
}

function parseAccountTypes(
  value: unknown,
): SoftwareAccountCatalogAccountType[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { name?: unknown; isDefault?: unknown };
    const name = typeof row.name === 'string' ? row.name : '';
    if (!name.trim()) return [];
    return [{ name, isDefault: row.isDefault === true }];
  });
}

export function mapSoftwareAccountCatalogAccountTypes(
  value: unknown,
): SoftwareAccountCatalogAccountType[] {
  return parseAccountTypes(value);
}

export const emptySoftwareAccountCatalogForm: SoftwareAccountCatalogFormValues =
  {
    name: '',
    description: '',
    defaultAccessUrl: '',
    defaultUsername: '',
    defaultPassword: '',
    accountTypes: [],
    isActive: true,
  };
