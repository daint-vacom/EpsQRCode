import { useCallback, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
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
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useMaterialReceiptsQuery } from '../hooks/use-material-receipts';
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
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MaterialReceiptStatus | ''>('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const query = useMaterialReceiptsQuery(
    {
      search,
      ...(status ? { status } : {}),
      page: pageIndex + 1,
      pageSize,
    },
    isPermissionsPending || canView || canManage,
  );
  const result = query.data;
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
        id: search || status ? 'receipts.empty.search' : 'receipts.empty.list',
      }),
    [intl, search, status],
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
      <DataGrid
        table={table}
        recordCount={result?.total ?? 0}
        isLoading={
          isPermissionsPending || ((canView || canManage) && query.isPending)
        }
        isFetching={query.isFetching}
        emptyMessage={emptyMessage}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({ id: 'receipts.page.title' })}
            stats={
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label={intl.formatMessage({
                    id: 'receipts.search.label',
                  })}
                  title={intl.formatMessage({ id: 'receipts.search.label' })}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPageIndex(0);
                  }}
                  className="w-72 shrink-0"
                />
                <OptionSelect
                  aria-label={intl.formatMessage({
                    id: 'receipts.fields.status',
                  })}
                  value={status}
                  onChange={(value) => {
                    setStatus(value as MaterialReceiptStatus | '');
                    setPageIndex(0);
                  }}
                  options={[
                    {
                      value: '',
                      label: intl.formatMessage({
                        id: 'receipts.filters.allStatus',
                      }),
                    },
                    ...(
                      ['draft', 'handover', 'completed', 'cancelled'] as const
                    ).map((value) => ({
                      value,
                      label: intl.formatMessage({
                        id: `receipts.status.${value}`,
                      }),
                    })),
                  ]}
                  searchable={false}
                  className="w-48 shrink-0"
                />
              </div>
            }
            toolbar={<DataGridHeaderMenu table={table} />}
          />
          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending && !canView && !canManage ? (
              <ErrorState
                title={intl.formatMessage({ id: 'receipts.errors.permission' })}
                description={intl.formatMessage({
                  id: 'receipts.errors.permission',
                })}
              />
            ) : query.isError ? (
              <ErrorState
                title={intl.formatMessage({ id: 'receipts.errors.loadTitle' })}
                description={getApiErrorMessage(query.error)}
                onRetry={() => void query.refetch()}
              />
            ) : (
              <ScrollArea className="h-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardTable>
          <CardFooter className="justify-between">
            {(canView || canManage) &&
            !isPermissionsPending &&
            !query.isError ? (
              <DataGridPagination />
            ) : null}
          </CardFooter>
        </Card>
      </DataGrid>
    </div>
  );
}
