import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { EmployeeIdentity } from '@/project/employees/components/employee-identity';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  useReactTable,
  type PaginationState,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ClipboardList,
  FileText,
  Plus,
  RefreshCw,
  TriangleAlert,
  UserRoundSearch,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '@/lib/date';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGrid } from '@/components/ui/data-grid';
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
import { ErrorState } from '@/components/ui/error-state';
import {
  EventCalendar,
  type CalendarEvent,
} from '@/components/ui/event-calendar';
import { FilterToolbar } from '@/components/ui/filter-toolbar';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IDENTITY_AVATAR_TONES } from '@/components/common/gradient-avatar';
import {
  createWorkItem,
  createWorkLabel,
  deleteWorkItem,
  deleteWorkItemAttachment,
  loadCurrentWorkEmployeeId,
  loadWorkEmployeeOptions,
  loadWorkItemAttachments,
  loadWorkItems,
  loadWorkLabels,
  loadWorkLinkOptions,
  loadWorkTemplate,
  loadWorkTemplates,
  loadWorkTree,
  updateWorkItem,
  updateWorkItemStatus,
  uploadWorkItemAttachments,
} from '../api/work.api';
import { WorkDetailDialog } from '../components/work-detail-dialog';
import {
  createWorkKanbanColumns,
  moveWorkKanbanItem,
  restoreWorkKanbanItemStatus,
  WorkKanban,
  type WorkKanbanColumns,
  type WorkKanbanProps,
} from '../components/work-kanban';
import { WorkOverview } from '../components/work-overview';
import { WorkPriorityIcon } from '../components/work-priority-icon';
import { WorkStatusBadge } from '../components/work-status-badge';
import { WorkViewSwitcher } from '../components/work-view-switcher';
import { useWorkForm } from '../forms/work-form.generated';
import {
  isWorkOverdue,
  toWorkFormValues,
  toWorkFormValuesFromTemplate,
  WORK_PRIORITY_LABELS,
  WORK_STATUS_LABELS,
  type WorkFormValues,
  type WorkItem,
  type WorkListFilters,
  type WorkPriority,
  type WorkStatus,
  type WorkTemplate,
} from '../model/work';
import {
  useWorkColumns,
  WORK_COLUMN_PINNING,
} from '../table/work.columns.generated';
import { WorkFilterBar } from '../table/work.filters.generated';

type WorkView = 'overview' | 'list' | 'kanban' | 'calendar';

type PendingWorkStatusSave = {
  originalStatus: WorkStatus;
  originalIndex: number;
  desiredStatus: WorkStatus;
  isSaving: boolean;
};

