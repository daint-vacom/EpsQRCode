/**
 * Scaffolded by segmented-control-builder from `src/project/customers/components/customer-responsibility-view-switcher.segmented-control.fixture.ts`. Run npm run gen:segmented-control — do NOT hand-write this file.
 * You own this file now — wire the generated control into the feature and keep domain state outside the component.
 * To change options or control styling, edit the spec and re-gen to a scratch path first.
 */
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export interface CustomerResponsibilityViewSwitcherOption {
  value: string;
  label: string;
}

const CustomerResponsibilityViewSwitcherOptions: CustomerResponsibilityViewSwitcherOption[] =
  [
    { value: 'group', label: 'Theo nhóm' },
    { value: 'employee', label: 'Theo nhân viên' },
  ];

export interface CustomerResponsibilityViewSwitcherProps {
  value: string;
  onValueChange: (value: string) => void;
  options?: CustomerResponsibilityViewSwitcherOption[];
  disabled?: boolean;
  className?: string;
}

export function CustomerResponsibilityViewSwitcher({
  value,
  onValueChange,
  options = CustomerResponsibilityViewSwitcherOptions,
  disabled = false,
  className,
}: CustomerResponsibilityViewSwitcherProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) onValueChange(nextValue);
      }}
      disabled={disabled}
      variant="light-neutral"
      size="md"
      className={cn('w-fit', className)}
      aria-label="Cách lọc người phụ trách khách hàng"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.label}
          className={cn(
            'data-[state=on]:bg-background data-[state=on]:text-foreground',
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
