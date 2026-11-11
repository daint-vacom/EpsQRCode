import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialSafetyInspectionQueueRow',
  modelImport: '../model/safety-inspection',
  hookName: 'useMaterialSafetyInspectionQueueColumns',
  specPath:
    'src/project/material-safety-inspections/table/safety-inspection-queue.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'qrCode',
      header: 'Mã QR',
      headerMessageId: 'project.materials.fields.qrCode',
      size: 90,
    },
    {
      kind: 'custom',
      id: 'identity',
      header: 'Vật tư',
      headerMessageId: 'project.materials.fields.identity',
      size: 320,
      headerClassName: 'min-w-[260px]',
    },
    {
      kind: 'custom',
      id: 'lastInspection',
      header: 'Kiểm tra lần cuối',
      headerMessageId:
        'project.materials.safetyInspection.queue.lastInspection',
      size: 170,
    },
    {
      kind: 'custom',
      id: 'nextDue',
      header: 'Hạn kiểm tra kế tiếp',
      headerMessageId: 'project.materials.safetyInspection.queue.nextDue',
      size: 190,
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerMessageId: 'project.materials.safetyInspection.queue.status',
      size: 165,
    },
    {
      kind: 'custom',
      id: 'startInspection',
      header: 'Thao tác',
      headerMessageId: 'project.materials.safetyInspection.queue.action',
      size: 210,
      cellClassName: 'text-right',
    },
  ],
};

export default spec;
