import type { TableSpec } from '@/builders/table';

const spec: TableSpec = {
  entity: 'Tag',
  modelImport: '../model/tag',
  specPath: 'src/project/tags/table/tag.table.fixture.ts',
  grouping: {
    parentIdField: 'groupId',
    isGroupField: 'isGroup',
    expandedField: 'isExpanded',
  },
  columns: [
    {
      kind: 'custom',
      id: 'name',
      header: 'Danh mục',
      headerMessageId: 'tags.items.fields.name',
      headerClassName: 'min-w-[220px]',
    },
    {
      kind: 'text',
      id: 'description',
      header: 'Mô tả',
      headerMessageId: 'common.fields.description',
      field: 'description',
      headerClassName: 'min-w-[280px]',
    },
    {
      kind: 'actions',
      id: 'actions',
      header: '',
      headerClassName: 'w-[220px]',
      cellClassName: 'text-right',
    },
  ],
};

export default spec;
