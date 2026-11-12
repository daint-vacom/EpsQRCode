import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import type { EpsEmployeeCatalogEntry } from '@/project/custodians/model/custodian';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
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
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Download,
  Handshake,
  Plus,
  QrCode,
  Trash2,
  Upload,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Badge } from '@/components/ui/badge';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MaterialFilterRow,
  type MaterialFilterMode,
} from '../components/material-filter-row';
import { MaterialHandoverPreflightDialogShell } from '../components/material-handover-preflight-dialog-shell.generated';
import { MaterialQrCodeDialog } from '../components/material-qr-code-dialog';
import {
  MaterialSpreadsheetExportDialog,
  MaterialSpreadsheetImportDialog,
} from '../components/material-spreadsheet-dialog';
import {
  useDeleteMaterialMutation,
  useMaterialFilterSummaryQuery,
  useMaterialsQuery,
  useUpdateMaterialAvailabilityMutation,
} from '../hooks/use-materials';
import type {
  Material,
  MaterialCondition,
  MaterialListFilters,
  MaterialOwnerFilterType,
  MaterialStatus,
} from '../model/material';
import { MATERIAL_PERMISSION_CODES } from '../model/material-permissions';
import {
  MATERIAL_COLUMN_PINNING,
  useMaterialColumns,
} from '../table/material.columns.generated';
import { useMaterialTableMainColumnWidth } from '../table/use-material-table-main-column-width';

const DEFAULT_PAGE_SIZE = 25;
type MaterialBulkAction = 'printQr' | 'handover' | 'delete' | '';

function getMaterialOwnerIdentity(material: Material): string | null {
  const snapshot = material.ownerSnapshot;
  if (snapshot.kind === 'other') {
    const scopePartyId = snapshot.scopePartyId?.trim();
    const name = snapshot.name.trim().toLocaleLowerCase();
    return scopePartyId && name ? `other:${scopePartyId}:${name}` : null;
  }

  const partyId =
    material.ownerPartyId ?? snapshot.partyId ?? snapshot.catalogPartyId;
  return partyId ? `${snapshot.kind}:${partyId}` : null;
}

function HandoverCheckRow({
  label,
  passed,
  passedLabel,
  failedLabel,
}: {
  label: string;
  passed: boolean;
  passedLabel: string;
  failedLabel: string;
}) {
  const Icon = passed ? CheckCircle2 : CircleAlert;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon
        className={
          passed
            ? 'size-4 text-[var(--color-success-accent,var(--color-green-600))]'
            : 'size-4 text-destructive'
        }
        aria-hidden="true"
      />
      <span className="flex-1">{label}</span>
      <span
        className={
          passed
            ? 'text-[var(--color-success-accent,var(--color-green-600))]'
            : 'text-destructive'
        }
        role="status"
      >
        {passed ? passedLabel : failedLabel}
      </span>
    </div>
  );
}

