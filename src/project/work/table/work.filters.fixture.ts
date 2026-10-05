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
      optionsSource: 'prop',
      placeholder: 'Trạng thái',
      className: 'w-40',
    },
    {
      type: 'select',
      name: 'priority',
      optionsSource: 'prop',
      placeholder: 'Ưu tiên',
      className: 'w-40',
    },
    {
      type: 'select',
      name: 'assignee',
      optionsSource: 'prop',
      placeholder: 'NV phụ trách',
      className: 'w-44',
    },
  ],
};

export default spec;
