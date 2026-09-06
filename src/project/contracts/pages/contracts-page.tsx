import { useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { SavedViewFilterControls } from '@/project/saved-views/components/saved-view-filter-controls';
import {
  SavedViewFormDialog,
  useSavedViewForm,
} from '@/project/saved-views/components/saved-view-form-dialog';
import { useSavedViewTableState } from '@/project/saved-views/hooks/use-saved-view-table-state';
import { useTenantSavedViews } from '@/project/saved-views/hooks/use-tenant-saved-views';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from '@tanstack/react-table';
import {
  ChevronDown,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnVisibility } from '@/components/ui/data-grid-column-visibility';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  deleteContract,
  renewContracts,
  type ContractBulkRenewalInput,
} from '../api/contracts.api';
import { ContractBulkRenewalDialog } from '../components/contract-bulk-renewal-dialog';
import {
  ContractFilterDrawer,
  type ContractFilterDraft,
} from '../components/contract-filter-drawer';
import { ContractStatsCards } from '../components/contract-stats-cards';
import { useContractList } from '../hooks/use-contract-list';
import { useContractStats } from '../hooks/use-contract-stats';
import { type Contract, type ContractListFilters } from '../model/contract';
import {
  CONTRACT_SAVED_VIEW_MANAGE_PERMISSION,
  CONTRACT_SAVED_VIEW_RESOURCE,
  contractSavedViewConfigEquals,
  normalizeContractSavedViewConfig,
  type ContractSavedView,
  type ContractSavedViewConfig,
} from '../model/contract-saved-view';
import {
  CONTRACT_COLUMN_PINNING,
  useContractColumns,
} from '../table/contract.columns.generated';
import { ContractFilterBar } from '../table/contract.filters.generated';

