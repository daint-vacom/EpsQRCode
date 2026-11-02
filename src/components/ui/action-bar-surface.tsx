'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export function ActionBarSurface({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const inverseDark = resolvedTheme !== 'dark';
  const colorVariables = (
    inverseDark
      ? {
          '--background': 'var(--color-zinc-950)',
          '--foreground': 'var(--color-zinc-50)',
          '--border': 'var(--color-zinc-800)',
          '--input': 'var(--color-zinc-700)',
          '--muted': 'var(--color-zinc-900)',
          '--muted-foreground': 'var(--color-zinc-400)',
          '--accent': 'var(--color-zinc-800)',
          '--accent-foreground': 'var(--color-zinc-50)',
          '--secondary': 'var(--color-zinc-800)',
          '--secondary-foreground': 'var(--color-zinc-50)',
          '--field': 'var(--color-zinc-900)',
          '--popover': 'var(--color-zinc-950)',
          '--popover-foreground': 'var(--color-zinc-50)',
          '--ring': 'var(--admin-primary-bright)',
        }
      : {
          '--background': 'var(--color-white)',
          '--foreground': 'var(--color-zinc-900)',
          '--border': 'var(--color-zinc-200)',
          '--input': 'var(--color-zinc-300)',
          '--muted': 'var(--color-zinc-100)',
          '--muted-foreground': 'var(--color-zinc-500)',
          '--accent': 'var(--color-zinc-100)',
          '--accent-foreground': 'var(--color-zinc-900)',
          '--secondary': 'var(--color-zinc-100)',
          '--secondary-foreground': 'var(--color-zinc-900)',
          '--field': 'var(--color-white)',
          '--popover': 'var(--color-white)',
          '--popover-foreground': 'var(--color-zinc-900)',
          '--ring': 'var(--admin-primary)',
        }
  ) as CSSProperties;

  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      data-color-scheme={inverseDark ? 'dark' : 'light'}
      style={colorVariables}
      className={cn(
        'fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-foreground shadow-lg',
        'animate-in fade-in-0 slide-in-from-bottom-4 duration-200',
        className,
      )}
    >
      {children}
    </div>
  );
}
