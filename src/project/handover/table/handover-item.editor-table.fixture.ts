import type { EditorTableSpec } from '@/builders/editor-table';

const spec: EditorTableSpec = {
  entity: 'HandoverItemInput',
  componentName: 'HandoverItemsEditorTable',
  modelImport: '../model/handover',
  valuesType: 'HandoverFormValues',
  valuesImport: '../model/handover-form-schema',
  arrayName: 'items',
  createRowProp: 'createRow',
  specPath: 'src/project/handover/table/handover-item.editor-table.fixture.ts',
  tableMinWidthClass: 'min-w-[920px]',
  viewport: { mode: 'natural' },
  toolbar: {
    title: 'Danh sách vật tư bàn giao',
    addLabel: 'Thêm vật tư',
  },
  actions: {
    enabled: true,
    header: '',
    widthClass: 'w-12',
    duplicate: false,
    insert: false,
    delete: true,
  },
  columns: [
    { kind: 'index', header: 'STT', widthClass: 'w-14' },
    {
      kind: 'custom',
      id: 'material',
      header: 'Vật tư',
      widthClass: 'min-w-64',
    },
    {
      kind: 'custom',
      id: 'condition',
      header: 'Tình trạng',
      widthClass: 'w-48',
    },
    {
      kind: 'custom',
      id: 'note',
      header: 'Ghi chú',
      widthClass: 'min-w-72',
    },
  ],
};

export default spec;
