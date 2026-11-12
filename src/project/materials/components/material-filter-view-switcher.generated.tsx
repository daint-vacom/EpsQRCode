/**
 * Scaffolded by segmented-control-builder from `src/project/materials/components/material-filter-view-switcher.segmented-control.fixture.ts`. Run npm run gen:segmented-control — do NOT hand-write this file.
 * You own this file now — wire the generated control into the feature and keep domain state outside the component.
 * To change options or control styling, edit the spec and re-gen to a scratch path first.
 */
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export interface MaterialFilterViewSwitcherOption {
  value: string;
  label: string;
}

export interface MaterialFilterViewSwitcherProps {
  value: string;
  onValueChange: (value: string) => void;
  options: MaterialFilterViewSwitcherOption[];
  disabled?: boolean;
  className?: string;
}

export function MaterialFilterViewSwitcher({
  value,
  onValueChange,
  options,
  disabled = false,
  className,
}: MaterialFilterViewSwitcherProps) {
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
      aria-label="Cách lọc vật tư"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.label}
          className={cn(
            'data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm',
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
