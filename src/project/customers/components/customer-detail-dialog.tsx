import type { CustomField } from '@/project/data-configuration/model/custom-field';
import { COUNTRY_OPTIONS } from '@/lib/countries';
import { Input } from '@/components/ui/input';
import {
  countMatchingEntityDetailDialogFields,
  EntityDetailDialogTable,
  type EntityDetailDialogField,
  type EntityDetailDialogTabContext,
} from '@/components/layouts/entity-detail-dialog';
import { EmployeeRoleBadge } from '../../employees/components/employee-badges';
import { EmployeeCell } from '../../employees/components/employee-cell';
import {
  BUSINESS_TYPE_LABELS,
  CUSTOMER_STATUS_LABELS,
  VAT_DECLARATION_PERIOD_LABELS,
  type Customer,
  type CustomerSoftwareAccount,
} from '../model/customer';
import type {
  CustomerResponsibilityEmployee,
  CustomerResponsibilityRole,
  CustomerResponsibilityWorkspace,
} from '../model/customer-responsibility';
import { CustomerAvatar } from './customer-avatar';
import { CustomerDetailDialogShell } from './customer-detail-dialog.generated';

function displayValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function formatCustomerDate(value: string | null) {
  if (!value) return '';

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
      label: 'Mã số thuế',
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
  if (!value) return '';

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

interface CustomerResponsibilityDetailRow {
  employee: CustomerResponsibilityEmployee;
  allRoles: boolean;
  roles: CustomerResponsibilityRole[];
  searchText: string;
}

function getCustomerResponsibilityRows(
  workspace?: CustomerResponsibilityWorkspace,
): CustomerResponsibilityDetailRow[] {
  if (!workspace) return [];

  const employeeById = new Map(
    workspace.employees.map((employee) => [employee.id, employee]),
  );
  const roleById = new Map(workspace.roles.map((role) => [role.id, role]));

  return workspace.assignments.flatMap((assignment) => {
    const employee = employeeById.get(assignment.employeeId);
    if (!employee) return [];

    const roles = assignment.responsibilityRoleIds
      .map((roleId) => roleById.get(roleId))
      .filter((role): role is CustomerResponsibilityRole => Boolean(role));

    return [
      {
        employee,
        allRoles: assignment.allRoles,
        roles,
        searchText: joinSearchText(
          employee.displayName,
          employee.employeeCode,
          assignment.allRoles ? 'tất cả vai trò' : '',
          roles.map((role) => role.name),
        ),
      },
    ];
  });
}

function getCustomerResponsibilityFields(
  rows: CustomerResponsibilityDetailRow[],
): EntityDetailDialogField[] {
  return rows.map((row) => ({
    label: <EmployeeCell employee={row.employee} />,
    labelSearchText: joinSearchText(
      row.employee.displayName,
      row.employee.employeeCode,
    ),
    value: row.allRoles ? (
      <span className="text-sm font-medium text-foreground">
        Tất cả vai trò
      </span>
    ) : row.roles.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        {row.roles.map((role) => (
          <EmployeeRoleBadge
            key={role.id}
            role={{ name: role.name, color: 'blue' }}
          />
        ))}
      </div>
    ) : (
      <span className="text-sm text-muted-foreground">Chưa gán vai trò</span>
    ),
    searchText: row.searchText,
  }));
}

function CustomerResponsibilityContent({
  workspace,
  matches,
}: {
  workspace?: CustomerResponsibilityWorkspace;
  matches: (value: unknown) => boolean;
}) {
  const rows = getCustomerResponsibilityRows(workspace);

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Chưa có nhân viên phụ trách.
      </div>
    );
  }

  return (
    <EntityDetailDialogTable
      fields={getCustomerResponsibilityFields(rows)}
      matches={matches}
    />
  );
}

function buildResponsibilitySearchText(
  customer: Customer,
  workspace?: CustomerResponsibilityWorkspace,
) {
  return joinSearchText(
    'nhân viên phụ trách',
    customer.name,
    getCustomerResponsibilityRows(workspace).map((row) => row.searchText),
  );
}

function countMatchingResponsibility({
  matches,
  workspace,
}: {
  matches: (value: unknown) => boolean;
  workspace?: CustomerResponsibilityWorkspace;
}) {
  return getCustomerResponsibilityRows(workspace).filter((row) =>
    matches(row.searchText),
  ).length;
}

