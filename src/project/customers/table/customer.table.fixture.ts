import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Customer',
  modelImport: '../model/customer',
  specPath: 'src/project/customers/table/customer.table.fixture.ts',
  columns: [
    {
      kind: 'select',
      id: 'select',
      header: '',
    },
    {
      kind: 'custom',
      id: 'name',
      header: 'Khách hàng',
      headerClassName: 'min-w-[240px]',
    },
    {
      kind: 'custom',
      id: 'businessType',
      header: 'Loại hình đơn vị',
      headerClassName: 'min-w-[170px]',
    },
    {
      kind: 'custom',
      id: 'contact',
      header: 'Liên hệ',
      headerClassName: 'min-w-[220px]',
    },
    {
      kind: 'custom',
      id: 'tags',
      header: 'Nhóm/nhãn',
      headerClassName: 'min-w-[220px]',
      size: 240,
    },
    {
      kind: 'badge',
      id: 'status',
      header: 'Trạng thái',
      field: 'status',
      config: {
        active: {
          label: 'Đang hoạt động',
          className:
            'rounded-md border-transparent bg-admin-success-bg px-2.5 py-1 text-xs text-admin-success-text',
          dotClassName: 'bg-admin-success-dot opacity-100',
        },
        inactive: {
          label: 'Ngừng hoạt động',
          variant: 'outline',
          className: 'rounded-md px-2.5 py-1 text-xs text-muted-foreground',
          dotClassName: 'bg-admin-neutral-400 opacity-100',
        },
      },
    },
    {
      kind: 'text',
      id: 'businessRegistrationCode',
      header: 'Mã số đăng ký',
      field: 'businessRegistrationCode',
      headerClassName: 'min-w-[170px]',
    },
    {
      kind: 'custom',
      id: 'countryCode',
      header: 'Quốc gia',
      headerClassName: 'min-w-[160px]',
    },
    {
      kind: 'custom',
      id: 'region',
      header: 'Khu vực',
      headerClassName: 'min-w-[180px]',
    },
    {
      kind: 'text',
      id: 'phone',
      header: 'Số điện thoại',
      field: 'phone',
      headerClassName: 'min-w-[170px]',
    },
    {
      kind: 'text',
      id: 'email',
      header: 'Email',
      field: 'email',
      headerClassName: 'min-w-[220px]',
    },
    {
      kind: 'text',
      id: 'addressDetail',
      header: 'Địa chỉ chi tiết',
      field: 'addressDetail',
      headerClassName: 'min-w-[240px]',
    },
    {
      kind: 'text',
      id: 'note',
      header: 'Ghi chú',
      field: 'note',
      headerClassName: 'min-w-[220px]',
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionCount: 2,
      cellClassName: 'text-right',
    },
  ],
};

export default spec;
