import type { CustomField } from '@/project/data-configuration/model/custom-field';
import { COUNTRY_OPTIONS } from '@/lib/countries';
import {
  countMatchingEntityDetailDialogFields,
  EntityDetailDialogTable,
  type EntityDetailDialogField,
  type EntityDetailDialogTabContext,
} from '@/components/layouts/entity-detail-dialog';
import {
  BUSINESS_TYPE_LABELS,
  CUSTOMER_STATUS_LABELS,
  VAT_DECLARATION_PERIOD_LABELS,
  type Customer,
} from '../model/customer';
import { CustomerAvatar } from './customer-avatar';
import { CustomerDetailDialogShell } from './customer-detail-dialog.generated';

function displayValue(value: string | null | undefined) {
  return value?.trim() || 'Chưa cập nhật';
}

function formatCustomerDate(value: string | null) {
  if (!value) return 'Chưa cập nhật';

  return new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`));
}

function joinSearchText(...values: unknown[]) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value) => value !== null && value !== undefined)
    .join(' ');
}

function getCustomerGeneralFields(
  customer: Customer,
): EntityDetailDialogField[] {
  const country = COUNTRY_OPTIONS.find(
    (option) => option.value === customer.countryCode,
  );

  return [
    {
      label: 'Ảnh khách hàng',
      value: (
        <CustomerAvatar
          customer={customer}
          className="size-12 rounded-xl text-base"
        />
      ),
      searchText: customer.name,
    },
    {
      label: 'Mã khách hàng',
      value: displayValue(customer.customerCode),
      searchText: customer.customerCode,
    },
    {
      label: 'Tên khách hàng',
      value: displayValue(customer.name),
      searchText: customer.name,
    },
    {
      label: 'Loại hình đơn vị',
      value: BUSINESS_TYPE_LABELS[customer.businessType],
      searchText: BUSINESS_TYPE_LABELS[customer.businessType],
    },
    {
      label: 'Mã số thuế / QHNS / ĐKKD',
      value: displayValue(customer.businessRegistrationCode),
      searchText: customer.businessRegistrationCode,
    },
    {
      label: 'Quốc gia',
      value: country?.label ?? displayValue(customer.countryCode),
      searchText: joinSearchText(country?.label, customer.countryCode),
    },
    {
      label: 'Tỉnh/Thành phố',
      value: displayValue(customer.regionName),
      searchText: customer.regionName,
    },
    {
      label: 'Quận/Huyện',
      value: displayValue(customer.districtName),
      searchText: customer.districtName,
    },
    {
      label: 'Phường/Xã',
      value: displayValue(customer.wardName),
      searchText: customer.wardName,
    },
    {
      label: 'Số nhà, tên đường',
      value: displayValue(customer.streetAddress),
      searchText: customer.streetAddress,
    },
    {
      label: 'Địa chỉ đầy đủ',
      value: displayValue(customer.addressDetail),
      searchText: customer.addressDetail,
    },
    {
      label: 'Người liên hệ',
      value: displayValue(customer.contactName),
      searchText: customer.contactName,
    },
    {
      label: 'Chức danh',
      value: displayValue(customer.contactTitle),
      searchText: customer.contactTitle,
    },
    {
      label: 'Ngày thành lập',
      value: formatCustomerDate(customer.establishedDate),
      searchText: customer.establishedDate,
    },
    {
      label: 'Kỳ kê khai thuế GTGT',
      value: VAT_DECLARATION_PERIOD_LABELS[customer.vatDeclarationPeriod],
      searchText: VAT_DECLARATION_PERIOD_LABELS[customer.vatDeclarationPeriod],
    },
    {
      label: 'Số điện thoại',
      value: displayValue(customer.phone),
      searchText: customer.phone,
    },
    {
      label: 'Email',
      value: displayValue(customer.email),
      searchText: customer.email,
    },
    {
      label: 'Trạng thái',
      value: CUSTOMER_STATUS_LABELS[customer.status],
      searchText: CUSTOMER_STATUS_LABELS[customer.status],
    },
  ];
}

function getCustomFieldDisplayValue(
  customField: CustomField,
  customFieldValues: Record<string, string>,
) {
  const value = customFieldValues[customField.key]?.trim();
  if (!value) return 'Chưa cập nhật';

  if (customField.fieldType !== 'select') return value;

  return (
    customField.options.find((option) => option.value === value)?.label ?? value
  );
}

function getCustomerCustomFields(
  customFields: CustomField[],
  customFieldValues: Record<string, string>,
): EntityDetailDialogField[] {
  return customFields
    .filter((customField) => customField.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((customField) => ({
      label: customField.label,
      value: getCustomFieldDisplayValue(customField, customFieldValues),
      searchText: getCustomFieldDisplayValue(customField, customFieldValues),
    }));
}

function buildGeneralSearchText(customer: Customer) {
  return joinSearchText(
    'thông tin chung',
    customer.name,
    customer.customerCode,
    BUSINESS_TYPE_LABELS[customer.businessType],
    customer.businessRegistrationCode,
    customer.countryCode,
    customer.regionName,
    customer.districtName,
    customer.wardName,
    customer.streetAddress,
    customer.addressDetail,
    customer.contactName,
    customer.contactTitle,
    customer.establishedDate,
    VAT_DECLARATION_PERIOD_LABELS[customer.vatDeclarationPeriod],
    customer.phone,
    customer.email,
    CUSTOMER_STATUS_LABELS[customer.status],
  );
}

function buildCustomSearchText(
  customer: Customer,
  customFields: CustomField[],
  customFieldValues: Record<string, string>,
) {
  return joinSearchText(
    'thông tin bổ sung',
    customer.name,
    customFields
      .filter((customField) => customField.isActive)
      .map((customField) => [
        customField.label,
        getCustomFieldDisplayValue(customField, customFieldValues),
      ]),
  );
}

function countMatchingGeneralFields({
  data,
  matches,
}: EntityDetailDialogTabContext<Customer>) {
  return countMatchingEntityDetailDialogFields(
    getCustomerGeneralFields(data),
    matches,
  );
}

function CustomerCustomFieldsContent({
  customFields,
  customFieldValues,
  matches,
}: {
  customFields: CustomField[];
  customFieldValues: Record<string, string>;
  matches: (value: unknown) => boolean;
}) {
  const fields = getCustomerCustomFields(customFields, customFieldValues);

  if (fields.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Chưa có trường bổ sung cho khách hàng.
      </div>
    );
  }

  return <EntityDetailDialogTable fields={fields} matches={matches} />;
}

function countMatchingCustomFields({
  data: _data,
  matches,
  customFields,
  customFieldValues,
}: EntityDetailDialogTabContext<Customer> & {
  customFields: CustomField[];
  customFieldValues: Record<string, string>;
}) {
  return countMatchingEntityDetailDialogFields(
    getCustomerCustomFields(customFields, customFieldValues),
    matches,
  );
}

export function CustomerDetailDialog({
  open,
  onOpenChange,
  customer,
  customFields = [],
  customFieldValues = {},
  isLoading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  customFields?: CustomField[];
  customFieldValues?: Record<string, string>;
  isLoading?: boolean;
}) {
  return (
    <CustomerDetailDialogShell<Customer>
      open={open}
      onOpenChange={onOpenChange}
      title="Chi tiết khách hàng"
      data={customer}
      isLoading={isLoading}
      searchPlaceholder="Tìm theo tên, mã, thông tin liên hệ..."
      generalFields={({ data }) => getCustomerGeneralFields(data)}
      customContent={({ matches }) => (
        <CustomerCustomFieldsContent
          customFields={customFields}
          customFieldValues={customFieldValues}
          matches={matches}
        />
      )}
      generalSearchText={buildGeneralSearchText}
      customSearchText={(data) =>
        buildCustomSearchText(data, customFields, customFieldValues)
      }
      generalSearchMatchCount={countMatchingGeneralFields}
      customSearchMatchCount={({ data, matches }) =>
        countMatchingCustomFields({
          data,
          matches,
          customFields,
          customFieldValues,
        })
      }
    />
  );
}
