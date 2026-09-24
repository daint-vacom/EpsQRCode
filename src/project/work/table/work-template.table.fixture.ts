import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'WorkTemplateSummary',
  modelImport: '../model/work',
  specPath: 'src/project/work/table/work-template.table.fixture.ts',
  columns: [
    { kind: 'select' },
    {
      kind: 'custom',
      id: 'availability',
      header: 'Có thể sử dụng',
      size: 140,
    },
    {
      kind: 'custom',
      id: 'template',
      header: 'Mẫu công việc',
      headerClassName: 'min-w-[220px]',
      size: 460,
    },
    {
      kind: 'custom',
      id: 'labels',
      header: 'Nhãn',
      size: 180,
    },
    {
      kind: 'number',
      id: 'childCount',
      header: 'Công việc con',
      field: 'childCount',
      size: 140,
    },
    {
      kind: 'date',
      id: 'updatedAt',
      header: 'Cập nhật gần nhất',
      field: 'updatedAt',
      size: 150,
    },
    {
      kind: 'custom',
      id: 'priority',
      header: 'Ưu tiên',
      size: 140,
    },
    {
      kind: 'custom',
      id: 'assignee',
      header: 'Phụ trách',
      cellClassName: 'truncate',
      size: 180,
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      cellClassName: 'text-center',
      actionPresets: ['edit', 'delete'],
      actionCount: 2,
    },
  ],
};

export default spec;
