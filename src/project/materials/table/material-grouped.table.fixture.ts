import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'MaterialGrouped',
  modelImport: '../model/material',
  specPath: 'src/project/materials/table/material-grouped.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'model',
      header: 'Mẫu vật tư',
      headerMessageId: 'project.materials.grouping.model',
      size: 320,
    },
    {
      kind: 'custom',
      id: 'owner',
      header: 'Đơn vị quản lý',
      headerMessageId: 'project.materials.grouping.owner',
      size: 240,
    },
    {
      kind: 'custom',
      id: 'quantity',
      header: 'Số lượng',
      headerMessageId: 'project.materials.grouping.quantity',
      size: 140,
    },
    {
      kind: 'custom',
      id: 'condition',
      header: 'Tình trạng',
      headerMessageId: 'project.materials.grouping.condition',
      size: 180,
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerMessageId: 'project.materials.fields.status',
      size: 160,
    },
    {
      kind: 'custom',
      id: 'availability',
      header: 'Sử dụng',
      headerMessageId: 'materialModels.fields.availability',
      size: 120,
    },
    {
      kind: 'custom',
      id: 'group',
      header: 'Nhóm VT',
      headerMessageId: 'materialGroups.columns.groupShort',
      size: 220,
    },
    {
      kind: 'custom',
      id: 'code',
      header: 'Mã vật tư',
      headerMessageId: 'project.materials.fields.code',
      size: 180,
    },
    {
      kind: 'custom',
      id: 'holder',
      header: 'Đơn vị đang giữ',
      headerMessageId: 'project.materials.fields.holder',
      size: 220,
    },
  ],
};

export default spec;
