import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialGroup',
  modelImport: '../model/material-group',
  specPath: 'src/project/material-groups/table/material-group.table.fixture.ts',
  columns: [
    {
      kind: 'text',
      id: 'code',
      field: 'code',
      header: 'Mã nhóm',
      headerMessageId: 'materialGroups.fields.code',
      sizePreset: 'short',
    },
    {
      kind: 'text',
      id: 'name',
      field: 'name',
      header: 'Tên nhóm',
      headerMessageId: 'materialGroups.fields.name',
      sizePreset: 'identity',
    },
    {
      kind: 'text',
      id: 'description',
      field: 'description',
      header: 'Mô tả',
      headerMessageId: 'materialGroups.fields.description',
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
