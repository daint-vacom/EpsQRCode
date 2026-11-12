import type { SegmentedControlSpec } from '@/builders/segmented-control';

const spec = {
  componentName: 'MaterialFilterViewSwitcher',
  specPath:
    'src/project/materials/components/material-filter-view-switcher.segmented-control.fixture.ts',
  ariaLabel: 'Cách lọc vật tư',
  optionsSource: 'prop',
  size: 'md',
  variant: 'light-neutral',
  itemClassName:
    'data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm',
} satisfies SegmentedControlSpec;

export default spec;
