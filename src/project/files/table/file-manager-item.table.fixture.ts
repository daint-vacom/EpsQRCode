import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'FileManagerItem',
  modelImport: '../model/file-manager',
  specPath: 'src/project/files/table/file-manager-item.table.fixture.ts',
  columns: [
    {
      kind: 'select',
    },
    {
      kind: 'text',
      id: 'name',
      header: 'Tên',
      field: 'name',
      headerClassName: 'min-w-[320px]',
      size: 360,
      tooltipOnTruncate: true,
    },
    {
      kind: 'text',
      id: 'mimeType',
      header: 'Loại',
      field: 'mimeType',
      headerClassName: 'w-[180px]',
      size: 180,
    },
    {
      kind: 'text',
      id: 'sizeLabel',
      header: 'Dung lượng',
      field: 'sizeLabel',
      headerClassName: 'w-[130px]',
      size: 130,
    },
    {
      kind: 'text',
      id: 'modifiedAtLabel',
      header: 'Cập nhật',
      field: 'modifiedAtLabel',
      headerClassName: 'w-[180px]',
      size: 180,
    },
  ],
};

export default spec;
