import type { TableSpec } from '@/builders/table';

/**
 * Table-builder spec cho bảng mẫu vật tư.
 *
 *   npm run gen:table -- src/examples/material/models/table/material-model.table.fixture.ts \
 *     src/examples/material/models/components/material-model-columns.generated.tsx
 */
const spec: TableSpec = {
  entity: 'ExampleMaterialModel',
  modelImport: '../../model/material-model',
  specPath:
    'src/examples/material/models/table/material-model.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'availability',
      header: 'Sử dụng',
      headerClassName: 'w-[110px]',
      size: 110,
    },
    {
      kind: 'custom',
      id: 'identity',
      header: 'Mẫu vật tư',
      headerClassName: 'min-w-[260px]',
      size: 320,
    },
    {
      kind: 'date',
      id: 'createdAt',
      field: 'createdAt',
      header: 'Ngày tạo',
      sizePreset: 'date',
    },
    {
      kind: 'date',
      id: 'updatedAt',
      field: 'updatedAt',
      header: 'Ngày chỉnh sửa',
      size: 170,
    },
    {
      kind: 'actions',
      header: 'Thao tác',
      headerClassName: 'w-[120px]',
      cellClassName: 'text-right',
      size: 120,
    },
  ],
};

export default spec;
