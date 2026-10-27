import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SelectOptionContentProps {
  title: ReactNode;
  description: ReactNode;
  leading?: ReactNode;
  className?: string;
}

export function SelectOptionContent({
  title,
  description,
  leading,
  className,
}: SelectOptionContentProps) {
  return (
    <span
      className={cn('flex min-w-0 items-center gap-2 text-start', className)}
    >
      {leading}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="block truncate text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </span>
  );
}
