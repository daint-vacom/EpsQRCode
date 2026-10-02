import type { ColumnFilterSpec } from '@/builders/column-filter';

const spec: ColumnFilterSpec = {
  componentName: 'Customer',
  specPath: 'src/project/customers/table/customer-column-filters.fixture.ts',
  fields: [
    {
      type: 'search',
      name: 'name',
      placeholder: '',
      ariaLabel: 'Tìm theo tên khách hàng',
      className: 'min-w-0 w-full shrink-0 bg-background',
    },
    {
      type: 'multiSelect',
      name: 'businessType',
      placeholder: '',
      searchPlaceholder: 'Tìm loại hình...',
      maxChips: 0,
      optionsSource: 'prop',
      className: 'h-7 min-h-7 min-w-0 rounded-md bg-background px-2.5 text-xs',
    },
    {
      type: 'search',
      name: 'contact',
      placeholder: '',
      ariaLabel: 'Tìm theo số điện thoại hoặc email',
      className: 'min-w-0 w-full shrink-0 bg-background',
    },
    {
      type: 'search',
      name: 'businessRegistrationCode',
      placeholder: '',
      ariaLabel: 'Tìm theo mã số thuế',
      className: 'min-w-0 w-full shrink-0 bg-background',
    },
    {
      type: 'selectSearch',
      name: 'countryCode',
      placeholder: 'Tất cả',
      searchPlaceholder: 'Tìm quốc gia...',
      ariaLabel: 'Lọc theo quốc gia',
      optionsSource: 'prop',
      className: 'min-w-0 bg-background',
    },
    {
      type: 'search',
      name: 'region',
      placeholder: '',
      ariaLabel: 'Tìm theo mã hoặc tên khu vực',
      className: 'min-w-0 w-full shrink-0 bg-background',
    },
    {
      type: 'search',
      name: 'phone',
      placeholder: '',
      ariaLabel: 'Tìm theo số điện thoại',
      className: 'min-w-0 w-full shrink-0 bg-background',
    },
    {
      type: 'search',
      name: 'email',
      placeholder: '',
      ariaLabel: 'Tìm theo email',
      className: 'min-w-0 w-full shrink-0 bg-background',
    },
    {
      type: 'search',
      name: 'addressDetail',
      placeholder: '',
      ariaLabel: 'Tìm theo địa chỉ',
      className: 'min-w-0 w-full shrink-0 bg-background',
    },
    {
      type: 'search',
      name: 'note',
      placeholder: '',
      ariaLabel: 'Tìm theo ghi chú',
      className: 'min-w-0 w-full shrink-0 bg-background',
    },
    {
      type: 'multiSelect',
      name: 'status',
      placeholder: '',
      searchPlaceholder: 'Tìm trạng thái...',
      maxChips: 0,
      optionsSource: 'prop',
      className: 'h-7 min-h-7 min-w-0 rounded-md bg-background px-2.5 text-xs',
    },
  ],
};

export default spec;
