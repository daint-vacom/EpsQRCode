import type { FilterSpec } from '@/builders/filter';

const spec: FilterSpec = {
  componentName: 'ReportFilterBar',
  specPath:
    'src/project/reports/components/report-filter-bar.filter.fixture.ts',
  fields: [
    {
      type: 'search',
      name: 'keyword',
      placeholder: 'Tìm theo tên hoặc mô tả báo cáo',
      className: 'w-full sm:w-80',
    },
  ],
};

export default spec;
