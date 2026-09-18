/**
 * Scaffolded by segmented-control-builder from `src/project/work/components/work-view-switcher.segmented-control.fixture.ts`. Run npm run gen:segmented-control — do NOT hand-write this file.
 * You own this file now — wire the generated control into the feature and keep domain state outside the component.
 * To change options or control styling, edit the spec and re-gen to a scratch path first.
 */
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export interface WorkViewSwitcherOption {
  value: string;
  label: string;
}

const WorkViewSwitcherOptions: WorkViewSwitcherOption[] = [
  { value: 'list', label: 'Danh sách' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'calendar', label: 'Lịch' },
];

export interface WorkViewSwitcherProps {
  value: string;
  onValueChange: (value: string) => void;
  options?: WorkViewSwitcherOption[];
  disabled?: boolean;
  className?: string;
}

export function WorkViewSwitcher({
  value,
  onValueChange,
  options = WorkViewSwitcherOptions,
  disabled = false,
  className,
}: WorkViewSwitcherProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) onValueChange(nextValue);
      }}
      disabled={disabled}
      variant="outline"
      size="sm"
      className={cn('w-fit', className)}
      aria-label="Kiểu hiển thị công việc"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.label}
          className={undefined}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
