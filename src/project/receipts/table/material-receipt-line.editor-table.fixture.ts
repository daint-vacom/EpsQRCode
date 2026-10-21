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
  tableMinWidthClass: 'min-w-[1180px]',
  viewport: { mode: 'remaining' },
  toolbar: {
    title: 'Danh sách mẫu vật tư',
    titleProp: 'title',
    addLabel: 'Thêm dòng',
    addVariant: 'primary',
  },
  pagination: { pageSize: 10, sizes: [10, 25, 50] },
  actions: {
    enabled: true,
    widthClass: 'w-14',
    duplicate: true,
    insert: true,
    delete: true,
  },
  columns: [
    {
      kind: 'custom',
      id: 'model',
      header: 'Mẫu vật tư',
      widthClass: 'min-w-[430px]',
    },
    {
      kind: 'text',
      name: 'externalCode',
      header: 'Mã liên kết ngoài',
      ariaLabel: 'Mã liên kết ngoài',
    },
    {
      kind: 'number',
      name: 'quantity',
      header: 'Số lượng',
      ariaLabel: 'Số lượng',
      min: 1,
      max: 10000,
      step: 1,
    },
    {
      kind: 'custom',
      id: 'units',
      header: 'Chi tiết từng vật tư',
      widthClass: 'min-w-[260px]',
    },
  ],
};

export default spec;
