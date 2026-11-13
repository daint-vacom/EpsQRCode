import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialReceiptLine',
  modelImport: '../model/material-receipt',
  specPath: 'src/project/receipts/table/material-receipt-line.table.fixture.ts',
  columns: [
    {
      kind: 'select',
      header: '',
    },
    {
      kind: 'custom',
      id: 'material',
      header: 'Mẫu vật tư',
      headerMessageId: 'receipts.items.columns.model',
      size: 300,
    },
    {
      kind: 'number',
      id: 'quantity',
      field: 'quantity',
      header: 'Số lượng',
      headerMessageId: 'receipts.fields.quantity',
      sizePreset: 'number',
    },
    {
      kind: 'custom',
      id: 'condition',
      header: 'Tình trạng',
      headerMessageId: 'receipts.fields.unitCondition',
      size: 180,
    },
    {
      kind: 'custom',
      id: 'specifications',
      header: 'Thông số kỹ thuật',
      headerMessageId: 'receipts.fields.specifications',
      size: 320,
    },
    {
      kind: 'actions',
      header: '',
      actionCount: 1,
    },
  ],
};

export default spec;
