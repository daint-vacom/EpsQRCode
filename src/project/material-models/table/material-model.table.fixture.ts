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
      kind: 'date',
      id: 'createdAt',
      field: 'createdAt',
      header: 'Ngày tạo',
      headerMessageId: 'materialModels.columns.createdAt',
      sizePreset: 'date',
    },
    {
      kind: 'date',
      id: 'updatedAt',
      field: 'updatedAt',
      header: 'Ngày chỉnh sửa',
      headerMessageId: 'materialModels.columns.updatedAt',
      size: 170,
    },
    {
      kind: 'actions',
      header: 'Thao tác',
      headerMessageId: 'materialModels.columns.actions',
      actionCount: 3,
    },
  ],
};

export default spec;
