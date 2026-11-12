import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';

export interface FilterCountChipOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterCountChipsProps {
  ariaLabel: string;
  value: string;
  options: readonly FilterCountChipOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function FilterCountChips({
  ariaLabel,
  value,
  options,
  onValueChange,
  disabled = false,
}: FilterCountChipsProps) {
  const intl = useIntl();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Button
            key={option.value || 'all'}
            type="button"
            variant={selected ? 'primary' : 'light-neutral'}
            size="md"
            className="shrink-0 rounded-full"
            onClick={() => onValueChange(option.value)}
            disabled={disabled}
            aria-pressed={selected}
          >
            {option.label}
            <span
              className={
                selected
                  ? 'text-primary-foreground/80'
                  : 'text-muted-foreground'
              }
            >
              {option.count === undefined
                ? '—'
                : intl.formatNumber(option.count)}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
