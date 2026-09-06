import { useCallback, useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import {
  createTenantSavedView,
  deleteTenantSavedView,
  loadTenantSavedViews,
  updateTenantSavedView,
} from '@/project/saved-views/api/saved-views.api';
import { useSavedViewTableState } from '@/project/saved-views/hooks/use-saved-view-table-state';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from '@tanstack/react-table';
import { ChevronDown, Plus, RefreshCw, TriangleAlert } from 'lucide-react';
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
import { DataGridColumnVisibility } from '@/components/ui/data-grid-column-visibility';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  createCustomer,
  deleteCustomer,
  loadCustomerCustomFields,
  loadCustomerCustomFieldValues,
  loadCustomerRegionOptions,
  saveCustomerCustomFieldValues,
  updateCustomer,
  uploadCustomerImage,
} from '../api/customers.api';
import { CustomerFilterViewControl } from '../components/customer-filter-view-control';
import { CustomerStatsCards } from '../components/customer-stats-cards';
import {
  CustomerFormDialog,
  useCustomerForm,
} from '../forms/customer-form.generated';
import {
  CustomerSavedViewFormDialog,
  useCustomerSavedViewForm,
} from '../forms/customer-saved-view-form.generated';
import { useCustomerList } from '../hooks/use-customer-list';
import {
  emptyCustomerForm,
  mapCustomerToFormValues,
  type Customer,
  type CustomerFilterFormValues,
  type CustomerFormValues,
  type CustomerListFilters,
} from '../model/customer';
import {
  CUSTOMER_SAVED_VIEW_MANAGE_PERMISSION,
  CUSTOMER_SAVED_VIEW_RESOURCE,
  customerSavedViewConfigEquals,
  normalizeCustomerSavedViewConfig,
  type CustomerSavedView,
  type CustomerSavedViewConfig,
} from '../model/customer-saved-view';
import {
  CUSTOMER_COLUMN_PINNING,
  useCustomerColumns,
} from '../table/customer.columns.generated';
import { CustomerFilterBar } from '../table/customer.filters.generated';

const customerDefaultColumnVisibility = {
  businessRegistrationCode: false,
  countryCode: false,
  region: false,
  phone: false,
  email: false,
  addressDetail: false,
  note: false,
};

