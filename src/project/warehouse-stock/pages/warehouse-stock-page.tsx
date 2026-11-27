import { useCallback, useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import {
  MaterialGroupFilterLayout,
  MaterialGroupFilterLayoutProvider,
  MaterialGroupFilterSidebar,
  MaterialGroupFilterToggle,
} from '@/project/material-groups/components/material-group-filter-tree';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
import { getMaterialGroupDescendantIds } from '@/project/material-groups/model/material-group-tree';
import {
  MATERIAL_LABEL_SELECTION_STATE_KEY,
  storeMaterialLabelSelection,
} from '@/project/material-labels/utils/material-label-print-selection';
import { MaterialGroupedTable } from '@/project/materials/components/material-grouped-table';
import { MaterialGroupingControls } from '@/project/materials/components/material-grouping-controls';
import { MaterialQrCodeDialog } from '@/project/materials/components/material-qr-code-dialog';
import {
  useGroupedMaterialsQuery,
  useMaterialsQuery,
} from '@/project/materials/hooks/use-materials';
import {
  DEFAULT_MATERIAL_GROUPING_CONFIG,
  type Material,
  type MaterialGroupingConfig,
  type MaterialListFilters,
} from '@/project/materials/model/material';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import {
  MATERIAL_COLUMN_PINNING,
  useMaterialColumns,
} from '@/project/materials/table/material.columns.generated';
import { MaterialReceiptSelect } from '@/project/receipts/components/material-receipt-select';
import { MATERIAL_RECEIPT_PERMISSION_CODES } from '@/project/receipts/model/material-receipt';
import type { MaterialReceiptSelectOption } from '@/project/receipts/model/material-receipt';
import { FilterCountChips } from '@/project/shared/filter-count-chips';
import { ProjectFilterModeSwitcher } from '@/project/shared/project-filter-mode.generated';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowLeft } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { PROJECT_FEATURE_ICONS } from '@/config/project-feature-icons';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridHeaderMenu } from '@/components/ui/data-grid-header-menu';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  useWarehouseStockReceiptCodesQuery,
  useWarehouseStockSummaryQuery,
} from '../hooks/use-warehouse-stock';

const PAGE_SIZE = 25;
const EMPTY_PENDING_AVAILABILITY_IDS: ReadonlySet<string> = new Set();
const EMPTY_GROUPS: NonNullable<
  ReturnType<typeof useMaterialGroupsQuery>['data']
> = [];
const EMPTY_MATERIALS: Material[] = [];
const MATERIAL_TABLE_LAYOUT = {
  dense: true,
  fillColumn: { id: 'identity', minWidth: 260 },
};

