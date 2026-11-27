import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialSafetyInspectionType',
  modelImport: '../model/safety-inspection',
  hookName: 'useMaterialSafetyInspectionScheduleColumns',
  specPath:
    'src/project/material-safety-inspections/table/material-safety-inspection-schedule.table.fixture.ts',
  columns: [
    {
      kind: 'text',
      id: 'typeName',
      field: 'typeName',
      header: 'Loại kiểm tra',
      headerMessageId: 'project.materials.safetyInspection.type',
      size: 220,
    },
    {
      kind: 'custom',
      id: 'interval',
      header: 'Chu kỳ',
      headerMessageId: 'project.materials.safetyInspection.schedule.interval',
      size: 135,
    },
    {
      kind: 'custom',
      id: 'source',
      header: 'Nguồn',
      headerMessageId: 'project.materials.safetyInspection.schedule.source',
      size: 155,
    },
    {
      kind: 'custom',
      id: 'dueDate',
      header: 'Hạn kiểm tra kế tiếp',
      headerMessageId: 'project.materials.safetyInspection.queue.nextDue',
      size: 175,
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerMessageId: 'project.materials.safetyInspection.queue.status',
      size: 160,
    },
    {
      kind: 'custom',
      id: 'start',
      header: 'Thao tác',
      headerMessageId: 'project.materials.safetyInspection.queue.action',
      size: 180,
      cellClassName: 'text-right',
    },
  ],
};

export default spec;
