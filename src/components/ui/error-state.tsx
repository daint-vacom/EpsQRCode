import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ErrorStateProps {
  title: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Thử lại',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-48 w-full flex-col items-center justify-center gap-3 px-5 py-8 text-center',
        className,
      )}
    >
      <TriangleAlert
        className="size-7 shrink-0 text-destructive"
        aria-hidden="true"
      />
      <div className="max-w-2xl">
        <p className="font-semibold text-foreground">{title}</p>
        {description ? (
          <div className="mt-1 text-sm text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
