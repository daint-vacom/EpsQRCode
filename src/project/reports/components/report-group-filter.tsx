import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const REPORT_GROUP_OPTIONS = [
  { value: 'finance', label: 'Tài chính' },
] as const;

export type ReportGroup = (typeof REPORT_GROUP_OPTIONS)[number]['value'];
export type ReportGroupFilterValue = 'all' | ReportGroup;

interface ReportGroupFilterProps {
  value: ReportGroupFilterValue;
  onValueChange: (value: ReportGroupFilterValue) => void;
  disabled?: boolean;
  className?: string;
}

export function ReportGroupFilter({
  value,
  onValueChange,
  disabled = false,
  className,
}: ReportGroupFilterProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      role="group"
      aria-label="Nhóm báo cáo"
    >
      <Button
        type="button"
        variant={value === 'all' ? 'primary' : 'light-neutral'}
        size="md"
        className="shrink-0 rounded-full"
        onClick={() => onValueChange('all')}
        disabled={disabled}
        aria-pressed={value === 'all'}
      >
        Tất cả
      </Button>
      {REPORT_GROUP_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? 'primary' : 'light-neutral'}
          size="md"
          className="shrink-0 rounded-full"
          onClick={() => onValueChange(option.value)}
          disabled={disabled}
          aria-pressed={value === option.value}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
