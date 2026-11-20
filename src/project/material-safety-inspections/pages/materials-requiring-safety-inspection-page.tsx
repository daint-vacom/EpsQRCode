import { useMemo, useState } from 'react';
import type { EpsEmployeeCatalogEntry } from '@/project/custodians/model/custodian';
import {
  MaterialGroupFilterSidebar,
  MaterialGroupFilterToggle,
} from '@/project/material-groups/components/material-group-filter-tree';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
import type { MaterialGroup } from '@/project/material-groups/model/material-group';
import { getMaterialGroupDescendantIds } from '@/project/material-groups/model/material-group-tree';
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
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MaterialSafetyInspectionPlanChart } from '../charts/material-safety-inspection-plan.chart.generated';
import { MaterialSafetyInspectionStatusChart } from '../charts/material-safety-inspection-status.chart.generated';
import {
  MaterialSafetyInspectionQueueFilterRow,
  type MaterialSafetyInspectionQueueFilterMode,
  type MaterialSafetyInspectionQueueOwnerType,
} from '../components/material-safety-inspection-queue-filter-row';
import {
  useMaterialSafetyInspectionPlanQuery,
  useMaterialSafetyInspectionQueueQuery,
} from '../hooks/use-safety-inspections';
import type {
  MaterialSafetyInspectionPlanChartPoint,
  MaterialSafetyInspectionPlanFilters,
  MaterialSafetyInspectionQueueChartPoint,
  MaterialSafetyInspectionQueueFilters,
} from '../model/safety-inspection';
import { useMaterialSafetyInspectionQueueColumns } from '../table/safety-inspection-queue.columns.generated';

const DEFAULT_PAGE_SIZE = 25;
const EMPTY_MATERIAL_GROUPS: MaterialGroup[] = [];

function getCurrentVietnameseYear() {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
    }).format(new Date()),
  );
}

