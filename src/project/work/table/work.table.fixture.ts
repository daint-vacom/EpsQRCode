import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Work',
  modelImport: '../model/work',
  specPath: 'src/project/work/table/work.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'work',
      header: 'Công việc',
      headerClassName: 'min-w-[340px]',
      size: 360,
    },
    {
      kind: 'badge',
      id: 'status',
      header: 'Trạng thái',
      field: 'status',
      sizePreset: 'badge',
      config: {
        draft: {
          label: 'Bản nháp',
          className:
            'border-transparent bg-muted px-2.5 py-1 text-xs text-muted-foreground',
          dotClassName: 'bg-muted-foreground',
        },
        todo: {
          label: 'Chưa thực hiện',
          className:
            'border-transparent bg-admin-blue-bg px-2.5 py-1 text-xs text-admin-blue-text',
          dotClassName: 'bg-admin-blue-primary',
        },
        in_progress: {
          label: 'Đang thực hiện',
          className:
            'border-transparent bg-admin-amber-bg px-2.5 py-1 text-xs text-admin-amber-dark',
          dotClassName: 'bg-admin-amber-primary',
        },
        paused: {
          label: 'Tạm dừng',
          className:
            'border-transparent bg-muted px-2.5 py-1 text-xs text-muted-foreground',
          dotClassName: 'bg-muted-foreground',
        },
        completed: {
          label: 'Hoàn thành',
          className:
            'border-transparent bg-admin-success-bg px-2.5 py-1 text-xs text-admin-success-text',
          dotClassName: 'bg-admin-success-dot',
        },
        cancelled: {
          label: 'Đã hủy',
          className:
            'border-transparent bg-admin-red-bg px-2.5 py-1 text-xs text-admin-red-dark',
          dotClassName: 'bg-admin-red-primary',
        },
      },
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
      id: 'dates',
      header: 'Thời gian',
      headerClassName: 'w-[210px]',
      size: 210,
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
