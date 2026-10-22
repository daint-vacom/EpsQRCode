import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'ExternalOrganization',
  modelImport: '../model/account',
  specPath: 'src/project/accounts/table/external-organization.table.fixture.ts',
  columns: [
    {
      kind: 'text',
      id: 'code',
      field: 'code',
      header: 'Mã đơn vị',
      headerMessageId: 'accounts.external.columns.code',
      sizePreset: 'compact',
    },
    {
      kind: 'custom',
      id: 'name',
      header: 'Tên đơn vị',
      headerMessageId: 'accounts.external.columns.name',
      sizePreset: 'identity',
    },
    {
      kind: 'custom',
      id: 'is_active',
      header: 'Trạng thái',
      headerMessageId: 'accounts.external.columns.status',
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
