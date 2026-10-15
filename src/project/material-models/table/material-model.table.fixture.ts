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
      size: 110,
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
      kind: 'text',
      id: 'description',
      field: 'description',
      header: 'Mô tả',
      headerMessageId: 'materialModels.fields.description',
      sizePreset: 'long',
      tooltipOnTruncate: true,
    },
    {
      kind: 'actions',
      header: '',
      actionCount: 2,
    },
  ],
};

export default spec;
