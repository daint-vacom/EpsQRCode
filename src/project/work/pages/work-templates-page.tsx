import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSavedViewTableState } from '@/project/saved-views/hooks/use-saved-view-table-state';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
  type RowSelectionState,
} from '@tanstack/react-table';
import {
  Check,
  ChevronDown,
  ClipboardList,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { IDENTITY_AVATAR_TONES } from '@/components/common/gradient-avatar';
import {
  createWorkLabel,
  deleteWorkTemplateAttachment,
  deleteWorkTemplates,
  loadWorkEmployeeOptions,
  loadWorkLabels,
  loadWorkTemplate,
  loadWorkTemplateAttachments,
  loadWorkTemplates,
  saveWorkTemplate,
  updateWorkTemplatesAvailability,
  uploadWorkTemplateAttachments,
} from '../api/work.api';
import { WorkTemplateDialog } from '../components/work-template-dialog';
import { WorkTemplateEditorSections } from '../components/work-template-editor-sections';
import { useWorkTemplateForm } from '../forms/work-template-form.generated';
import {
  toWorkTemplateFormValues,
  WORK_PRIORITIES,
  WORK_PRIORITY_LABELS,
  workTemplateDefaultValues,
  type WorkTemplateChildFormValues,
  type WorkTemplateFormValues,
  type WorkTemplateSummary,
} from '../model/work';
import {
  useWorkTemplateSummaryColumns,
  WORK_TEMPLATE_SUMMARY_COLUMN_PINNING,
} from '../table/work-template.columns.generated';

const queryKey = ['project', 'work', 'templates'] as const;
const MIN_TEMPLATE_COLUMN_WIDTH = 460;
const WORK_TEMPLATE_FIXED_COLUMN_WIDTHS = {
  select: 44,
  availability: 140,
  labels: 180,
  childCount: 140,
  updatedAt: 150,
  priority: 140,
  assignee: 180,
  actions: 80,
} as const;

interface SaveTemplateVariables {
  templateId: string | null;
  values: WorkTemplateFormValues;
  children: WorkTemplateChildFormValues[];
  files: File[];
  attachmentIdsToDelete: string[];
}

export function WorkTemplatesPage() {
  const { tenantId } = useTenant();
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(
    null,
  );
  const templateLoadRequestRef = useRef(0);
  const [children, setChildren] = useState<WorkTemplateChildFormValues[]>([]);
  const [attachments, setAttachments] = useState<
    Awaited<ReturnType<typeof loadWorkTemplateAttachments>>
  >([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [search, setSearch] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deletingTemplates, setDeletingTemplates] = useState<
    WorkTemplateSummary[] | null
  >(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>(
    [],
  );
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const [tableViewportWidth, setTableViewportWidth] = useState(0);
  const form = useWorkTemplateForm();
  const query = useQuery({
    queryKey: [...queryKey, tenantId],
    queryFn: () => loadWorkTemplates(tenantId!),
    enabled: Boolean(tenantId),
  });
  const employeeQuery = useQuery({
    queryKey: ['project', 'work', 'employees', tenantId],
    queryFn: () => loadWorkEmployeeOptions(tenantId!),
    enabled: Boolean(tenantId),
  });
  const labelsQuery = useQuery({
    queryKey: ['project', 'work', 'labels', tenantId],
    queryFn: () => loadWorkLabels(tenantId!),
    enabled: Boolean(tenantId),
  });
  const createLabelMutation = useMutation({
    mutationFn: (name: string) => createWorkLabel(tenantId!, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['project', 'work', 'labels', tenantId],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const mutation = useMutation({
    mutationFn: async (variables: SaveTemplateVariables) => {
      if (!tenantId || !userId) {
        throw new Error('Không xác định được tài khoản hoặc tenant hiện tại.');
      }
      const savedTemplateId = await saveWorkTemplate(
        tenantId,
        variables.templateId,
        variables.values,
        variables.children,
      );
      if (variables.templateId === null) {
        setTemplateId(savedTemplateId);
        setMode('edit');
      }
      let storageCleanupFailed = false;
      try {
        await uploadWorkTemplateAttachments(
          tenantId,
          savedTemplateId,
          userId,
          variables.files,
        );
        if (variables.files.length) setPendingFiles([]);
        for (const attachmentId of variables.attachmentIdsToDelete) {
          const result = await deleteWorkTemplateAttachment(
            tenantId,
            savedTemplateId,
            attachmentId,
          );
          storageCleanupFailed ||= result.storageCleanupFailed;
          setAttachments((current) =>
            current.filter((attachment) => attachment.id !== attachmentId),
          );
          setDeletedAttachmentIds((current) =>
            current.filter((id) => id !== attachmentId),
          );
        }
      } catch (error) {
        throw new Error(
          `Mẫu đã được lưu, nhưng chưa xử lý xong tệp đính kèm: ${getApiErrorMessage(error)}`,
        );
      }
      return {
        id: savedTemplateId,
        wasCreated: variables.templateId === null,
        storageCleanupFailed,
      };
    },
    onSuccess: async ({ wasCreated, storageCleanupFailed }) => {
      if (storageCleanupFailed) {
        toast.warning(
          'Mẫu đã lưu và tệp đã được đánh dấu xóa, nhưng chưa thể dọn dữ liệu tệp khỏi kho lưu trữ.',
        );
      } else {
        toast.success(
          wasCreated ? 'Đã tạo mẫu công việc.' : 'Đã cập nhật mẫu công việc.',
        );
      }
      setOpen(false);
      setTemplateId(null);
      setChildren([]);
      setAttachments([]);
      setPendingFiles([]);
      setDeletedAttachmentIds([]);
      form.reset(workTemplateDefaultValues);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const availabilityMutation = useMutation({
    mutationFn: (variables: {
      templateIds: string[];
      isActive: boolean;
      clearSelection?: boolean;
    }) =>
      updateWorkTemplatesAvailability(
        tenantId!,
        variables.templateIds,
        variables.isActive,
      ),
    onSuccess: async (_, { templateIds, isActive, clearSelection }) => {
      queryClient.setQueryData<WorkTemplateSummary[]>(
        [...queryKey, tenantId],
        (current) =>
          current?.map((template) =>
            templateIds.includes(template.id)
              ? { ...template, isActive }
              : template,
          ),
      );
      if (clearSelection) setRowSelection({});
      const isBulk = templateIds.length > 1 || clearSelection;
      toast.success(
        isBulk
          ? `Đã ${isActive ? 'bật' : 'tắt'} sử dụng ${templateIds.length} mẫu công việc.`
          : isActive
            ? 'Đã cho phép sử dụng mẫu công việc.'
            : 'Đã tắt mẫu công việc.',
      );
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (templatesToDelete: WorkTemplateSummary[]) =>
      deleteWorkTemplates(
        tenantId!,
        templatesToDelete.map((template) => template.id),
      ),
    onSuccess: async ({ storageCleanupFailed }, templatesToDelete) => {
      setDeletingTemplates(null);
      setRowSelection({});
      if (storageCleanupFailed) {
        toast.warning(
          `Đã xóa ${templatesToDelete.length} mẫu công việc, nhưng chưa dọn được một số tệp khỏi kho lưu trữ.`,
        );
      } else {
        toast.success(`Đã xóa ${templatesToDelete.length} mẫu công việc.`);
      }
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const templates = useMemo(() => query.data ?? [], [query.data]);
  const employeeOptions = employeeQuery.data ?? [];
  const labelOptions = labelsQuery.data ?? [];
  const priorityOptions = WORK_PRIORITIES.map((value) => ({
    value,
    label: WORK_PRIORITY_LABELS[value],
  }));
  const childLabelOptions = labelOptions.map((label) => ({
    value: label.id,
    label: label.name,
    data: { color: label.color },
  }));
  const assigneeOptions = employeeOptions.map((employee) => ({
    value: employee.id,
    label: employee.label,
    code: employee.employeeCode,
    avatarUrl: employee.avatarUrl,
    avatarTone: IDENTITY_AVATAR_TONES.employee,
    searchableText: `${employee.label} ${employee.employeeCode}`,
    data: employee,
  }));

  const loadTemplateForEdit = async (id: string) => {
    const requestId = templateLoadRequestRef.current + 1;
    templateLoadRequestRef.current = requestId;
    setIsLoadingTemplate(true);
    setTemplateLoadError(null);

    try {
      const [template, existingAttachments] = await Promise.all([
        loadWorkTemplate(tenantId!, id),
        loadWorkTemplateAttachments(tenantId!, id),
      ]);
      if (requestId !== templateLoadRequestRef.current) return;

      form.reset(toWorkTemplateFormValues(template));
      setChildren(
        template.children.map((child) => ({
          title: child.title,
          description: child.description,
          priority: child.priority,
          assigneeEmployeeId: child.assigneeEmployeeId,
          color: child.color,
          labelIds: child.labelIds,
        })),
      );
      setAttachments(existingAttachments);
      setPendingFiles([]);
      setDeletedAttachmentIds([]);
    } catch (error) {
      if (requestId === templateLoadRequestRef.current) {
        setTemplateLoadError(getApiErrorMessage(error));
      }
    } finally {
      if (requestId === templateLoadRequestRef.current) {
        setIsLoadingTemplate(false);
      }
    }
  };

  const startCreate = () => {
    templateLoadRequestRef.current += 1;
    setIsLoadingTemplate(false);
    setTemplateLoadError(null);
    setMode('create');
    setTemplateId(null);
    setChildren([]);
    setAttachments([]);
    setPendingFiles([]);
    setDeletedAttachmentIds([]);
    form.reset(workTemplateDefaultValues);
    setOpen(true);
  };

  const startEdit = (id: string) => {
    setMode('edit');
    setTemplateId(id);
    setIsLoadingTemplate(true);
    setTemplateLoadError(null);
    form.reset(workTemplateDefaultValues);
    setChildren([]);
    setAttachments([]);
    setPendingFiles([]);
    setDeletedAttachmentIds([]);
    setOpen(true);
    void loadTemplateForEdit(id);
  };

  const handleTemplateDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      templateLoadRequestRef.current += 1;
      setIsLoadingTemplate(false);
      setTemplateLoadError(null);
    }
    setOpen(nextOpen);
  };

  const handleSubmit = (values: WorkTemplateFormValues) => {
    if (children.some((child) => !child.title.trim())) {
      toast.error('Vui lòng nhập tên cho tất cả công việc con.');
      return;
    }
    mutation.mutate({
      templateId,
      values,
      children,
      files: pendingFiles,
      attachmentIdsToDelete: deletedAttachmentIds,
    });
  };

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi');
    if (!normalizedSearch) return templates;
    return templates.filter((template) =>
      `${template.name} ${template.code} ${template.description}`
        .toLocaleLowerCase('vi')
        .includes(normalizedSearch),
    );
  }, [search, templates]);
  const employeeNamesById = Object.fromEntries(
    employeeOptions.map((employee) => [employee.id, employee.label]),
  );
  const {
    columnVisibility,
    onColumnVisibilityChange,
    columnOrder,
    onColumnOrderChange,
  } = useSavedViewTableState<Record<string, unknown>>({
    visibilityStorageKey: 'project.workTemplates.columnVisibility',
    orderStorageKey: 'project.workTemplates.columnOrder',
    defaultColumnVisibility: {
      priority: false,
      assignee: false,
    },
  });
  useLayoutEffect(() => {
    const viewport = tableViewportRef.current;
    if (!viewport) return;

    const updateWidth = () => setTableViewportWidth(viewport.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  const fixedColumnsWidth = Object.entries(
    WORK_TEMPLATE_FIXED_COLUMN_WIDTHS,
  ).reduce(
    (total, [columnId, width]) =>
      total + (columnVisibility[columnId] === false ? 0 : width),
    0,
  );
  const templateColumnSize = Math.max(
    MIN_TEMPLATE_COLUMN_WIDTH,
    Math.floor(tableViewportWidth - fixedColumnsWidth),
  );
  const columns = useWorkTemplateSummaryColumns({
    onEdit: (template) => void startEdit(template.id),
    onDelete: (template) => setDeletingTemplates([template]),
    employeeNamesById,
    onAvailabilityChange: (template, isActive) =>
      availabilityMutation.mutate({
        templateIds: [template.id],
        isActive,
      }),
    isAvailabilityPending: availabilityMutation.isPending,
    templateColumnSize,
  });
  const table = useReactTable({
    data: filteredTemplates,
    columns,
    getRowId: (row) => row.id,
    state: {
      pagination,
      rowSelection,
      columnVisibility,
      columnOrder,
      columnPinning: WORK_TEMPLATE_SUMMARY_COLUMN_PINNING,
    },
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange,
    onColumnOrderChange,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const selectedTemplates = table
    .getSelectedRowModel()
    .rows.map((row) => row.original);
  const selectedTemplatesCount = selectedTemplates.length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title="Quản lý mẫu công việc"
        icon={ClipboardList}
        titleAside={
          <span className="text-sm text-muted-foreground">
            {filteredTemplates.length} mẫu
          </span>
        }
        actions={
          <Button onClick={startCreate}>
            <Plus /> Thêm mẫu
          </Button>
        }
      />

      {query.isError ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TriangleAlert className="size-8 text-destructive" />
          <div>
            <CardTitle>Không tải được danh sách mẫu công việc</CardTitle>
            <CardDescription className="mt-1">
              {getApiErrorMessage(query.error)}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </Card>
      ) : (
        <DataGrid
          table={table}
          recordCount={filteredTemplates.length}
          isLoading={query.isLoading}
          isFetching={query.isFetching}
          emptyMessage={
            search ? 'Không tìm thấy mẫu công việc' : 'Chưa có mẫu công việc'
          }
          tableLayout={{
            dense: true,
            columnsVisibility: false,
            showInlineFilters: false,
          }}
          tableClassNames={{ base: 'w-fit' }}
        >
          <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
            <DataGridHeader
              title={
                <span className="inline-flex items-center gap-3 text-sm font-normal text-muted-foreground">
                  <span>
                    Đã chọn{' '}
                    <span className="font-semibold text-foreground">
                      {selectedTemplatesCount}
                    </span>{' '}
                    mẫu công việc
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={
                          selectedTemplatesCount === 0 ||
                          availabilityMutation.isPending ||
                          deleteMutation.isPending
                        }
                        aria-label="Thao tác hàng loạt"
                      >
                        Thao tác hàng loạt
                        <ChevronDown />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onSelect={() =>
                          availabilityMutation.mutate({
                            templateIds: selectedTemplates.map(
                              (template) => template.id,
                            ),
                            isActive: true,
                            clearSelection: true,
                          })
                        }
                      >
                        <Check />
                        Bật sử dụng mẫu
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          availabilityMutation.mutate({
                            templateIds: selectedTemplates.map(
                              (template) => template.id,
                            ),
                            isActive: false,
                            clearSelection: true,
                          })
                        }
                      >
                        <X />
                        Tắt sử dụng mẫu
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeletingTemplates(selectedTemplates)}
                      >
                        <Trash2 />
                        Xóa mẫu
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              }
              toolbar={
                <div className="flex w-full flex-nowrap items-center gap-2 sm:w-auto">
                  <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
                    <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setRowSelection({});
                        setPagination((current) => ({
                          ...current,
                          pageIndex: 0,
                        }));
                      }}
                      placeholder="Tìm tên, mã mẫu..."
                      aria-label="Tìm mẫu công việc"
                      className="ps-9"
                    />
                  </div>
                  <DataGridColumnVisibility table={table} mode="drawer" />
                </div>
              }
            />
            <CardTable className="min-h-0 flex-1">
              <ScrollArea className="h-full" viewportRef={tableViewportRef}>
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardTable>
            <CardFooter className="justify-between">
              <DataGridPagination />
            </CardFooter>
          </Card>
        </DataGrid>
      )}

      <ConfirmDialog
        open={Boolean(deletingTemplates?.length)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeletingTemplates(null);
        }}
        title={
          deletingTemplates?.length === 1
            ? 'Xóa mẫu công việc?'
            : 'Xóa các mẫu công việc đã chọn?'
        }
        description={
          deletingTemplates?.length === 1
            ? `Bạn có chắc muốn xóa mẫu "${deletingTemplates[0].name}"? Thao tác này không thể hoàn tác.`
            : `Bạn có chắc muốn xóa ${deletingTemplates?.length ?? 0} mẫu công việc đã chọn? Thao tác này không thể hoàn tác.`
        }
        confirmLabel="Xóa mẫu công việc"
        confirmVariant="destructive"
        isConfirming={deleteMutation.isPending}
        closeOnConfirm={false}
        onConfirm={() => {
          if (deletingTemplates?.length) {
            deleteMutation.mutate(deletingTemplates);
          }
        }}
      />

      <WorkTemplateDialog
        open={open}
        onOpenChange={handleTemplateDialogOpenChange}
        mode={mode}
        form={form}
        onSubmit={handleSubmit}
        isSaving={mutation.isPending}
        isLoading={isLoadingTemplate}
        errorMessage={templateLoadError}
        onRetry={() => {
          if (templateId) void loadTemplateForEdit(templateId);
        }}
        title={mode === 'create' ? 'Thêm mẫu công việc' : 'Sửa mẫu công việc'}
        priorityOptions={priorityOptions}
        assigneeOptions={assigneeOptions}
        labelOptions={labelOptions}
        onCreateLabel={(name) => createLabelMutation.mutateAsync(name)}
        childCount={children.length}
        attachmentCount={attachments.length + pendingFiles.length}
        childrenEditor={
          <WorkTemplateEditorSections
            section="children"
            children={children}
            onChildrenChange={setChildren}
            employeeOptions={employeeOptions}
            labelOptions={childLabelOptions}
            attachments={attachments}
            pendingFiles={pendingFiles}
            deletedAttachmentIds={deletedAttachmentIds}
            onPendingFilesChange={setPendingFiles}
            onDeletedAttachmentIdsChange={setDeletedAttachmentIds}
          />
        }
        attachmentsEditor={
          <WorkTemplateEditorSections
            section="attachments"
            children={children}
            onChildrenChange={setChildren}
            employeeOptions={employeeOptions}
            labelOptions={childLabelOptions}
            attachments={attachments}
            pendingFiles={pendingFiles}
            deletedAttachmentIds={deletedAttachmentIds}
            onPendingFilesChange={setPendingFiles}
            onDeletedAttachmentIdsChange={setDeletedAttachmentIds}
          />
        }
      />
    </div>
  );
}
