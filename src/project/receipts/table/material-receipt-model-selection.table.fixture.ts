import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialModel',
  modelImport: '@/project/material-models/model/material-model',
  specPath:
    'src/project/receipts/table/material-receipt-model-selection.table.fixture.ts',
  columns: [
    { kind: 'select' },
    {
      kind: 'custom',
      id: 'identity',
      header: 'Mẫu vật tư',
      headerMessageId: 'receipts.modelSelection.model',
      size: 440,
      headerClassName: 'min-w-[300px]',
    },
  ],
};

export default spec;
