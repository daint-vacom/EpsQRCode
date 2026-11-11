import { useMemo, useState } from 'react';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { PaginationState } from '@tanstack/react-table';
import { ClipboardCheck } from 'lucide-react';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useMaterialSafetyInspectionQueueQuery } from '../hooks/use-safety-inspections';
import type { MaterialSafetyInspectionQueueFilters } from '../model/safety-inspection';
import { useMaterialSafetyInspectionQueueColumns } from '../table/safety-inspection-queue.columns.generated';

const DEFAULT_PAGE_SIZE = 25;

export function MaterialsRequiringSafetyInspectionPage() {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const filters = useMemo<MaterialSafetyInspectionQueueFilters>(
    () => ({
      search: search.trim() || undefined,
      status: status
        ? (status as MaterialSafetyInspectionQueueFilters['status'])
        : undefined,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [pagination.pageIndex, pagination.pageSize, search, status],
  );
  const query = useMaterialSafetyInspectionQueueQuery(
    filters,
    !isPermissionsPending && canView,
  );
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const columns = useMaterialSafetyInspectionQueueColumns({ canManage });
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.pageSize),
    state: { pagination },
    onPaginationChange: setPagination,
  });
  const setFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };
  const emptyMessage = intl.formatMessage({
    id: 'project.materials.safetyInspection.queue.empty',
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.title',
        })}
        icon={ClipboardCheck}
      />
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={emptyMessage}
        tableLayout={{ dense: true }}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({
              id: 'project.materials.safetyInspection.queue.recordCountLabel',
            })}
            stats={
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SearchInput
                  aria-label={intl.formatMessage({
                    id: 'project.materials.safetyInspection.queue.search',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.materials.safetyInspection.queue.search',
                  })}
                  value={search}
                  className="w-64 shrink-0"
                  onSearch={setFilter(setSearch)}
                />
                <OptionSelect
                  aria-label={intl.formatMessage({
                    id: 'project.materials.safetyInspection.queue.filterStatus',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.materials.safetyInspection.queue.allStatuses',
                  })}
                  options={[
                    {
                      value: 'due',
                      label: intl.formatMessage({
                        id: 'project.materials.safetyInspection.queue.status.due',
                      }),
                    },
                    {
                      value: 'upcoming',
                      label: intl.formatMessage({
                        id: 'project.materials.safetyInspection.queue.status.upcoming',
                      }),
                    },
                    {
                      value: 'in_progress',
                      label: intl.formatMessage({
                        id: 'project.materials.safetyInspection.queue.status.inProgress',
                      }),
                    },
                  ]}
                  value={status}
                  onChange={setFilter(setStatus)}
                  searchable={false}
                  className="w-52 shrink-0"
                />
              </div>
            }
          />
          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending && !canView ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.materials.errors.authorizationTitle',
                })}
                description={intl.formatMessage({
                  id: 'project.materials.errors.authorization',
                })}
              />
            ) : query.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.materials.safetyInspection.queue.loadTitle',
                })}
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
            {canView && !isPermissionsPending && !query.isError ? (
              <DataGridPagination />
            ) : null}
          </CardFooter>
        </Card>
      </DataGrid>
    </div>
  );
}
