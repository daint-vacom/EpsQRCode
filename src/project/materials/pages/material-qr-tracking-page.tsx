import { useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
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
import { MaterialQrCodeDialog } from '../components/material-qr-code-dialog';
import { useMaterialQrTrackingMetricsQuery } from '../hooks/use-material-qr-tracking';
import {
  useMaterialsQuery,
  useUpdateMaterialAvailabilityMutation,
} from '../hooks/use-materials';
import type { Material, MaterialListFilters } from '../model/material';
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
const EMPTY_METRICS: MaterialQrTrackingMetric[] = [];

export function MaterialQrTrackingPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const [search, setSearch] = useState('');
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
  const filters = useMemo<MaterialListFilters>(
    () => ({
      search: search.trim() || undefined,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [pagination.pageIndex, pagination.pageSize, search],
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
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isLoading}
        isFetching={materialsQuery.isFetching || metricsQuery.isFetching}
        emptyMessage={intl.formatMessage({
          id: search
            ? 'project.materialQrTracking.empty.search'
            : 'project.materialQrTracking.empty.list',
        })}
        tableLayout={{ dense: true }}
      >
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
