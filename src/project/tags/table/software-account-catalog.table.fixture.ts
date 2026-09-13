import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'SoftwareAccountCatalog',
  modelImport: '../model/software-account-catalog',
  specPath: 'src/project/tags/table/software-account-catalog.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'name',
      header: 'Tên phần mềm',
      sizePreset: 'medium',
      pin: 'left',
    },
    {
      kind: 'text',
      id: 'defaultAccessUrl',
      header: 'Địa chỉ truy cập mặc định',
      field: 'defaultAccessUrl',
      sizePreset: 'long',
    },
    {
      kind: 'text',
      id: 'defaultUsername',
      header: 'Tài khoản mặc định',
      field: 'defaultUsername',
      sizePreset: 'short',
    },
    {
      kind: 'custom',
      id: 'defaultPassword',
      header: 'Mật khẩu mặc định',
      sizePreset: 'short',
    },
    {
      kind: 'custom',
      id: 'accountTypes',
      header: 'Loại tài khoản',
      sizePreset: 'long',
    },
    {
      kind: 'badge',
      id: 'isActive',
      header: 'Trạng thái',
      field: 'isActive',
      config: {
        true: {
          label: 'Đang sử dụng',
          className:
            'rounded-md border-transparent bg-admin-success-bg px-2.5 py-1 text-xs text-admin-success-text',
        },
        false: {
          label: 'Ngừng sử dụng',
          className:
            'rounded-md border-transparent bg-muted px-2.5 py-1 text-xs text-muted-foreground',
        },
      },
      sizePreset: 'badge',
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionPresets: ['edit', 'delete'],
      actionCount: 2,
      cellClassName: 'text-right',
    },
  ],
};

export default spec;
