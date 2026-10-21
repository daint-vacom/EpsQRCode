import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialReceiptItemRow',
  modelImport: '../model/material-receipt',
  specPath: 'src/project/receipts/table/material-receipt-item.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'material',
      header: 'Vật tư',
      headerMessageId: 'receipts.items.columns.material',
      size: 240,
    },
    {
      kind: 'custom',
      id: 'model',
      header: 'Mẫu',
      headerMessageId: 'receipts.items.columns.model',
      size: 220,
    },
    {
      kind: 'text',
      id: 'serialNumber',
      field: 'serialNumber',
      header: 'Số sê-ri',
      headerMessageId: 'receipts.items.columns.serialNumber',
      sizePreset: 'medium',
    },
    {
      kind: 'custom',
      id: 'condition',
      header: 'Tình trạng lúc nhập',
      headerMessageId: 'receipts.items.columns.condition',
      size: 160,
    },
    {
      kind: 'custom',
      id: 'receiptOutcome',
      header: 'Kết quả bàn giao',
      headerMessageId: 'receipts.items.columns.receiptOutcome',
      size: 160,
    },
    {
      kind: 'text',
      id: 'note',
      field: 'note',
      header: 'Ghi chú',
      headerMessageId: 'receipts.items.columns.note',
      sizePreset: 'long',
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerMessageId: 'receipts.items.columns.status',
      size: 130,
    },
  ],
};

export default spec;
