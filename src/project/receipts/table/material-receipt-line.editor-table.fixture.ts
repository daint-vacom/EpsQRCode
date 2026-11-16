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
  tableMinWidthClass: 'min-w-[1120px]',
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
    widthClass: 'w-14',
    duplicate: true,
    insert: false,
    delete: true,
  },
  columns: [
    {
      kind: 'custom',
      id: 'model',
      header: 'Vật tư',
      widthClass: 'min-w-[360px]',
    },
    {
      kind: 'custom',
      id: 'editMaterial',
      header: 'Thông số',
      widthClass: 'w-28',
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
      kind: 'autocomplete',
      name: 'condition',
      header: 'Tình trạng',
      ariaLabel: 'Tình trạng',
      options: [
        {
          value: 'good',
          label: 'Tốt',
          labelMessageId: 'project.handover.condition.good',
        },
        {
          value: 'damaged',
          label: 'Hỏng',
          labelMessageId: 'project.handover.condition.damaged',
        },
      ],
      bulkEdit: true,
      widthClass: 'w-40',
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