export function ContractsPage() {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { userId, hasPermission } = useUser();
  const queryClient = useQueryClient();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [statsOpen, setStatsOpen] = useState(true);
  const [deletingContracts, setDeletingContracts] = useState<Contract[]>([]);
  const [bulkRenewalDialogOpen, setBulkRenewalDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingView, setEditingView] = useState<ContractSavedView | null>(
    null,
  );
  const [deletingView, setDeletingView] = useState<ContractSavedView | null>(
    null,
  );
  const viewForm = useSavedViewForm();
  const {
    contracts,
    total,
    keyword,
    setKeyword,
    filters,
    setFilters,
    setFilter,
    resetAll,
    pagination,
    onPaginationChange,
    tenantQuery,
    workspaceQuery,
    customerOptions,
    customerOptionsQuery,
    paymentReminderDays,
    contractRenewalReminderDays,
  } = useContractList();
  const contractStats = useContractStats({
    expiringWithinDays: contractRenewalReminderDays,
  });
  const savedViewState = useTenantSavedViews<ContractListFilters>({
    tenantId,
    userId,
    resource: CONTRACT_SAVED_VIEW_RESOURCE,
  });
  const deleteMutation = useMutation({
    mutationFn: (contractIds: string[]) =>
      Promise.all(contractIds.map((contractId) => deleteContract(contractId))),
    onSuccess: async () => {
      toast.success(
        deletingContracts.length > 1
          ? `Đã xóa ${deletingContracts.length} hợp đồng.`
          : 'Đã xóa hợp đồng.',
      );
      setDeletingContracts([]);
      setRowSelection({});
      await queryClient.invalidateQueries({
        queryKey: ['project', 'contracts'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const renewalMutation = useMutation({
    mutationFn: (input: ContractBulkRenewalInput) => {
      if (!tenantId) {
        throw new Error('Thiếu thông tin tổ chức để gia hạn hợp đồng.');
      }
      return renewContracts(tenantId, input);
    },
    onSuccess: async (result) => {
      toast.success(
        result.overrodeDraftCount > 0
          ? `Đã lập lịch gia hạn cho ${result.total} hợp đồng và thay thế ${result.overrodeDraftCount} bản nháp.`
          : `Đã lập lịch gia hạn cho ${result.total} hợp đồng.`,
      );
      setBulkRenewalDialogOpen(false);
      setRowSelection({});
      await queryClient.invalidateQueries({
        queryKey: ['project', 'contracts'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function openCreate() {
    navigate(ROUTES.PROJECT.CONTRACT_CREATE);
  }

  function openEdit(contract: Contract) {
    navigate(
      `${ROUTES.PROJECT.CONTRACT_CREATE}?edit=${encodeURIComponent(contract.id)}`,
    );
  }

  const columns = useContractColumns({
    onEdit: openEdit,
    onDelete: (contract) => setDeletingContracts([contract]),
    contractSearch: filters.contractSearch,
    onContractSearchChange: (value) => setFilter('contractSearch', value),
    customerId: filters.customerId,
    customerOptions,
    customerOptionsLoading: customerOptionsQuery.isPending,
    onCustomerIdChange: (value) => setFilter('customerId', value),
    paymentReminderDays,
    contractRenewalReminderDays,
    statuses: filters.status,
    onStatusChange: (value) => setFilter('status', value),
    outstandingMin: filters.outstandingMin,
    outstandingMax: filters.outstandingMax,
    onOutstandingChange: (value) => {
      setFilters((current) => ({
        ...current,
        outstandingMin: value.min,
        outstandingMax: value.max,
      }));
    },
    nextDueFrom: filters.nextDueFrom,
    nextDueTo: filters.nextDueTo,
    onNextDueChange: (value) => {
      setFilters((current) => ({
        ...current,
        nextDueFrom: value.from ?? '',
        nextDueTo: value.to ?? '',
      }));
    },
  });
  const {
    columnVisibility,
    onColumnVisibilityChange,
    columnOrder,
    onColumnOrderChange,
    applySavedViewTableState,
    resetSavedViewTableState,
    showInlineFilters,
    onShowInlineFiltersChange,
  } = useSavedViewTableState<ContractListFilters>({
    visibilityStorageKey: 'project.contracts.columnVisibility',
    orderStorageKey: 'project.contracts.columnOrder',
    inlineFiltersStorageKey: 'project.contracts.showInlineFilters',
  });
  const currentViewConfig = useMemo<ContractSavedViewConfig>(
    () => ({ version: 1, keyword, filters, columnVisibility, columnOrder }),
    [columnOrder, columnVisibility, filters, keyword],
  );
  const activeView = savedViewState.activeView;
  const isActiveViewDirty = Boolean(
    activeView &&
    !contractSavedViewConfigEquals(
      currentViewConfig,
      normalizeContractSavedViewConfig(activeView.config),
    ),
  );
  const canManageSavedViews = hasPermission(
    CONTRACT_SAVED_VIEW_MANAGE_PERMISSION,
  );

  function selectSavedView(viewId: string | null) {
    if (!viewId) {
      savedViewState.setActiveViewId(null);
      resetAll();
      resetSavedViewTableState();
      return;
    }
    const view = savedViewState.savedViews.find((item) => item.id === viewId);
    if (!view) return;
    const config = normalizeContractSavedViewConfig(view.config);
    savedViewState.setActiveViewId(view.id);
    setKeyword(config.keyword);
    setFilters({ ...config.filters, status: [...config.filters.status] });
    applySavedViewTableState(config);
  }

  function openCreateSavedView() {
    setEditingView(null);
    viewForm.reset({ name: '' });
    setViewDialogOpen(true);
  }

  function openEditSavedView(view: ContractSavedView) {
    setEditingView(view);
    viewForm.reset({ name: view.name });
    setViewDialogOpen(true);
  }

  function saveView(config = currentViewConfig) {
    if (!activeView) return;
    savedViewState.saveMutation.mutate(
      { name: activeView.name, view: activeView, config },
      {
        onSuccess: () => toast.success('Đã cập nhật chế độ xem.'),
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  }

  function submitSavedView(name: string) {
    savedViewState.saveMutation.mutate(
      { name, view: editingView, config: currentViewConfig },
      {
        onSuccess: () => {
          setViewDialogOpen(false);
          setEditingView(null);
          toast.success(
            editingView
              ? 'Đã cập nhật chế độ xem.'
              : 'Đã tạo chế độ xem dùng chung.',
          );
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  }
  const pageHeader = (
    <PageHeader
      title="Quản lý hợp đồng"
      icon={FileText}
      actions={
        <div className="flex items-center gap-2">
          <ShortcutTooltip label="Thêm hợp đồng" shortcut="Alt + N">
            <Button
              variant="primary"
              onClick={openCreate}
              data-shortcut-action="create"
            >
              <Plus />
              Thêm hợp đồng
            </Button>
          </ShortcutTooltip>
          <span className="h-5 w-px bg-border" aria-hidden="true" />
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              mode="icon"
              size="md"
              aria-label={statsOpen ? 'Thu gọn thống kê' : 'Mở rộng thống kê'}
              aria-expanded={statsOpen}
            >
              <ChevronDown
                className={`transition-transform duration-200 ${
                  statsOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
        </div>
      }
    />
  );

  const table = useReactTable({
    data: contracts,
    columns,
    getRowId: (row) => row.id,
    state: {
      pagination,
      columnVisibility,
      columnOrder,
      columnPinning: CONTRACT_COLUMN_PINNING,
      rowSelection,
    },
    onPaginationChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.pageSize),
    getCoreRowModel: getCoreRowModel(),
  });

  const listError = tenantQuery.error ?? workspaceQuery.error;
  const isListLoading = tenantQuery.isPending || workspaceQuery.isLoading;
  const selectedContracts = useMemo(
    () => contracts.filter((contract) => rowSelection[contract.id]),
    [contracts, rowSelection],
  );

  if (tenantQuery.isError || workspaceQuery.isError) {
    return (
      <Collapsible
        open={statsOpen}
        onOpenChange={setStatsOpen}
        className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5"
      >
        {pageHeader}
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TriangleAlert className="size-8 text-destructive" />
          <div>
            <CardTitle>Không tải được danh sách hợp đồng</CardTitle>
            <CardDescription className="mt-1">
              {getApiErrorMessage(listError)}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void tenantQuery.refetch();
              void workspaceQuery.refetch();
            }}
          >
            Thử lại
          </Button>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Collapsible
      open={statsOpen}
      onOpenChange={setStatsOpen}
      className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5"
    >
      {pageHeader}
      <CollapsibleContent>
        <ContractStatsCards
          stats={contractStats.statusStats}
          paymentPlan={contractStats.paymentPlan}
          isLoading={
            contractStats.statusQuery.isPending ||
            contractStats.paymentPlanQuery.isPending
          }
          activeStatusFilters={filters.status}
          onStatusFilterChange={(status) =>
            setFilter('status', status ? [status] : [])
          }
        />
      </CollapsibleContent>
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isListLoading}
        isFetching={workspaceQuery.isFetching}
        emptyMessage="Chưa có hợp đồng"
        tableLayout={{
          dense: true,
          columnsVisibility: false,
          showInlineFilters,
        }}
      >
        <Card className="min-h-0 flex-1 overflow-hidden">
          <DataGridHeader
            title={
              <span className="inline-flex items-center gap-3 text-sm font-normal text-muted-foreground">
                <span>
                  Đã chọn{' '}
                  <span className="font-semibold text-foreground">
                    {selectedContracts.length}
                  </span>{' '}
                  hợp đồng
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="md"
                      disabled={selectedContracts.length === 0}
                      aria-label="Thao tác hàng loạt"
                    >
                      Thao tác hàng loạt
                      <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onSelect={() => setBulkRenewalDialogOpen(true)}
                    >
                      <RefreshCw />
                      Gia hạn hợp đồng
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeletingContracts(selectedContracts)}
                    >
                      <Trash2 />
                      Xóa hợp đồng
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            }
            toolbar={
              <>
                <ContractFilterBar
                  keyword={keyword}
                  onKeywordChange={setKeyword}
                />
                <SavedViewFilterControls
                  views={savedViewState.savedViews}
                  activeViewId={savedViewState.activeViewId}
                  canManage={canManageSavedViews}
                  isLoading={savedViewState.savedViewsQuery.isPending}
                  isDirty={isActiveViewDirty}
                  isSaving={savedViewState.saveMutation.isPending}
                  showInlineFilters={showInlineFilters}
                  onShowInlineFiltersChange={onShowInlineFiltersChange}
                  renderFilterDrawer={({ open, onOpenChange, trigger }) => (
                    <ContractFilterDrawer
                      keyword={keyword}
                      filters={filters}
                      customerOptions={customerOptions}
                      customerOptionsLoading={customerOptionsQuery.isPending}
                      open={open}
                      onOpenChange={onOpenChange}
                      onApply={({
                        keyword: nextKeyword,
                        filters: nextFilters,
                      }) => {
                        setKeyword(nextKeyword);
                        setFilters(nextFilters);
                      }}
                      onReset={resetAll}
                      onSaveToView={
                        canManageSavedViews
                          ? (draft: ContractFilterDraft) =>
                              saveView({
                                ...currentViewConfig,
                                keyword: draft.keyword,
                                filters: draft.filters,
                              })
                          : undefined
                      }
                      canSaveToView={Boolean(activeView && canManageSavedViews)}
                      saveDisabled={!isActiveViewDirty}
                      isSaving={savedViewState.saveMutation.isPending}
                      trigger={trigger}
                    />
                  )}
                  onSelect={selectSavedView}
                  onCreate={openCreateSavedView}
                  onEdit={openEditSavedView}
                  onSaveCurrent={() => saveView()}
                />
                <Button
                  variant="outline"
                  mode="icon"
                  aria-label="Làm mới"
                  title="Làm mới"
                  onClick={() => {
                    void workspaceQuery.refetch();
                  }}
                >
                  <RefreshCw />
                </Button>
                <DataGridColumnVisibility
                  table={table}
                  mode="drawer"
                  onSaveToView={
                    canManageSavedViews ? () => saveView() : undefined
                  }
                  canSaveToView={Boolean(activeView && canManageSavedViews)}
                  saveDisabled={!isActiveViewDirty}
                  isSaving={savedViewState.saveMutation.isPending}
                />
              </>
            }
          />
          <CardTable className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardTable>
          <CardFooter className="justify-between">
            <DataGridPagination />
          </CardFooter>
        </Card>
      </DataGrid>

      <ConfirmDialog
        open={deletingContracts.length > 0}
        onOpenChange={(open) => {
          if (!open) setDeletingContracts([]);
        }}
        title={
          deletingContracts.length > 1
            ? `Xóa ${deletingContracts.length} hợp đồng?`
            : 'Xóa hợp đồng?'
        }
        description={
          deletingContracts.length > 1
            ? `Bạn có chắc muốn xóa ${deletingContracts.length} hợp đồng đã chọn?`
            : deletingContracts[0]
              ? `Bạn có chắc muốn xóa hợp đồng "${deletingContracts[0].name}"?`
              : ''
        }
        confirmLabel={
          deletingContracts.length > 1 ? 'Xóa các hợp đồng' : 'Xóa hợp đồng'
        }
        confirmVariant="destructive"
        onConfirm={() => {
          if (deletingContracts.length > 0) {
            deleteMutation.mutate(deletingContracts.map((item) => item.id));
          }
        }}
      />
      <ContractBulkRenewalDialog
        open={bulkRenewalDialogOpen}
        contracts={selectedContracts}
        isSubmitting={renewalMutation.isPending}
        onOpenChange={(open) => {
          if (!renewalMutation.isPending) setBulkRenewalDialogOpen(open);
        }}
        onConfirm={(input) => renewalMutation.mutate(input)}
      />
      <SavedViewFormDialog
        open={viewDialogOpen}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) setEditingView(null);
        }}
        mode={editingView ? 'edit' : 'create'}
        form={viewForm}
        isSaving={savedViewState.saveMutation.isPending}
        title={editingView ? 'Sửa chế độ xem' : 'Tạo chế độ xem'}
        onSubmit={(values) => submitSavedView(values.name)}
        onDelete={() => {
          if (!editingView) return;
          setViewDialogOpen(false);
          setEditingView(null);
          setDeletingView(editingView);
        }}
      />
      <ConfirmDialog
        open={Boolean(deletingView)}
        onOpenChange={(open) => {
          if (!open) setDeletingView(null);
        }}
        title="Xóa chế độ xem?"
        description={
          deletingView
            ? `Chế độ xem "${deletingView.name}" sẽ bị xóa cho toàn bộ tenant.`
            : ''
        }
        confirmLabel="Xóa chế độ xem"
        confirmVariant="destructive"
        onConfirm={() => {
          if (!deletingView) return;
          savedViewState.deleteMutation.mutate(deletingView, {
            onSuccess: () => {
              setDeletingView(null);
              toast.success('Đã xóa chế độ xem.');
            },
            onError: (error) => toast.error(getApiErrorMessage(error)),
          });
        }}
      />
    </Collapsible>
  );
}
