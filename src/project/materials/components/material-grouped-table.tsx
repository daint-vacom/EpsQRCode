import { useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  getCoreRowModel,
  useReactTable,
  type PaginationState,
} from '@tanstack/react-table';
import { useIntl } from 'react-intl';
import { CardFooter } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { MaterialGroupedRow } from '../model/material';
import { useMaterialGroupedColumns } from '../table/material-grouped.columns.generated';

export interface MaterialGroupedTableProps {
  groups: MaterialGroupedRow[];
  total: number;
  pagination: PaginationState;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  onOpenGroup: (groupKey: string) => void;
  groupNameById?: ReadonlyMap<string, string>;
  receiptColumnHeader?: string;
  isLoading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

export function MaterialGroupedTable({
  groups,
  total,
  pagination,
  setPagination,
  onOpenGroup,
  groupNameById = new Map(),
  receiptColumnHeader,
  isLoading = false,
  error = false,
  onRetry,
}: MaterialGroupedTableProps) {
  const intl = useIntl();
  const columns = useMaterialGroupedColumns(
    onOpenGroup,
    groupNameById,
    receiptColumnHeader,
  );
  const table = useReactTable({
    data: groups,
    columns,
    getRowId: (row) => row.groupKey,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: total,
    state: { pagination },
    onPaginationChange: setPagination,
  });
  const emptyMessage = useMemo(
    () => intl.formatMessage({ id: 'project.materials.grouping.empty' }),
    [intl],
  );

  return (
    <DataGrid
      table={table}
      recordCount={total}
      isLoading={isLoading}
      loadingMode="skeleton"
      emptyMessage={emptyMessage}
    >
      {error ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.grouping.loadError',
          })}
          onRetry={onRetry}
          retryLabel={intl.formatMessage({ id: 'common.actions.retry' })}
        />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <DataGridTable />
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      {!error ? (
        <CardFooter className="justify-between">
          <DataGridPagination
            sizes={[25, 50, 100]}
            sizesDescription={intl.formatMessage({
              id: 'project.materials.grouping.groups',
            })}
            info={intl.formatMessage({
              id: 'project.materials.grouping.pagination',
            })}
          />
        </CardFooter>
      ) : null}
    </DataGrid>
  );
}
