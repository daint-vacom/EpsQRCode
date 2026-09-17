import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { SavedViewFilterControls } from '@/project/saved-views/components/saved-view-filter-controls';
import {
  SavedViewFormDialog,
  useSavedViewForm,
} from '@/project/saved-views/components/saved-view-form-dialog';
import { useSavedViewTableState } from '@/project/saved-views/hooks/use-saved-view-table-state';
import { useTenantSavedViews } from '@/project/saved-views/hooks/use-tenant-saved-views';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from '@tanstack/react-table';
import {
  ChevronDown,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  deleteEmployee,
  loadEmployeeCustomFields,
  loadEmployeeCustomFieldValues,
  saveEmployeeAccess,
  saveEmployeeCustomFieldValues,
  updateEmployee,
  uploadEmployeeAvatar,
} from '../api/employees.api';
import { EmployeeCreateDialog } from '../components/employee-create-dialog';
import {
  EmployeeFilterDrawer,
  type EmployeeFilterDraft,
} from '../components/employee-filter-drawer';
import {
  EmployeeFormDialog,
  useEmployeeForm,
} from '../forms/employee-form.generated';
import { useEmployeeAccessWorkspace } from '../hooks/use-employee-access-workspace';
import { useEmployeeList } from '../hooks/use-employee-list';
import {
  mapEmployeeToFormValues,
  type Employee,
  type EmployeeFormValues,
  type EmployeeListFilters,
} from '../model/employee';
import type { EmployeeCustomerAssignmentInput } from '../model/employee-responsibility';
import {
  EMPLOYEE_SAVED_VIEW_MANAGE_PERMISSION,
  EMPLOYEE_SAVED_VIEW_RESOURCE,
  employeeSavedViewConfigEquals,
  normalizeEmployeeSavedViewConfig,
  type EmployeeSavedView,
  type EmployeeSavedViewConfig,
} from '../model/employee-saved-view';
import {
  EMPLOYEE_COLUMN_PINNING,
  useEmployeeColumns,
} from '../table/employee.columns.generated';
import { EmployeeFilterBar } from '../table/employee.filters.generated';