export function WarehouseStockPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canViewReceipts = hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.view);
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const filterModes = [
    {
      value: 'warehouse' as const,
      label: intl.formatMessage({
        id: 'warehouseStock.filters.mode.warehouse',
      }),
    },
    {
      value: 'receipt' as const,
      label: intl.formatMessage({
        id: 'warehouseStock.filters.mode.receipt',
      }),
    },
  ];
  const [selectedFilterMode, setFilterMode] =
    useState<(typeof filterModes)[number]['value']>();
  const filterMode = selectedFilterMode ?? filterModes[0].value;
  const [selectedReceipt, setSelectedReceipt] =
    useState<MaterialReceiptSelectOption>();
  const [groupId, setGroupId] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [groupPagination, setGroupPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [groupKey, setGroupKey] = useState<string>();
  const [groupingEnabled, setGroupingEnabled] = useState(false);
  const [groupingConfig, setGroupingConfig] = useState<MaterialGroupingConfig>(
    DEFAULT_MATERIAL_GROUPING_CONFIG,
  );
  const [qrDialogMaterial, setQrDialogMaterial] = useState<Material | null>(
    null,
  );
  const queryEnabled = canView && !isPermissionsPending;
  const groupsQuery = useMaterialGroupsQuery(queryEnabled);
  const partiesQuery = useCustodiansQuery(false, queryEnabled);
  const groups = groupsQuery.data ?? EMPTY_GROUPS;
  const groupIds = useMemo(
    () =>
      groupId ? [...getMaterialGroupDescendantIds(groups, groupId)] : undefined,
    [groupId, groups],
  );
  const materialFilters = useMemo<MaterialListFilters>(
    () => ({
      ownerKind: 'warehouse',
      status: 'available',
      ...(filterMode === 'warehouse' && warehouseId
        ? { ownerPartyId: warehouseId }
        : {}),
      ...(filterMode === 'receipt' && selectedReceipt
        ? { receiptId: selectedReceipt.id }
        : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(groupIds ? { groupIds } : {}),
    }),
    [filterMode, groupIds, search, selectedReceipt, warehouseId],
  );
  const summaryFilters = useMemo(
    () => ({
      mode: filterMode,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(groupIds ? { groupIds } : {}),
      ...(filterMode === 'warehouse' && warehouseId ? { warehouseId } : {}),
      ...(filterMode === 'receipt' && selectedReceipt
        ? { receiptId: selectedReceipt.id }
        : {}),
    }),
    [filterMode, groupIds, search, selectedReceipt, warehouseId],
  );
  const stockQueryEnabled =
    queryEnabled &&
    (filterMode === 'warehouse' ||
      (canViewReceipts && Boolean(selectedReceipt)));
  const showGroups = groupingEnabled && groupKey === undefined;
  const materialsQuery = useMaterialsQuery(
    {
      ...materialFilters,
      page: pageIndex + 1,
      pageSize: PAGE_SIZE,
      ...(groupingEnabled && groupKey !== undefined
        ? { groupBy: groupingConfig, groupKey }
        : {}),
    },
    stockQueryEnabled && !showGroups,
  );
  const groupedQuery = useGroupedMaterialsQuery(
    materialFilters,
    groupingConfig,
    groupPagination.pageIndex + 1,
    groupPagination.pageSize,
    stockQueryEnabled && showGroups,
  );
  const stockSummaryQuery = useWarehouseStockSummaryQuery(
    summaryFilters,
    queryEnabled,
  );
  const rawItems = materialsQuery.data?.items ?? EMPTY_MATERIALS;
  const receiptCodesQuery = useWarehouseStockReceiptCodesQuery(
    rawItems.map((material) => material.id),
    stockQueryEnabled && canViewReceipts && !showGroups,
  );
  const items = useMemo(
    () =>
      rawItems.map((material) => ({
        ...material,
        receiptCode: receiptCodesQuery.data?.[material.id] ?? null,
      })),
    [rawItems, receiptCodesQuery.data],
  );
  const total = materialsQuery.data?.total ?? 0;
  const groupNameById = useMemo(
    () =>
      new Map((groupsQuery.data ?? []).map((group) => [group.id, group.name])),
    [groupsQuery.data],
  );
  const partyNameById = useMemo(
    () =>
      new Map((partiesQuery.data ?? []).map((party) => [party.id, party.name])),
    [partiesQuery.data],
  );
  const warehouses = useMemo(
    () =>
      (partiesQuery.data ?? []).filter(
        (party) => party.type === 'warehouse' && party.isActive,
      ),
    [partiesQuery.data],
  );
  const groupCountById = useMemo(
    () =>
      new Map(
        Object.entries(stockSummaryQuery.data?.groupCounts ?? {}).map(
          ([id, count]) => [id, Number(count)],
        ),
      ),
    [stockSummaryQuery.data?.groupCounts],
  );
  const onView = useCallback((material: Material) => {
    window.open(
      buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, { id: material.id }),
      '_blank',
      'noopener,noreferrer',
    );
  }, []);
  const onPrint = useCallback(
    (material: Material) => {
      const selectionKey = storeMaterialLabelSelection([material.id]);
      navigate(ROUTES.PROJECT.MATERIAL_LABEL_PRINT, {
        state: { [MATERIAL_LABEL_SELECTION_STATE_KEY]: selectionKey },
      });
    },
    [navigate],
  );
  const noAvailabilityChange = useCallback(() => undefined, []);
  const noMaterialAction = useCallback((_material: Material) => undefined, []);
  const columns = useMaterialColumns({
    partyNameById,
    groupNameById,
    canManage: false,
    pendingAvailabilityIds: EMPTY_PENDING_AVAILABILITY_IDS,
    onAvailabilityChange: noAvailabilityChange,
    onOpenQr: setQrDialogMaterial,
    onView,
    onEdit: noMaterialAction,
    onHandover: noMaterialAction,
    onDelete: noMaterialAction,
    onPrint,
  });
  const receiptColumn = useMemo(
    () =>
      createColumnHelpers<Material>().text({
        id: 'receiptCode',
        get: (material) => material.receiptCode,
        header: intl.formatMessage({
          id: 'warehouseStock.columns.receipt',
        }),
        size: 190,
        enableSorting: false,
      }),
    [intl],
  );
  const stockColumns = useMemo(() => {
    const actionIndex = columns.findIndex((column) => column.id === 'actions');
    const next = [...columns];
    next.splice(actionIndex < 0 ? next.length : actionIndex, 0, receiptColumn);
    return next;
  }, [columns, receiptColumn]);
  const table = useReactTable({
    data: items,
    columns: stockColumns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    rowCount: total,
    enableRowSelection: false,
    state: {
      pagination: { pageIndex, pageSize: PAGE_SIZE },
      columnPinning: MATERIAL_COLUMN_PINNING,
      columnVisibility: { select: false },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize: PAGE_SIZE })
          : updater;
      setPageIndex(next.pageIndex);
    },
  });
  const emptyMessage = intl.formatMessage({
    id:
      search || warehouseId || selectedReceipt
        ? 'warehouseStock.empty.search'
        : 'warehouseStock.empty.list',
  });
  const resetPagination = () => {
    setPageIndex(0);
    setGroupPagination((pagination) => ({ ...pagination, pageIndex: 0 }));
    setGroupKey(undefined);
  };
  const materialError = showGroups
    ? null
    : (materialsQuery.error ?? receiptCodesQuery.error);
  const catalogError =
    groupsQuery.error ?? partiesQuery.error ?? stockSummaryQuery.error;

  return (
    <MaterialGroupFilterLayoutProvider>
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
        <PageHeader
          title={intl.formatMessage({ id: 'warehouseStock.page.title' })}
          icon={PROJECT_FEATURE_ICONS.warehouseStock}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <MaterialGroupFilterToggle
            controlsId="warehouse-stock-group-filter-tree"
            disabled={!queryEnabled || groupsQuery.isPending}
          />
          <ProjectFilterModeSwitcher
            value={filterMode}
            onValueChange={(value) => {
              setFilterMode(
                filterModes.find((option) => option.value === value)?.value,
              );
              resetPagination();
            }}
            options={filterModes}
            className="shrink-0"
            disabled={!queryEnabled}
          />
          <span
            className="hidden h-5 w-px bg-border sm:block"
            aria-hidden="true"
          />
          {filterMode === 'warehouse' ? (
            <FilterCountChips
              ariaLabel={intl.formatMessage({
                id: 'project.management.filters.warehouse',
              })}
              value={warehouseId}
              onValueChange={(value) => {
                setWarehouseId(value);
                resetPagination();
              }}
              disabled={!queryEnabled || partiesQuery.isPending}
              options={[
                {
                  value: '',
                  label: intl.formatMessage({
                    id: 'project.management.filters.all',
                  }),
                  count: stockSummaryQuery.data?.total,
                },
                ...warehouses.map((warehouse) => ({
                  value: warehouse.id,
                  label: warehouse.name,
                  count: stockSummaryQuery.data?.warehouses[warehouse.id] ?? 0,
                })),
              ]}
            />
          ) : (
            <MaterialReceiptSelect
              value={selectedReceipt?.id ?? ''}
              selectedReceipt={selectedReceipt}
              onSelect={(receipt) => {
                setSelectedReceipt(receipt);
                resetPagination();
              }}
              disabled={!queryEnabled || !canViewReceipts}
              ariaLabel={intl.formatMessage({
                id: 'warehouseStock.filters.receipt',
              })}
              placeholder={intl.formatMessage({
                id: 'warehouseStock.filters.receiptPlaceholder',
              })}
              className="w-72 shrink-0"
              statuses={['draft', 'handover']}
            />
          )}
        </div>
        <DataGrid
          table={table}
          recordCount={showGroups ? (groupedQuery.data?.total ?? 0) : total}
          isLoading={
            isPermissionsPending ||
            (queryEnabled &&
              ((stockQueryEnabled && materialsQuery.isPending) ||
                groupsQuery.isPending ||
                partiesQuery.isPending ||
                stockSummaryQuery.isPending ||
                receiptCodesQuery.isFetching))
          }
          isFetching={
            materialsQuery.isFetching ||
            groupsQuery.isFetching ||
            partiesQuery.isFetching ||
            stockSummaryQuery.isFetching ||
            receiptCodesQuery.isFetching
          }
          emptyMessage={emptyMessage}
          tableLayout={MATERIAL_TABLE_LAYOUT}
        >
          <MaterialGroupFilterLayout>
            <MaterialGroupFilterSidebar
              id="warehouse-stock-group-filter-tree"
              animateSize
              groups={groups}
              selectedGroupId={groupId || null}
              onSelectGroup={(nextGroupId) => {
                setGroupId(nextGroupId ?? '');
                resetPagination();
              }}
              countByNode={groupCountById}
              allCount={stockSummaryQuery.data?.groupTotal ?? 0}
            />
            <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
              <DataGridHeader
                variant="stats"
                recordCountLabel={intl.formatMessage({
                  id: showGroups
                    ? 'project.materials.grouping.groups'
                    : 'warehouseStock.page.title',
                })}
                stats={
                  <SearchInput
                    aria-label={intl.formatMessage({
                      id: 'warehouseStock.search.label',
                    })}
                    placeholder={intl.formatMessage({
                      id: 'warehouseStock.search.label',
                    })}
                    value={search}
                    onSearch={(value) => {
                      setSearch(value);
                      resetPagination();
                    }}
                    className="w-72 shrink-0"
                  />
                }
                toolbar={
                  <>
                    <MaterialGroupingControls
                      enabled={groupingEnabled}
                      config={groupingConfig}
                      disabled={!stockQueryEnabled}
                      onEnabledChange={(enabled) => {
                        setGroupingEnabled(enabled);
                        resetPagination();
                      }}
                      onApply={(config) => {
                        setGroupingConfig(config);
                        resetPagination();
                      }}
                    />
                    {!showGroups && <DataGridHeaderMenu table={table} />}
                  </>
                }
              />
              {groupingEnabled && groupKey !== undefined && (
                <div className="flex items-center gap-3 border-b px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setGroupKey(undefined);
                      setPageIndex(0);
                    }}
                  >
                    <ArrowLeft />
                    {intl.formatMessage({
                      id: 'project.materials.grouping.backToGroups',
                    })}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {intl.formatMessage({
                      id: 'warehouseStock.grouping.detail',
                    })}
                  </span>
                </div>
              )}
              {showGroups && stockQueryEnabled && !catalogError ? (
                <MaterialGroupedTable
                  groups={groupedQuery.data?.items ?? []}
                  total={groupedQuery.data?.total ?? 0}
                  pagination={groupPagination}
                  setPagination={setGroupPagination}
                  groupNameById={groupNameById}
                  receiptColumnHeader={intl.formatMessage({
                    id: 'warehouseStock.columns.receipt',
                  })}
                  onOpenGroup={(key) => {
                    setGroupKey(key);
                    setPageIndex(0);
                  }}
                  isLoading={groupedQuery.isPending}
                  error={groupedQuery.isError}
                  onRetry={() => void groupedQuery.refetch()}
                />
              ) : (
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
                  ) : filterMode === 'receipt' && !canViewReceipts ? (
                    <ErrorState
                      title={intl.formatMessage({
                        id: 'warehouseStock.errors.receiptsPermissionTitle',
                      })}
                      description={intl.formatMessage({
                        id: 'warehouseStock.errors.receiptsPermission',
                      })}
                    />
                  ) : materialError || catalogError ? (
                    <ErrorState
                      title={intl.formatMessage({
                        id: materialError
                          ? 'warehouseStock.errors.loadTitle'
                          : 'project.materials.errors.loadFiltersTitle',
                      })}
                      description={getApiErrorMessage(
                        materialError ?? catalogError,
                      )}
                      onRetry={() => {
                        if (stockQueryEnabled && !showGroups) {
                          void materialsQuery.refetch();
                          if (canViewReceipts && rawItems.length > 0) {
                            void receiptCodesQuery.refetch();
                          }
                        }
                        void groupsQuery.refetch();
                        void partiesQuery.refetch();
                        void stockSummaryQuery.refetch();
                      }}
                    />
                  ) : (
                    <ScrollArea className="h-full">
                      {filterMode === 'receipt' && !selectedReceipt ? (
                        <div className="flex min-h-32 items-center justify-center px-4 text-sm text-muted-foreground">
                          {intl.formatMessage({
                            id: 'warehouseStock.filters.selectReceiptHint',
                          })}
                        </div>
                      ) : (
                        <DataGridTable />
                      )}
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  )}
                </CardTable>
              )}
              {!showGroups && (
                <CardFooter className="justify-between">
                  {queryEnabled && !materialError && !catalogError && (
                    <DataGridPagination />
                  )}
                </CardFooter>
              )}
            </Card>
          </MaterialGroupFilterLayout>
        </DataGrid>
        <MaterialQrCodeDialog
          material={qrDialogMaterial}
          open={qrDialogMaterial !== null}
          onOpenChange={(open) => {
            if (!open) setQrDialogMaterial(null);
          }}
        />
      </div>
    </MaterialGroupFilterLayoutProvider>
  );
}
