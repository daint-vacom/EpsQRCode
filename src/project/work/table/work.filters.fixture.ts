import type { FilterSpec } from '@/builders/filter';

const spec: FilterSpec = {
  componentName: 'WorkFilterBar',
  fields: [
    {
      type: 'search',
      name: 'search',
      placeholder: 'Tìm theo mã hoặc tên công việc',
      className: 'w-72',
    },
    {
      type: 'select',
      name: 'status',
      label: 'Trạng thái',
      optionsSource: 'prop',
      placeholder: 'Trạng thái',
    },
    {
      type: 'select',
      name: 'priority',
      label: 'Ưu tiên',
      optionsSource: 'prop',
      placeholder: 'Ưu tiên',
    },
  ],
};

export default spec;
