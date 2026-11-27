import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'SafetyInspectionTypeConfigView',
  modelImport: '../model/safety-inspection-type-config',
  hookName: 'useSafetyInspectionTypeConfigColumns',
  specPath:
    'src/project/material-safety-inspections/table/safety-inspection-type-config.table.fixture.ts',
  columns: [
    {
      kind: 'text',
      id: 'typeName',
      field: 'typeName',
      header: 'Loại kiểm tra',
      headerMessageId: 'project.materials.safetyInspection.type',
      size: 210,
    },
    {
      kind: 'custom',
      id: 'interval',
      header: 'Chu kỳ',
      headerMessageId: 'project.materials.safetyInspection.schedule.interval',
      size: 125,
    },
    {
      kind: 'custom',
      id: 'source',
      header: 'Nguồn',
      headerMessageId: 'project.materials.safetyInspection.schedule.source',
      size: 140,
    },
    {
      kind: 'custom',
      id: 'startsOn',
      header: 'Hạn kiểm tra đầu tiên',
      headerMessageId: 'project.materials.safetyInspection.typeConfig.startsOn',
      size: 175,
    },
    {
      kind: 'custom',
      id: 'enabled',
      header: 'Trạng thái',
      headerMessageId: 'project.materials.safetyInspection.queue.status',
      size: 140,
    },
    {
      kind: 'actions',
      header: '',
      actionPresets: ['edit'],
      actionCount: 1,
    },
  ],
};

export default spec;
