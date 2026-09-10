import { z } from 'zod';
import { COUNTRY_OPTIONS } from '@/lib/countries';

export const CUSTOMER_STATUSES = ['active', 'inactive', 'uncontacted'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const BUSINESS_TYPES = ['individual', 'organization'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: 'Đang hoạt động',
  inactive: 'Ngừng hoạt động',
  uncontacted: 'Chưa liên hệ',
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  individual: 'Cá nhân',
  organization: 'Doanh nghiệp',
};

const customerCustomFieldValuesSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, fieldValue]) => [
        key,
        fieldValue == null ? '' : String(fieldValue),
      ]),
    );
  },
  z.record(z.string(), z.string()),
);

export const CUSTOMER_COUNTRY_OPTIONS = COUNTRY_OPTIONS.map(
  ({ value, label }) => ({ value, label }),
);

export const customerFormSchema = z.object({
  customerCode: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập mã khách hàng.')
    .regex(/^[A-Za-z0-9-]+$/, 'Mã chỉ gồm chữ, số và dấu gạch ngang.'),
  name: z.string().trim().min(1, 'Vui lòng nhập tên khách hàng.'),
  businessType: z.enum(BUSINESS_TYPES),
  businessRegistrationCode: z.string().trim(),
  imageUrl: z.string().trim(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/, 'Mã quốc gia phải gồm 2 chữ cái viết hoa.'),
  regionCode: z.string().trim(),
  regionName: z.string().trim(),
  phone: z.string().trim(),
  email: z.string().trim().email('Email không hợp lệ.').or(z.literal('')),
  addressDetail: z.string().trim(),
  status: z.enum(CUSTOMER_STATUSES),
  note: z.string().trim().max(500, 'Ghi chú không được quá 500 ký tự.'),
  customFields: customerCustomFieldValuesSchema,
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export interface Customer {
  id: string;
  tenantId: string;
  customerCode: string;
  name: string;
  businessType: BusinessType;
  businessRegistrationCode: string;
  imageUrl: string | null;
  countryCode: string;
  regionCode: string | null;
  regionName: string;
  phone: string;
  email: string;
  addressDetail: string;
  status: CustomerStatus;
  note: string;
  customFields: Record<string, string>;
}

export interface CustomerRow {
  id: string;
  tenant_id: string;
  customer_code: string;
  name: string;
  business_type: BusinessType;
  business_registration_code: string;
  image_url: string | null;
  country_code: string;
  region_code: string | null;
  region_name: string;
  phone: string;
  email: string;
  address_detail: string;
  status: CustomerStatus;
  note: string;
  created_at?: string;
  updated_at?: string;
  custom_fields?: Record<string, unknown> | null;
}

export interface CustomerListFieldFilters {
  customerCode: string;
  name: string;
  businessRegistrationCode: string;
  countryCode: string;
  region: string;
  contactSearch: string;
  phone: string;
  email: string;
  addressDetail: string;
  note: string;
  customFields: Record<string, string>;
}

export interface CustomerListParams {
  page: number;
  pageSize: number;
  search?: string;
  businessTypes?: BusinessType[];
  statuses?: CustomerStatus[];
  tagIds?: string[];
  responsibleEmployeeIds?: string[];
  fieldFilters?: Partial<CustomerListFieldFilters>;
}

export interface CustomerListFilters {
  customerCode: string;
  name: string;
  businessTypes: BusinessType[];
  businessRegistrationCode: string;
  countryCode: string;
  region: string;
  contactSearch: string;
  phone: string;
  email: string;
  addressDetail: string;
  statuses: CustomerStatus[];
  tagIds: string[];
  responsibleEmployeeIds?: string[];
  note: string;
  customFields: Record<string, string>;
}

export const customerFilterFormSchema = z.object({
  customerCode: z
    .string()
    .trim()
    .max(100, 'Mã khách hàng không được quá 100 ký tự.'),
  name: z.string().trim().max(100, 'Tên khách hàng không được quá 100 ký tự.'),
  businessTypes: z.array(z.enum(BUSINESS_TYPES)),
  businessRegistrationCode: z
    .string()
    .trim()
    .max(100, 'Mã số đăng ký không được quá 100 ký tự.'),
  countryCode: z.string().trim().max(10, 'Mã quốc gia không hợp lệ.'),
  region: z.string().trim().max(100, 'Khu vực không được quá 100 ký tự.'),
  contactSearch: z
    .string()
    .trim()
    .max(100, 'Liên hệ không được quá 100 ký tự.'),
  phone: z.string().trim().max(100, 'Số điện thoại không được quá 100 ký tự.'),
  email: z.string().trim().max(100, 'Email không được quá 100 ký tự.'),
  addressDetail: z
    .string()
    .trim()
    .max(200, 'Địa chỉ không được quá 200 ký tự.'),
  tagIds: z.array(z.string()),
  statuses: z.array(z.enum(CUSTOMER_STATUSES)),
  note: z.string().trim().max(500, 'Ghi chú không được quá 500 ký tự.'),
  customFields: customerCustomFieldValuesSchema,
});

export type CustomerFilterFormValues = z.infer<typeof customerFilterFormSchema>;

export const CUSTOMER_LIST_INITIAL_FILTERS: CustomerListFilters = {
  customerCode: '',
  name: '',
  businessTypes: [],
  businessRegistrationCode: '',
  countryCode: '',
  region: '',
  contactSearch: '',
  phone: '',
  email: '',
  addressDetail: '',
  statuses: [],
  tagIds: [],
  responsibleEmployeeIds: [],
  note: '',
  customFields: {},
};

export interface CustomerListResult {
  customers: Customer[];
  total: number;
}

export interface CustomerListRpcRow extends CustomerRow {
  created_at: string;
}

export const emptyCustomerForm: CustomerFormValues = {
  customerCode: '',
  name: '',
  businessType: 'individual',
  businessRegistrationCode: '',
  imageUrl: '',
  countryCode: 'VN',
  regionCode: '',
  regionName: '',
  phone: '',
  email: '',
  addressDetail: '',
  status: 'active',
  note: '',
  customFields: {},
};

export function mapCustomerRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerCode: row.customer_code,
    name: row.name,
    businessType: row.business_type,
    businessRegistrationCode: row.business_registration_code ?? '',
    imageUrl: row.image_url,
    countryCode: row.country_code ?? 'VN',
    regionCode: row.region_code,
    regionName: row.region_name ?? '',
    phone: row.phone,
    email: row.email,
    addressDetail: row.address_detail,
    status: row.status,
    note: row.note,
    customFields: normalizeCustomFieldValues(row.custom_fields),
  };
}

export function normalizeCustomFieldValues(
  data: Record<string, unknown> | null | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data ?? {}).map(([key, value]) => [
      key,
      value == null ? '' : String(value),
    ]),
  );
}

export function mapCustomerToFormValues(
  customer: Customer,
): CustomerFormValues {
  return {
    customerCode: customer.customerCode,
    name: customer.name,
    businessType: customer.businessType,
    businessRegistrationCode: customer.businessRegistrationCode,
    imageUrl: customer.imageUrl ?? '',
    countryCode: customer.countryCode,
    regionCode: customer.regionCode ?? '',
    regionName: customer.regionName,
    phone: customer.phone,
    email: customer.email,
    addressDetail: customer.addressDetail,
    status: customer.status,
    note: customer.note,
    customFields: customer.customFields,
  };
}
