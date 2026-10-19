import { useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
} from '@tanstack/react-table';
import { Boxes, Plus } from 'lucide-react';
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
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useMaterialsQuery } from '../hooks/use-materials';
import type { MaterialListFilters, MaterialStatus } from '../model/material';
import { MATERIAL_PERMISSION_CODES } from '../model/material-permissions';
import {
  MATERIAL_COLUMN_PINNING,
  useMaterialColumns,
} from '../table/material.columns.generated';

const DEFAULT_PAGE_SIZE = 25;

export function MaterialListPage() {
  const intl = useIntl();
  const navigate = useNavigate();
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
  const filters = useMemo<MaterialListFilters>(
    () => ({
      search: search.trim() || undefined,
      status: (status || undefined) as MaterialStatus | undefined,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [pagination.pageIndex, pagination.pageSize, search, status],
  );
  const queryEnabled = isPermissionsPending || canView;
  const query = useMaterialsQuery(
    filters,
    queryEnabled && !isPermissionsPending,
  );
  const partiesQuery = useCustodiansQuery(
    false,
    queryEnabled && !isPermissionsPending,
  );
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const partyNameById = useMemo(
    () =>
      new Map((partiesQuery.data ?? []).map((party) => [party.id, party.name])),
    [partiesQuery.data],
  );
  const columns = useMaterialColumns({
    partyNameById,
    canManage,
    onView: (material) =>
      window.open(
        buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, { id: material.id }),
        '_blank',
        'noopener,noreferrer',
      ),
    onEdit: (material) =>
      navigate(buildPath(ROUTES.PROJECT.MATERIAL_EDIT, { id: material.id })),
  });
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    rowCount: total,
    state: { pagination, columnPinning: MATERIAL_COLUMN_PINNING },
    onPaginationChange: setPagination,
  });
  const statusOptions: SelectOption[] = [
    {
      value: 'available',
      label: intl.formatMessage({ id: 'project.materials.status.available' }),
    },
    {
      value: 'loaned',
      label: intl.formatMessage({ id: 'project.materials.status.loaned' }),
    },
  ];
  const handleFilterChange =
    (setValue: (value: string) => void) => (value: string) => {
      setValue(value);
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'project.materials.page.title' })}
        icon={Boxes}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => navigate(ROUTES.PROJECT.MATERIAL_CREATE)}
            >
              <Plus />
              {intl.formatMessage({ id: 'project.materials.actions.create' })}
            </Button>
          ) : null
        }
      />
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={intl.formatMessage({
          id: search
            ? 'project.materials.empty.search'
            : 'project.materials.empty.list',
        })}
        tableLayout={{ dense: true }}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({
              id: 'project.materials.list.recordCountLabel',
            })}
            stats={
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Input
                  aria-label={intl.formatMessage({
                    id: 'project.materials.filters.search',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.materials.filters.search',
                  })}
                  value={search}
                  className="w-64 shrink-0"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPagination((current) => ({ ...current, pageIndex: 0 }));
                  }}
                />
                <OptionSelect
                  aria-label={intl.formatMessage({
                    id: 'project.materials.filters.status',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.materials.filters.statusPlaceholder',
                  })}
                  options={statusOptions}
                  value={status}
                  onChange={handleFilterChange(setStatus)}
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
                  id: 'project.materials.errors.loadTitle',
                })}
                description={intl.formatMessage({
                  id: 'project.materials.errors.authorization',
                })}
              />
            ) : query.isError || partiesQuery.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: query.isError
                    ? 'project.materials.errors.loadTitle'
                    : 'project.materials.errors.loadFiltersTitle',
                })}
                description={getApiErrorMessage(
                  query.error ?? partiesQuery.error,
                )}
                onRetry={() => {
                  void query.refetch();
                  void partiesQuery.refetch();
                }}
              />
            ) : (
              <ScrollArea className="h-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardTable>
          <CardFooter className="justify-between">
            {canView &&
            !isPermissionsPending &&
            !query.isError &&
            !partiesQuery.isError ? (
              <DataGridPagination />
            ) : null}
          </CardFooter>
        </Card>
      </DataGrid>
    </div>
  );
}
