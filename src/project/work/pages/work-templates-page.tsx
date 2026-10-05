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
  ClipboardList,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
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
import { DataGridActionBar } from '@/components/ui/data-grid-action-bar';
import { DataGridColumnVisibility } from '@/components/ui/data-grid-column-visibility';
import { DataGridFilterDrawer } from '@/components/ui/data-grid-filter-drawer';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SelectWithAvatar } from '@/components/ui/select-with-avatar';
import { Separator } from '@/components/ui/separator';
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
  editor: 'root' | 'child';
  templateId: string | null;
  parentId: string | null;
  sortOrder: number;
  values: WorkTemplateFormValues;
  files: File[];
  attachmentIdsToDelete: string[];
  keepEditorState?: boolean;
  successMessage?: string;
}

function normalizeTemplateValues(values: WorkTemplateFormValues) {
  const description = values.description
    .trim()
    .replace(/<p><br\s*\/?><\/p>$/gi, '')
    .replace(/^<p>([\s\S]*)<\/p>$/i, '$1')
    .trim();
  return JSON.stringify({ ...values, description });
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
  const [children, setChildren] = useState<WorkTemplateSummary[]>([]);
  const [childDialogOpen, setChildDialogOpen] = useState(false);
  const [childMode, setChildMode] = useState<'create' | 'edit'>('create');
  const [childTemplateId, setChildTemplateId] = useState<string | null>(null);
  const [isLoadingChildTemplate, setIsLoadingChildTemplate] = useState(false);
  const [childTemplateLoadError, setChildTemplateLoadError] = useState<
    string | null
  >(null);
  const childTemplateLoadRequestRef = useRef(0);
  const [pendingChildTemplateId, setPendingChildTemplateId] = useState<
    string | null
  >(null);
  const [confirmSaveBeforeChildOpen, setConfirmSaveBeforeChildOpen] =
    useState(false);
  const [preserveTabOnOpen, setPreserveTabOnOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [childAttachments, setChildAttachments] = useState<
    Awaited<ReturnType<typeof loadWorkTemplateAttachments>>
  >([]);
  const [childPendingFiles, setChildPendingFiles] = useState<File[]>([]);
  const [childDeletedAttachmentIds, setChildDeletedAttachmentIds] = useState<
    string[]
  >([]);
  const [attachments, setAttachments] = useState<
    Awaited<ReturnType<typeof loadWorkTemplateAttachments>>
  >([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [labelFilters, setLabelFilters] = useState<string[]>([]);
  const [filterDraft, setFilterDraft] = useState({
    status: '',
    priorities: [] as string[],
    assigneeEmployeeId: '',
    labelIds: [] as string[],
  });
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
  const childForm = useWorkTemplateForm();
  const [savedFormValues, setSavedFormValues] = useState(
    workTemplateDefaultValues,
  );
  const isFormDirty = form.formState.isDirty;
  const hasParentEdits =
    (isFormDirty &&
      normalizeTemplateValues(form.getValues()) !==
        normalizeTemplateValues(savedFormValues)) ||
    pendingFiles.length > 0 ||
    deletedAttachmentIds.length > 0;
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
        variables.parentId,
        variables.sortOrder,
        variables.values,
      );
      if (variables.templateId === null && variables.editor === 'root') {
        setTemplateId(savedTemplateId);
        setMode('edit');
      } else if (variables.templateId === null) {
        setChildTemplateId(savedTemplateId);
        setChildMode('edit');
      }
      let storageCleanupFailed = false;
      try {
        await uploadWorkTemplateAttachments(
          tenantId,
          savedTemplateId,
          userId,
          variables.files,
        );
        if (variables.files.length) {
          if (variables.editor === 'root') setPendingFiles([]);
          else setChildPendingFiles([]);
        }
        for (const attachmentId of variables.attachmentIdsToDelete) {
          const result = await deleteWorkTemplateAttachment(
            tenantId,
            savedTemplateId,
            attachmentId,
          );
          storageCleanupFailed ||= result.storageCleanupFailed;
          if (variables.editor === 'root') {
            setAttachments((current) =>
              current.filter((attachment) => attachment.id !== attachmentId),
            );
            setDeletedAttachmentIds((current) =>
              current.filter((id) => id !== attachmentId),
            );
          } else {
            setChildAttachments((current) =>
              current.filter((attachment) => attachment.id !== attachmentId),
            );
            setChildDeletedAttachmentIds((current) =>
              current.filter((id) => id !== attachmentId),
            );
          }
        }
      } catch (error) {
        throw new Error(
          `${variables.editor === 'child' ? 'Mẫu công việc con' : 'Mẫu công việc'} đã được lưu, nhưng chưa xử lý xong tệp đính kèm: ${getApiErrorMessage(error)}`,
        );
      }
      return {
        id: savedTemplateId,
        wasCreated: variables.templateId === null,
        storageCleanupFailed,
      };
    },
    onSuccess: async ({ id, wasCreated, storageCleanupFailed }, variables) => {
      if (variables.editor === 'child') {
        setChildTemplateId(id);
        setChildMode('edit');
        setChildPendingFiles([]);
        setChildDeletedAttachmentIds([]);
        setChildDialogOpen(false);
        setChildTemplateLoadError(null);
        setIsLoadingChildTemplate(false);
        setPendingChildTemplateId(null);
        setPreserveTabOnOpen(true);
        setOpen(true);
        if (tenantId && variables.parentId) {
          void loadWorkTemplate(tenantId, variables.parentId)
            .then((parent) => setChildren(parent.children))
            .catch(() => {
              toast.warning(
                'Mẫu con đã được lưu, nhưng danh sách công việc con chưa thể làm mới.',
              );
            });
        }
      } else if (variables.keepEditorState) {
        setTemplateId(id);
        setMode('edit');
        form.reset(variables.values);
        setSavedFormValues(variables.values);
        setPendingFiles([]);
        setDeletedAttachmentIds([]);
        if (tenantId) {
          try {
            setAttachments(await loadWorkTemplateAttachments(tenantId, id));
          } catch {
            // Keep the editor usable; attachment loading has its own retry path.
          }
        }
      }
      if (storageCleanupFailed) {
        toast.warning(
          'Mẫu đã lưu và tệp đã được đánh dấu xóa, nhưng chưa thể dọn dữ liệu tệp khỏi kho lưu trữ.',
        );
      } else {
        toast.success(
          variables.successMessage ??
            (wasCreated
              ? 'Đã tạo mẫu công việc.'
              : 'Đã cập nhật mẫu công việc.'),
        );
      }
      if (variables.editor === 'root' && !variables.keepEditorState) {
        setOpen(false);
        setTemplateId(null);
        setChildren([]);
        setAttachments([]);
        setPendingFiles([]);
        setDeletedAttachmentIds([]);
        setSavedFormValues(workTemplateDefaultValues);
        form.reset(workTemplateDefaultValues);
      }
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
      const deletedIds = new Set(
        templatesToDelete.map((template) => template.id),
      );
      setChildren((current) =>
        current.filter((child) => !deletedIds.has(child.id)),
      );
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
  const statusFilterOptions = [
    { value: 'active', label: 'Đang sử dụng' },
    { value: 'inactive', label: 'Đã tắt' },
  ];
  const labelFilterOptions = labelOptions.map((label) => ({
    value: label.id,
    label: label.name,
    searchableText: label.name,
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

      const values = toWorkTemplateFormValues(template);
      form.reset(values);
      setSavedFormValues(values);
      setChildren(template.children);
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

  const loadChildTemplateForEdit = async (
    id: string,
    parentTemplateId: string,
  ) => {
    const requestId = childTemplateLoadRequestRef.current + 1;
    childTemplateLoadRequestRef.current = requestId;
    setIsLoadingChildTemplate(true);
    setChildTemplateLoadError(null);

    try {
      const [child, existingAttachments] = await Promise.all([
        loadWorkTemplate(tenantId!, id),
        loadWorkTemplateAttachments(tenantId!, id),
      ]);
      if (requestId !== childTemplateLoadRequestRef.current) return;
      if (child.parentId !== parentTemplateId) {
        throw new Error('Mẫu công việc con không thuộc mẫu cha hiện tại.');
      }
      childForm.reset(toWorkTemplateFormValues(child));
      setChildAttachments(existingAttachments);
      setChildPendingFiles([]);
      setChildDeletedAttachmentIds([]);
    } catch (error) {
      if (requestId === childTemplateLoadRequestRef.current) {
        setChildTemplateLoadError(getApiErrorMessage(error));
      }
    } finally {
      if (requestId === childTemplateLoadRequestRef.current) {
        setIsLoadingChildTemplate(false);
      }
    }
  };

  const startCreate = () => {
    templateLoadRequestRef.current += 1;
    setIsLoadingTemplate(false);
    setTemplateLoadError(null);
    setMode('create');
    setTemplateId(null);
    setSavedFormValues(workTemplateDefaultValues);
    setChildren([]);
    setChildDialogOpen(false);
    setChildMode('create');
    setChildTemplateId(null);
    childTemplateLoadRequestRef.current += 1;
    setIsLoadingChildTemplate(false);
    setChildTemplateLoadError(null);
    setPendingChildTemplateId(null);
    setConfirmSaveBeforeChildOpen(false);
    setPreserveTabOnOpen(false);
    setChildAttachments([]);
    setChildPendingFiles([]);
    setChildDeletedAttachmentIds([]);
    setAttachments([]);
    setPendingFiles([]);
    setDeletedAttachmentIds([]);
    form.reset(workTemplateDefaultValues);
    childForm.reset(workTemplateDefaultValues);
    setOpen(true);
  };

  const startEdit = (id: string) => {
    setMode('edit');
    setTemplateId(id);
    setSavedFormValues(workTemplateDefaultValues);
    setIsLoadingTemplate(true);
    setTemplateLoadError(null);
    form.reset(workTemplateDefaultValues);
    setChildren([]);
    setChildDialogOpen(false);
    setChildMode('create');
    setChildTemplateId(null);
    childTemplateLoadRequestRef.current += 1;
    setIsLoadingChildTemplate(false);
    setChildTemplateLoadError(null);
    setPendingChildTemplateId(null);
    setConfirmSaveBeforeChildOpen(false);
    setPreserveTabOnOpen(false);
    setChildAttachments([]);
    setChildPendingFiles([]);
    setChildDeletedAttachmentIds([]);
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

  const handleChildDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setChildDialogOpen(true);
      return;
    }
    if (mutation.isPending) return;
    childTemplateLoadRequestRef.current += 1;
    setIsLoadingChildTemplate(false);
    setChildTemplateLoadError(null);
    setChildDialogOpen(false);
    setPendingChildTemplateId(null);
    setPreserveTabOnOpen(true);
    setOpen(true);
  };

  const handleSubmit = (values: WorkTemplateFormValues) => {
    mutation.mutate({
      editor: 'root',
      templateId,
      parentId: null,
      sortOrder: 0,
      values,
      files: pendingFiles,
      attachmentIdsToDelete: deletedAttachmentIds,
    });
  };

  const beginChildEditor = (
    childId: string | null,
    parentTemplateId = templateId,
  ) => {
    if (!parentTemplateId) {
      toast.error('Hãy lưu mẫu công việc cha trước khi thêm mẫu con.');
      return;
    }
    childTemplateLoadRequestRef.current += 1;
    setChildMode(childId ? 'edit' : 'create');
    setChildTemplateId(childId);
    setPendingChildTemplateId(null);
    setChildTemplateLoadError(null);
    setIsLoadingChildTemplate(Boolean(childId));
    setChildAttachments([]);
    setChildPendingFiles([]);
    setChildDeletedAttachmentIds([]);
    childForm.reset(workTemplateDefaultValues);
    setOpen(false);
    setChildDialogOpen(true);
    if (childId) {
      void loadChildTemplateForEdit(childId, parentTemplateId);
    }
  };

  const requestChildEditor = (childId: string | null) => {
    setPendingChildTemplateId(childId);
    if (mode === 'create' || !templateId || hasParentEdits) {
      setConfirmSaveBeforeChildOpen(true);
      return;
    }
    beginChildEditor(childId);
  };

  const saveParentBeforeChild = async () => {
    if (!(await form.trigger())) {
      setConfirmSaveBeforeChildOpen(false);
      return;
    }
    const childId = pendingChildTemplateId;
    try {
      const saved = await mutation.mutateAsync({
        editor: 'root',
        templateId,
        parentId: null,
        sortOrder: 0,
        values: form.getValues(),
        files: pendingFiles,
        attachmentIdsToDelete: deletedAttachmentIds,
        keepEditorState: true,
        successMessage: 'Đã lưu mẫu công việc.',
      });
      setConfirmSaveBeforeChildOpen(false);
      beginChildEditor(childId, saved.id);
    } catch {
      // The mutation shows the API error and leaves the parent dialog in place.
    }
  };

  const saveTemplateChild = async (values: WorkTemplateFormValues) => {
    if (!templateId) {
      toast.error('Hãy lưu mẫu công việc cha trước khi lưu mẫu con.');
      return;
    }
    const existingChild = children.find(
      (child) => child.id === childTemplateId,
    );
    try {
      await mutation.mutateAsync({
        editor: 'child',
        templateId: childTemplateId,
        parentId: templateId,
        sortOrder:
          existingChild?.sortOrder ??
          children.reduce((max, child) => Math.max(max, child.sortOrder), -1) +
            1,
        values,
        files: childPendingFiles,
        attachmentIdsToDelete: childDeletedAttachmentIds,
        successMessage:
          childMode === 'create'
            ? 'Đã thêm mẫu công việc con.'
            : 'Đã cập nhật mẫu công việc con.',
      });
    } catch {
      // The mutation shows the API error and leaves the child dialog open.
    }
  };

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi');
    return templates.filter((template) => {
      const matchesSearch =
        !normalizedSearch ||
        `${template.name} ${template.code} ${template.description}`
          .toLocaleLowerCase('vi')
          .includes(normalizedSearch);
      const matchesStatus =
        !statusFilter || template.isActive === (statusFilter === 'active');
      const matchesPriority =
        priorityFilters.length === 0 ||
        priorityFilters.includes(template.priority);
      const matchesAssignee =
        !assigneeFilter || template.assigneeEmployeeId === assigneeFilter;
      const matchesLabels =
        labelFilters.length === 0 ||
        labelFilters.every((labelId) =>
          template.labels.some((label) => label.id === labelId),
        );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesAssignee &&
        matchesLabels
      );
    });
  }, [
    assigneeFilter,
    labelFilters,
    priorityFilters,
    search,
    statusFilter,
    templates,
  ]);
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

  const resetSelectionAndPage = () => {
    setRowSelection({});
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  const openFilterDrawer = () => {
    setFilterDraft({
      status: statusFilter,
      priorities: [...priorityFilters],
      assigneeEmployeeId: assigneeFilter,
      labelIds: [...labelFilters],
    });
    setFilterDrawerOpen(true);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilters([]);
    setAssigneeFilter('');
    setLabelFilters([]);
    setFilterDraft({
      status: '',
      priorities: [],
      assigneeEmployeeId: '',
      labelIds: [],
    });
    resetSelectionAndPage();
  };

  const applyFilterDraft = () => {
    setStatusFilter(filterDraft.status);
    setPriorityFilters(filterDraft.priorities);
    setAssigneeFilter(filterDraft.assigneeEmployeeId);
    setLabelFilters(filterDraft.labelIds);
    resetSelectionAndPage();
    setFilterDrawerOpen(false);
  };

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
              variant="stats"
              stats={
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
                    <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        resetSelectionAndPage();
                      }}
                      placeholder="Tìm tên, mã mẫu..."
                      aria-label="Tìm mẫu công việc"
                      className="ps-9"
                    />
                  </div>
                  <Separator orientation="vertical" className="mx-1 h-6" />
                  <OptionSelect
                    value={statusFilter}
                    onChange={(value) => {
                      setStatusFilter(value);
                      resetSelectionAndPage();
                    }}
                    options={statusFilterOptions}
                    placeholder="Trạng thái"
                    ariaLabel="Lọc theo trạng thái sử dụng"
                    className="w-[180px]"
                  />
                  <MultiSelect
                    value={priorityFilters}
                    onChange={(value) => {
                      setPriorityFilters(value);
                      resetSelectionAndPage();
                    }}
                    options={priorityOptions}
                    placeholder="Mức độ ưu tiên"
                    searchPlaceholder="Tìm mức độ ưu tiên..."
                    maxChips={0}
                    ariaLabel="Lọc theo độ ưu tiên"
                    className="w-[190px]"
                  />
                  <DataGridFilterDrawer
                    open={filterDrawerOpen}
                    onOpenChange={setFilterDrawerOpen}
                    title="Lọc mẫu công việc"
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openFilterDrawer}
                      >
                        <SlidersHorizontal />
                        Lọc chi tiết
                      </Button>
                    }
                    footer={
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={resetFilters}
                        >
                          Xóa bộ lọc
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          onClick={applyFilterDraft}
                        >
                          Áp dụng
                        </Button>
                      </div>
                    }
                  >
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <Label variant="secondary">Trạng thái sử dụng</Label>
                        <OptionSelect
                          value={filterDraft.status}
                          onChange={(value) =>
                            setFilterDraft((current) => ({
                              ...current,
                              status: value,
                            }))
                          }
                          options={statusFilterOptions}
                          placeholder="Trạng thái"
                          ariaLabel="Trạng thái sử dụng"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label variant="secondary">Độ ưu tiên</Label>
                        <MultiSelect
                          value={filterDraft.priorities}
                          onChange={(priorities) =>
                            setFilterDraft((current) => ({
                              ...current,
                              priorities,
                            }))
                          }
                          options={priorityOptions}
                          placeholder="Mức độ ưu tiên"
                          searchPlaceholder="Tìm mức độ ưu tiên..."
                          maxChips={0}
                          ariaLabel="Độ ưu tiên"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label variant="secondary">Người phụ trách</Label>
                        <SelectWithAvatar
                          value={filterDraft.assigneeEmployeeId}
                          onChange={(assigneeEmployeeId) =>
                            setFilterDraft((current) => ({
                              ...current,
                              assigneeEmployeeId,
                            }))
                          }
                          options={assigneeOptions}
                          placeholder="Người phụ trách"
                          searchPlaceholder="Tìm nhân viên..."
                          ariaLabel="Người phụ trách"
                          loading={employeeQuery.isPending}
                          loadingMessage="Đang tải danh sách nhân viên..."
                          disabled={
                            employeeQuery.isPending &&
                            employeeOptions.length === 0
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label variant="secondary">Nhãn</Label>
                        <MultiSelect
                          value={filterDraft.labelIds}
                          onChange={(labelIds) =>
                            setFilterDraft((current) => ({
                              ...current,
                              labelIds,
                            }))
                          }
                          options={labelFilterOptions}
                          placeholder="Nhãn"
                          searchPlaceholder="Tìm nhãn..."
                          maxChips={0}
                          ariaLabel="Nhãn mẫu công việc"
                          loading={labelsQuery.isPending}
                          loadingMessage="Đang tải nhãn..."
                        />
                      </div>
                    </div>
                  </DataGridFilterDrawer>
                </div>
              }
              toolbar={
                <div className="ms-auto flex shrink-0 items-center gap-2.5">
                  <Button
                    variant="outline"
                    mode="icon"
                    aria-label="Làm mới"
                    title="Làm mới"
                    onClick={() => void query.refetch()}
                  >
                    <RefreshCw />
                  </Button>
                  <DataGridColumnVisibility table={table} mode="drawer" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        mode="icon"
                        aria-label="Tùy chọn bộ lọc"
                        title="Tùy chọn bộ lọc"
                      >
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Bộ lọc</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={openFilterDrawer}>
                        <SlidersHorizontal />
                        Mở bộ lọc chi tiết
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={resetFilters}>
                        <X />
                        Xóa tất cả bộ lọc
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
          <DataGridActionBar>
            <Button
              variant="outline"
              size="sm"
              disabled={
                availabilityMutation.isPending || deleteMutation.isPending
              }
              onClick={() =>
                availabilityMutation.mutate({
                  templateIds: selectedTemplates.map((template) => template.id),
                  isActive: true,
                  clearSelection: true,
                })
              }
            >
              <Check />
              Bật sử dụng mẫu
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                availabilityMutation.isPending || deleteMutation.isPending
              }
              onClick={() =>
                availabilityMutation.mutate({
                  templateIds: selectedTemplates.map((template) => template.id),
                  isActive: false,
                  clearSelection: true,
                })
              }
            >
              <X />
              Tắt sử dụng mẫu
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={
                availabilityMutation.isPending || deleteMutation.isPending
              }
              onClick={() => setDeletingTemplates(selectedTemplates)}
            >
              <Trash2 />
              Xóa mẫu
            </Button>
          </DataGridActionBar>
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

      <ConfirmDialog
        open={confirmSaveBeforeChildOpen}
        onOpenChange={(nextOpen) => {
          setConfirmSaveBeforeChildOpen(nextOpen);
          if (!nextOpen) setPendingChildTemplateId(null);
        }}
        title="Lưu mẫu công việc cha trước khi mở mẫu con?"
        description="Cần lưu mẫu công việc cha trước khi thêm hoặc sửa một mẫu công việc con. Các thay đổi chưa lưu trên mẫu cha sẽ được lưu trước."
        confirmLabel="Lưu và tiếp tục"
        cancelLabel="Ở lại"
        isConfirming={mutation.isPending}
        closeOnConfirm={false}
        onConfirm={() => void saveParentBeforeChild()}
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
        allowChildren
        preserveTabOnOpen={preserveTabOnOpen}
        childrenEditor={
          <WorkTemplateEditorSections
            section="children"
            children={children}
            employeeOptions={employeeOptions}
            onAddChild={() => requestChildEditor(null)}
            onEditChild={requestChildEditor}
            onDeleteChild={(child) => setDeletingTemplates([child])}
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
            employeeOptions={employeeOptions}
            attachments={attachments}
            pendingFiles={pendingFiles}
            deletedAttachmentIds={deletedAttachmentIds}
            onPendingFilesChange={setPendingFiles}
            onDeletedAttachmentIdsChange={setDeletedAttachmentIds}
          />
        }
      />

      <WorkTemplateDialog
        open={childDialogOpen}
        onOpenChange={handleChildDialogOpenChange}
        mode={childMode}
        form={childForm}
        onSubmit={saveTemplateChild}
        isSaving={mutation.isPending}
        isLoading={isLoadingChildTemplate}
        errorMessage={childTemplateLoadError}
        onRetry={() => {
          if (childTemplateId && templateId) {
            void loadChildTemplateForEdit(childTemplateId, templateId);
          }
        }}
        title={
          childMode === 'create'
            ? 'Thêm mẫu công việc con'
            : 'Sửa mẫu công việc con'
        }
        priorityOptions={priorityOptions}
        assigneeOptions={assigneeOptions}
        labelOptions={labelOptions}
        onCreateLabel={(name) => createLabelMutation.mutateAsync(name)}
        childCount={0}
        attachmentCount={childAttachments.length + childPendingFiles.length}
        allowChildren={false}
        childrenEditor={null}
        attachmentsEditor={
          <WorkTemplateEditorSections
            section="attachments"
            children={[]}
            employeeOptions={employeeOptions}
            attachments={childAttachments}
            pendingFiles={childPendingFiles}
            deletedAttachmentIds={childDeletedAttachmentIds}
            onPendingFilesChange={setChildPendingFiles}
            onDeletedAttachmentIdsChange={setChildDeletedAttachmentIds}
          />
        }
      />
    </div>
  );
}