function getSoftwareAccountSearchText(account: CustomerSoftwareAccount) {
  return joinSearchText(
    account.softwareName,
    account.accessUrl,
    account.username,
    account.accountType,
    account.expiresAt,
    account.hasPassword ? 'đã lưu mật khẩu' : 'chưa có mật khẩu',
  );
}

function CustomerSoftwareAccountSubRows({
  account,
}: {
  account: CustomerSoftwareAccount;
}) {
  const rows = [
    { label: 'Địa chỉ truy cập', value: displayValue(account.accessUrl) },
    { label: 'Tài khoản', value: displayValue(account.username) },
    {
      label: 'Mật khẩu',
      value: account.hasPassword ? (
        <Input
          aria-label="Mật khẩu"
          className="h-8.5 max-w-sm border-0 bg-transparent px-0 shadow-none [&[readonly]]:bg-transparent [&[readonly]]:cursor-default"
          readOnly
          type="password"
          value={account.password || 'password'}
        />
      ) : (
        ''
      ),
    },
    { label: 'Loại tài khoản', value: displayValue(account.accountType) },
    { label: 'Ngày hết hạn', value: formatCustomerDate(account.expiresAt) },
  ];

  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b last:border-b-0">
            <td className="w-[180px] py-2 pe-4 align-top text-muted-foreground">
              {row.label}
            </td>
            <td className="py-2 align-top text-foreground">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function getSoftwareAccountFields(
  accounts: CustomerSoftwareAccount[],
): EntityDetailDialogField[] {
  return accounts.map((account) => ({
    label: displayValue(account.softwareName),
    value: <CustomerSoftwareAccountSubRows account={account} />,
    searchText: getSoftwareAccountSearchText(account),
    valueClassName: 'p-0',
  }));
}

function CustomerSoftwareAccountsContent({
  accounts,
  matches,
}: {
  accounts: CustomerSoftwareAccount[];
  matches: (value: unknown) => boolean;
}) {
  if (accounts.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Chưa có tài khoản phần mềm.
      </div>
    );
  }

  return (
    <EntityDetailDialogTable
      fields={getSoftwareAccountFields(accounts)}
      matches={matches}
    />
  );
}

function buildSoftwareAccountsSearchText(
  customer: Customer,
  accounts: CustomerSoftwareAccount[],
) {
  return joinSearchText(
    'tài khoản phần mềm',
    customer.name,
    accounts.map(getSoftwareAccountSearchText),
  );
}

function countMatchingSoftwareAccounts({
  matches,
  accounts,
}: {
  matches: (value: unknown) => boolean;
  accounts: CustomerSoftwareAccount[];
}) {
  return accounts.filter((account) =>
    matches(getSoftwareAccountSearchText(account)),
  ).length;
}

export function CustomerDetailDialog({
  open,
  onOpenChange,
  customer,
  customFields = [],
  customFieldValues = {},
  responsibilityWorkspace,
  softwareAccounts = [],
  isLoading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  customFields?: CustomField[];
  customFieldValues?: Record<string, string>;
  responsibilityWorkspace?: CustomerResponsibilityWorkspace;
  softwareAccounts?: CustomerSoftwareAccount[];
  isLoading?: boolean;
}) {
  return (
    <CustomerDetailDialogShell<Customer>
      open={open}
      onOpenChange={onOpenChange}
      title={
        customer ? (
          <>
            Tra cứu khách hàng:{' '}
            <span className="font-semibold text-primary">{customer.name}</span>
          </>
        ) : (
          'Tra cứu khách hàng'
        )
      }
      data={customer}
      isLoading={isLoading}
      searchPlaceholder="Tìm kiếm dữ liệu"
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
      responsibilityContent={({ matches }) => (
        <CustomerResponsibilityContent
          workspace={responsibilityWorkspace}
          matches={matches}
        />
      )}
      softwareAccountsContent={({ matches }) => (
        <CustomerSoftwareAccountsContent
          accounts={softwareAccounts}
          matches={matches}
        />
      )}
      responsibilitySearchText={(data) =>
        buildResponsibilitySearchText(data, responsibilityWorkspace)
      }
      softwareAccountsSearchText={(data) =>
        buildSoftwareAccountsSearchText(data, softwareAccounts)
      }
      responsibilitySearchMatchCount={({ matches }) =>
        countMatchingResponsibility({
          matches,
          workspace: responsibilityWorkspace,
        })
      }
      softwareAccountsSearchMatchCount={({ matches }) =>
        countMatchingSoftwareAccounts({ matches, accounts: softwareAccounts })
      }
    />
  );
}
