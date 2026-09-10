import type { SegmentedControlSpec } from '@/builders/segmented-control';

const spec = {
  componentName: 'CustomerResponsibilityViewSwitcher',
  specPath:
    'src/project/customers/components/customer-responsibility-view-switcher.segmented-control.fixture.ts',
  ariaLabel: 'Cách lọc người phụ trách khách hàng',
  options: [
    { value: 'group', label: 'Theo nhóm' },
    { value: 'employee', label: 'Theo nhân viên' },
  ],
  size: 'md',
  variant: 'light-neutral',
  itemClassName:
    'data-[state=on]:bg-background data-[state=on]:text-foreground',
} satisfies SegmentedControlSpec;

export default spec;
