import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialSpecification',
  modelImport: '../model/material-specification',
  specPath:
    'src/project/material-specifications/table/material-specification.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'identity',
      header: 'Thông số',
      headerMessageId: 'materialSpecifications.columns.identity',
      size: 280,
    },
    {
      kind: 'text',
      id: 'description',
      field: 'description',
      header: 'Mô tả',
      headerMessageId: 'materialSpecifications.fields.description',
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
