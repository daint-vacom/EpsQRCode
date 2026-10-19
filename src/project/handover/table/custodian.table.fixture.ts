import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Custodian',
  modelImport: '../../custodians/model/custodian',
  specPath: 'src/project/handover/table/custodian.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'name',
      header: 'Chủ thể',
      headerMessageId: 'project.handover.custodians.fields.name',
      sizePreset: 'identity',
    },
    {
      kind: 'custom',
      id: 'type',
      header: 'Loại',
      headerMessageId: 'project.handover.custodians.fields.type',
      sizePreset: 'short',
    },
    {
      kind: 'custom',
      id: 'parent',
      header: 'Cấp trên',
      headerMessageId: 'project.handover.custodians.fields.parent',
      sizePreset: 'medium',
    },
    {
      kind: 'custom',
      id: 'representative',
      header: 'Người đại diện',
      headerMessageId: 'project.handover.custodians.fields.representative',
      sizePreset: 'medium',
    },
    {
      kind: 'custom',
      id: 'isActive',
      header: 'Trạng thái',
      headerMessageId: 'project.handover.fields.status',
      sizePreset: 'badge',
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
