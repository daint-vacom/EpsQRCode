import { useMemo, useState } from 'react';
import type { EpsEmployeeCatalogEntry } from '@/project/custodians/model/custodian';
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
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  MaterialSafetyInspectionQueueFilterRow,
  type MaterialSafetyInspectionQueueFilterMode,
  type MaterialSafetyInspectionQueueOwnerType,
} from '../components/material-safety-inspection-queue-filter-row';
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
  const [selectedOwnerEmployee, setSelectedOwnerEmployee] =
    useState<EpsEmployeeCatalogEntry | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const filters = useMemo<MaterialSafetyInspectionQueueFilters>(
    () => ({
      search: search.trim() || undefined,
      status,
      ownerPartyId: ownerPartyId || undefined,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [ownerPartyId, pagination.pageIndex, pagination.pageSize, search, status],
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
      </DataGrid>
    </div>
  );
}
