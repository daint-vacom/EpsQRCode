import { useCallback, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { HANDOVER_PERMISSION_CODES } from '@/project/handover/model/handover-permissions';
import { FilterCountChips } from '@/project/shared/filter-count-chips';
import { ProjectFilterModeSwitcher } from '@/project/shared/project-filter-mode.generated';
import { WarehouseSelect } from '@/project/warehouses/components/warehouse-select';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ClipboardPlus, Plus } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridHeaderMenu } from '@/components/ui/data-grid-header-menu';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  useAvailableMaterialReceiptRequestsQuery,
  useMaterialReceiptFilterSummaryQuery,
  useMaterialReceiptsQuery,
} from '../hooks/use-material-receipts';
import type { MaterialReceiptStatus } from '../model/material-receipt';
import { MATERIAL_RECEIPT_PERMISSION_CODES } from '../model/material-receipt';
import {
  MATERIAL_RECEIPT_COLUMN_PINNING,
  useMaterialReceiptColumns,
} from '../table/material-receipt.columns.generated';

export function MaterialReceiptsPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.manage);
  const canRequestWarehouseMaterials = hasPermission(
    HANDOVER_PERMISSION_CODES.manage,
  );
  const requestableOnly =
    !isPermissionsPending &&
    !canView &&
    !canManage &&
    canRequestWarehouseMaterials;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MaterialReceiptStatus | ''>('');
  const [warehouseId, setWarehouseId] = useState('');
  const [filterMode, setFilterMode] = useState<'status' | 'warehouse'>(
    'status',
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const query = useMaterialReceiptsQuery(
    {
      search,
      ...(status ? { status } : {}),
      ...(warehouseId ? { warehouseId } : {}),
      page: pageIndex + 1,
      pageSize,
    },
    !requestableOnly && (isPermissionsPending || canView || canManage),
  );
  const requestableQuery = useAvailableMaterialReceiptRequestsQuery(
    { search, page: pageIndex + 1, pageSize },
    requestableOnly,
  );
  const summaryQuery = useMaterialReceiptFilterSummaryQuery(
    { search: search.trim(), warehouseId: warehouseId || undefined },
    !isPermissionsPending && (canView || canManage),
  );
  const summary = summaryQuery.data;
  const activeQuery = requestableOnly ? requestableQuery : query;
  const result = requestableOnly ? requestableQuery.data : query.data;
  const items = result?.items ?? [];
  const onView = useCallback(
    (receipt: (typeof items)[number]) => {
      navigate(ROUTES.PROJECT.RECEIPT_DETAIL.replace(':id', receipt.id));
    },
    [navigate],
  );
  const columns = useMaterialReceiptColumns({ onView });
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil((result?.total ?? 0) / pageSize),
    state: {
      columnPinning: MATERIAL_RECEIPT_COLUMN_PINNING,
      pagination: { pageIndex, pageSize },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize })
          : updater;
      if (next.pageSize !== pageSize) {
        setPageSize(next.pageSize);
        setPageIndex(0);
      } else setPageIndex(next.pageIndex);
    },
  });
  const emptyMessage = useMemo(
    () =>
      intl.formatMessage({
        id:
          search || status || warehouseId
            ? 'receipts.empty.search'
            : 'receipts.empty.list',
      }),
    [intl, search, status, warehouseId],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'receipts.page.title' })}
        icon={ClipboardPlus}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => navigate(ROUTES.PROJECT.RECEIPT_CREATE)}
            >
              <Plus />
              {intl.formatMessage({ id: 'receipts.actions.create' })}
            </Button>
          ) : null
        }
      />
      {requestableOnly ? (
        <p className="text-sm text-muted-foreground">
          {intl.formatMessage({
            id: 'receipts.requestRegistration.listDescription',
          })}
        </p>
      ) : null}
      {!requestableOnly ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ProjectFilterModeSwitcher
            value={filterMode}
            onValueChange={(value) => {
              setFilterMode(value as 'status' | 'warehouse');
              setStatus('');
              setWarehouseId('');
              setPageIndex(0);
            }}
            options={[
              {
                value: 'status',
                label: intl.formatMessage({
                  id: 'project.management.filters.status',
                }),
              },
              {
                value: 'warehouse',
                label: intl.formatMessage({
                  id: 'project.management.filters.warehouse',
                }),
              },
            ]}
            className="shrink-0"
            disabled={isPermissionsPending || (!canView && !canManage)}
          />
          <span
            className="hidden h-5 w-px bg-border sm:block"
            aria-hidden="true"
          />

          {!requestableOnly && filterMode === 'status' ? (
            <FilterCountChips
              ariaLabel={intl.formatMessage({
                id: 'project.management.filters.status',
              })}
              value={status}
              onValueChange={(value) => {
                setStatus(value as MaterialReceiptStatus | '');
                setPageIndex(0);
              }}
              disabled={isPermissionsPending || (!canView && !canManage)}
              options={[
                {
                  value: '',
                  label: intl.formatMessage({
                    id: 'project.management.filters.all',
                  }),
                  count: summary?.total,
                },
                ...(
                  ['draft', 'handover', 'completed', 'cancelled'] as const
                ).map((value) => ({
                  value,
                  label: intl.formatMessage({
                    id: `receipts.status.${value}`,
                  }),
                  count: summary?.[value],
                })),
              ]}
            />
          ) : null}
          {!requestableOnly && filterMode === 'warehouse' ? (
            <WarehouseSelect
              aria-label={intl.formatMessage({
                id: 'project.management.filters.warehouse',
              })}
              value={warehouseId}
              onChange={(value) => {
                setWarehouseId(value);
                setPageIndex(0);
              }}
              canDeselect
              disabled={isPermissionsPending || (!canView && !canManage)}
              searchable
              className="w-64 shrink-0"
            />
          ) : null}
        </div>
      ) : null}
      <DataGrid
        table={table}
        recordCount={result?.total ?? 0}
        isLoading={
          isPermissionsPending ||
          ((canView || canManage || requestableOnly) && activeQuery.isPending)
        }
        isFetching={activeQuery.isFetching}
        emptyMessage={emptyMessage}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({ id: 'receipts.page.title' })}
            stats={
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <SearchInput
                    aria-label={intl.formatMessage({
                      id: 'receipts.search.label',
                    })}
                    placeholder={intl.formatMessage({
                      id: 'receipts.search.label',
                    })}
                    value={search}
                    onSearch={(value) => {
                      setSearch(value);
                      setPageIndex(0);
                    }}
                    className="w-72 shrink-0"
                  />
                </div>
              </div>
            }
            toolbar={<DataGridHeaderMenu table={table} />}
          />
          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending &&
            !canView &&
            !canManage &&
            !canRequestWarehouseMaterials ? (
              <ErrorState
                title={intl.formatMessage({ id: 'receipts.errors.permission' })}
                description={intl.formatMessage({
                  id: 'receipts.errors.permission',
                })}
              />
            ) : activeQuery.isError ? (
              <ErrorState
                title={intl.formatMessage({ id: 'receipts.errors.loadTitle' })}
                description={getApiErrorMessage(activeQuery.error)}
                onRetry={() => void activeQuery.refetch()}
              />
            ) : (
              <ScrollArea className="h-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardTable>
          <CardFooter className="justify-between">
            {(canView || canManage || requestableOnly) &&
            !isPermissionsPending &&
            !activeQuery.isError ? (
              <DataGridPagination />
            ) : null}
          </CardFooter>
        </Card>
      </DataGrid>
    </div>
  );
}
