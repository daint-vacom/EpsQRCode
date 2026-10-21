import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Warehouse',
  modelImport: '../model/warehouse',
  specPath: 'src/project/warehouses/table/warehouse.table.fixture.ts',
  columns: [
    {
      kind: 'custom',
      id: 'warehouse',
      header: 'Kho',
      headerMessageId: 'warehouses.columns.warehouse',
      size: 250,
    },
    {
      kind: 'text',
      id: 'address',
      field: 'address',
      header: 'Địa chỉ',
      headerMessageId: 'warehouses.fields.address',
      sizePreset: 'long',
    },
    {
      kind: 'custom',
      id: 'accounts',
      header: 'Tài khoản phụ trách',
      headerMessageId: 'warehouses.fields.accounts',
      size: 240,
    },
    {
      kind: 'custom',
      id: 'availability',
      header: 'Sử dụng',
      headerMessageId: 'warehouses.fields.availability',
      size: 100,
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
