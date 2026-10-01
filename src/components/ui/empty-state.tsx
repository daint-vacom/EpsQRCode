import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  iconSize?: 'default' | 'lg';
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  iconSize = 'default',
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex min-h-48 w-full flex-col items-center justify-center gap-3 px-5 py-8 text-center',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex items-center justify-center rounded-full bg-muted text-muted-foreground',
          iconSize === 'lg' ? 'size-20' : 'size-11',
        )}
      >
        <Icon className={iconSize === 'lg' ? 'size-10' : 'size-5'} />
      </span>
      <div className="max-w-2xl">
        <p className="font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
