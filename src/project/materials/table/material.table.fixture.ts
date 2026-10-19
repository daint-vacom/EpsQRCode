import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Material',
  modelImport: '../model/material',
  specPath: 'src/project/materials/table/material.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'identity',
      header: 'Vật tư',
      headerMessageId: 'project.materials.fields.code',
      size: 320,
      headerClassName: 'min-w-[260px]',
    },
    {
      kind: 'custom',
      id: 'model',
      header: 'Mẫu vật tư',
      headerMessageId: 'project.materials.fields.model',
      size: 280,
    },
    {
      kind: 'custom',
      id: 'custody',
      header: 'Chủ sở hữu',
      headerMessageId: 'project.materials.fields.owner',
      size: 280,
    },
    {
      kind: 'custom',
      id: 'borrower',
      header: 'Đơn vị/cá nhân đang mượn',
      headerMessageId: 'project.materials.fields.borrower',
      size: 280,
    },
    {
      kind: 'text',
      id: 'serialNumber',
      field: 'serialNumber',
      header: 'Số sê-ri',
      headerMessageId: 'project.materials.fields.serialNumber',
      size: 180,
    },
    {
      kind: 'custom',
      id: 'condition',
      header: 'Tình trạng',
      headerMessageId: 'project.materials.fields.condition',
      size: 150,
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerMessageId: 'project.materials.fields.status',
      size: 150,
    },
    {
      kind: 'actions',
      header: '',
      actionCount: 2,
    },
  ],
};

export default spec;
