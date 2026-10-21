import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Material',
  modelImport: '../model/material',
  specPath: 'src/project/materials/table/material-selection.table.fixture.ts',
  columns: [
    { kind: 'select' },
    {
      kind: 'custom',
      id: 'identity',
      header: 'Vật tư',
      headerMessageId: 'project.materials.fields.identity',
      size: 340,
      headerClassName: 'min-w-[260px]',
    },
    {
      kind: 'custom',
      id: 'condition',
      header: 'Tình trạng',
      headerMessageId: 'project.materials.fields.condition',
      size: 140,
    },
    {
      kind: 'custom',
      id: 'status',
      header: 'Trạng thái',
      headerMessageId: 'project.materials.fields.status',
      size: 150,
    },
  ],
};

export default spec;
