import { useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import type { EpsEmployeeCatalogEntry } from '@/project/custodians/model/custodian';
import {
  MaterialGroupFilterSidebar,
  MaterialGroupFilterToggle,
} from '@/project/material-groups/components/material-group-filter-tree';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
import type { MaterialGroup } from '@/project/material-groups/model/material-group';
import { getMaterialGroupDescendantIds } from '@/project/material-groups/model/material-group-tree';
import {
  MATERIAL_LABEL_SELECTION_STATE_KEY,
  storeMaterialLabelSelection,
} from '@/project/material-labels/utils/material-label-print-selection';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { Copy, Download, QrCode } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridActionBar } from '@/components/ui/data-grid-action-bar';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridHeaderMenu } from '@/components/ui/data-grid-header-menu';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { MaterialFilterRow } from '../components/material-filter-row';
import type { MaterialFilterMode } from '../components/material-filter-row';
import { MaterialQrCodeDialog } from '../components/material-qr-code-dialog';
import { useMaterialQrTrackingMetricsQuery } from '../hooks/use-material-qr-tracking';
import {
  useMaterialQrTrackingFilterSummaryQuery,
  useMaterialsQuery,
  useUpdateMaterialAvailabilityMutation,
} from '../hooks/use-materials';
import type {
  Material,
  MaterialListFilters,
  MaterialOwnerFilterType,
} from '../model/material';
import { MATERIAL_PERMISSION_CODES } from '../model/material-permissions';
import type {
  MaterialQrTrackingMetric,
  MaterialQrTrackingRow,
} from '../model/material-qr-tracking';
import {
  MATERIAL_QR_TRACKING_ROW_COLUMN_PINNING,
  useMaterialQrTrackingColumns,
} from '../table/material-qr-tracking.columns.generated';
import {
  copyMaterialQrUrl,
  copyMaterialQrUrls,
  downloadMaterialQrPngs,
  getMaterialDetailUrl,
} from '../utils/material-qr';

const DEFAULT_PAGE_SIZE = 25;
type MaterialQrTrackingBulkAction = 'downloadPng' | 'copyQr' | 'printQr' | '';
const EMPTY_MATERIALS: Material[] = [];
const EMPTY_MATERIAL_GROUPS: MaterialGroup[] = [];
const EMPTY_METRICS: MaterialQrTrackingMetric[] = [];

