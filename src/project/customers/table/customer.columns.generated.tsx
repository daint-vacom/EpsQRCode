/**
 * Scaffolded by table-builder from `src/project/customers/table/customer.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import { TagColumnFilter } from '@/project/tags/components/tag-column-filter';
import { TagList } from '@/project/tags/components/tag-list';
import type { TagSelectOption } from '@/project/tags/model/tag';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { ExternalLink, Pencil, Search, Trash2 } from 'lucide-react';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
  type StatusBadgeConfig,
} from '@/components/ui/data-grid-columns';
import { OptionSelect } from '@/components/ui/option-select';
import { CustomerCell } from '../components/customer-cell';
import {
  CustomerCustomFieldColumnFilter,
  getCustomerCustomFieldDisplayValue,
} from '../components/customer-custom-field-filter';
import {
  BUSINESS_TYPE_LABELS,
  CUSTOMER_COUNTRY_OPTIONS,
  type Customer,
} from '../model/customer';
import {
  CustomerBusinessTypeColumnFilter,
  CustomerContactColumnFilter,
  CustomerStatusColumnFilter,
  CustomerTextColumnFilter,
} from './customer-column-filters.generated';

export const CUSTOMER_COLUMN_PINNING: ColumnPinningState = {
  left: ['select', 'name'],
  right: ['actions'],
};

const statusBadgeConfig: StatusBadgeConfig<string> = {
  active: {
    label: 'Đang hoạt động',
    className:
      'rounded-md border-transparent bg-admin-success-bg px-2.5 py-1 text-xs text-admin-success-text',
    dotClassName: 'bg-admin-success-dot opacity-100',
  },
  inactive: {
    label: 'Ngừng hoạt động',
    className:
      'rounded-md border-transparent bg-admin-red-bg px-2.5 py-1 text-xs text-admin-red-dark',
    dotClassName: 'bg-admin-red-primary opacity-100',
  },
  uncontacted: {
    label: 'Chưa liên hệ',
    className:
      'rounded-md border-transparent bg-muted px-2.5 py-1 text-xs text-muted-foreground',
    dotClassName: 'bg-admin-neutral-400 opacity-100',
  },
};

export interface UseCustomerColumnsParams {
  onLookup?: (customer: Customer) => void;
  onOpenDetail?: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
  includeActions?: boolean;
  customFields: CustomField[];
  tagIds: string[];
  onTagIdsChange: (value: string[]) => void;
  tagsByCustomerId: Record<string, TagSelectOption[]>;
  name: string;
  onNameChange: (value: string) => void;
  businessTypes: string[];
  onBusinessTypesChange: (value: string[]) => void;
  businessRegistrationCode: string;
  onBusinessRegistrationCodeChange: (value: string) => void;
  countryCode: string;
  onCountryCodeChange: (value: string) => void;
  region: string;
  onRegionChange: (value: string) => void;
  contactSearch: string;
  onContactSearchChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  addressDetail: string;
  onAddressDetailChange: (value: string) => void;
  statuses: string[];
  onStatusesChange: (value: string[]) => void;
  note: string;
  onNoteChange: (value: string) => void;
  customFieldValues: Record<string, string>;
  onCustomFieldChange: (key: string, value: string) => void;
}

function textFilter(
  value: string,
  onChange: (value: string) => void,
  ariaLabel: string,
) {
  return (
    <CustomerTextColumnFilter
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
    />
  );
}

export function useCustomerColumns(
  params: UseCustomerColumnsParams,
): ColumnDef<Customer>[] {
  return useMemo(() => {
    const col = createColumnHelpers<Customer>();
    const customColumns = params.customFields
      .filter((field) => field.isActive)
      .map((field) =>
        col.custom({
          id: `customField:${field.key}`,
          header: field.label,
          headerFilter: (
            <CustomerCustomFieldColumnFilter
              field={field}
              value={params.customFieldValues[field.key] ?? ''}
              onChange={(value) => params.onCustomFieldChange(field.key, value)}
            />
          ),
          headerClassName: 'min-w-[180px]',
          size: 220,
          visibility: false,
          enableSorting: false,
          cell: (row) => (
            <span className="text-sm text-foreground">
              {getCustomerCustomFieldDisplayValue(
                field,
                row.customFields[field.key] ?? '',
              )}
            </span>
          ),
        }),
      );

    const actionColumn =
      params.includeActions !== false &&
      params.onLookup &&
      params.onOpenDetail &&
      params.onEdit &&
      params.onDelete
        ? col.actions({
            id: 'actions',
            header: '',
            size: getDataGridActionsColumnSize(4),
            cellClassName: 'text-right',
            enableSorting: false,
            cell: (row) => (
              <div className="flex justify-end gap-1">
                <DataGridActionButton
                  action="other"
                  tooltip="Mở trang chi tiết"
                  type="button"
                  mode="icon"
                  size="sm"
                  aria-label={`Mở trang chi tiết khách hàng ${row.name}`}
                  onClick={() => params.onOpenDetail?.(row)}
                >
                  <ExternalLink className="size-4" />
                </DataGridActionButton>
                <DataGridActionButton
                  action="view"
                  tooltip="Tra cứu"
                  type="button"
                  mode="icon"
                  size="sm"
                  aria-label={`Tra cứu khách hàng ${row.name}`}
                  onClick={() => params.onLookup?.(row)}
                >
                  <Search className="size-4" />
                </DataGridActionButton>
                <DataGridActionButton
                  action="edit"
                  tooltip="Sửa"
                  type="button"
                  mode="icon"
                  size="sm"
                  aria-label={`Sửa khách hàng ${row.name}`}
                  onClick={() => params.onEdit?.(row)}
                >
                  <Pencil className="size-4" />
                </DataGridActionButton>
                <DataGridActionButton
                  action="delete"
                  tooltip="Xóa"
                  type="button"
                  mode="icon"
                  size="sm"
                  aria-label={`Xóa khách hàng ${row.name}`}
                  onClick={() => params.onDelete?.(row)}
                >
                  <Trash2 className="size-4" />
                </DataGridActionButton>
              </div>
            ),
          })
        : null;

    return [
      col.select(),
      col.custom({
        id: 'name',
        header: 'Khách hàng',
        headerFilter: textFilter(
          params.name,
          params.onNameChange,
          'Tìm theo tên khách hàng',
        ),
        headerClassName: 'min-w-[300px]',
        size: 320,
        enableSorting: false,
        cell: (row) => <CustomerCell customer={row} />,
      }),
      col.custom({
        id: 'businessType',
        header: 'Loại hình đơn vị',
        headerFilter: (
          <CustomerBusinessTypeColumnFilter
            value={params.businessTypes}
            onChange={params.onBusinessTypesChange}
          />
        ),
        headerClassName: 'min-w-[170px]',
        size: 180,
        enableSorting: false,
        cell: (row) => (
          <span className="text-sm text-foreground">
            {BUSINESS_TYPE_LABELS[row.businessType]}
          </span>
        ),
      }),
      col.custom({
        id: 'contact',
        header: 'Liên hệ',
        headerFilter: (
          <CustomerContactColumnFilter
            value={params.contactSearch}
            onChange={params.onContactSearchChange}
          />
        ),
        headerClassName: 'min-w-[220px]',
        size: 280,
        enableSorting: false,
        cell: (row) => (
          <div className="min-w-0">
            <div className="truncate text-sm text-foreground">
              {row.phone || 'Chưa có số điện thoại'}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {row.email || 'Chưa có email'}
            </div>
          </div>
        ),
      }),
      col.custom({
        id: 'tags',
        header: 'Nhóm/danh mục',
        headerFilter: (
          <TagColumnFilter
            value={params.tagIds}
            onChange={params.onTagIdsChange}
            moduleCodes={['customers']}
            ariaLabel="Nhóm/danh mục khách hàng"
          />
        ),
        headerClassName: 'min-w-[220px]',
        size: 240,
        enableSorting: false,
        cell: (row) => <TagList tags={params.tagsByCustomerId[row.id] ?? []} />,
      }),
      col.badge({
        id: 'status',
        header: 'Trạng thái',
        get: (row) => row.status,
        config: statusBadgeConfig,
        headerFilter: (
          <CustomerStatusColumnFilter
            value={params.statuses}
            onChange={params.onStatusesChange}
          />
        ),
        headerClassName: 'min-w-[170px]',
        size: 170,
        enableSorting: false,
      }),
      col.text({
        id: 'businessRegistrationCode',
        header: 'Mã số thuế',
        get: (row) => row.businessRegistrationCode,
        headerFilter: textFilter(
          params.businessRegistrationCode,
          params.onBusinessRegistrationCodeChange,
          'Tìm theo mã số thuế',
        ),
        headerClassName: 'min-w-[170px]',
        size: 180,
        enableSorting: false,
      }),
      col.custom({
        id: 'countryCode',
        header: 'Quốc gia',
        headerFilter: (
          <OptionSelect
            value={params.countryCode}
            onChange={params.onCountryCodeChange}
            options={CUSTOMER_COUNTRY_OPTIONS}
            placeholder="Tất cả"
            searchable
            canDeselect
            ariaLabel="Lọc theo quốc gia"
            size="sm"
            className="min-w-0 bg-background"
          />
        ),
        headerClassName: 'min-w-[160px]',
        size: 160,
        enableSorting: false,
        cell: (row) => (
          <span className="text-sm text-foreground">{row.countryCode}</span>
        ),
      }),
      col.custom({
        id: 'region',
        header: 'Khu vực',
        headerFilter: textFilter(
          params.region,
          params.onRegionChange,
          'Tìm theo mã hoặc tên khu vực',
        ),
        headerClassName: 'min-w-[180px]',
        size: 220,
        enableSorting: false,
        cell: (row) => (
          <div className="min-w-0">
            <div className="truncate text-sm text-foreground">
              {row.regionName || 'Chưa có khu vực'}
            </div>
            {row.regionCode ? (
              <div className="truncate text-xs text-muted-foreground">
                {row.regionCode}
              </div>
            ) : null}
          </div>
        ),
      }),
      col.text({
        id: 'phone',
        header: 'Số điện thoại',
        get: (row) => row.phone,
        headerFilter: textFilter(
          params.phone,
          params.onPhoneChange,
          'Tìm theo số điện thoại',
        ),
        headerClassName: 'min-w-[170px]',
        size: 180,
        enableSorting: false,
      }),
      col.text({
        id: 'email',
        header: 'Email',
        get: (row) => row.email,
        headerFilter: textFilter(
          params.email,
          params.onEmailChange,
          'Tìm theo email',
        ),
        headerClassName: 'min-w-[220px]',
        size: 280,
        enableSorting: false,
      }),
      col.text({
        id: 'addressDetail',
        header: 'Địa chỉ chi tiết',
        get: (row) => row.addressDetail,
        headerFilter: textFilter(
          params.addressDetail,
          params.onAddressDetailChange,
          'Tìm theo địa chỉ',
        ),
        headerClassName: 'min-w-[240px]',
        size: 360,
        enableSorting: false,
      }),
      col.text({
        id: 'note',
        header: 'Ghi chú',
        get: (row) => row.note,
        headerFilter: textFilter(
          params.note,
          params.onNoteChange,
          'Tìm theo ghi chú',
        ),
        headerClassName: 'min-w-[220px]',
        size: 280,
        enableSorting: false,
      }),
      ...customColumns,
      ...(actionColumn ? [actionColumn] : []),
    ];
  }, [params]);
}
