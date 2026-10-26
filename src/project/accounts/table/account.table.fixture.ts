import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Account',
  modelImport: '../model/account',
  specPath: 'src/project/accounts/table/account.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'status',
      header: ' ',
      headerClassName: 'w-12 text-center',
      cellClassName: 'text-center',
      size: 48,
    },
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
      header: 'Loại tài khoản',
      headerMessageId: 'accounts.columns.type',
      sizePreset: 'compact',
    },
    {
      kind: 'custom',
      id: 'organization',
      header: 'Đơn vị',
      headerMessageId: 'accounts.columns.organization',
      sizePreset: 'long',
    },
    {
      kind: 'custom',
      id: 'roles',
      header: 'Vai trò',
      headerMessageId: 'accounts.columns.roles',
      sizePreset: 'tags',
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
