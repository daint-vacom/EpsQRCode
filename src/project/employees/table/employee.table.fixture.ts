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
      pin: 'left',
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
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerClassName: 'min-w-[150px]',
      size: 150,
    },
    {
      kind: 'custom',
      id: 'account',
      header: 'Tài khoản',
      headerClassName: 'min-w-[140px]',
      size: 140,
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionCount: 4,
      cellClassName: 'text-right',
    },
  ],
};

export default spec;
