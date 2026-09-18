import type { SegmentedControlSpec } from '@/builders/segmented-control';

const spec: SegmentedControlSpec = {
  componentName: 'WorkViewSwitcher',
  ariaLabel: 'Kiểu hiển thị công việc',
  specPath:
    'src/project/work/components/work-view-switcher.segmented-control.fixture.ts',
  options: [
    { value: 'list', label: 'Danh sách' },
    { value: 'kanban', label: 'Kanban' },
    { value: 'calendar', label: 'Lịch' },
  ],
  size: 'sm',
  variant: 'outline',
};

export default spec;
