import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface StatusIndicatorProps {
  label: ReactNode;
  dotClassName: string;
  className?: string;
}

export function StatusIndicator({
  label,
  dotClassName,
  className,
}: StatusIndicatorProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-sm font-normal text-foreground',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-2 shrink-0 rounded-full', dotClassName)}
      />
      {label}
    </span>
  );
}
