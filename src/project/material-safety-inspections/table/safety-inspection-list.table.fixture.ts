import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'SafetyInspectionListRow',
  modelImport: '../model/safety-inspection',
  hookName: 'useSafetyInspectionListColumns',
  specPath:
    'src/project/material-safety-inspections/table/safety-inspection-list.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'inspectedAt',
      header: 'Ngày kiểm tra',
      headerMessageId: 'project.materials.safetyInspection.list.inspectedAt',
      size: 190,
    },
    {
      kind: 'custom',
      id: 'material',
      header: 'Vật tư',
      headerMessageId: 'project.materials.safetyInspection.list.material',
      size: 310,
      headerClassName: 'min-w-[250px]',
    },
    {
      kind: 'text',
      id: 'inspectionType',
      field: 'inspectionTypeName',
      header: 'Loại kiểm tra',
      headerMessageId: 'project.materials.safetyInspection.type',
      size: 200,
    },
    {
      kind: 'text',
      id: 'inspectorName',
      field: 'inspectorName',
      header: 'Người thực hiện',
      headerMessageId: 'project.materials.safetyInspection.list.inspector',
      sizePreset: 'medium',
    },
    {
      kind: 'custom',
      id: 'result',
      header: 'Kết quả',
      headerMessageId: 'project.materials.safetyInspection.list.result',
      sizePreset: 'short',
    },
    {
      kind: 'actions',
      header: '',
      actionPresets: ['view'],
      actionCount: 1,
    },
  ],
};

export default spec;
