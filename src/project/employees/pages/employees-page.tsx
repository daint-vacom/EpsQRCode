import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { SavedViewFilterMenu } from '@/project/saved-views/components/saved-view-filter-controls';
import {
  SavedViewFormDialog,
  useSavedViewForm,
} from '@/project/saved-views/components/saved-view-form-dialog';
import { useSavedViewTableState } from '@/project/saved-views/hooks/use-saved-view-table-state';
import { useSavedViews } from '@/project/saved-views/hooks/use-saved-views';
import { TagColumnFilter } from '@/project/tags/components/tag-column-filter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from '@tanstack/react-table';
import {
  Funnel,
  MoreVertical,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
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
import { MultiSelect } from '@/components/ui/multi-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  createEmployeeAccount,
  deleteEmployee,
  loadEmployeeCustomFields,
  loadEmployeeCustomFieldValues,
  resetEmployeePassword,
  saveEmployeeAccess,
  saveEmployeeCustomFieldValues,
  updateEmployee,
  updateEmployeeUsername,
  uploadEmployeeAvatar,
} from '../api/employees.api';
import { EmployeeCreateDialog } from '../components/employee-create-dialog';
import {
  EmployeeFilterDrawer,
  type EmployeeFilterDraft,
} from '../components/employee-filter-drawer';
import { EmployeeResetPasswordDialog } from '../components/employee-reset-password-dialog';
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
import {
  EMPLOYEE_SAVED_VIEW_MANAGE_PERMISSION,
  EMPLOYEE_SAVED_VIEW_RESOURCE,
  employeeSavedViewConfigEquals,
  normalizeEmployeeSavedViewConfig,
  type EmployeeSavedView,
  type EmployeeSavedViewConfig,
} from '../model/employee-saved-view';
import { toEmployeeRoleFilterOption } from '../table/employee-column-filters';
import {
  EMPLOYEE_COLUMN_PINNING,
  useEmployeeColumns,
} from '../table/employee.columns.generated';
import { EmployeeFilterBar } from '../table/employee.filters.generated';

const employeeDefaultColumnVisibility = { account: false };

