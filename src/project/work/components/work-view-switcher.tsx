import { CalendarDays, KanbanSquare, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface WorkViewSwitcherProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const viewOptions = [
  { value: 'list', label: 'Danh sách', icon: List },
  { value: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { value: 'calendar', label: 'Lịch', icon: CalendarDays },
] as const;

export function WorkViewSwitcher({
  value,
  onValueChange,
  disabled = false,
  className,
}: WorkViewSwitcherProps) {
  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className={cn('shrink-0', className)}
      aria-label="Kiểu hiển thị công việc"
    >
      <TabsList
        variant="default"
        size="sm"
        className="gap-1 border border-border bg-card p-1 text-muted-foreground shadow-xs"
        aria-label="Kiểu hiển thị công việc"
      >
        {viewOptions.map(({ value: optionValue, label, icon: Icon }) => (
          <TabsTrigger
            key={optionValue}
            value={optionValue}
            disabled={disabled}
            aria-label={label}
            title={label}
            className="text-muted-foreground [&[data-state=active]]:bg-muted [&[data-state=active]]:text-foreground [&[data-state=active]_svg]:text-foreground [&:hover_svg]:text-foreground [&_svg]:text-muted-foreground"
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
