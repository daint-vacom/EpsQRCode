import type { DetailSpec } from '@/builders/detail';

const spec: DetailSpec = {
  componentName: 'WorkDetailLayout',
  specPath: 'src/project/work/detail/work-detail-layout.fixture.ts',
  defaultTab: 'overview',
  tabs: [
    { value: 'overview', label: 'Tổng quan', icon: 'LayoutDashboard' },
    { value: 'children', label: 'Đầu mục con', icon: 'ListChecks' },
  ],
};

export default spec;
