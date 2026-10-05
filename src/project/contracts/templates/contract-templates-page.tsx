import { useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { SavedViewFilterMenu } from '@/project/saved-views/components/saved-view-filter-controls';
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
  Archive,
  Layers3,
  MoreVertical,
  Plus,
  RefreshCw,
  SlidersHorizontal,
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridActionBar } from '@/components/ui/data-grid-action-bar';
import { DataGridColumnVisibility } from '@/components/ui/data-grid-column-visibility';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { archiveContractTemplate } from '../api/contract-templates.api';
import {
  CONTRACT_TEMPLATE_STATUS_LABELS,
  CONTRACT_TEMPLATE_STATUSES,
  type ContractTemplate,
  type ContractTemplateListFilters,
} from '../model/contract-template';
import {
  CONTRACT_TEMPLATE_SAVED_VIEW_MANAGE_PERMISSION,
  CONTRACT_TEMPLATE_SAVED_VIEW_RESOURCE,
  contractTemplateSavedViewConfigEquals,
  normalizeContractTemplateSavedViewConfig,
  type ContractTemplateSavedView,
  type ContractTemplateSavedViewConfig,
} from '../model/contract-template-saved-view';
import {
  ContractTemplateFilterDrawer,
  type ContractTemplateFilterDraft,
} from './contract-template-filter-drawer';
import { ContractTemplateStatusIndicator } from './contract-template-status-indicator';
import {
  CONTRACT_TEMPLATE_COLUMN_PINNING,
  useContractTemplateColumns,
} from './contract-template.columns.generated';
import { ContractTemplateFilterBar } from './contract-template.filters.generated';
import { useContractTemplateList } from './use-contract-template-list';

const CONTRACT_TEMPLATE_FILTER_STATUS_OPTIONS = [
  ...CONTRACT_TEMPLATE_STATUSES.map((status) => ({
    value: status,
    label: CONTRACT_TEMPLATE_STATUS_LABELS[status],
  })),
];

