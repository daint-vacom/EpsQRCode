import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialReceipt',
  modelImport: '../model/material-receipt',
  specPath: 'src/project/receipts/table/material-receipt.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'receipt',
      header: 'Phiếu nhập',
      headerMessageId: 'receipts.columns.receipt',
      size: 250,
    },
    {
      kind: 'custom',
      id: 'warehouse',
      header: 'Kho',
      headerMessageId: 'receipts.columns.warehouse',
      size: 220,
    },
    {
      kind: 'date',
      id: 'createdAt',
      field: 'createdAt',
      header: 'Ngày tạo',
      headerMessageId: 'receipts.columns.createdAt',
      mode: 'date',
      sizePreset: 'medium',
    },
    {
      kind: 'custom',
      id: 'progress',
      header: 'Đã phân bổ',
      headerMessageId: 'receipts.columns.progress',
      size: 170,
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerMessageId: 'receipts.fields.status',
      size: 140,
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionCount: 1,
      cellClassName: 'text-right',
    },
  ],
};

export default spec;
