import { z } from 'zod';
import { COUNTRY_OPTIONS } from '@/lib/countries';

export const CUSTOMER_STATUSES = ['active', 'inactive', 'uncontacted'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const BUSINESS_TYPES = [
  'individual',
  'household',
  'organization',
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: 'Đang hoạt động',
  inactive: 'Ngừng hoạt động',
  uncontacted: 'Chưa liên hệ',
};

export const VAT_DECLARATION_PERIODS = [
  'monthly',
  'quarterly',
  'yearly',
] as const;
export type VatDeclarationPeriod = (typeof VAT_DECLARATION_PERIODS)[number];
export type StoredVatDeclarationPeriod = VatDeclarationPeriod | 'unspecified';

export const VAT_DECLARATION_PERIOD_LABELS: Record<
  StoredVatDeclarationPeriod,
  string
> = {
  unspecified: '',
  monthly: 'Theo tháng',
  quarterly: 'Theo quý',
  yearly: 'Theo năm',
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  individual: 'Cá nhân',
  household: 'Hộ kinh doanh',
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

export const customerSoftwareAccountSchema = z.object({
  id: z.string().uuid().optional(),
  catalogId: z.string().uuid().nullable().optional(),
  softwareName: z.string().trim().min(1, 'Vui lòng nhập tên phần mềm.'),
  accessUrl: z
    .string()
    .trim()
    .url('Địa chỉ truy cập không hợp lệ.')
    .or(z.literal('')),
  username: z.string().trim(),
  password: z.string(),
  accountType: z.string().trim(),
  expiresAt: z.string().trim().nullable(),
  hasPassword: z.boolean().optional(),
});

export type CustomerSoftwareAccount = z.infer<
  typeof customerSoftwareAccountSchema
>;

export function createEmptyCustomerSoftwareAccount(): CustomerSoftwareAccount {
  return {
    catalogId: null,
    softwareName: '',
    accessUrl: '',
    username: '',
    password: '',
    accountType: '',
    expiresAt: null,
  };
}

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
  districtName: z.string().trim(),
  wardName: z.string().trim(),
  streetAddress: z.string().trim(),
  phone: z.string().trim(),
  email: z.string().trim().email('Email không hợp lệ.').or(z.literal('')),
  contactName: z.string().trim(),
  contactTitle: z.string().trim(),
  establishedDate: z.date().nullable(),
  vatDeclarationPeriod: z
    .string()
    .refine(
      (value): value is VatDeclarationPeriod =>
        VAT_DECLARATION_PERIODS.includes(value as VatDeclarationPeriod),
      'Vui lòng chọn kỳ kê khai thuế GTGT.',
    ),
  customerGroupTagIds: z.array(
    z.string().uuid('Nhóm khách hàng không hợp lệ.'),
  ),
  softwareAccounts: z.array(customerSoftwareAccountSchema),
  status: z.enum(CUSTOMER_STATUSES),
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
  districtName: string;
  wardName: string;
  streetAddress: string;
  phone: string;
  email: string;
  /** Derived from streetAddress, regionName, and countryCode; never persisted. */
  fullAddress?: string;
  contactName: string;
  contactTitle: string;
  establishedDate: string | null;
  vatDeclarationPeriod: StoredVatDeclarationPeriod;
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
  district_name: string;
  ward_name: string;
  street_address: string;
  phone: string;
  email: string;
  contact_name: string;
  contact_title: string;
  established_date: string | null;
  vat_declaration_period: StoredVatDeclarationPeriod;
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
  address: string;
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
  address: string;
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
    .max(100, 'Mã số thuế không được quá 100 ký tự.'),
  countryCode: z.string().trim().max(10, 'Mã quốc gia không hợp lệ.'),
  region: z.string().trim().max(100, 'Khu vực không được quá 100 ký tự.'),
  contactSearch: z
    .string()
    .trim()
    .max(100, 'Liên hệ không được quá 100 ký tự.'),
  phone: z.string().trim().max(100, 'Số điện thoại không được quá 100 ký tự.'),
  email: z.string().trim().max(100, 'Email không được quá 100 ký tự.'),
  address: z.string().trim().max(200, 'Địa chỉ không được quá 200 ký tự.'),
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
  address: '',
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
  districtName: '',
  wardName: '',
  streetAddress: '',
  phone: '',
  email: '',
  contactName: '',
  contactTitle: '',
  establishedDate: null,
  vatDeclarationPeriod: '',
  customerGroupTagIds: [],
  softwareAccounts: [],
  status: 'active',
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
    districtName: row.district_name ?? '',
    wardName: row.ward_name ?? '',
    streetAddress: row.street_address ?? '',
    phone: row.phone,
    email: row.email,
    fullAddress: getCustomerFullAddress({
      streetAddress: row.street_address,
      regionName: row.region_name,
      countryCode: row.country_code,
    }),
    contactName: row.contact_name ?? '',
    contactTitle: row.contact_title ?? '',
    establishedDate: row.established_date ?? null,
    vatDeclarationPeriod: row.vat_declaration_period ?? 'unspecified',
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
    districtName: customer.districtName,
    wardName: customer.wardName,
    streetAddress: customer.streetAddress,
    phone: customer.phone,
    email: customer.email,
    contactName: customer.contactName,
    contactTitle: customer.contactTitle,
    establishedDate: customer.establishedDate
      ? new Date(`${customer.establishedDate}T00:00:00`)
      : null,
    vatDeclarationPeriod:
      customer.vatDeclarationPeriod === 'unspecified'
        ? ''
        : customer.vatDeclarationPeriod,
    customerGroupTagIds: [],
    softwareAccounts: [],
    status: customer.status,
    customFields: customer.customFields,
  };
}

export function getCustomerFullAddress({
  streetAddress,
  regionName,
  countryCode,
}: {
  streetAddress: string | null | undefined;
  regionName: string | null | undefined;
  countryCode: string | null | undefined;
}): string {
  const countryLabel =
    CUSTOMER_COUNTRY_OPTIONS.find((option) => option.value === countryCode)
      ?.label ?? countryCode;
  const normalizedStreet = removeTrailingAddressPart(
    removeTrailingAddressPart(streetAddress?.trim() ?? '', countryLabel),
    regionName,
  );

  return [normalizedStreet, regionName, countryLabel]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ');
}

function removeTrailingAddressPart(
  address: string,
  part: string | null | undefined,
): string {
  const trimmedPart = part?.trim();
  if (!address || !trimmedPart) return address;

  const variants = [
    trimmedPart,
    trimmedPart.replace(/^(?:tỉnh|thành phố)\s+/iu, ''),
  ];
  for (const variant of new Set(variants)) {
    if (!variant) continue;
    const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suffixPattern = new RegExp(`(?:,\\s*|\\s+)${escapedVariant}$`, 'iu');
    const shortenedAddress = address
      .replace(suffixPattern, '')
      .replace(/[,\s]+$/u, '')
      .trim();
    if (shortenedAddress && shortenedAddress.length < address.length) {
      return shortenedAddress;
    }
  }

  return address;
}
