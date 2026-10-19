import { useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
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

const EMPTY_FILTERS: HandoverListFilters = {};

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
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [senderPartyId, setSenderPartyId] = useState('');
  const [recipientPartyId, setRecipientPartyId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const { pageIndex, pageSize } = pagination;
  const filters = useMemo<HandoverListFilters>(
    () => ({
      ...EMPTY_FILTERS,
      search: search.trim() || undefined,
      type: (type || undefined) as HandoverListFilters['type'],
      status: (status || undefined) as HandoverListFilters['status'],
      senderPartyId: senderPartyId || undefined,
      recipientPartyId: recipientPartyId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: pageIndex + 1,
      pageSize,
    }),
    [
      search,
      type,
      status,
      senderPartyId,
      recipientPartyId,
      dateFrom,
      dateTo,
      pageIndex,
      pageSize,
    ],
  );
  const query = useHandoversQuery(filters, isPermissionsPending || canView);
  const custodiansQuery = useCustodiansQuery(
    false,
    isPermissionsPending || canView,
  );
  const custodians = custodiansQuery.data ?? [];
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
  const partyOptions = [
    { value: '', label: 'Tất cả chủ thể' },
    ...custodians.map((party) => ({
      value: party.id,
      label: `${party.name} · ${party.code}`,
    })),
  ];
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
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={intl.formatMessage({
                    id: 'project.handover.labels.search',
                  })}
                  value={search}
                  onChange={(event) => setFilter(setSearch)(event.target.value)}
                  className="w-64"
                />
                <OptionSelect
                  aria-label={intl.formatMessage({
                    id: 'project.handover.labels.filterSender',
                  })}
                  value={senderPartyId}
                  onChange={setFilter(setSenderPartyId)}
                  options={partyOptions}
                  searchable
                />
                <OptionSelect
                  aria-label={intl.formatMessage({
                    id: 'project.handover.labels.filterRecipient',
                  })}
                  value={recipientPartyId}
                  onChange={setFilter(setRecipientPartyId)}
                  options={partyOptions}
                  searchable
                />
                <Input
                  aria-label="Từ ngày"
                  type="date"
                  value={dateFrom}
                  onChange={(event) =>
                    setFilter(setDateFrom)(event.target.value)
                  }
                  className="w-40"
                />
                <Input
                  aria-label="Đến ngày"
                  type="date"
                  value={dateTo}
                  onChange={(event) => setFilter(setDateTo)(event.target.value)}
                  className="w-40"
                />
              </div>
            }
            toolbar={
              <div className="flex items-center gap-2">
                <OptionSelect
                  aria-label={intl.formatMessage({
                    id: 'project.handover.labels.filterType',
                  })}
                  value={type}
                  onChange={setFilter(setType)}
                  options={[
                    { value: '', label: 'Tất cả loại phiếu' },
                    { value: 'transfer', label: 'Chuyển sở hữu' },
                    { value: 'loan', label: 'Cho mượn' },
                    { value: 'return', label: 'Trả lại' },
                  ]}
                  searchable={false}
                />
                <OptionSelect
                  aria-label={intl.formatMessage({
                    id: 'project.handover.labels.filterStatus',
                  })}
                  value={status}
                  onChange={setFilter(setStatus)}
                  options={[
                    { value: '', label: 'Tất cả trạng thái' },
                    { value: 'draft', label: 'Bản nháp' },
                    { value: 'pending', label: 'Chờ xác nhận' },
                    { value: 'completed', label: 'Hoàn tất' },
                    { value: 'rejected', label: 'Đã từ chối' },
                    { value: 'cancelled', label: 'Đã hủy' },
                  ]}
                  searchable={false}
                />
                <DataGridHeaderMenu table={table} />
              </div>
            }
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
