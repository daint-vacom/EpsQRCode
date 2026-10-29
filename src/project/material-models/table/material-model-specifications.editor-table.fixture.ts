import type { EditorTableSpec } from '@/builders/editor-table';

const spec: EditorTableSpec = {
  entity: 'MaterialModelSpecification',
  componentName: 'MaterialModelSpecificationsEditorTable',
  modelImport: '../model/material-model',
  valuesType: 'MaterialModelFormValues',
  valuesImport: '../model/material-model',
  arrayName: 'specifications',
  tableMinWidthClass: 'min-w-[768px]',
  viewport: { mode: 'natural' },
  actions: {
    enabled: true,
    header: '',
    widthClass: 'w-14',
    duplicate: false,
    insert: false,
    delete: true,
  },
  reorder: {
    enabled: true,
    header: '',
    widthClass: 'w-12',
  },
  columns: [
    {
      kind: 'custom',
      id: 'visibility',
      header: 'Hiển thị',
      widthClass: 'w-24',
    },
    {
      kind: 'custom',
      id: 'specification',
      header: 'Thông số',
      widthClass: 'min-w-[260px]',
    },
    {
      kind: 'custom',
      id: 'values',
      header: 'Giá trị',
      widthClass: 'min-w-[360px]',
    },
  ],
};

export default spec;
