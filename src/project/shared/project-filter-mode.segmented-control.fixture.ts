import type { SegmentedControlSpec } from '@/builders/segmented-control';

const spec = {
  componentName: 'ProjectFilterModeSwitcher',
  specPath:
    'src/project/shared/project-filter-mode.segmented-control.fixture.ts',
  ariaLabel: 'Cách lọc danh sách',
  optionsSource: 'prop',
  size: 'md',
  variant: 'light-neutral',
  itemClassName:
    'data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm',
} satisfies SegmentedControlSpec;

export default spec;
