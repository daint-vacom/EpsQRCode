import { useEffect, useMemo, useState } from 'react';
import { useMaterialModelsQuery } from '@/project/material-models/hooks/use-material-models';
import type { MaterialModel } from '@/project/material-models/model/material-model';
import { MaterialSelectionDialogShell } from '@/project/materials/components/material-selection-dialog-shell.generated';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { PaginationState, RowSelectionState } from '@tanstack/react-table';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/inputs/search-input';
import {
  MATERIAL_MODEL_COLUMN_PINNING,
  useMaterialModelColumns,
} from '../table/material-receipt-model-selection.columns.generated';

const PAGE_SIZE = 10;

interface MaterialModelSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (models: MaterialModel[]) => void;
}

export function MaterialModelSelectionDialog({
  open,
  onOpenChange,
  onConfirm,
}: MaterialModelSelectionDialogProps) {
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const query = useMaterialModelsQuery(open);
  const columns = useMaterialModelColumns();
  const items = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    return (query.data ?? []).filter((model) => {
      if (!model.isActive) return false;
      return (
        !keyword ||
        `${model.name} ${model.code} ${model.externalCodes.join(' ')}`
          .toLocaleLowerCase()
          .includes(keyword)
      );
    });
  }, [query.data, search]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setPagination({ pageIndex: 0, pageSize: PAGE_SIZE });
    setRowSelection({});
  }, [open]);

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    rowCount: items.length,
    enableRowSelection: true,
    state: {
      columnPinning: MATERIAL_MODEL_COLUMN_PINNING,
      pagination,
      rowSelection,
    },
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
  });
  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  const handleConfirm = () => {
    const selectedIds = new Set(
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => id),
    );
    onConfirm((query.data ?? []).filter((model) => selectedIds.has(model.id)));
    onOpenChange(false);
  };

  return (
    <MaterialSelectionDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={handleConfirm}
      confirmLabel={
        selectedCount > 0
          ? intl.formatMessage(
              { id: 'receipts.modelSelection.confirmCount' },
              { count: selectedCount },
            )
          : intl.formatMessage({ id: 'receipts.modelSelection.confirm' })
      }
      confirmDisabled={selectedCount === 0}
      title={intl.formatMessage({
        id: 'receipts.dialogs.modelSelectionTitle',
      })}
      contentClassName="h-[min(90dvh,760px)] w-[min(96vw,64rem)] max-w-none"
    >
      <DataGrid
        table={table}
        recordCount={items.length}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        emptyMessage={intl.formatMessage({
          id: search.trim()
            ? 'materialModels.empty.search'
            : 'materialModels.empty.list',
        })}
        tableLayout={{ dense: true }}
      >
        <Card className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-0 shadow-none">
          <DataGridHeader
            className="shrink-0"
            variant="stats"
            recordCountLabel={intl.formatMessage({
              id: 'receipts.modelSelection.recordCount',
            })}
            stats={
              <SearchInput
                aria-label={intl.formatMessage({
                  id: 'materialModels.filters.searchPlaceholder',
                })}
                value={search}
                className="w-72 shrink-0"
                onSearch={(value) => {
                  setSearch(value);
                  setPagination((current) => ({ ...current, pageIndex: 0 }));
                }}
              />
            }
          />
          <CardTable className="min-h-0 flex-1 overflow-auto">
            {query.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'materialModels.errors.loadTitle',
                })}
                description={getApiErrorMessage(query.error)}
                onRetry={() => void query.refetch()}
              />
            ) : (
              <DataGridTable />
            )}
          </CardTable>
          <CardFooter className="shrink-0 justify-between">
            {!query.isError ? (
              <DataGridPagination sizes={[10, 25, 50]} />
            ) : null}
          </CardFooter>
        </Card>
      </DataGrid>
    </MaterialSelectionDialogShell>
  );
}
