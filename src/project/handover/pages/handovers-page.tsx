import { useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { PaginationState } from '@tanstack/react-table';
import { ClipboardList, Plus } from 'lucide-react';
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
import { useHandoversQuery } from '../hooks/use-handovers';
import type { HandoverListFilters } from '../model/handover';
import { HANDOVER_PERMISSION_CODES } from '../model/handover-permissions';
import {
  HANDOVER_DOCUMENT_COLUMN_PINNING,
  useHandoverDocumentColumns,
} from '../table/handover.columns.generated';

function isAuthorizationError(error: unknown) {
  if (typeof error !== 'object' || error === null) return false;
  const value = error as { status?: unknown; response?: { status?: unknown } };
  return (
    (value.status ?? value.response?.status) === 401 ||
    (value.status ?? value.response?.status) === 403
  );
}

export function HandoversPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(HANDOVER_PERMISSION_CODES.view);
  const canManage = hasPermission(HANDOVER_PERMISSION_CODES.manage);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const { pageIndex, pageSize } = pagination;
  const filters = useMemo<HandoverListFilters>(
    () => ({
      search: search.trim() || undefined,
      status: (status || undefined) as HandoverListFilters['status'],
      page: pageIndex + 1,
      pageSize,
    }),
    [search, status, pageIndex, pageSize],
  );
  const query = useHandoversQuery(filters, isPermissionsPending || canView);
  const records = query.data?.items ?? [];
  const columns = useHandoverDocumentColumns({
    onView: (row) =>
      navigate(ROUTES.PROJECT.HANDOVER_DETAIL.replace(':id', row.id)),
  });
  const table = useReactTable({
    data: records,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.ceil((query.data?.total ?? 0) / pageSize),
    state: {
      columnPinning: HANDOVER_DOCUMENT_COLUMN_PINNING,
      pagination,
    },
    onPaginationChange: setPagination,
  });
  const emptyMessage = search.trim()
    ? intl.formatMessage({ id: 'project.handover.empty.search' })
    : intl.formatMessage({ id: 'project.handover.empty.list' });

  const setFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'project.handover.page.title' })}
        icon={ClipboardList}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => navigate(ROUTES.PROJECT.HANDOVER_CREATE)}
            >
              <Plus />
              {intl.formatMessage({ id: 'project.handover.actions.create' })}
            </Button>
          ) : null
        }
      />
      <DataGrid
        table={table}
        recordCount={query.data?.total ?? 0}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={emptyMessage}
        tableLayout={{ dense: true }}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({
              id: 'project.handover.labels.listCount',
            })}
            stats={
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Input
                  aria-label={intl.formatMessage({
                    id: 'project.handover.labels.search',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.handover.labels.search',
                  })}
                  value={search}
                  onChange={(event) => setFilter(setSearch)(event.target.value)}
                  className="w-64 shrink-0"
                />
                <OptionSelect
                  aria-label={intl.formatMessage({
                    id: 'project.handover.labels.filterStatus',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.handover.labels.filterStatusPlaceholder',
                  })}
                  value={status}
                  onChange={setFilter(setStatus)}
                  options={[
                    {
                      value: 'draft',
                      label: intl.formatMessage({
                        id: 'project.handover.status.draft',
                      }),
                    },
                    {
                      value: 'pending',
                      label: intl.formatMessage({
                        id: 'project.handover.status.pending',
                      }),
                    },
                    {
                      value: 'completed',
                      label: intl.formatMessage({
                        id: 'project.handover.status.completed',
                      }),
                    },
                    {
                      value: 'rejected',
                      label: intl.formatMessage({
                        id: 'project.handover.status.rejected',
                      }),
                    },
                    {
                      value: 'cancelled',
                      label: intl.formatMessage({
                        id: 'project.handover.status.cancelled',
                      }),
                    },
                  ]}
                  searchable={false}
                  className="w-52 shrink-0"
                />
              </div>
            }
            toolbar={<DataGridHeaderMenu table={table} />}
          />
          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending && !canView ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.handover.errors.noViewPermission',
                })}
                description={intl.formatMessage({
                  id: 'project.handover.errors.contactAdmin',
                })}
              />
            ) : query.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.handover.errors.loadTitle',
                })}
                description={
                  isAuthorizationError(query.error)
                    ? intl.formatMessage({
                        id: 'project.handover.errors.unauthorized',
                      })
                    : getApiErrorMessage(query.error)
                }
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
            <DataGridPagination />
          </CardFooter>
        </Card>
      </DataGrid>
    </div>
  );
}
