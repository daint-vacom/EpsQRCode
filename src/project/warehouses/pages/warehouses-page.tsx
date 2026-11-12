import { useMemo, useState } from 'react';
import { useCustodianAccountOptionsQuery } from '@/project/custodians/hooks/use-custodians';
import { FilterCountChips } from '@/project/shared/filter-count-chips';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Building2, Plus } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
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
import type { MultiSelectOption } from '@/components/ui/multi-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  mapWarehouseToFormValues,
  useWarehouseForm,
  WarehouseFormDialog,
} from '../forms/warehouse-form.generated';
import {
  useSaveWarehouseMutation,
  useWarehouseFilterSummaryQuery,
  useWarehousesQuery,
} from '../hooks/use-warehouses';
import type { Warehouse } from '../model/warehouse';
import { WAREHOUSE_PERMISSION_CODES } from '../model/warehouse';
import {
  useWarehouseColumns,
  WAREHOUSE_COLUMN_PINNING,
} from '../table/warehouse.columns.generated';

const EMPTY_WAREHOUSES: Warehouse[] = [];

export function WarehousesPage() {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(WAREHOUSE_PERMISSION_CODES.view);
  const canManage = hasPermission(WAREHOUSE_PERMISSION_CODES.manage);
  const query = useWarehousesQuery(true, isPermissionsPending || canView);
  const accountOptionsQuery = useCustodianAccountOptionsQuery(
    isPermissionsPending || canManage,
  );
  const saveMutation = useSaveWarehouseMutation();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const createForm = useWarehouseForm();
  const editForm = useWarehouseForm();
  const accounts = accountOptionsQuery.data ?? [];
  const accountUserIdsOptions: MultiSelectOption[] = accounts.map(
    (account) => ({
      value: account.id,
      label: account.displayName,
    }),
  );
  const accountNameById = new Map(
    accounts.map((account) => [account.id, account.displayName]),
  );
  const normalizedSearch = search.trim().toLocaleLowerCase('vi');
  const summaryQuery = useWarehouseFilterSummaryQuery(
    search.trim(),
    !isPermissionsPending && canView,
  );
  const summary = summaryQuery.data;
  const filteredWarehouses = useMemo(() => {
    const warehouses = query.data ?? EMPTY_WAREHOUSES;
    return warehouses.filter(
      (warehouse) =>
        (!activeFilter || warehouse.isActive === (activeFilter === 'active')) &&
        (!normalizedSearch ||
          [warehouse.code, warehouse.name, warehouse.address].some((value) =>
            value.toLocaleLowerCase('vi').includes(normalizedSearch),
          )),
    );
  }, [normalizedSearch, query.data, activeFilter]);
  const openEdit = (warehouse: Warehouse) => {
    if (!canManage) return;
    setEditing(warehouse);
    editForm.reset(mapWarehouseToFormValues(warehouse));
  };
  const columns = useWarehouseColumns({
    canManage,
    accountNameById,
    onEdit: openEdit,
  });
  const table = useReactTable({
    data: filteredWarehouses,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { columnPinning: WAREHOUSE_COLUMN_PINNING },
  });
  const save = (
    id: string | null,
    values: Parameters<typeof saveMutation.mutate>[0]['values'],
  ) => {
    if (!canManage) return;
    saveMutation.mutate(
      { id, values },
      {
        onSuccess: () => {
          toast.success(
            intl.formatMessage({
              id: id
                ? 'warehouses.toasts.updated'
                : 'warehouses.toasts.created',
            }),
          );
          if (id) setEditing(null);
          else {
            setCreateOpen(false);
            createForm.reset();
          }
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'warehouses.page.title' })}
        icon={Building2}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <Plus />
              {intl.formatMessage({ id: 'warehouses.actions.create' })}
            </Button>
          ) : null
        }
      />
      <DataGrid
        table={table}
        recordCount={filteredWarehouses.length}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={intl.formatMessage({
          id:
            normalizedSearch || activeFilter
              ? 'warehouses.empty.search'
              : 'warehouses.empty.list',
        })}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({
              id: 'warehouses.page.title',
            })}
            stats={
              <div className="flex min-w-0 flex-col gap-2">
                <SearchInput
                  aria-label={intl.formatMessage({
                    id: 'warehouses.search.placeholder',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'warehouses.search.placeholder',
                  })}
                  value={search}
                  onSearch={(value) => {
                    setSearch(value);
                    table.setPageIndex(0);
                  }}
                  className="w-72 shrink-0"
                />
                <FilterCountChips
                  ariaLabel={intl.formatMessage({
                    id: 'project.management.filters.status',
                  })}
                  value={activeFilter}
                  onValueChange={(value) => {
                    setActiveFilter(value);
                    table.setPageIndex(0);
                  }}
                  disabled={!canView || isPermissionsPending}
                  options={[
                    {
                      value: '',
                      label: intl.formatMessage({
                        id: 'project.management.filters.all',
                      }),
                      count: summary?.total,
                    },
                    {
                      value: 'active',
                      label: intl.formatMessage({
                        id: 'warehouses.status.active',
                      }),
                      count: summary?.active,
                    },
                    {
                      value: 'inactive',
                      label: intl.formatMessage({
                        id: 'warehouses.status.inactive',
                      }),
                      count: summary?.inactive,
                    },
                  ]}
                />
              </div>
            }
            toolbar={<DataGridHeaderMenu table={table} />}
          />
          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending && !canView ? (
              <ErrorState
                title={intl.formatMessage({ id: 'warehouses.errors.noView' })}
                description={intl.formatMessage({
                  id: 'warehouses.errors.noView',
                })}
              />
            ) : query.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'warehouses.errors.loadTitle',
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
      <WarehouseFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        form={createForm}
        onSubmit={(values) => save(null, values)}
        isSaving={saveMutation.isPending}
        accountUserIdsOptions={accountUserIdsOptions}
        title={intl.formatMessage({ id: 'warehouses.dialogs.createTitle' })}
      />
      <WarehouseFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        form={editForm}
        onSubmit={(values) => editing && save(editing.id, values)}
        isSaving={saveMutation.isPending}
        accountUserIdsOptions={accountUserIdsOptions}
        title={intl.formatMessage({ id: 'warehouses.dialogs.editTitle' })}
      />
    </div>
  );
}