export function MaterialsRequiringSafetyInspectionPage() {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const [isGroupTreeOpen, setIsGroupTreeOpen] = useState(true);
  const [filterMode, setFilterMode] =
    useState<MaterialSafetyInspectionQueueFilterMode>('status');
  const [status, setStatus] =
    useState<MaterialSafetyInspectionQueueFilters['status']>();
  const [ownerType, setOwnerType] = useState<
    MaterialSafetyInspectionQueueOwnerType | ''
  >('');
  const [ownerDepartmentId, setOwnerDepartmentId] = useState('');
  const [ownerTeamId, setOwnerTeamId] = useState('');
  const [ownerPartyId, setOwnerPartyId] = useState('');
  const currentYear = getCurrentVietnameseYear();
  const [planYear, setPlanYear] = useState(currentYear);
  const groupsQuery = useMaterialGroupsQuery(isPermissionsPending || canView);
  const groups = groupsQuery.data ?? EMPTY_MATERIAL_GROUPS;
  const groupIds = useMemo(
    () =>
      groupId ? [...getMaterialGroupDescendantIds(groups, groupId)] : undefined,
    [groupId, groups],
  );
  const [selectedOwnerEmployee, setSelectedOwnerEmployee] =
    useState<EpsEmployeeCatalogEntry | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const filters = useMemo<MaterialSafetyInspectionQueueFilters>(
    () => ({
      search: search.trim() || undefined,
      groupIds,
      status,
      ownerPartyId: ownerPartyId || undefined,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [
      groupIds,
      ownerPartyId,
      pagination.pageIndex,
      pagination.pageSize,
      search,
      status,
    ],
  );
  const query = useMaterialSafetyInspectionQueueQuery(
    filters,
    !isPermissionsPending && canView,
  );
  const planFilters = useMemo<MaterialSafetyInspectionPlanFilters>(
    () => ({
      search: search.trim() || undefined,
      groupIds,
      ownerPartyId: ownerPartyId || undefined,
      year: planYear,
    }),
    [groupIds, ownerPartyId, planYear, search],
  );
  const planQuery = useMaterialSafetyInspectionPlanQuery(
    planFilters,
    !isPermissionsPending && canView,
  );
  const statusChartData = useMemo<
    MaterialSafetyInspectionQueueChartPoint[]
  >(() => {
    const summary = query.data?.summary;
    const isEmpty = !summary || summary.total === 0;

    return [
      {
        name: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.chart.notInspected',
        }),
        value: (summary?.due ?? 0) + (summary?.upcoming ?? 0),
        fill: isEmpty ? 'var(--admin-chart-empty)' : 'var(--admin-red-primary)',
      },
      {
        name: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.chart.inProgress',
        }),
        value: summary?.inProgress ?? 0,
        fill: isEmpty
          ? 'var(--admin-chart-empty)'
          : 'var(--admin-amber-primary)',
      },
    ];
  }, [intl, query.data?.summary]);
  const planChartData = useMemo<MaterialSafetyInspectionPlanChartPoint[]>(
    () =>
      (
        planQuery.data?.items ??
        Array.from({ length: 12 }, (_, index) => ({
          month: index + 1,
          notInspected: 0,
          inProgress: 0,
          completed: 0,
        }))
      ).map((point) => ({
        ...point,
        monthLabel: `T${intl.formatNumber(point.month)}`,
      })),
    [intl, planQuery.data?.items],
  );
  const planYearOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: 5 }, (_, index) => currentYear + index).map(
        (year) => ({ value: String(year), label: String(year) }),
      ),
    [currentYear],
  );
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const groupCounts = useMemo(
    () => new Map(Object.entries(query.data?.groupCounts ?? {})),
    [query.data?.groupCounts],
  );
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
  const resetPage = () => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };
  const handleFilterModeChange = (
    nextMode: MaterialSafetyInspectionQueueFilterMode,
  ) => {
    if (nextMode === filterMode) return;

    if (nextMode === 'status') {
      setOwnerType('');
      setOwnerDepartmentId('');
      setOwnerTeamId('');
      setOwnerPartyId('');
      setSelectedOwnerEmployee(null);
    } else {
      setStatus(undefined);
    }
    setFilterMode(nextMode);
    resetPage();
  };
  const handleOwnerTypeChange = (
    nextType: MaterialSafetyInspectionQueueOwnerType | '',
  ) => {
    setOwnerType(nextType);
    setOwnerDepartmentId('');
    setOwnerTeamId('');
    setOwnerPartyId('');
    setSelectedOwnerEmployee(null);
    resetPage();
  };
  const handleOwnerDepartmentChange = (departmentId: string) => {
    setOwnerDepartmentId(departmentId);
    setOwnerTeamId('');
    setOwnerPartyId(departmentId);
    resetPage();
  };
  const handleOwnerTeamChange = (teamId: string) => {
    setOwnerTeamId(teamId);
    setOwnerPartyId(teamId || ownerDepartmentId);
    resetPage();
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
      {!isPermissionsPending && !canView ? null : (
        <div className="grid min-w-0 gap-admin-page-section xl:grid-cols-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardHeading>
                <CardTitle>
                  {intl.formatMessage({
                    id: 'project.materials.safetyInspection.queue.chart.statusTitle',
                  })}
                </CardTitle>
              </CardHeading>
            </CardHeader>
            <CardContent className="grid min-h-[15rem] items-center gap-4 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.9fr)]">
              {query.isPending ? (
                <>
                  <Skeleton className="mx-auto size-48 rounded-full" />
                  <div className="space-y-4">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                </>
              ) : query.isError ? (
                <div className="col-span-full">
                  <ErrorState
                    title={intl.formatMessage({
                      id: 'project.materials.safetyInspection.queue.loadTitle',
                    })}
                    description={getApiErrorMessage(query.error)}
                    onRetry={() => void query.refetch()}
                  />
                </div>
              ) : (
                <>
                  <div className="relative mx-auto w-full max-w-56">
                    <MaterialSafetyInspectionStatusChart
                      data={statusChartData}
                      countLabel={intl.formatMessage({
                        id: 'project.materials.safetyInspection.queue.chart.countLabel',
                      })}
                      isEmpty={(query.data?.summary.total ?? 0) === 0}
                    />
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-metric font-semibold tabular-nums text-foreground">
                        {intl.formatNumber(query.data?.summary.total ?? 0)}
                      </span>
                      <span className="max-w-24 text-xs text-muted-foreground">
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.queue.chart.total',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {statusChartData.map((point) => (
                      <div
                        key={point.name}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-foreground">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: point.fill }}
                            aria-hidden="true"
                          />
                          <span className="truncate">{point.name}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-foreground">
                          {intl.formatNumber(point.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardHeading>
                <CardTitle>
                  {intl.formatMessage({
                    id: 'project.materials.safetyInspection.queue.chart.planTitle',
                  })}
                </CardTitle>
              </CardHeading>
              <OptionSelect
                aria-label={intl.formatMessage({
                  id: 'project.materials.safetyInspection.queue.chart.year',
                })}
                options={planYearOptions}
                value={String(planYear)}
                onChange={(value) => setPlanYear(Number(value))}
                searchable={false}
                className="w-28 shrink-0"
              />
            </CardHeader>
            <CardContent className="min-h-[15rem] px-4 pb-3 pt-0">
              {planQuery.isPending ? (
                <Skeleton className="h-60 w-full" />
              ) : planQuery.isError ? (
                <ErrorState
                  title={intl.formatMessage({
                    id: 'project.materials.safetyInspection.queue.chart.planLoadTitle',
                  })}
                  description={getApiErrorMessage(planQuery.error)}
                  onRetry={() => void planQuery.refetch()}
                />
              ) : (
                <MaterialSafetyInspectionPlanChart
                  data={planChartData}
                  labels={{
                    notInspected: intl.formatMessage({
                      id: 'project.materials.safetyInspection.queue.chart.notInspected',
                    }),
                    inProgress: intl.formatMessage({
                      id: 'project.materials.safetyInspection.queue.chart.inProgress',
                    }),
                    completed: intl.formatMessage({
                      id: 'project.materials.safetyInspection.queue.chart.completed',
                    }),
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <MaterialGroupFilterToggle
          isOpen={isGroupTreeOpen}
          controlsId="material-safety-inspection-group-tree"
          disabled={!canView || isPermissionsPending || groupsQuery.isPending}
          onClick={() => setIsGroupTreeOpen((current) => !current)}
        />
        <div className="min-w-0 flex-1">
          <MaterialSafetyInspectionQueueFilterRow
            mode={filterMode}
            onModeChange={handleFilterModeChange}
            status={status}
            onStatusChange={(value) => {
              setStatus(value);
              resetPage();
            }}
            summary={query.data?.summary}
            isCountsLoading={query.isPending}
            ownerFilter={query.data?.ownerFilter}
            ownerType={ownerType}
            onOwnerTypeChange={handleOwnerTypeChange}
            ownerDepartmentId={ownerDepartmentId}
            onOwnerDepartmentChange={handleOwnerDepartmentChange}
            ownerTeamId={ownerTeamId}
            onOwnerTeamChange={handleOwnerTeamChange}
            ownerPartyId={ownerPartyId}
            onOwnerPartyIdChange={(value) => {
              setOwnerPartyId(value);
              resetPage();
            }}
            selectedEmployee={selectedOwnerEmployee}
            onSelectedEmployeeChange={setSelectedOwnerEmployee}
            disabled={isPermissionsPending || !canView}
          />
        </div>
      </div>
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={emptyMessage}
        tableLayout={{ dense: true }}
      >
        <div
          className={`flex min-h-[32rem] min-w-0 flex-1 flex-col transition-[gap] duration-300 ease-in-out motion-reduce:transition-none xl:flex-row ${isGroupTreeOpen ? 'gap-3' : 'gap-0'}`}
        >
          <MaterialGroupFilterSidebar
            id="material-safety-inspection-group-tree"
            isOpen={isGroupTreeOpen}
            groups={groups}
            selectedGroupId={groupId || null}
            countByNode={groupCounts}
            allCount={query.data?.groupCountsTotal ?? 0}
            countLabelId="project.materials.safetyInspection.queue.groupCount"
            onSelectGroup={(nextGroupId) => {
              setGroupId(nextGroupId ?? '');
              resetPage();
            }}
          />
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
                    onSearch={(value) => {
                      setSearch(value);
                      resetPage();
                    }}
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
        </div>
      </DataGrid>
      <div aria-hidden="true" className="h-2 shrink-0" />
    </div>
  );
}