export function CustomersPage() {
  const { tenantId } = useTenant();
  const { userId, hasPermission } = useUser();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(
    null,
  );
  const [customerImageFile, setCustomerImageFile] = useState<File | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingView, setEditingView] = useState<CustomerSavedView | null>(
    null,
  );
  const [deletingView, setDeletingView] = useState<CustomerSavedView | null>(
    null,
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const form = useCustomerForm();
  const savedViewForm = useCustomerSavedViewForm();

  const {
    customers,
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
    customerStatsQuery,
    customerTagsByCustomerId,
  } = useCustomerList();

  const savedViewsQuery = useQuery({
    queryKey: [
      'project',
      'saved-views',
      tenantId,
      CUSTOMER_SAVED_VIEW_RESOURCE,
    ],
    queryFn: ({ signal }) =>
      loadTenantSavedViews<CustomerListFilters>(
        tenantId!,
        CUSTOMER_SAVED_VIEW_RESOURCE,
        signal,
      ),
    enabled: Boolean(tenantId),
    staleTime: 60 * 1000,
  });

  const customerRegionQuery = useQuery({
    queryKey: ['project', 'customers', 'regions'],
    queryFn: loadCustomerRegionOptions,
  });

  const customerCustomFieldsQuery = useQuery({
    queryKey: ['project', 'customers', 'custom-fields', tenantId],
    queryFn: () => loadCustomerCustomFields(tenantId!),
    enabled: Boolean(tenantId),
    staleTime: 60 * 1000,
  });

  const customerCustomDataQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'custom-data',
      tenantId,
      editingCustomer?.id,
    ],
    queryFn: () =>
      loadCustomerCustomFieldValues(tenantId!, editingCustomer!.id),
    enabled: Boolean(tenantId && dialogOpen && editingCustomer),
  });

  useEffect(() => {
    if (!dialogOpen || !editingCustomer || customerCustomDataQuery.isLoading) {
      return;
    }

    form.reset({
      ...mapCustomerToFormValues(editingCustomer),
      customFields: customerCustomDataQuery.data ?? {},
    });
  }, [
    customerCustomDataQuery.data,
    customerCustomDataQuery.isLoading,
    dialogOpen,
    editingCustomer,
    form,
  ]);

  const customerTableDefaultColumnVisibility = useMemo(
    () => ({
      ...customerDefaultColumnVisibility,
      ...Object.fromEntries(
        (customerCustomFieldsQuery.data ?? [])
          .filter((field) => field.isActive)
          .map((field) => [`customField:${field.key}`, false]),
      ),
    }),
    [customerCustomFieldsQuery.data],
  );

  const {
    columnVisibility,
    onColumnVisibilityChange,
    columnOrder,
    onColumnOrderChange,
    applySavedViewTableState,
    resetSavedViewTableState,
    showInlineFilters,
    onShowInlineFiltersChange,
  } = useSavedViewTableState<CustomerListFilters>({
    visibilityStorageKey: 'project.customers.columnVisibility',
    orderStorageKey: 'project.customers.columnOrder',
    inlineFiltersStorageKey: 'project.customers.showInlineFilters',
    defaultColumnVisibility: customerTableDefaultColumnVisibility,
  });

  useEffect(() => {
    const customFields = customerCustomFieldsQuery.data ?? [];
    if (customFields.length === 0) return;

    onColumnVisibilityChange((current) => {
      const next = { ...current };
      let changed = false;
      for (const field of customFields) {
        if (!field.isActive) continue;
        const id = `customField:${field.key}`;
        if (id in next) continue;
        next[id] = false;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [customerCustomFieldsQuery.data, onColumnVisibilityChange]);

  const currentViewConfig = useMemo<CustomerSavedViewConfig>(
    () => ({
      version: 1,
      keyword,
      filters,
      columnVisibility,
      columnOrder,
    }),
    [columnOrder, columnVisibility, filters, keyword],
  );
  const savedViews = savedViewsQuery.data ?? [];
  const activeView =
    savedViews.find((view) => view.id === activeViewId) ?? null;
  const isActiveViewDirty = Boolean(
    activeView &&
    !customerSavedViewConfigEquals(
      currentViewConfig,
      normalizeCustomerSavedViewConfig(activeView.config),
    ),
  );
  const canManageSavedViews = hasPermission(
    CUSTOMER_SAVED_VIEW_MANAGE_PERMISSION,
  );

  const invalidateCustomers = () =>
    queryClient.invalidateQueries({
      queryKey: ['project', 'customers'],
    });

  const invalidateSavedViews = () =>
    queryClient.invalidateQueries({
      queryKey: [
        'project',
        'saved-views',
        tenantId,
        CUSTOMER_SAVED_VIEW_RESOURCE,
      ],
    });

  function selectSavedView(viewId: string | null) {
    if (!viewId) {
      setActiveViewId(null);
      resetAll();
      resetSavedViewTableState({
        columnVisibility: customerTableDefaultColumnVisibility,
      });
      return;
    }

    const view = savedViews.find((candidate) => candidate.id === viewId);
    if (!view) return;

    const config = normalizeCustomerSavedViewConfig(view.config);
    setActiveViewId(view.id);
    setKeyword(config.keyword);
    setFilters({
      ...config.filters,
      businessTypes: [...config.filters.businessTypes],
      statuses: [...config.filters.statuses],
      tagIds: [...config.filters.tagIds],
      customFields: { ...config.filters.customFields },
    });
    applySavedViewTableState(config);
  }

  function openCreateSavedView() {
    setEditingView(null);
    savedViewForm.reset({ name: '' });
    setViewDialogOpen(true);
  }

  function openEditSavedView(view: CustomerSavedView) {
    selectSavedView(view.id);
    setEditingView(view);
    savedViewForm.reset({ name: view.name });
    setViewDialogOpen(true);
  }

  const savedViewMutation = useMutation({
    mutationFn: async ({
      name,
      view,
      config,
    }: {
      name: string;
      view: CustomerSavedView | null;
      config?: CustomerSavedViewConfig;
    }) => {
      if (!tenantId || !userId) {
        throw new Error('Chưa xác định tenant hoặc tài khoản đăng nhập.');
      }

      const nextConfig = config ?? currentViewConfig;

      return view
        ? updateTenantSavedView(tenantId, userId, view, name, nextConfig)
        : createTenantSavedView(
            tenantId,
            userId,
            CUSTOMER_SAVED_VIEW_RESOURCE,
            name,
            nextConfig,
          );
    },
    onSuccess: async (view, variables) => {
      setActiveViewId(view.id);
      setViewDialogOpen(false);
      setEditingView(null);
      await invalidateSavedViews();
      toast.success(
        variables.view
          ? 'Đã cập nhật chế độ xem.'
          : 'Đã tạo chế độ xem dùng chung.',
      );
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteSavedViewMutation = useMutation({
    mutationFn: (view: CustomerSavedView) => {
      if (!tenantId) throw new Error('Chưa xác định tenant.');
      return deleteTenantSavedView(tenantId, view.id);
    },
    onSuccess: async (_, view) => {
      if (activeViewId === view.id) {
        setActiveViewId(null);
        resetAll();
        resetSavedViewTableState({
          columnVisibility: customerTableDefaultColumnVisibility,
        });
      }
      setDeletingView(null);
      await invalidateSavedViews();
      toast.success('Đã xóa chế độ xem.');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function saveCurrentView(config = currentViewConfig) {
    if (!activeView) return;

    savedViewMutation.mutate({
      name: activeView.name,
      view: activeView,
      config,
    });
  }

  const saveMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      if (!tenantId) throw new Error('Chưa xác định tenant.');

      let savedCustomer: Customer;
      if (editingCustomer) {
        const imageUrl = customerImageFile
          ? await uploadCustomerImage(
              tenantId,
              editingCustomer.id,
              customerImageFile,
            )
          : values.imageUrl;

        savedCustomer = await updateCustomer(editingCustomer.id, {
          ...values,
          imageUrl,
        });
      } else {
        savedCustomer = await createCustomer(tenantId, values);

        if (customerImageFile) {
          const imageUrl = await uploadCustomerImage(
            tenantId,
            savedCustomer.id,
            customerImageFile,
          );
          savedCustomer = await updateCustomer(savedCustomer.id, {
            ...values,
            imageUrl,
          });
        }
      }

      await saveCustomerCustomFieldValues(
        tenantId,
        savedCustomer.id,
        values.customFields,
      );

      return savedCustomer;
    },
    onSuccess: async () => {
      toast.success(
        editingCustomer ? 'Đã cập nhật khách hàng.' : 'Đã tạo khách hàng.',
      );
      setDialogOpen(false);
      setCustomerImageFile(null);
      await invalidateCustomers();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: async () => {
      toast.success('Đã xóa khách hàng.');
      await invalidateCustomers();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function openCreate() {
    setEditingCustomer(null);
    setCustomerImageFile(null);
    form.reset(emptyCustomerForm);
    setDialogOpen(true);
  }

  const openEdit = useCallback(
    (customer: Customer) => {
      setEditingCustomer(customer);
      setCustomerImageFile(null);
      form.reset(mapCustomerToFormValues(customer));
      setDialogOpen(true);
    },
    [form],
  );

  function handleCustomerSubmit(values: CustomerFormValues) {
    const missingField = (customerCustomFieldsQuery.data ?? [])
      .filter((customField) => customField.isActive && customField.isRequired)
      .find((customField) => !values.customFields[customField.key]?.trim());

    if (missingField) {
      form.setError(`customFields.${missingField.key}` as never, {
        type: 'required',
        message: `Vui lòng nhập ${missingField.label}.`,
      });
      return;
    }

    saveMutation.mutate(values);
  }

  function openCustomerCustomFieldConfiguration() {
    window.open(
      `${ROUTES.PROJECT.DATA_CONFIGURATION}?entity=customer`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  const columns = useCustomerColumns({
    onEdit: openEdit,
    onDelete: setDeletingCustomer,
    customFields: customerCustomFieldsQuery.data ?? [],
    tagIds: filters.tagIds,
    onTagIdsChange: (value) => setFilter('tagIds', value),
    tagsByCustomerId: customerTagsByCustomerId,
    name: filters.name,
    onNameChange: (value) => setFilter('name', value),
    businessTypes: filters.businessTypes,
    onBusinessTypesChange: (value) =>
      setFilter('businessTypes', value as typeof filters.businessTypes),
    businessRegistrationCode: filters.businessRegistrationCode,
    onBusinessRegistrationCodeChange: (value) =>
      setFilter('businessRegistrationCode', value),
    countryCode: filters.countryCode,
    onCountryCodeChange: (value) => setFilter('countryCode', value),
    region: filters.region,
    onRegionChange: (value) => setFilter('region', value),
    contactSearch: filters.contactSearch,
    onContactSearchChange: (value) => setFilter('contactSearch', value),
    phone: filters.phone,
    onPhoneChange: (value) => setFilter('phone', value),
    email: filters.email,
    onEmailChange: (value) => setFilter('email', value),
    addressDetail: filters.addressDetail,
    onAddressDetailChange: (value) => setFilter('addressDetail', value),
    statuses: filters.statuses,
    onStatusesChange: (value) =>
      setFilter('statuses', value as typeof filters.statuses),
    note: filters.note,
    onNoteChange: (value) => setFilter('note', value),
    customFieldValues: filters.customFields,
    onCustomFieldChange: (key, value) =>
      setFilter('customFields', {
        ...filters.customFields,
        [key]: value,
      }),
  });
  const table = useReactTable({
    data: customers,
    columns,
    getRowId: (row) => row.id,
    state: {
      pagination,
      rowSelection,
      columnVisibility,
      columnOrder,
      columnPinning: CUSTOMER_COLUMN_PINNING,
    },
    onPaginationChange,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange,
    onColumnOrderChange,
    enableRowSelection: true,
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.pageSize),
    getCoreRowModel: getCoreRowModel(),
  });

  const listError = tenantQuery.error ?? workspaceQuery.error;
  const isListLoading = tenantQuery.isPending || workspaceQuery.isLoading;
  const selectedCustomersCount = table.getSelectedRowModel().rows.length;
  const selectableCustomersCount = total;

  const pageHeader = (
    <PageHeader
      title="Khách hàng"
      actions={
        <ShortcutTooltip label="Thêm khách hàng" shortcut="Alt + N">
          <Button
            variant="primary"
            onClick={openCreate}
            data-shortcut-action="create"
          >
            <Plus />
            Thêm khách hàng
          </Button>
        </ShortcutTooltip>
      }
    />
  );

  if (tenantQuery.isError || workspaceQuery.isError) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
        {pageHeader}
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TriangleAlert className="size-8 text-destructive" />
          <div>
            <CardTitle>Không tải được danh sách khách hàng</CardTitle>
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
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-auto p-4 lg:p-5">
      {pageHeader}
      <CustomerStatsCards
        stats={customerStatsQuery.data}
        isLoading={customerStatsQuery.isPending}
      />
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isListLoading}
        isFetching={workspaceQuery.isFetching}
        emptyMessage="Chưa có khách hàng"
        tableLayout={{
          dense: true,
          columnsVisibility: false,
          showInlineFilters,
        }}
      >
        <Card className="min-h-[28rem] flex-1 overflow-hidden">
          <DataGridHeader
            title={
              <span className="inline-flex items-center gap-3 text-sm font-normal text-muted-foreground">
                <span>
                  Đã chọn{' '}
                  <span className="font-semibold text-foreground">
                    {selectedCustomersCount}/{selectableCustomersCount}
                  </span>{' '}
                  khách hàng
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="md"
                      disabled={selectedCustomersCount === 0}
                      aria-label="Thao tác hàng loạt"
                    >
                      Thao tác hàng loạt
                      <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Khách hàng đã chọn</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => setRowSelection({})}>
                      Bỏ chọn tất cả
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            }
            toolbar={
              <>
                <CustomerFilterBar
                  keyword={keyword}
                  onKeywordChange={setKeyword}
                />
                <CustomerFilterViewControl
                  views={savedViews}
                  activeViewId={activeViewId}
                  canManage={canManageSavedViews}
                  isLoading={savedViewsQuery.isPending}
                  isDirty={isActiveViewDirty}
                  isSaving={savedViewMutation.isPending}
                  showInlineFilters={showInlineFilters}
                  onShowInlineFiltersChange={onShowInlineFiltersChange}
                  filters={filters}
                  customFields={customerCustomFieldsQuery.data ?? []}
                  onSelect={selectSavedView}
                  onCreate={openCreateSavedView}
                  onEdit={openEditSavedView}
                  onSaveCurrent={() => saveCurrentView()}
                  onApply={(values: CustomerFilterFormValues) =>
                    setFilters(values)
                  }
                  onReset={() => resetAll()}
                  onSaveToView={
                    canManageSavedViews
                      ? (values) =>
                          saveCurrentView({
                            ...currentViewConfig,
                            filters: values,
                          })
                      : undefined
                  }
                  canSaveToView={Boolean(activeView && canManageSavedViews)}
                  saveDisabled={!isActiveViewDirty}
                />
                <Button
                  variant="outline"
                  mode="icon"
                  aria-label="Làm mới"
                  title="Làm mới"
                  onClick={() => {
                    void workspaceQuery.refetch();
                    void customerStatsQuery.refetch();
                  }}
                >
                  <RefreshCw />
                </Button>
                <DataGridColumnVisibility
                  table={table}
                  mode="drawer"
                  onSaveToView={
                    canManageSavedViews ? () => saveCurrentView() : undefined
                  }
                  canSaveToView={Boolean(activeView && canManageSavedViews)}
                  saveDisabled={!isActiveViewDirty}
                  isSaving={savedViewMutation.isPending}
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

      <CustomerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={editingCustomer ? 'edit' : 'create'}
        form={form}
        onSubmit={handleCustomerSubmit}
        onImageUrlFileChange={setCustomerImageFile}
        regionCodeOptions={customerRegionQuery.data ?? []}
        customFields={customerCustomFieldsQuery.data ?? []}
        onAddCustomField={openCustomerCustomFieldConfiguration}
        onReloadCustomFields={() => {
          void customerCustomFieldsQuery.refetch();
        }}
        isReloadingCustomFields={customerCustomFieldsQuery.isFetching}
        isSaving={saveMutation.isPending}
        title={editingCustomer ? 'Sửa khách hàng' : 'Thêm khách hàng'}
      />
      <CustomerSavedViewFormDialog
        open={viewDialogOpen}
        mode={editingView ? 'edit' : 'create'}
        form={savedViewForm}
        isSaving={savedViewMutation.isPending}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) setEditingView(null);
        }}
        onSubmit={(values) =>
          savedViewMutation.mutate({ name: values.name, view: editingView })
        }
        title={editingView ? 'Sửa chế độ xem' : 'Tạo chế độ xem'}
        onDelete={() => {
          if (!editingView) return;
          setViewDialogOpen(false);
          setEditingView(null);
          setDeletingView(editingView);
        }}
      />
      <ConfirmDialog
        open={Boolean(deletingCustomer)}
        onOpenChange={(open) => {
          if (!open) setDeletingCustomer(null);
        }}
        title="Xóa khách hàng?"
        description={
          deletingCustomer
            ? `Bạn có chắc muốn xóa khách hàng "${deletingCustomer.name}"?`
            : ''
        }
        confirmLabel="Xóa khách hàng"
        confirmVariant="destructive"
        onConfirm={() => {
          if (deletingCustomer) deleteMutation.mutate(deletingCustomer.id);
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
          if (deletingView) deleteSavedViewMutation.mutate(deletingView);
        }}
      />
    </div>
  );
}
