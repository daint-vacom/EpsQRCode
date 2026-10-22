import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Account',
  modelImport: '../model/account',
  specPath: 'src/project/accounts/table/account.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'identity',
      header: 'Tài khoản',
      headerMessageId: 'accounts.columns.account',
      sizePreset: 'identity',
    },
    {
      kind: 'custom',
      id: 'accountType',
      header: 'Loại',
      headerMessageId: 'accounts.columns.type',
      sizePreset: 'badge',
    },
    {
      kind: 'custom',
      id: 'organization',
      header: 'Đơn vị / tổ',
      headerMessageId: 'accounts.columns.organization',
      sizePreset: 'long',
    },
    {
      kind: 'custom',
      id: 'warehouses',
      header: 'Kho phụ trách',
      headerMessageId: 'accounts.columns.warehouses',
      sizePreset: 'medium',
    },
    {
      kind: 'custom',
      id: 'roles',
      header: 'Vai trò',
      headerMessageId: 'accounts.columns.roles',
      sizePreset: 'medium',
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerMessageId: 'accounts.columns.status',
      sizePreset: 'badge',
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionCount: 1,
      cellClassName: 'text-right',
    },
  ],
};

export default spec;
