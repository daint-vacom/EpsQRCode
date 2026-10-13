import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialGroup',
  modelImport: '../model/material-group',
  specPath: 'src/project/material-groups/table/material-group.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'availability',
      header: 'Sử dụng',
      headerMessageId: 'materialGroups.fields.availability',
      size: 110,
    },
    {
      kind: 'custom',
      id: 'materialGroup',
      header: 'Nhóm vật tư',
      headerMessageId: 'materialGroups.columns.group',
      size: 320,
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
