import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Material',
  modelImport: '../model/material',
  specPath: 'src/project/materials/table/material.table.fixture.ts',
  columns: [
    { kind: 'select' },
    {
      kind: 'custom',
      id: 'availability',
      header: 'Sử dụng',
      headerMessageId: 'materialModels.fields.availability',
      size: 80,
    },
    {
      kind: 'custom',
      id: 'qrCode',
      header: 'Mã QR',
      headerMessageId: 'project.materials.fields.qrCode',
      size: 80,
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
      id: 'group',
      header: 'Nhóm VT',
      headerMessageId: 'materialGroups.columns.groupShort',
      size: 220,
    },
    {
      kind: 'custom',
      id: 'custody',
      header: 'Đơn vị đang giữ',
      headerMessageId: 'project.materials.fields.holder',
      size: 200,
    },
    {
      kind: 'custom',
      id: 'condition',
      header: 'Tình trạng',
      headerMessageId: 'project.materials.fields.condition',
      size: 120,
    },
    {
      kind: 'actions',
      header: '',
      actionCount: 2,
    },
  ],
};

export default spec;
