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
      headerClassName: 'w-[190px]',
      size: 190,
    },
    {
      kind: 'custom',
      id: 'plannedStartDate',
      header: 'Bắt đầu dự kiến',
      headerClassName: 'w-[150px]',
      sizePreset: 'date',
    },
    {
      kind: 'custom',
      id: 'plannedEndDate',
      header: 'Hoàn thành dự kiến',
      headerClassName: 'w-[150px]',
      sizePreset: 'date',
    },
    {
      kind: 'custom',
      id: 'actualStartedAt',
      header: 'Bắt đầu thực tế',
      headerClassName: 'w-[170px]',
      size: 170,
    },
    {
      kind: 'custom',
      id: 'actualCompletedAt',
      header: 'Hoàn thành thực tế',
      headerClassName: 'w-[170px]',
      size: 170,
    },
    {
      kind: 'custom',
      id: 'links',
      header: 'Liên kết',
      headerClassName: 'w-[220px]',
      size: 220,
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
