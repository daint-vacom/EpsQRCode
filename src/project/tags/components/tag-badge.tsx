import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge, BadgeDot } from '@/components/ui/badge';

const DEFAULT_TAG_COLOR = '#64748b';

function resolveTagColor(color?: string | null) {
  return /^#[0-9a-f]{6}$/i.test(color ?? '') ? color! : DEFAULT_TAG_COLOR;
}

export interface TagBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string | null;
  size?: 'xl' | 'lg' | 'md' | 'sm' | 'xs';
  shape?: 'default' | 'circle';
}

export function TagBadge({
  color,
  size = 'lg',
  shape = 'circle',
  className,
  children,
  ...props
}: TagBadgeProps) {
  return (
    <Badge
      variant="secondary"
      appearance="light"
      size={size}
      shape={shape}
      className={cn(
        'justify-start gap-1.5 border-0 bg-muted text-muted-foreground',
        className,
      )}
      {...props}
    >
      <BadgeDot
        aria-hidden="true"
        className="shrink-0 opacity-100"
        style={{ backgroundColor: resolveTagColor(color) }}
      />
      {children}
    </Badge>
  );
}
