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
      headerClassName: 'min-w-[300px]',
      sizePreset: 'identity',
      pin: 'left',
    },
    {
      kind: 'custom',
      id: 'businessType',
      header: 'Loại hình đơn vị',
      headerClassName: 'min-w-[170px]',
      sizePreset: 'short',
    },
    {
      kind: 'custom',
      id: 'contact',
      header: 'Liên hệ',
      headerClassName: 'min-w-[220px]',
      sizePreset: 'long',
    },
    {
      kind: 'custom',
      id: 'tags',
      header: 'Nhóm/danh mục',
      headerClassName: 'min-w-[220px]',
      sizePreset: 'tags',
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
      },
      sizePreset: 'badge',
    },
    {
      kind: 'text',
      id: 'businessRegistrationCode',
      header: 'Mã số đăng ký',
      field: 'businessRegistrationCode',
      headerClassName: 'min-w-[170px]',
      sizePreset: 'short',
    },
    {
      kind: 'custom',
      id: 'countryCode',
      header: 'Quốc gia',
      headerClassName: 'min-w-[160px]',
      sizePreset: 'compact',
    },
    {
      kind: 'custom',
      id: 'region',
      header: 'Khu vực',
      headerClassName: 'min-w-[180px]',
      sizePreset: 'medium',
    },
    {
      kind: 'text',
      id: 'phone',
      header: 'Số điện thoại',
      field: 'phone',
      headerClassName: 'min-w-[170px]',
      sizePreset: 'short',
    },
    {
      kind: 'text',
      id: 'email',
      header: 'Email',
      field: 'email',
      headerClassName: 'min-w-[220px]',
      sizePreset: 'long',
    },
    {
      kind: 'text',
      id: 'addressDetail',
      header: 'Địa chỉ chi tiết',
      field: 'addressDetail',
      headerClassName: 'min-w-[240px]',
      sizePreset: 'extraLong',
    },
    {
      kind: 'text',
      id: 'note',
      header: 'Ghi chú',
      field: 'note',
      headerClassName: 'min-w-[220px]',
      sizePreset: 'long',
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