export function MaterialListPage() {
  const intl = useIntl();
  const exportExcelLabel = intl.formatMessage({
    id: 'project.materials.actions.exportExcel',
  });
  const importExcelLabel = intl.formatMessage({
    id: 'project.materials.actions.importExcel',
  });
  const navigate = useNavigate();
  const navigateToLabelPrint = (materialIds: readonly string[]) => {
    const selectionKey = storeMaterialLabelSelection(materialIds);
    navigate(ROUTES.PROJECT.MATERIAL_LABEL_PRINT, {
      state: { [MATERIAL_LABEL_SELECTION_STATE_KEY]: selectionKey },
    });
  };
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [filterMode, setFilterMode] = useState<MaterialFilterMode>('status');
  const [isActive, setIsActive] = useState<boolean | undefined>();
  const [condition, setCondition] = useState<MaterialCondition | undefined>();
  const [ownerType, setOwnerType] = useState<MaterialOwnerFilterType | ''>('');
  const [ownerDepartmentId, setOwnerDepartmentId] = useState('');
  const [ownerTeamId, setOwnerTeamId] = useState('');
  const [ownerPartyId, setOwnerPartyId] = useState('');
  const [selectedOwnerEmployee, setSelectedOwnerEmployee] =
    useState<EpsEmployeeCatalogEntry | null>(null);
  const [deletingMaterials, setDeletingMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<Material[]>([]);
  const [qrDialogMaterial, setQrDialogMaterial] = useState<Material | null>(
    null,
  );
  const [bulkAction, setBulkAction] = useState<MaterialBulkAction>('');
  const [isHandoverPreflightOpen, setIsHandoverPreflightOpen] = useState(false);
  const handoverNavigationStarted = useRef(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
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
      isActive,
      condition,
      ownerPartyId: ownerPartyId || undefined,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [
      condition,
      isActive,
      ownerPartyId,
      pagination.pageIndex,
      pagination.pageSize,
      search,
      status,
    ],
  );
  const spreadsheetFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      isActive,
      condition,
      ownerPartyId: ownerPartyId || undefined,
    }),
    [condition, isActive, ownerPartyId, search, status],
  );
  const filterSummaryFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: (status || undefined) as MaterialStatus | undefined,
    }),
    [search, status],
  );
  const hasActiveFilters = Boolean(
    search.trim() ||
    status ||
    isActive !== undefined ||
    condition ||
    ownerPartyId,
  );
  const queryEnabled = isPermissionsPending || canView;
  const filterSummary = useMaterialFilterSummaryQuery(
    filterSummaryFilters,
    queryEnabled && !isPermissionsPending,
  );
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
    onOpenQr: setQrDialogMaterial,
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
    onPrint: (material) => navigateToLabelPrint([material.id]),
  });
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    rowCount: total,
    enableRowSelection: canView,
    state: {
      pagination,
      columnPinning: MATERIAL_COLUMN_PINNING,
      columnVisibility: { select: canView },
      rowSelection,
    },
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
  });
  const handleBulkHandover = () => {
    if (!canManage || selectedMaterials.length === 0) return;
    handoverNavigationStarted.current = false;
    setIsHandoverPreflightOpen(true);
  };
  const ownerIdentities = selectedMaterials.map(getMaterialOwnerIdentity);
  const missingOwnerMaterials = selectedMaterials.filter(
    (material) => getMaterialOwnerIdentity(material) === null,
  );
  const hasSameOwner =
    selectedMaterials.length > 0 &&
    missingOwnerMaterials.length === 0 &&
    new Set(ownerIdentities).size === 1;
  const unavailableMaterials = selectedMaterials.filter(
    (material) => material.status !== 'available',
  );
  const reservedMaterials = selectedMaterials.filter(
    (material) => material.reservedHandoverId,
  );
  const handoverErrors = [
    ...missingOwnerMaterials.map((material) =>
      intl.formatMessage(
        { id: 'project.materials.bulk.handover.errors.missingOwner' },
        { code: material.code },
      ),
    ),
    ...(new Set(ownerIdentities.filter(Boolean)).size > 1
      ? [
          intl.formatMessage({
            id: 'project.materials.bulk.handover.errors.mixedOwners',
          }),
        ]
      : []),
    ...unavailableMaterials.map((material) =>
      intl.formatMessage(
        { id: 'project.materials.bulk.handover.errors.notAvailable' },
        { code: material.code },
      ),
    ),
    ...reservedMaterials.map((material) => {
      const statusId =
        material.reservationStatus === 'pending'
          ? 'project.handover.status.pending'
          : 'project.handover.status.draft';
      return intl.formatMessage(
        { id: 'project.materials.bulk.handover.errors.reserved' },
        {
          code: material.code,
          status: intl.formatMessage({ id: statusId }),
        },
      );
    }),
  ];
  useEffect(() => {
    if (
      !isHandoverPreflightOpen ||
      handoverErrors.length > 0 ||
      !canManage ||
      selectedMaterials.length === 0 ||
      handoverNavigationStarted.current
    ) {
      return;
    }

    handoverNavigationStarted.current = true;
    const query = new URLSearchParams({
      materialIds: selectedMaterials.map((material) => material.id).join(','),
    });
    navigate(`${ROUTES.PROJECT.HANDOVER_CREATE}?${query.toString()}`);
  }, [
    canManage,
    handoverErrors.length,
    isHandoverPreflightOpen,
    navigate,
    selectedMaterials,
  ]);
  const handleApplyBulkAction = () => {
    switch (bulkAction) {
      case 'printQr':
        if (!canView || selectedMaterials.length === 0) return;
        navigateToLabelPrint(selectedMaterials.map((material) => material.id));
        break;
      case 'handover':
        handleBulkHandover();
        break;
      case 'delete':
        if (!canManage || selectedMaterials.length === 0) return;
        setDeletingMaterials(selectedMaterials);
        break;
    }
    setBulkAction('');
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
  const handleFilterModeChange = (nextMode: MaterialFilterMode) => {
    if (nextMode === filterMode) return;

    if (nextMode === 'status') {
      setCondition(undefined);
      setOwnerType('');
      setOwnerDepartmentId('');
      setOwnerTeamId('');
      setOwnerPartyId('');
      setSelectedOwnerEmployee(null);
    } else if (nextMode === 'condition') {
      setIsActive(undefined);
      setOwnerType('');
      setOwnerDepartmentId('');
      setOwnerTeamId('');
      setOwnerPartyId('');
      setSelectedOwnerEmployee(null);
    } else {
      setIsActive(undefined);
      setCondition(undefined);
    }

    setFilterMode(nextMode);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };
  const handleOwnerTypeChange = (nextType: MaterialOwnerFilterType | '') => {
    setOwnerType(nextType);
    setOwnerDepartmentId('');
    setOwnerTeamId('');
    setOwnerPartyId('');
    setSelectedOwnerEmployee(null);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };
  const handleOwnerDepartmentChange = (departmentId: string) => {
    setOwnerDepartmentId(departmentId);
    setOwnerTeamId('');
    setOwnerPartyId(departmentId);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };
  const handleOwnerTeamChange = (teamId: string) => {
    setOwnerTeamId(teamId);
    setOwnerPartyId(
      teamId || (ownerType === 'department' ? ownerDepartmentId : ''),
    );
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canView ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    mode="icon"
                    size="md"
                    aria-label={exportExcelLabel}
                    onClick={() => setIsExportDialogOpen(true)}
                  >
                    <Download aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{exportExcelLabel}</TooltipContent>
              </Tooltip>
            ) : null}
            {canManage ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    mode="icon"
                    size="md"
                    aria-label={importExcelLabel}
                    onClick={() => setIsImportDialogOpen(true)}
                  >
                    <Upload aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{importExcelLabel}</TooltipContent>
              </Tooltip>
            ) : null}
            {canManage ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => navigate(ROUTES.PROJECT.MATERIAL_CREATE)}
              >
                <Plus />
                {intl.formatMessage({ id: 'project.materials.actions.create' })}
              </Button>
            ) : null}
          </div>
        }
      />
      <MaterialFilterRow
        mode={filterMode}
        onModeChange={handleFilterModeChange}
        counts={filterSummary.data}
        isCountsLoading={filterSummary.isPending}
        ownerFilter={filterSummary.data?.ownerFilter}
        isActive={isActive}
        onIsActiveChange={(value) => {
          setIsActive(value);
          setPagination((current) => ({ ...current, pageIndex: 0 }));
        }}
        condition={condition}
        onConditionChange={(value) => {
          setCondition(value);
          setPagination((current) => ({ ...current, pageIndex: 0 }));
        }}
        ownerType={ownerType}
        onOwnerTypeChange={handleOwnerTypeChange}
        ownerDepartmentId={ownerDepartmentId}
        onOwnerDepartmentChange={handleOwnerDepartmentChange}
        ownerTeamId={ownerTeamId}
        onOwnerTeamChange={handleOwnerTeamChange}
        ownerPartyId={ownerPartyId}
        onOwnerPartyIdChange={(value) => {
          setOwnerPartyId(value);
          setPagination((current) => ({ ...current, pageIndex: 0 }));
        }}
        selectedEmployee={selectedOwnerEmployee}
        onSelectedEmployeeChange={setSelectedOwnerEmployee}
        parties={partiesQuery.data ?? []}
        disabled={isPermissionsPending || !canView || partiesQuery.isPending}
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
          id: hasActiveFilters
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
                    id: 'project.materials.filters.loanStatus',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.materials.filters.loanStatusPlaceholder',
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
            onChange={(value) => setBulkAction(value as MaterialBulkAction)}
            options={[
              ...(canView
                ? [
                    {
                      value: 'printQr',
                      label: intl.formatMessage({
                        id: 'project.materials.bulk.printQr',
                      }),
                    },
                  ]
                : []),
              ...(canManage
                ? [
                    {
                      value: 'handover',
                      label: intl.formatMessage({
                        id: 'project.materials.bulk.handover',
                      }),
                    },
                    {
                      value: 'delete',
                      label: intl.formatMessage({
                        id: 'project.materials.bulk.delete',
                      }),
                    },
                  ]
                : []),
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
                option.value === 'printQr'
                  ? QrCode
                  : option.value === 'handover'
                    ? Handshake
                    : Trash2;
              const isDestructive = option.value === 'delete';

              return (
                <span className="flex items-center gap-2">
                  <Icon
                    className={`size-4 shrink-0 ${isDestructive ? 'text-destructive' : ''}`}
                  />
                  <span className={isDestructive ? 'text-destructive' : ''}>
                    {option.label}
                  </span>
                </span>
              );
            }}
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={
              !bulkAction ||
              (bulkAction === 'delete' && deleteMutation.isPending)
            }
            onClick={handleApplyBulkAction}
          >
            {intl.formatMessage({ id: 'project.materials.bulk.apply' })}
          </Button>
        </DataGridActionBar>
      </DataGrid>
      <ConfirmDialog
        open={deletingMaterials.length > 0}
        onOpenChange={(open) => !open && setDeletingMaterials([])}
        title={intl.formatMessage({
          id: 'project.materials.dialogs.deleteTitle',
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
      <MaterialQrCodeDialog
        material={qrDialogMaterial}
        onOpenChange={(open) => !open && setQrDialogMaterial(null)}
        onPrint={(material) => navigateToLabelPrint([material.id])}
      />
      <MaterialHandoverPreflightDialogShell
        open={isHandoverPreflightOpen}
        onOpenChange={setIsHandoverPreflightOpen}
        onCancel={() => setIsHandoverPreflightOpen(false)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <HandoverCheckRow
              label={intl.formatMessage({
                id: 'project.materials.bulk.handover.check.sameOwner',
              })}
              passed={hasSameOwner}
              passedLabel={intl.formatMessage({
                id: 'project.materials.bulk.handover.check.passed',
              })}
              failedLabel={intl.formatMessage({
                id: 'project.materials.bulk.handover.check.failed',
              })}
            />
            <HandoverCheckRow
              label={intl.formatMessage({
                id: 'project.materials.bulk.handover.check.ready',
              })}
              passed={
                unavailableMaterials.length === 0 &&
                reservedMaterials.length === 0
              }
              passedLabel={intl.formatMessage({
                id: 'project.materials.bulk.handover.check.passed',
              })}
              failedLabel={intl.formatMessage({
                id: 'project.materials.bulk.handover.check.failed',
              })}
            />
          </div>
          {handoverErrors.length > 0 ? (
            <ul
              role="alert"
              className="list-inside list-disc space-y-1 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {handoverErrors.map((error, index) => (
                <li key={`${index}-${error}`}>{error}</li>
              ))}
            </ul>
          ) : null}
          <ul className="max-h-64 divide-y overflow-y-auto rounded-md border border-border">
            {selectedMaterials.map((material) => (
              <li
                key={material.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {material.code} ·{' '}
                    {material.nameOverride?.trim() ||
                      material.modelSnapshot.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {material.ownerSnapshot.name || '—'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge
                    size="sm"
                    variant={
                      material.status === 'available' ? 'success' : 'warning'
                    }
                    appearance="light"
                  >
                    {intl.formatMessage({
                      id: `project.materials.status.${material.status}`,
                    })}
                  </Badge>
                  {material.reservationStatus ? (
                    <Badge size="sm" variant="destructive" appearance="light">
                      {intl.formatMessage({
                        id: `project.handover.status.${material.reservationStatus}`,
                      })}
                    </Badge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </MaterialHandoverPreflightDialogShell>
      <MaterialSpreadsheetImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />
      <MaterialSpreadsheetExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        filters={spreadsheetFilters}
      />
    </div>
  );
}
