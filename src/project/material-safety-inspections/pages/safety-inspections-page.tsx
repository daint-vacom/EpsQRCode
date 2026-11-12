import { useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { FilterCountChips } from '@/project/shared/filter-count-chips';
import { ProjectFilterModeSwitcher } from '@/project/shared/project-filter-mode.generated';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { PaginationState } from '@tanstack/react-table';
import { ClipboardList } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
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
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  useSafetyInspectionFilterSummaryQuery,
  useSafetyInspectionListQuery,
} from '../hooks/use-safety-inspections';
import type { SafetyInspectionListFilters } from '../model/safety-inspection';
import { useSafetyInspectionListColumns } from '../table/safety-inspection-list.columns.generated';

const DEFAULT_PAGE_SIZE = 25;

export function SafetyInspectionsPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [overallResult, setOverallResult] = useState('');
  const [filterMode, setFilterMode] = useState<'status' | 'result'>('status');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const filters = useMemo<SafetyInspectionListFilters>(
    () => ({
      search: search.trim() || undefined,
      status: status
        ? (status as SafetyInspectionListFilters['status'])
        : undefined,
      overallResult: overallResult
        ? (overallResult as SafetyInspectionListFilters['overallResult'])
        : undefined,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [pagination.pageIndex, pagination.pageSize, search, status, overallResult],
  );
  const query = useSafetyInspectionListQuery(
    filters,
    !isPermissionsPending && canView,
  );
  const summaryQuery = useSafetyInspectionFilterSummaryQuery(
    search.trim(),
    !isPermissionsPending && canView,
  );
  const summary = summaryQuery.data;
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const columns = useSafetyInspectionListColumns({
    onView: (row) =>
      navigate(
        buildPath(ROUTES.PROJECT.MATERIAL_SAFETY_INSPECTION_DETAIL, {
          id: row.materialId,
          inspectionId: row.id,
        }),
        { state: { returnTo: ROUTES.PROJECT.SAFETY_INSPECTIONS } },
      ),
  });
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({
          id: 'project.materials.safetyInspection.list.title',
        })}
        icon={ClipboardList}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ProjectFilterModeSwitcher
          value={filterMode}
          onValueChange={(value) => {
            setFilterMode(value as 'status' | 'result');
            setStatus('');
            setOverallResult('');
            setPagination((current) => ({ ...current, pageIndex: 0 }));
          }}
          options={[
            {
              value: 'status',
              label: intl.formatMessage({
                id: 'project.management.filters.status',
              }),
            },
            {
              value: 'result',
              label: intl.formatMessage({
                id: 'project.management.filters.result',
              }),
            },
          ]}
          className="shrink-0"
          disabled={!canView || isPermissionsPending}
        />
        <span
          className="hidden h-5 w-px bg-border sm:block"
          aria-hidden="true"
        />

        <FilterCountChips
          ariaLabel={intl.formatMessage({
            id: `project.management.filters.${filterMode}`,
          })}
          value={filterMode === 'status' ? status : overallResult}
          onValueChange={(value) => {
            if (filterMode === 'status') setFilter(setStatus)(value);
            else setFilter(setOverallResult)(value);
          }}
          disabled={!canView || isPermissionsPending}
          options={
            filterMode === 'status'
              ? [
                  {
                    value: '',
                    label: intl.formatMessage({
                      id: 'project.management.filters.all',
                    }),
                    count: summary?.total,
                  },
                  {
                    value: 'in_progress',
                    label: intl.formatMessage({
                      id: 'project.materials.safetyInspection.status.inProgress',
                    }),
                    count: summary?.inProgress,
                  },
                  {
                    value: 'completed',
                    label: intl.formatMessage({
                      id: 'project.materials.safetyInspection.status.completed',
                    }),
                    count: summary?.completed,
                  },
                ]
              : [
                  {
                    value: '',
                    label: intl.formatMessage({
                      id: 'project.management.filters.all',
                    }),
                    count: summary?.total,
                  },
                  ...(['passed', 'failed', 'none'] as const).map((value) => ({
                    value,
                    label: intl.formatMessage({
                      id:
                        value === 'none'
                          ? 'project.materials.safetyInspection.results.unassessed'
                          : `project.materials.safetyInspection.results.${value}`,
                    }),
                    count:
                      value === 'passed'
                        ? summary?.passed
                        : value === 'failed'
                          ? summary?.failed
                          : summary?.noResult,
                  })),
                ]
          }
        />
      </div>
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={intl.formatMessage({
          id: 'project.materials.safetyInspection.list.empty',
        })}
        tableLayout={{ dense: true }}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({
              id: 'project.materials.safetyInspection.list.recordCountLabel',
            })}
            stats={
              <div className="flex min-w-0 flex-col gap-2">
                <SearchInput
                  aria-label={intl.formatMessage({
                    id: 'project.materials.safetyInspection.list.search',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.materials.safetyInspection.list.search',
                  })}
                  value={search}
                  className="w-72 shrink-0"
                  onSearch={setFilter(setSearch)}
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
                  id: 'project.materials.safetyInspection.list.loadTitle',
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