export function MaterialQrTrackingPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const [isGroupTreeOpen, setIsGroupTreeOpen] = useState(true);
  const [filterMode, setFilterMode] = useState<MaterialFilterMode>('scan');
  const [scanState, setScanState] = useState<
    'scanned' | 'not_scanned' | undefined
  >();
  const [ownerType, setOwnerType] = useState<MaterialOwnerFilterType | ''>('');
  const [ownerDepartmentId, setOwnerDepartmentId] = useState('');
  const [ownerTeamId, setOwnerTeamId] = useState('');
  const [ownerPartyId, setOwnerPartyId] = useState('');
  const [selectedOwnerEmployee, setSelectedOwnerEmployee] =
    useState<EpsEmployeeCatalogEntry | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<
    MaterialQrTrackingRow[]
  >([]);
  const [bulkAction, setBulkAction] =
    useState<MaterialQrTrackingBulkAction>('');
  const [isApplyingBulkAction, setIsApplyingBulkAction] = useState(false);
  const [qrDialogMaterial, setQrDialogMaterial] = useState<Material | null>(
    null,
  );
  const [pendingAvailabilityIds, setPendingAvailabilityIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const partiesQuery = useCustodiansQuery(
    true,
    canView && !isPermissionsPending,
  );
  const groupsQuery = useMaterialGroupsQuery(isPermissionsPending || canView);
  const groups = groupsQuery.data ?? EMPTY_MATERIAL_GROUPS;
  const groupIds = useMemo(
    () =>
      groupId ? [...getMaterialGroupDescendantIds(groups, groupId)] : undefined,
    [groupId, groups],
  );
  const filters = useMemo<MaterialListFilters>(
    () => ({
      search: search.trim() || undefined,
      ownerPartyId: ownerPartyId || undefined,
      groupIds,
      scanState,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [
      ownerPartyId,
      groupIds,
      pagination.pageIndex,
      pagination.pageSize,
      scanState,
      search,
    ],
  );
  const filterSummary = useMaterialQrTrackingFilterSummaryQuery(
    {
      search: search.trim() || undefined,
      ownerPartyId: ownerPartyId || undefined,
      groupIds,
    },
    canView && !isPermissionsPending,
  );
  const materialsQuery = useMaterialsQuery(
    filters,
    canView && !isPermissionsPending,
  );
  const materials = materialsQuery.data?.items ?? EMPTY_MATERIALS;
  const materialIds = useMemo(
    () => materials.map((material) => material.id),
    [materials],
  );
  const metricsQuery = useMaterialQrTrackingMetricsQuery(
    materialIds,
    canView && !isPermissionsPending,
  );
  const metrics = metricsQuery.data ?? EMPTY_METRICS;
  const metricsById = useMemo(
    () => new Map(metrics.map((metric) => [metric.materialId, metric])),
    [metrics],
  );
  const rows = useMemo<MaterialQrTrackingRow[]>(() => {
    if (!metricsQuery.data) return [];
    return materials.flatMap((material) => {
      const metric = metricsById.get(material.id);
      return metric ? [{ ...material, ...metric }] : [];
    });
  }, [materials, metricsById, metricsQuery.data]);
  const total = materialsQuery.data?.total ?? 0;
  const resetPage = () =>
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  const handleFilterModeChange = (nextMode: MaterialFilterMode) => {
    if (nextMode === filterMode) return;
    if (nextMode === 'scan') {
      setOwnerType('');
      setOwnerDepartmentId('');
      setOwnerTeamId('');
      setOwnerPartyId('');
      setSelectedOwnerEmployee(null);
    } else {
      setScanState(undefined);
    }
    setFilterMode(nextMode);
    resetPage();
  };
  const handleOwnerTypeChange = (nextType: MaterialOwnerFilterType | '') => {
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
    setOwnerPartyId(
      teamId || (ownerType === 'department' ? ownerDepartmentId : ''),
    );
    resetPage();
  };
  const handleOwnerPartyIdChange = (partyId: string) => {
    setOwnerPartyId(partyId);
    if (ownerType !== 'person') setSelectedOwnerEmployee(null);
    resetPage();
  };
  const availabilityMutation = useUpdateMaterialAvailabilityMutation();
  const navigateToLabelPrint = (materialIds: readonly string[]) => {
    const selectionKey = storeMaterialLabelSelection(materialIds);
    navigate(ROUTES.PROJECT.MATERIAL_LABEL_PRINT, {
      state: { [MATERIAL_LABEL_SELECTION_STATE_KEY]: selectionKey },
    });
  };
  const handleCopyLink = async (materialId: string) => {
    try {
      await copyMaterialQrUrl(materialId);
      toast.success(
        intl.formatMessage({
          id: 'project.materialQrTracking.toasts.linkCopied',
        }),
      );
    } catch {
      toast.error(
        intl.formatMessage({
          id: 'project.materialQrTracking.errors.copyLink',
        }),
      );
    }
  };
  const handleApplyBulkAction = async () => {
    if (!canView || selectedMaterials.length === 0 || !bulkAction) return;

    setIsApplyingBulkAction(true);
    try {
      switch (bulkAction) {
        case 'downloadPng':
          await downloadMaterialQrPngs(selectedMaterials);
          toast.success(
            intl.formatMessage(
              { id: 'project.materialQrTracking.toasts.pngsDownloaded' },
              { count: selectedMaterials.length },
            ),
          );
          break;
        case 'copyQr':
          await copyMaterialQrUrls(
            selectedMaterials.map((material) => material.id),
          );
          toast.success(
            intl.formatMessage(
              { id: 'project.materialQrTracking.toasts.qrLinksCopied' },
              { count: selectedMaterials.length },
            ),
          );
          break;
        case 'printQr':
          navigateToLabelPrint(
            selectedMaterials.map((material) => material.id),
          );
          break;
      }
    } catch {
      toast.error(
        intl.formatMessage({
          id:
            bulkAction === 'downloadPng'
              ? 'project.materialQrTracking.errors.downloadSelectedPngs'
              : bulkAction === 'copyQr'
                ? 'project.materialQrTracking.errors.copySelectedQr'
                : 'project.materialQrTracking.errors.printSelectedQr',
        }),
      );
    } finally {
      setIsApplyingBulkAction(false);
      setBulkAction('');
    }
  };
  const columns = useMaterialQrTrackingColumns({
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
    onOpenQr: setQrDialogMaterial,
    onViewQr: setQrDialogMaterial,
    onOpen: (material) =>
      window.open(
        getMaterialDetailUrl(material.id),
        '_blank',
        'noopener,noreferrer',
      ),
    onCopyLink: (material) => void handleCopyLink(material.id),
  });
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    rowCount: total,
    enableRowSelection: canView,
    state: {
      pagination,
      columnPinning: MATERIAL_QR_TRACKING_ROW_COLUMN_PINNING,
      columnVisibility: { select: canView },
      rowSelection,
    },
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
  });
  const isMetricsPending = materialIds.length > 0 && metricsQuery.isPending;
  const isMetricsError = materialIds.length > 0 && metricsQuery.isError;
  const isLoading =
    isPermissionsPending ||
    (canView && (materialsQuery.isPending || isMetricsPending));
  const isError = materialsQuery.isError || isMetricsError;

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({
          id: 'project.materialQrTracking.page.title',
        })}
        icon={QrCode}
      />
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <MaterialGroupFilterToggle
          isOpen={isGroupTreeOpen}
          controlsId="material-qr-tracking-group-tree"
          disabled={!canView || isPermissionsPending || groupsQuery.isPending}
          onClick={() => setIsGroupTreeOpen((current) => !current)}
        />
        <div className="min-w-0 flex-1">
          <MaterialFilterRow
            mode={filterMode}
            onModeChange={handleFilterModeChange}
            availableModes={['scan', 'owner']}
            counts={filterSummary.data}
            isCountsLoading={filterSummary.isPending && !filterSummary.data}
            ownerFilter={filterSummary.data?.ownerFilter}
            isActive={undefined}
            onIsActiveChange={() => undefined}
            condition={undefined}
            onConditionChange={() => undefined}
            scanState={scanState}
            onScanStateChange={(value) => {
              setScanState(value);
              resetPage();
            }}
            ownerType={ownerType}
            onOwnerTypeChange={handleOwnerTypeChange}
            ownerDepartmentId={ownerDepartmentId}
            onOwnerDepartmentChange={handleOwnerDepartmentChange}
            ownerTeamId={ownerTeamId}
            onOwnerTeamChange={handleOwnerTeamChange}
            ownerPartyId={ownerPartyId}
            onOwnerPartyIdChange={handleOwnerPartyIdChange}
            selectedEmployee={selectedOwnerEmployee}
            onSelectedEmployeeChange={setSelectedOwnerEmployee}
            parties={partiesQuery.data ?? []}
            disabled={
              isPermissionsPending ||
              !canView ||
              partiesQuery.isPending ||
              (filterSummary.isPending && !filterSummary.data)
            }
          />
        </div>
      </div>
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isLoading}
        isFetching={
          materialsQuery.isFetching ||
          metricsQuery.isFetching ||
          filterSummary.isFetching ||
          partiesQuery.isFetching
        }
        emptyMessage={intl.formatMessage({
          id: search
            ? 'project.materialQrTracking.empty.search'
            : 'project.materialQrTracking.empty.list',
        })}
        tableLayout={{ dense: true }}
      >
        <div
          className={`flex min-h-0 min-w-0 flex-1 flex-col transition-[gap] duration-300 ease-in-out motion-reduce:transition-none xl:flex-row ${isGroupTreeOpen ? 'gap-3' : 'gap-0'}`}
        >
          <MaterialGroupFilterSidebar
            id="material-qr-tracking-group-tree"
            isOpen={isGroupTreeOpen}
            groups={groups}
            selectedGroupId={groupId || null}
            onSelectGroup={(nextGroupId) => {
              setGroupId(nextGroupId ?? '');
              resetPage();
            }}
          />
          <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
            <DataGridHeader
              variant="stats"
              recordCountLabel={intl.formatMessage({
                id: 'project.materialQrTracking.list.recordCountLabel',
              })}
              stats={
                <SearchInput
                  aria-label={intl.formatMessage({
                    id: 'project.materialQrTracking.filters.search',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.materialQrTracking.filters.search',
                  })}
                  value={search}
                  className="w-64 shrink-0"
                  onSearch={(value) => {
                    setSearch(value);
                    setPagination((current) => ({ ...current, pageIndex: 0 }));
                  }}
                />
              }
              toolbar={<DataGridHeaderMenu table={table} />}
            />
            <CardTable className="min-h-0 flex-1">
              {!isPermissionsPending && !canView ? (
                <ErrorState
                  title={intl.formatMessage({
                    id: 'project.materialQrTracking.errors.loadTitle',
                  })}
                  description={intl.formatMessage({
                    id: 'project.materialQrTracking.errors.authorization',
                  })}
                />
              ) : isError ? (
                <ErrorState
                  title={intl.formatMessage({
                    id: 'project.materialQrTracking.errors.loadTitle',
                  })}
                  description={getApiErrorMessage(
                    materialsQuery.error ?? metricsQuery.error,
                    {
                      fallbackMessage: intl.formatMessage({
                        id: 'project.materialQrTracking.errors.load',
                      }),
                    },
                  )}
                  onRetry={() => {
                    void materialsQuery.refetch();
                    if (materialIds.length > 0) void metricsQuery.refetch();
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
              {canView && !isPermissionsPending && !isError ? (
                <DataGridPagination />
              ) : null}
            </CardFooter>
          </Card>
        </div>
        <DataGridActionBar
          onSelectionChange={setSelectedMaterials}
          selectionLabel={(count) =>
            intl.formatMessage(
              { id: 'project.materials.bulk.selectedCount' },
              { count },
            )
          }
        >
          <OptionSelect
            value={bulkAction}
            onChange={(value) =>
              setBulkAction(value as MaterialQrTrackingBulkAction)
            }
            options={[
              {
                value: 'downloadPng',
                label: intl.formatMessage({
                  id: 'project.materialQrTracking.bulk.downloadPng',
                }),
              },
              {
                value: 'copyQr',
                label: intl.formatMessage({
                  id: 'project.materialQrTracking.bulk.copyQr',
                }),
              },
              {
                value: 'printQr',
                label: intl.formatMessage({
                  id: 'project.materials.bulk.printQr',
                }),
              },
            ]}
            placeholder={intl.formatMessage({
              id: 'project.materials.bulk.chooseAction',
            })}
            ariaLabel={intl.formatMessage({
              id: 'project.materials.bulk.chooseAction',
            })}
            searchable={false}
            size="md"
            className="w-56"
            renderOption={(option) => {
              const Icon =
                option.value === 'downloadPng'
                  ? Download
                  : option.value === 'copyQr'
                    ? Copy
                    : QrCode;

              return (
                <span className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0" />
                  <span>{option.label}</span>
                </span>
              );
            }}
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={isApplyingBulkAction}
            loadingText={intl.formatMessage({
              id: 'project.materialQrTracking.bulk.applying',
            })}
            disabled={!bulkAction || isApplyingBulkAction}
            onClick={() => void handleApplyBulkAction()}
          >
            {intl.formatMessage({ id: 'project.materials.bulk.apply' })}
          </Button>
        </DataGridActionBar>
      </DataGrid>
      <MaterialQrCodeDialog
        material={qrDialogMaterial}
        onOpenChange={(open) => !open && setQrDialogMaterial(null)}
        onPrint={(material) => navigateToLabelPrint([material.id])}
      />
    </div>
  );
}
