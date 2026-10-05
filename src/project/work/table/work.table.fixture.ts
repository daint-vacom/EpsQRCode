import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Work',
  modelImport: '../model/work',
  specPath: 'src/project/work/table/work.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      sizePreset: 'badge',
    },
    {
      kind: 'custom',
      id: 'work',
      header: 'Công việc',
      headerClassName: 'min-w-[340px]',
      size: 360,
    },
    {
      kind: 'custom',
      id: 'assignee',
      header: 'Phụ trách',
      headerClassName: 'min-w-[220px]',
      size: 220,
    },
    {
      kind: 'custom',
      id: 'labels',
      header: 'Nhãn công việc',
      headerClassName: 'min-w-[200px]',
      size: 220,
    },
    {
      kind: 'custom',
      id: 'plannedSchedule',
      header: 'Thời gian dự kiến',
      headerClassName: 'w-[240px]',
      size: 240,
    },
    {
      kind: 'custom',
      id: 'actualSchedule',
      header: 'Thời gian thực tế',
      headerClassName: 'w-[240px]',
      size: 240,
    },
    {
      kind: 'custom',
      id: 'links',
      header: 'Liên kết',
      headerClassName: 'w-[240px]',
      size: 240,
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionPresets: ['view', 'edit', 'delete'],
      actionCount: 3,
      cellClassName: 'text-center',
    },
  ],
};

export default spec;
