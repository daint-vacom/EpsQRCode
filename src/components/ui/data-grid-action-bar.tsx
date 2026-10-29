'use client';

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useDataGrid } from '@/components/ui/data-grid';
import { Separator } from '@/components/ui/separator';

interface DataGridActionBarProps<TData extends object> {
  /** Action controls (e.g. a bulk Select + Apply button, a delete button). */
  children?: ReactNode;
  className?: string;
  /** Override the selection label. Receives the visible-selected row count. */
  selectionLabel?: (count: number) => ReactNode;
  /** Hide the built-in "Bỏ chọn" clear button (default shown). */
  hideClear?: boolean;
  /** Receive selected row records, including records cached from other pages. */
  onSelectionChange?: (rows: TData[]) => void;
}

/**
 * Floating bulk-action bar for a `DataGrid`. Reads the table from `useDataGrid()`,
 * appears centered at the bottom while one or more visible rows are selected, and
 * hosts bulk controls passed as `children`. Render it inside `<DataGrid>`; the
 * page owns what the actions do (e.g. a batched mutation over the selected rows).
 */
export function DataGridActionBar<TData extends object>({
  children,
  className,
  selectionLabel,
  hideClear = false,
  onSelectionChange,
}: DataGridActionBarProps<TData>) {
  const { table, selectedRows } = useDataGrid<TData>();
  const { resolvedTheme } = useTheme();
  const inverseDark = resolvedTheme !== 'dark';
  const count = Object.values(table.getState().rowSelection ?? {}).filter(
    Boolean,
  ).length;

  useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [onSelectionChange, selectedRows]);

  if (count === 0) {
    return null;
  }

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
      aria-label="Thao tác hàng loạt"
      data-color-scheme={inverseDark ? 'dark' : 'light'}
      style={colorVariables}
      className={cn(
        'fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-foreground shadow-lg',
        'animate-in fade-in-0 slide-in-from-bottom-4 duration-200',
        className,
      )}
    >
      <span className="px-1 text-sm font-medium text-foreground">
        {selectionLabel ? selectionLabel(count) : `Đã chọn ${count}`}
      </span>

      {children ? (
        <>
          <DataGridActionBarSeparator />
          {children}
        </>
      ) : null}

      {!hideClear ? (
        <>
          <DataGridActionBarSeparator />
          <Button
            variant="ghost"
            size="md"
            onClick={() => table.resetRowSelection()}
          >
            <X />
            Bỏ chọn
          </Button>
        </>
      ) : null}
    </div>
  );
}

/** Vertical divider between action-bar groups. */
export function DataGridActionBarSeparator({
  className,
}: {
  className?: string;
}) {
  return <Separator orientation="vertical" className={cn('h-5', className)} />;
}
