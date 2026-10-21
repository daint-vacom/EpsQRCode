import { useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { Boxes, Handshake, Plus, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridActionBar } from '@/components/ui/data-grid-action-bar';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridHeaderMenu } from '@/components/ui/data-grid-header-menu';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  useDeleteMaterialMutation,
  useMaterialsQuery,
  useUpdateMaterialAvailabilityMutation,
} from '../hooks/use-materials';
import type {
  Material,
  MaterialListFilters,
  MaterialStatus,
} from '../model/material';
import { MATERIAL_PERMISSION_CODES } from '../model/material-permissions';
import {
  MATERIAL_COLUMN_PINNING,
  useMaterialColumns,
} from '../table/material.columns.generated';
import { useMaterialTableMainColumnWidth } from '../table/use-material-table-main-column-width';

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
  const [deletingMaterials, setDeletingMaterials] = useState<Material[]>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pendingAvailabilityIds, setPendingAvailabilityIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
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
  const groupsQuery = useMaterialGroupsQuery(
    queryEnabled && !isPermissionsPending,
  );
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const availabilityMutation = useUpdateMaterialAvailabilityMutation();
  const deleteMutation = useDeleteMaterialMutation();
  const partyNameById = useMemo(
    () =>
      new Map((partiesQuery.data ?? []).map((party) => [party.id, party.name])),
    [partiesQuery.data],
  );
  const groupNameById = useMemo(
    () =>
      new Map((groupsQuery.data ?? []).map((group) => [group.id, group.name])),
    [groupsQuery.data],
  );
  const columns = useMaterialColumns({
    partyNameById,
    groupNameById,
    canManage,
    pendingAvailabilityIds,
    onAvailabilityChange: async (material, isActive) => {
      if (!canManage || pendingAvailabilityIds.has(material.id)) return;
      setPendingAvailabilityIds((current) => new Set(current).add(material.id));
      try {
        await availabilityMutation.mutateAsync({ id: material.id, isActive });
        toast.success(
          intl.formatMessage({
            id: isActive
              ? 'project.materials.toasts.activated'
              : 'project.materials.toasts.deactivated',
          }),
        );
      } catch (error) {
        toast.error(getApiErrorMessage(error));
      } finally {
        setPendingAvailabilityIds((current) => {
          const next = new Set(current);
          next.delete(material.id);
          return next;
        });
      }
    },
    onView: (material) =>
      window.open(
        buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, { id: material.id }),
        '_blank',
        'noopener,noreferrer',
      ),
    onEdit: (material) =>
      navigate(buildPath(ROUTES.PROJECT.MATERIAL_EDIT, { id: material.id })),
    onHandover: (material) =>
      navigate(
        `${ROUTES.PROJECT.HANDOVER_CREATE}?materialId=${encodeURIComponent(material.id)}`,
      ),
    onDelete: (material) => setDeletingMaterials([material]),
  });
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    rowCount: total,
    enableRowSelection: canManage,
    state: {
      pagination,
      columnPinning: MATERIAL_COLUMN_PINNING,
      columnVisibility: { select: canManage },
      rowSelection,
    },
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
  });
  const selectedMaterials = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);
  const handleBulkHandover = () => {
    if (!canManage || selectedMaterials.length === 0) return;
    if (selectedMaterials.some((material) => material.reservedHandoverId)) {
      toast.error(
        intl.formatMessage({ id: 'project.materials.states.reserved' }),
      );
      return;
    }
    if (
      new Set(selectedMaterials.map((material) => material.status)).size > 1
    ) {
      toast.error(
        intl.formatMessage({ id: 'project.materials.errors.mixedStatuses' }),
      );
      return;
    }
    const query = new URLSearchParams({
      materialIds: selectedMaterials.map((material) => material.id).join(','),
    });
    navigate(`${ROUTES.PROJECT.HANDOVER_CREATE}?${query.toString()}`);
  };
  const tableViewportRef = useMaterialTableMainColumnWidth(table);
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
  const handleDelete = () => {
    if (!canManage || deletingMaterials.length === 0) return;
    deleteMutation.mutate(deletingMaterials, {
      onSuccess: () => {
        toast.success(
          deletingMaterials.length === 1
            ? intl.formatMessage(
                { id: 'project.materials.toasts.deleted' },
                {
                  name:
                    deletingMaterials[0].nameOverride?.trim() ||
                    deletingMaterials[0].modelSnapshot.name,
                },
              )
            : intl.formatMessage(
                { id: 'project.materials.toasts.deletedMultiple' },
                { count: deletingMaterials.length },
              ),
        );
        setDeletingMaterials([]);
        table.resetRowSelection();
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });
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
        isLoading={
          isPermissionsPending ||
          (canView &&
            (query.isPending ||
              partiesQuery.isPending ||
              groupsQuery.isPending))
        }
        isFetching={
          query.isFetching || partiesQuery.isFetching || groupsQuery.isFetching
        }
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
                <SearchInput
                  aria-label={intl.formatMessage({
                    id: 'project.materials.filters.search',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.materials.filters.search',
                  })}
                  value={search}
                  className="w-64 shrink-0"
                  onSearch={(value) => {
                    setSearch(value);
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
            ) : query.isError || partiesQuery.isError || groupsQuery.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: query.isError
                    ? 'project.materials.errors.loadTitle'
                    : 'project.materials.errors.loadFiltersTitle',
                })}
                description={getApiErrorMessage(
                  query.error ?? partiesQuery.error ?? groupsQuery.error,
                )}
                onRetry={() => {
                  void query.refetch();
                  void partiesQuery.refetch();
                  void groupsQuery.refetch();
                }}
              />
            ) : (
              <ScrollArea className="h-full" viewportRef={tableViewportRef}>
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardTable>
          <CardFooter className="justify-between">
            {canView &&
            !isPermissionsPending &&
            !query.isError &&
            !partiesQuery.isError &&
            !groupsQuery.isError ? (
              <DataGridPagination />
            ) : null}
          </CardFooter>
        </Card>
        <DataGridActionBar
          selectionLabel={(count) =>
            intl.formatMessage(
              { id: 'project.materials.bulk.selectedCount' },
              { count },
            )
          }
        >
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={selectedMaterials.some((material) =>
              Boolean(material.reservedHandoverId),
            )}
            onClick={handleBulkHandover}
          >
            <Handshake />
            {intl.formatMessage({ id: 'project.materials.bulk.handover' })}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={() => setDeletingMaterials(selectedMaterials)}
          >
            <Trash2 />
            {intl.formatMessage({ id: 'project.materials.bulk.delete' })}
          </Button>
        </DataGridActionBar>
      </DataGrid>
      <ConfirmDialog
        open={deletingMaterials.length > 0}
        onOpenChange={(open) => !open && setDeletingMaterials([])}
        title={intl.formatMessage({
          id:
            deletingMaterials.length > 1
              ? 'project.materials.bulk.deleteTitle'
              : 'project.materials.dialogs.deleteTitle',
        })}
        description={
          deletingMaterials.length > 1
            ? intl.formatMessage(
                { id: 'project.materials.bulk.deleteDescription' },
                { count: deletingMaterials.length },
              )
            : intl.formatMessage(
                { id: 'project.materials.dialogs.deleteDescription' },
                {
                  name:
                    deletingMaterials[0]?.nameOverride?.trim() ||
                    deletingMaterials[0]?.modelSnapshot.name ||
                    '',
                },
              )
        }
        confirmLabel={
          deletingMaterials.length > 1
            ? intl.formatMessage(
                { id: 'project.materials.bulk.deleteConfirm' },
                { count: deletingMaterials.length },
              )
            : intl.formatMessage({
                id: 'project.materials.dialogs.deleteConfirm',
              })
        }
        confirmVariant="destructive"
        isConfirming={deleteMutation.isPending}
        closeOnConfirm={false}
        onConfirm={handleDelete}
      />
    </div>
  );
}
