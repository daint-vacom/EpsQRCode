import type { FilterSpec } from '@/builders/filter';

const spec: FilterSpec = {
  componentName: 'MaterialGroupFilterBar',
  specPath:
    'src/project/material-groups/table/material-group.filters.fixture.ts',
  fields: [
    {
      type: 'search',
      name: 'keyword',
      placeholder: 'Tìm mã, tên hoặc mô tả',
      placeholderMessageId: 'materialGroups.filters.searchPlaceholder',
      className: 'w-64',
    },
  ],
};

export default spec;
