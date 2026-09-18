import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Employee',
  modelImport: '../model/employee',
  specPath: 'src/project/employees/table/employee.table.fixture.ts',
  columns: [
    {
      kind: 'select',
    },
    {
      kind: 'custom',
      id: 'name',
      header: 'Nhân viên',
      headerClassName: 'min-w-[220px]',
    },
    {
      kind: 'custom',
      id: 'roles',
      header: 'Vai trò',
      headerClassName: 'min-w-[200px]',
    },
    {
      kind: 'custom',
      id: 'tags',
      header: 'Nhóm/danh mục',
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
          label: 'Còn làm việc',
          variant: 'success',
          className: 'rounded-md px-2.5 py-1 text-xs',
        },
        inactive: {
          label: 'Ngừng làm việc',
          variant: 'destructive',
          className: 'rounded-md px-2.5 py-1 text-xs',
        },
      },
    },
    {
      kind: 'badge',
      id: 'account',
      header: 'Tài khoản',
      field: 'accountLinked',
      config: {
        true: {
          label: 'Đã liên kết',
          className:
            'rounded-md border-transparent bg-admin-success-bg px-2.5 py-1 text-xs text-admin-success-text',
          dotClassName: 'bg-admin-success-dot opacity-100',
        },
        false: {
          label: 'Chưa liên kết',
          variant: 'warning',
          className:
            'rounded-md border-transparent bg-admin-amber-bg px-2.5 py-1 text-xs text-admin-amber-dark',
          dotClassName: 'bg-admin-amber-primary opacity-100',
        },
      },
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      headerClassName: 'w-[150px]',
      cellClassName: 'text-right',
    },
  ],
};

export default spec;