export function EmployeesPage() {
  const intl = useIntl();
  const { userId, hasPermission } = useUser();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeImageFile, setEmployeeImageFile] = useState<File | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(
    null,
  );
  const [deletingEmployees, setDeletingEmployees] = useState<Employee[]>([]);
  const [resettingPasswordFor, setResettingPasswordFor] =
    useState<Employee | null>(null);
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
  const canManageEmployeeAccount = hasPermission(
    'organization:employee:update',
  );
  const canResetEmployeePassword = hasPermission(
    'organization:employee:reset-password',
  );
  const employeeAccess = useEmployeeAccessWorkspace({
    enabled: dialogOpen,
  });

  const employeeCustomFieldsQuery = useQuery({
    queryKey: ['project', 'employees', 'custom-fields'],
    queryFn: () => loadEmployeeCustomFields(),
    staleTime: 60 * 1000,
  });

  const employeeCustomDataQuery = useQuery({
    queryKey: ['project', 'employees', 'custom-data', editingEmployee?.id],
    queryFn: () => loadEmployeeCustomFieldValues(editingEmployee!.id),
    enabled: Boolean(dialogOpen && editingEmployee),
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
    accountQuery,
    workspaceQuery,
    employeeTagsByEmployeeId,
    employeeRoleOptions,
    employeeRoleOptionsQuery,
  } = useEmployeeList();

  const savedViewState = useSavedViews<EmployeeListFilters>({
    userId,
    resource: EMPLOYEE_SAVED_VIEW_RESOURCE,
  });

  const invalidateEmployees = () =>
    queryClient.invalidateQueries({
      queryKey: ['project', 'employees'],
    });

  const saveMutation = useMutation({
    mutationFn: async ({ values }: { values: EmployeeFormValues }) => {
      if (!editingEmployee) throw new Error('Chưa chọn nhân viên cần sửa.');

      let savedEmployee = await updateEmployee(editingEmployee.id, values);

      if (employeeImageFile) {
        const imageUrl = await uploadEmployeeAvatar(
          savedEmployee.id,
          employeeImageFile,
        );
        savedEmployee = await updateEmployee(savedEmployee.id, {
          ...values,
          imageUrl,
        });
      }

      if (savedEmployee.userId) {
        const requestedUsername = values.accountUsername.trim().toLowerCase();
        const currentUsername = editingEmployee.username?.toLowerCase() ?? '';
        if (requestedUsername && requestedUsername !== currentUsername) {
          const account = await updateEmployeeUsername(
            savedEmployee.id,
            requestedUsername,
          );
          savedEmployee = {
            ...savedEmployee,
            username: account.username ?? requestedUsername,
          };
        }
      } else if (values.createAccount && canManageEmployeeAccount) {
        const account = await createEmployeeAccount(
          savedEmployee.id,
          values.accountUsername,
          values.initialPassword,
        );
        savedEmployee = {
          ...savedEmployee,
          userId: account.user_id,
          username: account.username ?? values.accountUsername,
          accountLinked: true,
        };
      }

      await saveEmployeeCustomFieldValues(
        savedEmployee.id,
        values.customFields,
      );

      if (savedEmployee.userId) {
        await saveEmployeeAccess(
          savedEmployee.id,
          canManageEmployeeRoles ? values.roleIds : null,
        );
      }

      return savedEmployee;
    },
    onSuccess: async () => {
      toast.success('Đã cập nhật nhân viên.');
      setDialogOpen(false);
      setEmployeeImageFile(null);
      await invalidateEmployees();
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

  const resetPasswordMutation = useMutation({
    mutationFn: async ({
      employee,
      password,
    }: {
      employee: Employee;
      password: string;
    }) => {
      return resetEmployeePassword(employee.id, password);
    },
    onSuccess: () => {
      toast.success('Đã đổi mật khẩu tài khoản nhân viên.');
      setResettingPasswordFor(null);
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

    saveMutation.mutate({ values });
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
    onResetPassword: setResettingPasswordFor,
    canResetPassword: canResetEmployeePassword,
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
    defaultColumnVisibility: employeeDefaultColumnVisibility,
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
    initialState: { columnVisibility: employeeDefaultColumnVisibility },
    onPaginationChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.pageSize),
    getCoreRowModel: getCoreRowModel(),
  });

  const listError = accountQuery.error ?? workspaceQuery.error;
  const isListLoading = accountQuery.isPending || workspaceQuery.isLoading;
  const selectedEmployees = table
    .getSelectedRowModel()
    .rows.map((row) => row.original);

  if (accountQuery.isError || workspaceQuery.isError) {
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
              void accountQuery.refetch();
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
            variant="stats"
            recordCountLabel="nhân viên"
            className="pe-3"
            stats={
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <EmployeeFilterBar
                  className="w-64 shrink-0"
                  keyword={keyword}
                  onKeywordChange={setKeyword}
                />
                <Separator orientation="vertical" className="mx-1 h-6" />
                <MultiSelect
                  value={filters.roleIds}
                  onChange={(value) => setFilter('roleIds', value)}
                  options={employeeRoleOptions.map(toEmployeeRoleFilterOption)}
                  placeholder={intl.formatMessage({
                    id: 'employees.fields.roles',
                  })}
                  searchPlaceholder={intl.formatMessage({
                    id: 'employees.filters.searchRoles',
                  })}
                  loading={employeeRoleOptionsQuery.isLoading}
                  maxChips={0}
                  size="md"
                  ariaLabel={intl.formatMessage({
                    id: 'employees.filters.rolesAriaLabel',
                  })}
                  className="w-[200px] shrink-0"
                />
                <TagColumnFilter
                  value={filters.tagIds}
                  onChange={(value) => setFilter('tagIds', value)}
                  moduleCodes={['organization']}
                  placeholder={intl.formatMessage({ id: 'common.fields.tags' })}
                  ariaLabel={intl.formatMessage({
                    id: 'employees.filters.tagsAriaLabel',
                  })}
                  size="md"
                  className="w-[200px] shrink-0"
                />
                <EmployeeFilterDrawer
                  keyword={keyword}
                  filters={filters}
                  roleOptions={employeeRoleOptions}
                  roleOptionsLoading={employeeRoleOptionsQuery.isLoading}
                  open={filterDrawerOpen}
                  onOpenChange={setFilterDrawerOpen}
                  onApply={({ keyword: nextKeyword, filters: nextFilters }) => {
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
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      mode="icon"
                      aria-label="Lọc chi tiết"
                      title="Lọc chi tiết"
                    >
                      <Funnel />
                    </Button>
                  }
                />
              </div>
            }
            toolbar={
              <div className="ms-auto flex shrink-0 items-center gap-2.5">
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
                      title="Tùy chọn chế độ xem và bộ lọc"
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
            variant="destructive"
            size="sm"
            onClick={() => setDeletingEmployees(selectedEmployees)}
          >
            <Trash2 />
            Xóa nhân viên
          </Button>
        </DataGridActionBar>
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
        title={
          editingEmployee ? (
            <>
              Sửa nhân viên:{' '}
              <span className="font-semibold text-primary">
                {editingEmployee.displayName}
              </span>
            </>
          ) : (
            'Sửa nhân viên'
          )
        }
        roleOptions={employeeAccess.roleOptions}
        canManageRoles={canManageEmployeeRoles}
        canManageAccount={canManageEmployeeAccount}
        employeeHasLinkedAccount={Boolean(editingEmployee?.userId)}
      />
      <EmployeeCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <EmployeeResetPasswordDialog
        open={Boolean(resettingPasswordFor)}
        onOpenChange={(open) => {
          if (!open && !resetPasswordMutation.isPending) {
            setResettingPasswordFor(null);
          }
        }}
        employee={resettingPasswordFor}
        isSaving={resetPasswordMutation.isPending}
        onSubmit={(password) => {
          if (!resettingPasswordFor) return;
          resetPasswordMutation.mutate({
            employee: resettingPasswordFor,
            password,
          });
        }}
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
            ? `Chế độ xem "${deletingView.name}" sẽ bị xóa cho toàn bộ workspace.`
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