export function EmployeesPage() {
  const { tenantId } = useTenant();
  const { userId, hasPermission } = useUser();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [customerAssignments, setCustomerAssignments] = useState<
    EmployeeCustomerAssignmentInput[]
  >([]);
  const [employeeImageFile, setEmployeeImageFile] = useState<File | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(
    null,
  );
  const [deletingEmployees, setDeletingEmployees] = useState<Employee[]>([]);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingView, setEditingView] = useState<EmployeeSavedView | null>(
    null,
  );
  const [deletingView, setDeletingView] = useState<EmployeeSavedView | null>(
    null,
  );
  const form = useEmployeeForm();
  const viewForm = useSavedViewForm();
  const canManageEmployeeRoles = hasPermission(
    'organization:employee:assign-role',
  );
  const canManageCustomerAssignments = hasPermission('customers:update');
  const employeeAccess = useEmployeeAccessWorkspace({
    tenantId,
    employeeId: editingEmployee?.id,
    enabled: dialogOpen,
  });

  const employeeCustomFieldsQuery = useQuery({
    queryKey: ['project', 'employees', 'custom-fields', tenantId],
    queryFn: () => loadEmployeeCustomFields(tenantId!),
    enabled: Boolean(tenantId),
    staleTime: 60 * 1000,
  });

  const employeeCustomDataQuery = useQuery({
    queryKey: [
      'project',
      'employees',
      'custom-data',
      tenantId,
      editingEmployee?.id,
    ],
    queryFn: () =>
      loadEmployeeCustomFieldValues(tenantId!, editingEmployee!.id),
    enabled: Boolean(tenantId && dialogOpen && editingEmployee),
  });

  useEffect(() => {
    if (!dialogOpen || !editingEmployee || employeeCustomDataQuery.isLoading) {
      return;
    }

    form.reset({
      ...mapEmployeeToFormValues(editingEmployee),
      customFields: employeeCustomDataQuery.data ?? {},
    });
  }, [
    dialogOpen,
    editingEmployee,
    employeeCustomDataQuery.data,
    employeeCustomDataQuery.isLoading,
    form,
  ]);

  useEffect(() => {
    if (!dialogOpen || !employeeAccess.responsibilityQuery.data) return;
    setCustomerAssignments(employeeAccess.responsibilityQuery.data.assignments);
  }, [dialogOpen, employeeAccess.responsibilityQuery.data]);

  const {
    employees,
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
    employeeTagsByEmployeeId,
    employeeRoleOptions,
    employeeRoleOptionsQuery,
  } = useEmployeeList();

  const savedViewState = useTenantSavedViews<EmployeeListFilters>({
    tenantId,
    userId,
    resource: EMPLOYEE_SAVED_VIEW_RESOURCE,
  });

  const invalidateEmployees = () =>
    queryClient.invalidateQueries({
      queryKey: ['project', 'employees'],
    });

  const saveMutation = useMutation({
    mutationFn: async ({
      values,
      assignments,
    }: {
      values: EmployeeFormValues;
      assignments: EmployeeCustomerAssignmentInput[];
    }) => {
      if (!tenantId) throw new Error('Chưa xác định tenant.');

      if (!editingEmployee) throw new Error('Chưa chọn nhân viên cần sửa.');

      let savedEmployee = await updateEmployee(editingEmployee.id, values);

      if (employeeImageFile) {
        const imageUrl = await uploadEmployeeAvatar(
          tenantId,
          savedEmployee.id,
          employeeImageFile,
        );
        savedEmployee = await updateEmployee(savedEmployee.id, {
          ...values,
          imageUrl,
        });
      }

      await saveEmployeeCustomFieldValues(
        tenantId,
        savedEmployee.id,
        values.customFields,
      );

      if (savedEmployee.userId) {
        await saveEmployeeAccess(
          tenantId,
          savedEmployee.id,
          canManageEmployeeRoles ? values.roleIds : null,
          canManageCustomerAssignments ? assignments : null,
        );
      }

      return savedEmployee;
    },
    onSuccess: async () => {
      toast.success('Đã cập nhật nhân viên.');
      setDialogOpen(false);
      setEmployeeImageFile(null);
      setCustomerAssignments([]);
      await invalidateEmployees();
      await queryClient.invalidateQueries({
        queryKey: ['project', 'customers'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEmployee,
    onSuccess: async () => {
      toast.success('Đã xóa nhân viên.');
      await invalidateEmployees();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (selectedEmployees: Employee[]) =>
      Promise.all(
        selectedEmployees.map((employee) => deleteEmployee(employee.id)),
      ),
    onSuccess: async (_, deletedEmployees) => {
      setDeletingEmployees([]);
      setRowSelection({});
      toast.success(`Đã xóa ${deletedEmployees.length} nhân viên.`);
      await invalidateEmployees();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function openCreate() {
    setCreateDialogOpen(true);
  }

  function openEdit(employee: Employee) {
    setEditingEmployee(employee);
    setCustomerAssignments([]);
    setEmployeeImageFile(null);
    form.reset(mapEmployeeToFormValues(employee));
    setDialogOpen(true);
  }

  function handleEmployeeSubmit(values: EmployeeFormValues) {
    const missingField = (employeeCustomFieldsQuery.data ?? [])
      .filter((field) => field.isActive && field.isRequired)
      .find((field) => !values.customFields[field.key]?.trim());

    if (missingField) {
      form.setError(`customFields.${missingField.key}` as never, {
        type: 'required',
        message: `Vui lòng nhập ${missingField.label}.`,
      });
      return;
    }

    saveMutation.mutate({ values, assignments: customerAssignments });
  }

  function openEmployeeCustomFieldConfiguration() {
    window.open(
      `${ROUTES.PROJECT.DATA_CONFIGURATION}?entity=employee`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  const columns = useEmployeeColumns({
    onEdit: openEdit,
    onDelete: setDeletingEmployee,
    tagIds: filters.tagIds,
    onTagIdsChange: (value) => setFilter('tagIds', value),
    tagsByEmployeeId: employeeTagsByEmployeeId,
    employeeSearch: keyword,
    onEmployeeSearchChange: setKeyword,
    roleIds: filters.roleIds,
    roleOptions: employeeRoleOptions,
    roleOptionsLoading: employeeRoleOptionsQuery.isLoading,
    onRoleIdsChange: (value) => setFilter('roleIds', value),
    statuses: filters.statuses,
    onStatusesChange: (value) => setFilter('statuses', value),
    accountLinked: filters.accountLinked === 'all' ? '' : filters.accountLinked,
    onAccountLinkedChange: (value) =>
      setFilter(
        'accountLinked',
        value === '' ? 'all' : (value as 'linked' | 'unlinked'),
      ),
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
  } = useSavedViewTableState<EmployeeListFilters>({
    visibilityStorageKey: 'project.employees.columnVisibility',
    orderStorageKey: 'project.employees.columnOrder',
    inlineFiltersStorageKey: 'project.employees.showInlineFilters',
  });
  const currentViewConfig = useMemo<EmployeeSavedViewConfig>(
    () => ({ version: 1, keyword, filters, columnVisibility, columnOrder }),
    [columnOrder, columnVisibility, filters, keyword],
  );
  const activeView = savedViewState.activeView;
  const isActiveViewDirty = Boolean(
    activeView &&
    !employeeSavedViewConfigEquals(
      currentViewConfig,
      normalizeEmployeeSavedViewConfig(activeView.config),
    ),
  );
  const canManageSavedViews = hasPermission(
    EMPLOYEE_SAVED_VIEW_MANAGE_PERMISSION,
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
    const config = normalizeEmployeeSavedViewConfig(view.config);
    savedViewState.setActiveViewId(view.id);
    setKeyword(config.keyword);
    setFilters({
      ...config.filters,
      statuses: [...config.filters.statuses],
      roleIds: [...config.filters.roleIds],
      tagIds: [...config.filters.tagIds],
    });
    applySavedViewTableState(config);
  }

  function openCreateSavedView() {
    setEditingView(null);
    viewForm.reset({ name: '' });
    setViewDialogOpen(true);
  }

  function openEditSavedView(view: EmployeeSavedView) {
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
      title="Quản lý nhân viên"
      icon={Users}
      actions={
        <ShortcutTooltip label="Thêm nhân viên" shortcut="Alt + N">
          <Button
            variant="primary"
            onClick={openCreate}
            data-shortcut-action="create"
          >
            <Plus />
            Thêm nhân viên
          </Button>
        </ShortcutTooltip>
      }
    />
  );

  const table = useReactTable({
    data: employees,
    columns,
    getRowId: (row) => row.id,
    state: {
      pagination,
      columnVisibility,
      columnOrder,
      columnPinning: EMPLOYEE_COLUMN_PINNING,
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
  const selectedEmployees = table
    .getSelectedRowModel()
    .rows.map((row) => row.original);

  if (tenantQuery.isError || workspaceQuery.isError) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
        {pageHeader}
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TriangleAlert className="size-8 text-destructive" />
          <div>
            <CardTitle>Không tải được danh sách nhân viên</CardTitle>
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
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      {pageHeader}
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isListLoading}
        isFetching={workspaceQuery.isFetching}
        emptyMessage="Chưa có nhân viên"
        tableLayout={{
          dense: true,
          columnsVisibility: false,
          showInlineFilters,
        }}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            title={
              <span className="inline-flex items-center gap-3 text-sm font-normal text-muted-foreground">
                <span>
                  Đã chọn{' '}
                  <span className="font-semibold text-foreground">
                    {selectedEmployees.length}
                  </span>{' '}
                  nhân viên
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="md"
                      disabled={selectedEmployees.length === 0}
                      aria-label="Thao tác hàng loạt"
                    >
                      Thao tác hàng loạt
                      <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeletingEmployees(selectedEmployees)}
                    >
                      <Trash2 />
                      Xóa nhân viên
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            }
            toolbar={
              <>
                <EmployeeFilterBar
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
                    <EmployeeFilterDrawer
                      keyword={keyword}
                      filters={filters}
                      roleOptions={employeeRoleOptions}
                      roleOptionsLoading={employeeRoleOptionsQuery.isLoading}
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
                          ? (draft: EmployeeFilterDraft) =>
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

      <EmployeeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="edit"
        form={form}
        onSubmit={handleEmployeeSubmit}
        onImageUrlFileChange={setEmployeeImageFile}
        customFields={employeeCustomFieldsQuery.data ?? []}
        onAddCustomField={openEmployeeCustomFieldConfiguration}
        onReloadCustomFields={() => {
          void employeeCustomFieldsQuery.refetch();
        }}
        isReloadingCustomFields={employeeCustomFieldsQuery.isFetching}
        isSaving={saveMutation.isPending}
        title="Sửa nhân viên"
        roleOptions={employeeAccess.roleOptions}
        customerOptions={employeeAccess.customers}
        customerTable={employeeAccess.customerTable}
        customerAssignments={customerAssignments}
        onCustomerAssignmentsChange={setCustomerAssignments}
        canManageRoles={canManageEmployeeRoles}
        canManageCustomerAssignments={canManageCustomerAssignments}
        employeeHasLinkedAccount={Boolean(editingEmployee?.userId)}
        accessIsLoading={employeeAccess.isLoading}
        accessError={employeeAccess.error}
      />
      <EmployeeCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
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
        open={Boolean(deletingEmployee)}
        onOpenChange={(open) => {
          if (!open) setDeletingEmployee(null);
        }}
        title="Xóa nhân viên?"
        description={
          deletingEmployee
            ? `Bạn có chắc muốn xóa nhân viên "${deletingEmployee.displayName}"?`
            : ''
        }
        confirmLabel="Xóa nhân viên"
        confirmVariant="destructive"
        onConfirm={() => {
          if (deletingEmployee) deleteMutation.mutate(deletingEmployee.id);
        }}
      />
      <ConfirmDialog
        open={deletingEmployees.length > 0}
        onOpenChange={(open) => {
          if (!open) setDeletingEmployees([]);
        }}
        title={`Xóa ${deletingEmployees.length} nhân viên?`}
        description={`Bạn có chắc muốn xóa ${deletingEmployees.length} nhân viên đã chọn? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa nhân viên"
        confirmVariant="destructive"
        onConfirm={() => {
          if (deletingEmployees.length > 0) {
            bulkDeleteMutation.mutate(deletingEmployees);
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