export function ContractTemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { userId, hasPermission } = useUser();
  const [archivingTemplate, setArchivingTemplate] =
    useState<ContractTemplate | null>(null);
  const [archivingTemplates, setArchivingTemplates] = useState<
    ContractTemplate[]
  >([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [editingView, setEditingView] =
    useState<ContractTemplateSavedView | null>(null);
  const [deletingView, setDeletingView] =
    useState<ContractTemplateSavedView | null>(null);
  const viewForm = useSavedViewForm();
  const {
    templates,
    total,
    keyword,
    setKeyword,
    setFilters,
    filters,
    setFilter,
    resetAll,
    pagination,
    onPaginationChange,
    tenantQuery,
    listQuery,
    contractTemplateTagsByTemplateId,
  } = useContractTemplateList();
  const savedViewState = useTenantSavedViews<ContractTemplateListFilters>({
    tenantId,
    userId,
    resource: CONTRACT_TEMPLATE_SAVED_VIEW_RESOURCE,
  });

  const archiveMutation = useMutation({
    mutationFn: (template: ContractTemplate) =>
      archiveContractTemplate(template.id),
    onSuccess: async () => {
      toast.success('Đã lưu trữ mẫu hợp đồng.');
      setArchivingTemplate(null);
      await queryClient.invalidateQueries({
        queryKey: ['project', 'contract-templates'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: (selectedTemplates: ContractTemplate[]) =>
      Promise.all(
        selectedTemplates.map((template) =>
          archiveContractTemplate(template.id),
        ),
      ),
    onSuccess: async (_, archivedTemplates) => {
      setArchivingTemplates([]);
      setRowSelection({});
      toast.success(`Đã lưu trữ ${archivedTemplates.length} mẫu hợp đồng.`);
      await queryClient.invalidateQueries({
        queryKey: ['project', 'contract-templates'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns = useContractTemplateColumns({
    onView: (template) =>
      navigate(
        buildPath(ROUTES.PROJECT.CONTRACT_TEMPLATE_DETAIL, {
          id: template.id,
        }),
      ),
    onEdit: (template) =>
      navigate(
        buildPath(ROUTES.PROJECT.CONTRACT_TEMPLATE_EDIT, {
          id: template.id,
        }),
      ),
    onArchive: setArchivingTemplate,
    tagIds: filters.tagIds,
    onTagIdsChange: (value) => setFilter('tagIds', value),
    tagsByTemplateId: contractTemplateTagsByTemplateId,
    templateSearch: filters.templateSearch,
    onTemplateSearchChange: (value) => setFilter('templateSearch', value),
    statuses: filters.statuses,
    onStatusesChange: (value) => {
      setFilter('statuses', value as typeof filters.statuses);
      setFilter(
        'status',
        value.length === 1 ? (value[0] as typeof filters.status) : 'all',
      );
    },
    lineCount: {
      min: filters.lineCountMin,
      max: filters.lineCountMax,
    },
    onLineCountChange: (value) => {
      setFilter('lineCountMin', value.min);
      setFilter('lineCountMax', value.max);
    },
    contractCount: {
      min: filters.contractCountMin,
      max: filters.contractCountMax,
    },
    onContractCountChange: (value) => {
      setFilter('contractCountMin', value.min);
      setFilter('contractCountMax', value.max);
    },
    versionNo: {
      min: filters.versionNoMin,
      max: filters.versionNoMax,
    },
    onVersionNoChange: (value) => {
      setFilter('versionNoMin', value.min);
      setFilter('versionNoMax', value.max);
    },
    updatedAt: {
      from: filters.updatedFrom,
      to: filters.updatedTo,
    },
    onUpdatedAtChange: (value) => {
      setFilter('updatedFrom', value.from ?? '');
      setFilter('updatedTo', value.to ?? '');
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
  } = useSavedViewTableState<ContractTemplateListFilters>({
    visibilityStorageKey: 'project.contractTemplates.columnVisibility',
    orderStorageKey: 'project.contractTemplates.columnOrder',
    inlineFiltersStorageKey: 'project.contractTemplates.showInlineFilters',
  });
  const currentViewConfig = useMemo<ContractTemplateSavedViewConfig>(
    () => ({ version: 1, keyword, filters, columnVisibility, columnOrder }),
    [columnOrder, columnVisibility, filters, keyword],
  );
  const activeView = savedViewState.activeView;
  const isActiveViewDirty = Boolean(
    activeView &&
    !contractTemplateSavedViewConfigEquals(
      currentViewConfig,
      normalizeContractTemplateSavedViewConfig(activeView.config),
    ),
  );
  const canManageSavedViews = hasPermission(
    CONTRACT_TEMPLATE_SAVED_VIEW_MANAGE_PERMISSION,
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
    const config = normalizeContractTemplateSavedViewConfig(view.config);
    savedViewState.setActiveViewId(view.id);
    setKeyword(config.keyword);
    setFilters({
      ...config.filters,
      statuses: [...config.filters.statuses],
      tagIds: [...config.filters.tagIds],
    });
    applySavedViewTableState(config);
  }

  function openCreateSavedView() {
    setEditingView(null);
    viewForm.reset({ name: '' });
    setViewDialogOpen(true);
  }

  function openEditSavedView(view: ContractTemplateSavedView) {
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
      title="Quản lý mẫu hợp đồng"
      icon={Layers3}
      actions={
        <ShortcutTooltip label="Thêm mẫu hợp đồng" shortcut="Alt + N">
          <Button
            variant="primary"
            onClick={() => navigate(ROUTES.PROJECT.CONTRACT_TEMPLATE_CREATE)}
            data-shortcut-action="create"
          >
            <Plus />
            Thêm mẫu hợp đồng
          </Button>
        </ShortcutTooltip>
      }
    />
  );

  const table = useReactTable({
    data: templates,
    columns,
    getRowId: (row) => row.id,
    state: {
      pagination,
      columnVisibility,
      columnOrder,
      columnPinning: CONTRACT_TEMPLATE_COLUMN_PINNING,
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
  const listError = tenantQuery.error ?? listQuery.error;
  const selectedTemplates = table
    .getSelectedRowModel()
    .rows.map((row) => row.original);

  if (tenantQuery.isError || listQuery.isError) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
        {pageHeader}
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TriangleAlert className="size-8 text-destructive" />
          <div>
            <CardTitle>Không tải được danh sách mẫu hợp đồng</CardTitle>
            <CardDescription className="mt-1">
              {getApiErrorMessage(listError)}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => void listQuery.refetch()}>
            Thử lại
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      {pageHeader}
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={listQuery.isLoading}
        isFetching={listQuery.isFetching}
        emptyMessage="Chưa có mẫu hợp đồng"
        tableLayout={{
          dense: true,
          columnsVisibility: false,
          showInlineFilters,
        }}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            stats={
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <ContractTemplateFilterBar
                  className="min-w-0"
                  keyword={keyword}
                  onKeywordChange={setKeyword}
                  status={filters.status === 'all' ? '' : filters.status}
                  onStatusChange={(value) => {
                    const nextStatus = value as typeof filters.status | '';
                    setFilter('status', nextStatus || 'all');
                    setFilter('statuses', nextStatus ? [nextStatus] : []);
                  }}
                  statusOptions={CONTRACT_TEMPLATE_FILTER_STATUS_OPTIONS}
                  statusRenderOption={(option) => (
                    <ContractTemplateStatusIndicator status={option.value} />
                  )}
                  statusRenderValue={(option) =>
                    option ? (
                      <ContractTemplateStatusIndicator status={option.value} />
                    ) : null
                  }
                />
                <ContractTemplateFilterDrawer
                  keyword={keyword}
                  filters={filters}
                  open={filterDrawerOpen}
                  onOpenChange={setFilterDrawerOpen}
                  onApply={({ keyword: nextKeyword, filters: nextFilters }) => {
                    setKeyword(nextKeyword);
                    setFilters(nextFilters);
                  }}
                  onReset={resetAll}
                  onSaveToView={
                    canManageSavedViews
                      ? (draft: ContractTemplateFilterDraft) =>
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
                  trigger={
                    <Button type="button" variant="outline">
                      <SlidersHorizontal />
                      Lọc chi tiết
                    </Button>
                  }
                />
              </div>
            }
            toolbar={
              <div className="ms-auto flex shrink-0 items-center gap-2.5">
                <Button
                  variant="outline"
                  mode="icon"
                  aria-label="Làm mới"
                  title="Làm mới"
                  onClick={() => void listQuery.refetch()}
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
                <SavedViewFilterMenu
                  views={savedViewState.savedViews}
                  activeViewId={savedViewState.activeViewId}
                  canManage={canManageSavedViews}
                  isDirty={isActiveViewDirty}
                  isSaving={savedViewState.saveMutation.isPending}
                  showInlineFilters={showInlineFilters}
                  onShowInlineFiltersChange={onShowInlineFiltersChange}
                  onOpenFilterDrawer={() => setFilterDrawerOpen(true)}
                  onSelect={selectSavedView}
                  onCreate={openCreateSavedView}
                  onEdit={openEditSavedView}
                  onSaveCurrent={() => saveView()}
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      mode="icon"
                      disabled={savedViewState.savedViewsQuery.isPending}
                      aria-label="Tùy chọn chế độ xem và bộ lọc"
                      title={
                        activeView?.name ?? 'Tùy chọn chế độ xem và bộ lọc'
                      }
                    >
                      <MoreVertical />
                    </Button>
                  }
                />
              </div>
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
        <DataGridActionBar>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setArchivingTemplates(selectedTemplates)}
          >
            <Archive />
            Lưu trữ mẫu hợp đồng
          </Button>
        </DataGridActionBar>
      </DataGrid>

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
        open={Boolean(archivingTemplate)}
        onOpenChange={(open) => {
          if (!open) setArchivingTemplate(null);
        }}
        title="Lưu trữ mẫu hợp đồng?"
        description={
          archivingTemplate
            ? `Mẫu “${archivingTemplate.name}” sẽ không còn được chọn để tạo hợp đồng mới.`
            : ''
        }
        confirmLabel="Lưu trữ mẫu"
        confirmVariant="destructive"
        onConfirm={() => {
          if (archivingTemplate) archiveMutation.mutate(archivingTemplate);
        }}
      />
      <ConfirmDialog
        open={archivingTemplates.length > 0}
        onOpenChange={(open) => {
          if (!open) setArchivingTemplates([]);
        }}
        title={`Lưu trữ ${archivingTemplates.length} mẫu hợp đồng?`}
        description={`Các mẫu hợp đồng đã chọn sẽ không còn được sử dụng để tạo hợp đồng mới.`}
        confirmLabel="Lưu trữ mẫu"
        confirmVariant="destructive"
        onConfirm={() => {
          if (archivingTemplates.length > 0) {
            bulkArchiveMutation.mutate(archivingTemplates);
          }
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
    </div>
  );
}
