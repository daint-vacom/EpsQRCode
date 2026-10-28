import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialLabelTemplate',
  modelImport: '../model/material-label-template',
  specPath:
    'src/project/material-labels/table/material-label-template.table.fixture.ts',
  columns: [
    {
      kind: 'text',
      id: 'name',
      field: 'name',
      header: 'Tên mẫu',
      headerMessageId: 'project.materialLabels.fields.name',
      size: 300,
    },
    {
      kind: 'custom',
      id: 'dimensions',
      header: 'Kích thước',
      headerMessageId: 'project.materialLabels.fields.size',
      size: 160,
    },
    {
      kind: 'custom',
      id: 'default',
      header: 'Mặc định',
      headerMessageId: 'project.materialLabels.fields.default',
      size: 150,
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerMessageId: 'project.materialLabels.fields.status',
      size: 160,
    },
    {
      kind: 'actions',
      header: '',
      actionPresets: ['edit', 'delete'],
      actionCount: 2,
    },
  ],
};

export default spec;
