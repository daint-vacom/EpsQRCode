import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'HandoverDocument',
  modelImport: '../model/handover',
  specPath: 'src/project/handover/table/handover.table.fixture.ts',
  columns: [
    {
      kind: 'text',
      id: 'code',
      field: 'code',
      header: 'Mã phiếu',
      headerMessageId: 'project.handover.columns.code',
      sizePreset: 'compact',
    },
    {
      kind: 'custom',
      id: 'type',
      header: 'Loại phiếu',
      headerMessageId: 'project.handover.fields.type',
      sizePreset: 'short',
    },
    {
      kind: 'custom',
      id: 'parties',
      header: 'Bên giao / bên nhận',
      headerMessageId: 'project.handover.columns.parties',
      sizePreset: 'identity',
    },
    {
      kind: 'custom',
      id: 'items',
      header: 'Vật tư',
      headerMessageId: 'project.handover.columns.items',
      sizePreset: 'medium',
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerMessageId: 'project.handover.fields.status',
      sizePreset: 'badge',
    },
    {
      kind: 'date',
      id: 'createdAt',
      field: 'createdAt',
      header: 'Ngày tạo',
      headerMessageId: 'project.handover.columns.createdAt',
      sizePreset: 'date',
      mode: 'date',
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      actionCount: 1,
      cellClassName: 'text-right',
    },
  ],
};

export default spec;
