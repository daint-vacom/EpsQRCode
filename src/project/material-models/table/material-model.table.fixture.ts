import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialModel',
  modelImport: '../model/material-model',
  specPath: 'src/project/material-models/table/material-model.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'availability',
      header: 'Sử dụng',
      headerMessageId: 'materialModels.fields.availability',
      size: 80,
    },
    {
      kind: 'custom',
      id: 'identity',
      header: 'Mẫu vật tư',
      headerMessageId: 'materialModels.columns.identity',
      size: 320,
      headerClassName: 'min-w-[260px]',
    },
    {
      kind: 'custom',
      id: 'group',
      header: 'Nhóm VT',
      headerMessageId: 'materialGroups.columns.groupShort',
      size: 220,
    },
    {
      kind: 'custom',
      id: 'description',
      header: 'Mô tả',
      headerMessageId: 'materialModels.fields.description',
      size: 240,
      cellClassName: 'align-top',
    },
    {
      kind: 'actions',
      header: '',
      actionCount: 2,
    },
  ],
};

export default spec;
