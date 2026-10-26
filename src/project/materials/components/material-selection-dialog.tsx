import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
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
import { useMaterialsQuery } from '../hooks/use-materials';
import type { Material, MaterialListFilters } from '../model/material';
import {
  MATERIAL_COLUMN_PINNING,
  useMaterialColumns,
} from '../table/material-selection.columns.generated';
import { MaterialSelectionDialogShell } from './material-selection-dialog-shell.generated';

const PAGE_SIZE = 10;

export interface MaterialSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters?: Omit<MaterialListFilters, 'search' | 'page' | 'pageSize'>;
  selectedMaterialIds: readonly string[];
  onConfirm: (
    selectedMaterialIds: string[],
    addedMaterials: Material[],
  ) => void;
  allowReservedByHandoverId?: string;
  initialSearch?: string;
  title?: ReactNode;
}

export function MaterialSelectionDialog({
  open,
  onOpenChange,
  filters = {},
  selectedMaterialIds,
  onConfirm,
  allowReservedByHandoverId,
  initialSearch = '',
  title,
}: MaterialSelectionDialogProps) {
  const intl = useIntl();
  const [search, setSearch] = useState(initialSearch);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const selectedMaterialIdsRef = useRef(selectedMaterialIds);
  if (!open) selectedMaterialIdsRef.current = selectedMaterialIds;
  const [draftSelectedMaterialIds, setDraftSelectedMaterialIds] = useState<
    string[]
  >([]);
  const [draftAddedMaterials, setDraftAddedMaterials] = useState<
    Map<string, Material>
  >(() => new Map());
  useEffect(() => {
    if (!open) return;
    setDraftSelectedMaterialIds([...selectedMaterialIdsRef.current]);
    setDraftAddedMaterials(new Map());
  }, [open]);
  const selectedIdSet = useMemo(
    () => new Set(draftSelectedMaterialIds),
    [draftSelectedMaterialIds],
  );
  const listFilters = useMemo<MaterialListFilters>(
    () => ({
      ...filters,
      excludeReserved: true,
      allowReservedByHandoverId,
      search: search.trim() || undefined,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [allowReservedByHandoverId, filters, pagination, search],
  );
  const query = useMaterialsQuery(listFilters, open);
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries(draftSelectedMaterialIds.map((id) => [id, true])),
    [draftSelectedMaterialIds],
  );
  const columns = useMaterialColumns();
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: total,
    enableRowSelection: (row) =>
      !row.original.reservedHandoverId ||
      row.original.reservedHandoverId === allowReservedByHandoverId,
    state: {
      pagination,
      columnPinning: MATERIAL_COLUMN_PINNING,
      rowSelection,
    },
    onPaginationChange: setPagination,
    onRowSelectionChange: (updater) => {
      const current = Object.fromEntries(
        draftSelectedMaterialIds.map((id) => [id, true]),
      );
      const next = typeof updater === 'function' ? updater(current) : updater;
      const nextIds = Object.keys(next).filter((id) => Boolean(next[id]));
      for (const material of items) {
        const wasSelected = selectedIdSet.has(material.id);
        const isSelected = Boolean(next[material.id]);
        if (!wasSelected && isSelected) {
          setDraftAddedMaterials((currentMaterials) =>
            new Map(currentMaterials).set(material.id, material),
          );
        }
      }
      setDraftSelectedMaterialIds(nextIds);
    },
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  const handleConfirm = () => {
    const initialIds = new Set(selectedMaterialIdsRef.current);
    const addedMaterials = draftSelectedMaterialIds.flatMap((id) => {
      const material = draftAddedMaterials.get(id);
      return !initialIds.has(id) && material ? [material] : [];
    });
    onConfirm(draftSelectedMaterialIds, addedMaterials);
    onOpenChange(false);
  };

  return (
    <MaterialSelectionDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={handleConfirm}
      title={title}
      footerLeading={
        <span className="text-sm text-muted-foreground">
          {intl.formatMessage(
            { id: 'project.materials.selection.selectedCount' },
            { count: draftSelectedMaterialIds.length },
          )}
        </span>
      }
      contentClassName="h-[min(90dvh,760px)] w-[min(96vw,80rem)] max-w-none"
    >
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        emptyMessage={intl.formatMessage({
          id: search.trim()
            ? 'project.materials.empty.search'
            : 'project.materials.empty.list',
        })}
        tableLayout={{ dense: true }}
      >
        <Card className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-0 shadow-none">
          <DataGridHeader
            className="shrink-0"
            variant="stats"
            recordCountLabel={intl.formatMessage({
              id: 'project.materials.list.recordCountLabel',
            })}
            stats={
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <SearchInput
                  aria-label={intl.formatMessage({
                    id: 'project.materials.filters.search',
                  })}
                  value={search}
                  className="w-72 shrink-0"
                  onSearch={handleSearchChange}
                />
              </div>
            }
          />
          <CardTable className="min-h-0 flex-1 overflow-auto">
            {query.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.materials.errors.loadTitle',
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
              <DataGridPagination
                sizes={[10, 25, 50]}
                sizesDescription={intl.formatMessage({
                  id: 'project.handover.table.paginationSizeDescription',
                })}
                info={intl.formatMessage(
                  { id: 'project.handover.table.paginationInfo' },
                  { from: '{from}', to: '{to}', count: '{count}' },
                )}
              />
            ) : null}
          </CardFooter>
        </Card>
      </DataGrid>
    </MaterialSelectionDialogShell>
  );
}
