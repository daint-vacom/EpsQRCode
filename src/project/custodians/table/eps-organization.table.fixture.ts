import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'EpsOrganization',
  modelImport: '../model/custodian',
  specPath: 'src/project/custodians/table/eps-organization.table.fixture.ts',
  columns: [
    {
      kind: 'text',
      id: 'code',
      field: 'code',
      header: 'Mã',
      headerMessageId: 'custodians.eps.columns.code',
      sizePreset: 'compact',
    },
    {
      kind: 'custom',
      id: 'name',
      header: 'Tên',
      headerMessageId: 'custodians.eps.columns.name',
      sizePreset: 'identity',
    },
    {
      kind: 'custom',
      id: 'representatives',
      header: 'Tài khoản đại diện',
      headerMessageId: 'custodians.eps.columns.representatives',
      sizePreset: 'extraLong',
    },
  ],
};

export default spec;
