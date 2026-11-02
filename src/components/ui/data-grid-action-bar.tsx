'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActionBarSurface } from '@/components/ui/action-bar-surface';
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
  const count = Object.values(table.getState().rowSelection ?? {}).filter(
    Boolean,
  ).length;

  useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [onSelectionChange, selectedRows]);

  if (count === 0) {
    return null;
  }

  return (
    <ActionBarSurface ariaLabel="Thao tác hàng loạt" className={className}>
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
    </ActionBarSurface>
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
