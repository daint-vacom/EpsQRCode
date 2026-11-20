import type { EditorTableSpec } from '@/builders/editor-table';

const spec: EditorTableSpec = {
  entity: 'MaterialReceiptFormLine',
  componentName: 'MaterialReceiptLinesEditorTable',
  modelImport: '../model/material-receipt',
  valuesType: 'MaterialReceiptFormValues',
  valuesImport: '../model/material-receipt',
  arrayName: 'lines',
  createRowProp: 'createLine',
  specPath:
    'src/project/receipts/table/material-receipt-line.editor-table.fixture.ts',
  tableMinWidthClass: 'min-w-[1600px]',
  viewport: { mode: 'remaining' },
  toolbar: {
    title: 'Vật tư đã nhập',
    addLabel: 'Chọn mẫu VT',
    addVariant: 'primary',
  },
  multiEdit: {
    enabled: true,
    actions: ['copy', 'delete'],
  },
  pagination: { pageSize: 10, sizes: [10, 25, 50] },
  actions: {
    enabled: true,
    widthClass: 'w-48',
    duplicate: true,
    insert: false,
    delete: true,
  },
  columns: [
    {
      kind: 'custom',
      id: 'material',
      header: 'Vật tư',
      widthClass: 'min-w-[280px]',
    },
    {
      kind: 'custom',
      id: 'model',
      header: 'Mẫu vật tư',
      widthClass: 'min-w-[280px]',
    },
    {
      kind: 'number',
      name: 'quantity',
      header: 'Số lượng',
      ariaLabel: 'Số lượng',
      min: 1,
      max: 10000,
      step: 1,
      bulkEdit: true,
    },
    {
      kind: 'custom',
      id: 'condition',
      header: 'Tình trạng',
      headerMessageId: 'project.materials.fields.condition',
      widthClass: 'w-40',
    },
    {
      kind: 'custom',
      id: 'receivingParty',
      header: 'Đơn vị nhận',
      headerMessageId: 'receipts.handover.recipient',
      widthClass: 'min-w-[220px]',
    },
    {
      kind: 'text',
      name: 'note',
      header: 'Ghi chú',
      ariaLabel: 'Ghi chú',
      bulkEdit: true,
      widthClass: 'min-w-[240px]',
    },
  ],
};

export default spec;