const statusOptions = Object.entries(WORK_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const priorityOptions = Object.entries(WORK_PRIORITY_LABELS).map(
  ([value, label]) => {
    const priority = value as WorkPriority;

    return {
      value,
      searchableText: label,
      label: (
        <span className="flex items-center gap-1.5">
          <WorkPriorityIcon priority={priority} />
          <span>{label}</span>
        </span>
      ),
    };
  },
);
const prioritySelectOptions = Object.entries(WORK_PRIORITY_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const priorityFilterOptions = [
  { value: '', searchableText: 'Tất Cả', label: 'Tất Cả' },
  ...priorityOptions,
];
const boardViewContentClassName =
  'flex min-h-0 flex-1 overflow-auto px-4 pb-4 pt-0';

function WorkSectionEmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center px-5 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function parseWorkDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function parseWorkDateTime(value: string, timeValue?: string | null): Date {
  const date = parseWorkDate(value);
  const [hours, minutes] = (timeValue || '00:00').split(':').map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function formatWorkTime(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function formatWorkDate(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function toCalendarEvent(work: WorkItem): CalendarEvent | null {
  const startValue = work.plannedStartDate ?? work.plannedEndDate;
  const endValue = work.plannedEndDate ?? work.plannedStartDate;
  if (!startValue || !endValue) return null;

  const start = parseWorkDateTime(startValue, work.plannedStartTime);
  const end = parseWorkDateTime(endValue, work.plannedEndTime);

  return {
    id: work.id,
    title: work.title,
    description: work.description || undefined,
    start,
    end:
      end.getTime() > start.getTime()
        ? end
        : new Date(start.getTime() + 60 * 60 * 1000),
    allDay: false,
    location: work.assigneeName || undefined,
  };
}

function WorkPage({ scope = 'all' }: { scope?: 'all' | 'mine' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenantId } = useTenant();
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const [view, setView] = useState<WorkView>('overview');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState<WorkPriority | ''>('');
  const [assignee, setAssignee] = useState('');
  const [showAllKanbanStatuses, setShowAllKanbanStatuses] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingWork, setViewingWork] = useState<WorkItem | null>(null);
  const [deletingWork, setDeletingWork] = useState<WorkItem | null>(null);
  const [createChildOf, setCreateChildOf] = useState<WorkItem | null>(null);
  const [returnToWorkAfterCreate, setReturnToWorkAfterCreate] =
    useState<WorkItem | null>(null);
  const [kanbanColumns, setKanbanColumns] = useState<WorkKanbanColumns>(() =>
    createWorkKanbanColumns([]),
  );
  const kanbanColumnsRef = useRef(kanbanColumns);
  const statusSaveQueueRef = useRef<Map<string, PendingWorkStatusSave>>(
    new Map(),
  );
  const [savingWorkIds, setSavingWorkIds] = useState<Set<string>>(new Set());
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(
    null,
  );
  const createForm = useWorkForm();
  const editForm = useWorkForm();

  const employeeQuery = useQuery({
    queryKey: ['project', 'work', 'employees', tenantId],
    queryFn: () => loadWorkEmployeeOptions(tenantId!),
    enabled: Boolean(tenantId),
  });
  const currentEmployeeQuery = useQuery({
    queryKey: ['project', 'work', 'current-employee', tenantId, userId],
    queryFn: () => loadCurrentWorkEmployeeId(tenantId!, userId!),
    enabled: Boolean(tenantId && userId),
  });
  const linkQuery = useQuery({
    queryKey: ['project', 'work', 'links', tenantId],
    queryFn: () => loadWorkLinkOptions(tenantId!),
    enabled: Boolean(tenantId),
  });
  const workLabelsQuery = useQuery({
    queryKey: ['project', 'work', 'labels', tenantId],
    queryFn: () => loadWorkLabels(tenantId!),
    enabled: Boolean(tenantId),
  });
  const workTemplatesQuery = useQuery({
    queryKey: ['project', 'work', 'templates', tenantId, 'active'],
    queryFn: () => loadWorkTemplates(tenantId!, { activeOnly: true }),
    enabled: Boolean(tenantId),
  });
  const filters: WorkListFilters = {
    search,
    statuses:
      view === 'kanban' && status ? [] : status ? [status as WorkStatus] : [],
    priority,
    assigneeEmployeeId:
      scope === 'mine' ? (currentEmployeeQuery.data ?? '') : assignee,
    scope,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  };
  const workQuery = useQuery({
    queryKey: ['project', 'work', 'list', tenantId, filters],
    queryFn: ({ signal }) => loadWorkItems(tenantId!, filters, signal),
    enabled: Boolean(
      tenantId && (scope === 'all' || currentEmployeeQuery.data),
    ),
  });
  const workDetailQuery = useQuery({
    queryKey: ['project', 'work', 'detail', tenantId, viewingWork?.id],
    queryFn: () => loadWorkTree(tenantId!, viewingWork!.id),
    enabled: Boolean(tenantId && viewOpen && viewingWork),
  });
  const workAttachmentsQuery = useQuery({
    queryKey: ['project', 'work', 'attachments', tenantId, viewingWork?.id],
    queryFn: () => loadWorkItemAttachments(tenantId!, viewingWork!.id),
    enabled: Boolean(tenantId && viewOpen && viewingWork),
  });
  const updateKanbanColumns = useCallback((next: WorkKanbanColumns) => {
    kanbanColumnsRef.current = next;
    setKanbanColumns(next);
  }, []);
  const setWorkSaving = useCallback((workId: string, isSaving: boolean) => {
    setSavingWorkIds((current) => {
      const next = new Set(current);
      if (isSaving) next.add(workId);
      else next.delete(workId);
      return next;
    });
  }, []);
  const works = useMemo(
    () => workQuery.data?.items ?? [],
    [workQuery.data?.items],
  );
  const employeeOptions = (employeeQuery.data ?? []).map((item) => ({
    value: item.id,
    label: item.label,
    code: item.employeeCode,
    avatarUrl: item.avatarUrl,
    avatarTone: IDENTITY_AVATAR_TONES.employee,
    searchableText: `${item.label} ${item.employeeCode}`,
    data: item,
  }));
  const employeesById = useMemo(
    () =>
      new Map(
        (employeeQuery.data ?? []).map((employee) => [employee.id, employee]),
      ),
    [employeeQuery.data],
  );
  const assigneeFilterOptions = scope === 'all' ? employeeOptions : [];
  const assigneeAvatarUrls = useMemo(
    () =>
      new Map(
        (employeeQuery.data ?? []).map((item) => [item.id, item.avatarUrl]),
      ),
    [employeeQuery.data],
  );
  const customerOptions = (linkQuery.data?.customers ?? []).map((item) => ({
    value: item.id,
    label: item.label,
    searchableText: `${item.label} ${item.secondaryLabel ?? ''}`,
    data: { secondaryLabel: item.secondaryLabel },
  }));
  const contractOptions = (linkQuery.data?.contracts ?? []).map((item) => ({
    value: item.id,
    label: item.label,
    searchableText: `${item.label} ${item.secondaryLabel ?? ''}`,
    data: { secondaryLabel: item.secondaryLabel },
  }));

  const openView = useCallback(
    (work: WorkItem) => {
      setViewingWork(work);
      editForm.reset(toWorkFormValues(work));
      setViewOpen(true);
    },
    [editForm],
  );

  const openCreate = useCallback(
    (
      parent?: WorkItem | null,
      calendarStartAt?: Date,
      initialValues?: WorkFormValues,
    ) => {
      if (parent?.parentId) {
        toast.error('Phần mềm chỉ hỗ trợ tối đa hai cấp công việc.');
        return;
      }
      setCreateChildOf(parent ?? null);
      const nextValues = {
        ...(initialValues ?? createForm.getValues()),
        parentId: parent?.id ?? '',
      };
      if (calendarStartAt) {
        const date = formatWorkDate(calendarStartAt);
        const time = formatWorkTime(calendarStartAt);
        nextValues.plannedStartDate = date;
        nextValues.plannedEndDate = date;
        nextValues.plannedStartTime = time;
        nextValues.plannedEndTime = time;
      }
      createForm.reset({
        ...nextValues,
      });
      setCreateOpen(true);
    },
    [createForm],
  );
  const openCreateFromTemplate = async (templateId: string) => {
    if (!tenantId) return;
    setLoadingTemplateId(templateId);
    try {
      const template: WorkTemplate = await loadWorkTemplate(
        tenantId,
        templateId,
      );
      openCreate(null, undefined, toWorkFormValuesFromTemplate(template));
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setLoadingTemplateId(null);
    }
  };
  useEffect(() => {
    const parentId = searchParams.get('parent');
    if (!parentId || createOpen || !works.length) return;
    const parent = works.find((item) => item.id === parentId);
    if (!parent) return;
    openCreate(parent);
    navigate(ROUTES.PROJECT.WORK, { replace: true });
  }, [createOpen, navigate, openCreate, searchParams, works]);
  const openCreateChildFromDetail = (work: WorkItem) => {
    setReturnToWorkAfterCreate(work);
    setViewOpen(false);
    openCreate(work);
  };
  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (open) return;

    const parentWork = returnToWorkAfterCreate;
    setReturnToWorkAfterCreate(null);
    setCreateChildOf(null);

    if (parentWork) {
      setViewingWork(parentWork);
      editForm.reset(toWorkFormValues(parentWork));
      setViewOpen(true);
    }
  };
  const createMutation = useMutation({
    mutationFn: ({
      values,
      attachments,
    }: {
      values: WorkFormValues;
      attachments: File[];
    }) => {
      if (!tenantId || !userId) {
        throw new Error('Không xác định được tài khoản hoặc tenant hiện tại.');
      }
      return createWorkItem(tenantId, userId, values, attachments);
    },
    onSuccess: async () => {
      toast.success('Đã tạo công việc.');
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['project', 'work'] });
      await queryClient.invalidateQueries({ queryKey: ['project', 'tags'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const editMutation = useMutation({
    mutationFn: (values: WorkFormValues) =>
      updateWorkItem(tenantId!, viewingWork!.id, values),
    onSuccess: async (_data, values) => {
      toast.success('Đã cập nhật công việc.');
      editForm.reset(values);
      await queryClient.invalidateQueries({ queryKey: ['project', 'work'] });
      await queryClient.invalidateQueries({ queryKey: ['project', 'tags'] });
      await queryClient.refetchQueries({
        queryKey: ['project', 'work', 'list'],
        type: 'active',
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const createWorkLabelMutation = useMutation({
    mutationFn: (name: string) => {
      if (!tenantId) throw new Error('Không xác định được tenant hiện tại.');
      return createWorkLabel(tenantId, name);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['project', 'work', 'labels', tenantId],
      });
      await queryClient.invalidateQueries({ queryKey: ['project', 'tags'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const uploadAttachmentsMutation = useMutation({
    mutationFn: (files: File[]) => {
      if (!tenantId || !viewingWork || !userId) {
        throw new Error(
          'Không xác định được công việc hoặc tài khoản hiện tại.',
        );
      }
      return uploadWorkItemAttachments(tenantId, viewingWork.id, userId, files);
    },
    onSuccess: () => toast.success('Đã thêm tệp đính kèm.'),
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSettled: async () => {
      if (!tenantId || !viewingWork) return;
      await queryClient.invalidateQueries({
        queryKey: ['project', 'work', 'attachments', tenantId, viewingWork.id],
      });
    },
  });
  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => {
      if (!tenantId || !viewingWork) {
        throw new Error('Không xác định được công việc hiện tại.');
      }
      return deleteWorkItemAttachment(tenantId, viewingWork.id, attachmentId);
    },
    onSuccess: () => toast.success('Đã xóa tệp đính kèm.'),
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSettled: async () => {
      if (!tenantId || !viewingWork) return;
      await queryClient.invalidateQueries({
        queryKey: ['project', 'work', 'attachments', tenantId, viewingWork.id],
      });
    },
  });
  const calendarUpdateMutation = useMutation({
    mutationFn: ({ work, event }: { work: WorkItem; event: CalendarEvent }) =>
      updateWorkItem(tenantId!, work.id, {
        ...toWorkFormValues(work),
        plannedStartDate: formatWorkDate(event.start),
        plannedEndDate: formatWorkDate(event.end),
        plannedStartTime: formatWorkTime(event.start),
        plannedEndTime: formatWorkTime(event.end),
      }),
    onSuccess: async () => {
      toast.success('Đã cập nhật thời gian dự kiến của công việc.');
      await queryClient.invalidateQueries({ queryKey: ['project', 'work'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkItem(tenantId!, deletingWork!.id),
    onSuccess: async () => {
      toast.success('Đã xóa công việc.');
      setDeletingWork(null);
      await queryClient.invalidateQueries({ queryKey: ['project', 'work'] });
      await queryClient.invalidateQueries({ queryKey: ['project', 'tags'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const flushStatusSave = useCallback(
    async (workId: string) => {
      const queue = statusSaveQueueRef.current;
      const pending = queue.get(workId);
      if (!pending || pending.isSaving || !tenantId) return;

      pending.isSaving = true;
      setWorkSaving(workId, true);

      while (queue.get(workId) === pending) {
        const nextStatus = pending.desiredStatus;

        try {
          await updateWorkItemStatus(tenantId, workId, nextStatus);
        } catch (error) {
          const current = queue.get(workId);
          if (!current) {
            setWorkSaving(workId, false);
            return;
          }
          if (current.desiredStatus !== nextStatus) continue;

          queue.delete(workId);
          setWorkSaving(workId, false);
          updateKanbanColumns(
            restoreWorkKanbanItemStatus({
              columns: kanbanColumnsRef.current,
              workId,
              status: current.originalStatus,
              index: current.originalIndex,
            }),
          );
          toast.error(getApiErrorMessage(error));
          return;
        }

        const current = queue.get(workId);
        if (!current) {
          setWorkSaving(workId, false);
          return;
        }
        if (current.desiredStatus !== nextStatus) continue;

        queue.delete(workId);
        setWorkSaving(workId, false);
        if (!queue.size) {
          void queryClient.invalidateQueries({ queryKey: ['project', 'work'] });
        }
        return;
      }
    },
    [queryClient, setWorkSaving, tenantId, updateKanbanColumns],
  );

  const columns = useWorkColumns({
    onView: openView,
    onEdit: openView,
    onDelete: setDeletingWork,
    renderWork: (work) => (
      <div className="min-w-0">
        <button
          type="button"
          className="line-clamp-2 text-left font-medium hover:text-primary"
          onClick={() => openView(work)}
        >
          {work.title}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span>{work.code}</span>
        </div>
      </div>
    ),
    renderAssignee: (work) => {
      const employee = work.assigneeEmployeeId
        ? employeesById.get(work.assigneeEmployeeId)
        : undefined;
      if (employee) {
        return (
          <EmployeeIdentity
            employee={{
              displayName: employee.label,
              employeeCode: employee.employeeCode,
              avatarUrl: employee.avatarUrl,
              userId: employee.userId,
            }}
          />
        );
      }

      return work.assigneeName ? (
        <span className="text-sm">
          {work.assigneeName}
          {work.assigneeCode ? (
            <span className="block text-xs text-muted-foreground">
              {work.assigneeCode}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Chưa giao</span>
      );
    },
    renderPlannedSchedule: (work) => {
      const overdue = isWorkOverdue(work);
      const formatPlannedDateTime = (
        date: string | null,
        time: string | null,
      ) => (date ? `${formatDate(date)}${time ? ` ${time}` : ''}` : '—');

      return (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
          <span className="text-muted-foreground">Bắt đầu</span>
          <span className={overdue ? 'text-admin-red-dark' : 'text-foreground'}>
            {formatPlannedDateTime(
              work.plannedStartDate,
              work.plannedStartTime,
            )}
          </span>
          <span className="text-muted-foreground">Hoàn thành</span>
          <span className={overdue ? 'text-admin-red-dark' : 'text-foreground'}>
            {formatPlannedDateTime(work.plannedEndDate, work.plannedEndTime)}
          </span>
        </div>
      );
    },
    renderActualSchedule: (work) => (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
        <span className="text-muted-foreground">Bắt đầu</span>
        <span className="text-foreground">
          {work.actualStartedAt ? formatDateTime(work.actualStartedAt) : '—'}
        </span>
        <span className="text-muted-foreground">Hoàn thành</span>
        <span className="text-foreground">
          {work.actualCompletedAt
            ? formatDateTime(work.actualCompletedAt)
            : '—'}
        </span>
      </div>
    ),
    renderLinks: (work) => (
      <div className="flex max-w-[220px] flex-wrap gap-1">
        {work.customers.slice(0, 2).map((item) => (
          <Tooltip key={`customer-${item.id}`}>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                size="sm"
                className="max-w-full min-w-0 gap-1.5"
                aria-label={`Khách hàng: ${item.label}`}
                tabIndex={0}
              >
                <UserRoundSearch className="size-3.5" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Khách hàng: {item.label}</TooltipContent>
          </Tooltip>
        ))}
        {work.contracts.slice(0, 2).map((item) => (
          <Tooltip key={`contract-${item.id}`}>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                size="sm"
                className="max-w-full min-w-0 gap-1.5"
                aria-label={`Hợp đồng: ${item.label}`}
                tabIndex={0}
              >
                <FileText className="size-3.5" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Hợp đồng: {item.label}</TooltipContent>
          </Tooltip>
        ))}
        {work.customers.length + work.contracts.length > 4 ? (
          <span className="text-xs text-muted-foreground">
            +{work.customers.length + work.contracts.length - 4}
          </span>
        ) : null}
      </div>
    ),
  });
  const table = useReactTable({
    data: works,
    columns,
    getRowId: (row) => row.id,
    state: { pagination, columnPinning: WORK_COLUMN_PINNING },
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: Math.ceil((workQuery.data?.total ?? 0) / pagination.pageSize),
    getCoreRowModel: getCoreRowModel(),
  });

  const columnsByStatus = useMemo(
    () => createWorkKanbanColumns(works),
    [works],
  );
  useEffect(() => {
    updateKanbanColumns(columnsByStatus);
  }, [columnsByStatus, updateKanbanColumns]);
  const calendarEvents = useMemo(
    () =>
      works
        .map(toCalendarEvent)
        .filter((event): event is CalendarEvent => Boolean(event)),
    [works],
  );
  const detailWork = workDetailQuery.data?.root ?? viewingWork;
  const detailChildren = workDetailQuery.data?.children ?? [];
  const pageTitle = scope === 'mine' ? 'Việc của tôi' : 'Quản lý công việc';
  const currentEmployeeError =
    scope === 'mine' && currentEmployeeQuery.isError
      ? currentEmployeeQuery.error
      : undefined;
  const workDataError =
    scope === 'mine'
      ? (currentEmployeeError ??
        (workQuery.isError ? workQuery.error : undefined))
      : undefined;
  const showWorkDataError = scope === 'mine' && Boolean(workDataError);
  const isWorkLoading =
    (scope === 'mine' && currentEmployeeQuery.isPending) ||
    (scope === 'all' && workQuery.isPending) ||
    (scope === 'mine' &&
      Boolean(currentEmployeeQuery.data) &&
      workQuery.isPending);
  const hasNoCurrentEmployee =
    scope === 'mine' &&
    currentEmployeeQuery.isSuccess &&
    !currentEmployeeQuery.data;
  const retryWorkQuery = () => {
    void (currentEmployeeError
      ? currentEmployeeQuery.refetch()
      : workQuery.refetch());
  };
  const workErrorDescription = workDataError
    ? getApiErrorMessage(workDataError)
    : undefined;

  if (scope === 'all' && workQuery.isError) {
    return (
      <div className="flex h-full flex-col gap-5 overflow-auto p-4 lg:p-5">
        <PageHeader
          title={pageTitle}
          icon={ClipboardList}
          actions={
            <Button variant="outline" onClick={() => void workQuery.refetch()}>
              <RefreshCw /> Thử lại
            </Button>
          }
        />
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TriangleAlert className="size-8 text-destructive" />
          <CardTitle>Không tải được danh sách công việc</CardTitle>
          <CardDescription>
            {getApiErrorMessage(workQuery.error)}
          </CardDescription>
        </Card>
      </div>
    );
  }

  const moveKanban = ({
    activeContainer,
    overContainer,
    activeIndex,
    overIndex,
  }: Parameters<WorkKanbanProps['onMove']>[0]) => {
    const moved = moveWorkKanbanItem({
      columns: kanbanColumnsRef.current,
      activeContainer,
      overContainer,
      activeIndex,
      overIndex,
    });
    if (!moved) return;

    const pending = statusSaveQueueRef.current.get(moved.work.id) ?? {
      originalStatus: activeContainer as WorkStatus,
      originalIndex: activeIndex,
      desiredStatus: moved.work.status,
      isSaving: false,
    };
    pending.desiredStatus = moved.work.status;
    statusSaveQueueRef.current.set(moved.work.id, pending);
    updateKanbanColumns(moved.columns);
    void flushStatusSave(moved.work.id);
  };

  const workFilterBar = (
    <WorkFilterBar
      search={search}
      onSearchChange={(value) => {
        setSearch(value);
        setPagination((current) => ({ ...current, pageIndex: 0 }));
      }}
      status={status}
      onStatusChange={(value) => {
        setStatus(value);
        setPagination((current) => ({ ...current, pageIndex: 0 }));
      }}
      statusOptions={statusOptions}
      statusRenderOption={(option) => (
        <WorkStatusBadge status={option.value as WorkStatus} size="sm" />
      )}
      statusRenderValue={(option) =>
        option ? (
          <WorkStatusBadge status={option.value as WorkStatus} size="sm" />
        ) : undefined
      }
      priority={priority}
      onPriorityChange={(value) => {
        setPriority(value as WorkPriority | '');
        setPagination((current) => ({ ...current, pageIndex: 0 }));
      }}
      priorityOptions={prioritySelectOptions}
      priorityRenderOption={(option) => (
        <span className="flex items-center gap-1.5">
          <WorkPriorityIcon priority={option.value as WorkPriority} />
          <span>{option.label}</span>
        </span>
      )}
      priorityRenderValue={(option) =>
        option ? (
          <span className="flex items-center gap-1.5">
            <WorkPriorityIcon priority={option.value as WorkPriority} />
            <span>{option.label}</span>
          </span>
        ) : undefined
      }
      assignee={assignee}
      onAssigneeChange={(value) => {
        setAssignee(value);
        setPagination((current) => ({ ...current, pageIndex: 0 }));
      }}
      assigneeOptions={assigneeFilterOptions}
    />
  );

  const kanbanFilterBar = (
    <FilterToolbar
      className="min-w-0 flex-1"
      fields={[
        {
          kind: 'search',
          value: search,
          onValueChange: (value) => {
            setSearch(value);
            setPagination((current) => ({ ...current, pageIndex: 0 }));
          },
          placeholder: 'Tìm theo mã hoặc tên công việc',
          className: 'w-72',
          debounceMs: 300,
        },
        {
          kind: 'select',
          value: priority,
          onValueChange: (value) => {
            setPriority(value as WorkPriority | '');
            setPagination((current) => ({ ...current, pageIndex: 0 }));
          },
          options: priorityFilterOptions,
          label: 'Ưu tiên',
          placeholder: 'Ưu tiên',
          className: 'w-40',
        },
      ]}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-hidden p-4 lg:p-5">
      <PageHeader
        title={pageTitle}
        icon={ClipboardList}
        titleAside={
          <span className="text-sm text-muted-foreground">
            {workQuery.data?.total ?? 0} công việc
          </span>
        }
        actions={
          <>
            <WorkViewSwitcher
              value={view}
              onValueChange={(value) => setView(value as WorkView)}
            />
            <Separator orientation="vertical" className="mx-1 h-6" />
            <div className="inline-flex">
              <Button className="rounded-e-none" onClick={() => openCreate()}>
                <Plus /> Thêm công việc
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="-ms-px rounded-s-none px-2"
                    aria-label="Tạo công việc từ mẫu"
                    disabled={Boolean(loadingTemplateId)}
                  >
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Tạo từ mẫu công việc</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {workTemplatesQuery.isPending ? (
                    <DropdownMenuItem disabled>
                      Đang tải mẫu...
                    </DropdownMenuItem>
                  ) : workTemplatesQuery.isError ? (
                    <DropdownMenuItem disabled>
                      Không tải được danh sách mẫu công việc
                    </DropdownMenuItem>
                  ) : workTemplatesQuery.data?.length ? (
                    workTemplatesQuery.data.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        disabled={Boolean(loadingTemplateId)}
                        onSelect={() =>
                          void openCreateFromTemplate(template.id)
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {template.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {template.code} · {template.childCount} công việc
                            con
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      Chưa có mẫu công việc đang dùng
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        }
      />
      {view === 'overview' ? (
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader className="flex-row items-center gap-4">
            {kanbanFilterBar}
          </CardHeader>
          <CardContent className={boardViewContentClassName}>
            {showWorkDataError ? (
              <ErrorState
                title="Không tải được danh sách công việc"
                description={workErrorDescription}
                onRetry={retryWorkQuery}
              />
            ) : hasNoCurrentEmployee ? (
              <WorkSectionEmptyState message="Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên nên chưa thể lọc việc của tôi." />
            ) : (
              <WorkOverview
                works={works}
                onOpen={openView}
                savingWorkIds={savingWorkIds}
                assigneeAvatarUrls={assigneeAvatarUrls}
                isLoading={isWorkLoading}
              />
            )}
          </CardContent>
        </Card>
      ) : view === 'list' ? (
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader className="flex-row items-center gap-4">
            {workFilterBar}
          </CardHeader>
          {showWorkDataError ? (
            <CardContent className="flex min-h-0 flex-1 items-center justify-center p-0">
              <ErrorState
                title="Không tải được danh sách công việc"
                description={workErrorDescription}
                onRetry={retryWorkQuery}
              />
            </CardContent>
          ) : hasNoCurrentEmployee ? (
            <WorkSectionEmptyState message="Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên nên chưa thể lọc việc của tôi." />
          ) : (
            <DataGrid
              table={table}
              recordCount={workQuery.data?.total ?? 0}
              isLoading={isWorkLoading}
              isFetching={workQuery.isFetching}
              emptyMessage="Chưa có công việc"
              tableLayout={{ dense: true, columnsVisibility: false }}
            >
              <CardTable className="min-h-0 flex-1">
                <ScrollArea className="h-full">
                  <DataGridTable />
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardTable>
              <CardFooter className="justify-between">
                <DataGridPagination />
              </CardFooter>
            </DataGrid>
          )}
        </Card>
      ) : view === 'kanban' ? (
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader className="flex-row items-center gap-4">
            {kanbanFilterBar}
            <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              <span>Hiển thị tất cả trạng thái</span>
              <Switch
                size="sm"
                checked={showAllKanbanStatuses}
                onCheckedChange={setShowAllKanbanStatuses}
                aria-label="Hiển thị tất cả trạng thái"
              />
            </label>
          </CardHeader>
          <CardContent className={boardViewContentClassName}>
            {showWorkDataError ? (
              <ErrorState
                title="Không tải được danh sách công việc"
                description={workErrorDescription}
                onRetry={retryWorkQuery}
              />
            ) : hasNoCurrentEmployee ? (
              <WorkSectionEmptyState message="Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên nên chưa thể lọc việc của tôi." />
            ) : (
              <WorkKanban
                columns={kanbanColumns}
                onColumnsChange={updateKanbanColumns}
                onMove={moveKanban}
                onOpen={openView}
                savingWorkIds={savingWorkIds}
                assigneeAvatarUrls={assigneeAvatarUrls}
                isLoading={isWorkLoading}
                showAllStatuses={showAllKanbanStatuses}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          {showWorkDataError ? (
            <ErrorState
              title="Không tải được lịch công việc"
              description={workErrorDescription}
              onRetry={retryWorkQuery}
            />
          ) : hasNoCurrentEmployee ? (
            <WorkSectionEmptyState message="Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên nên chưa thể lọc việc của tôi." />
          ) : (
            <EventCalendar
              events={calendarEvents}
              initialView="month"
              allowEventCreation
              isLoading={scope === 'mine' && isWorkLoading}
              onEventCreate={(startTime) => openCreate(null, startTime)}
              onEventSelect={(event) => {
                const work = works.find((item) => item.id === event.id);
                if (work) openView(work);
              }}
              onEventUpdate={(event) => {
                const work = works.find((item) => item.id === event.id);
                if (!work) return;
                calendarUpdateMutation.mutate({ work, event });
              }}
            />
          )}
        </div>
      )}
      <WorkDetailDialog
        open={createOpen || viewOpen}
        onOpenChange={(open) => {
          if (createOpen) {
            handleCreateOpenChange(open);
            return;
          }

          setViewOpen(open);
          if (!open) setViewingWork(null);
        }}
        mode={createOpen ? 'create' : 'edit'}
        title={
          createOpen
            ? createChildOf
              ? `Thêm đầu mục con cho “${createChildOf.title}”`
              : 'Thêm công việc'
            : undefined
        }
        work={createOpen ? null : detailWork}
        children={createOpen ? [] : detailChildren}
        isLoading={createOpen ? false : workDetailQuery.isPending}
        errorMessage={
          createOpen || !workDetailQuery.isError
            ? undefined
            : getApiErrorMessage(workDetailQuery.error)
        }
        form={createOpen ? createForm : editForm}
        isSaving={
          createOpen ? createMutation.isPending : editMutation.isPending
        }
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        assigneeEmployeeOptions={employeeOptions}
        customerOptions={customerOptions}
        contractOptions={contractOptions}
        labelOptions={workLabelsQuery.data ?? []}
        attachments={createOpen ? [] : (workAttachmentsQuery.data ?? [])}
        isAttachmentsLoading={!createOpen && workAttachmentsQuery.isPending}
        isUploadingAttachments={uploadAttachmentsMutation.isPending}
        attachmentErrorMessage={
          createOpen || !workAttachmentsQuery.isError
            ? undefined
            : getApiErrorMessage(workAttachmentsQuery.error)
        }
        onCreateLabel={(name) => createWorkLabelMutation.mutateAsync(name)}
        onUploadAttachments={(files) =>
          uploadAttachmentsMutation.mutateAsync(files)
        }
        onDeleteAttachment={(attachmentId) =>
          deleteAttachmentMutation.mutateAsync(attachmentId)
        }
        onSave={(values, attachments) =>
          createOpen
            ? createMutation.mutateAsync({
                values,
                attachments: attachments ?? [],
              })
            : editMutation.mutateAsync(values)
        }
        onCreateChild={
          !createOpen && viewingWork && viewingWork.parentId === null
            ? openCreateChildFromDetail
            : undefined
        }
      />
      <ConfirmDialog
        open={Boolean(deletingWork)}
        onOpenChange={(open) => {
          if (!open) setDeletingWork(null);
        }}
        title="Xóa công việc?"
        description={
          deletingWork
            ? `Bạn có chắc muốn xóa “${deletingWork.title}”? Các đầu mục con và liên kết của công việc cũng sẽ được xóa.`
            : ''
        }
        confirmLabel="Xóa công việc"
        confirmVariant="destructive"
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}

export { WorkPage };
