import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'HandoverDocument',
  modelImport: '../model/handover',
  specPath: 'src/project/handover/table/handover.table.fixture.ts',
  columns: [
    {
      kind: 'date',
      id: 'createdAt',
      field: 'createdAt',
      header: 'Ngày tạo',
      headerMessageId: 'project.handover.columns.createdAt',
      size: 130,
      mode: 'date',
    },
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
      size: 140,
    },
    {
      kind: 'custom',
      id: 'senderParty',
      header: 'Bên giao',
      headerMessageId: 'project.handover.fields.sender',
      sizePreset: 'medium',
    },
    {
      kind: 'custom',
      id: 'recipientParty',
      header: 'Bên nhận',
      headerMessageId: 'project.handover.fields.recipient',
      sizePreset: 'medium',
    },
    {
      kind: 'custom',
      id: 'items',
      header: 'Vật tư',
      headerMessageId: 'project.handover.columns.items',
      size: 120,
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerMessageId: 'project.handover.fields.status',
      size: 130,
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
