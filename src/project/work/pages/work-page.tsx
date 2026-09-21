import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  useReactTable,
  type PaginationState,
} from '@tanstack/react-table';
import { ClipboardList, Plus, RefreshCw, TriangleAlert } from 'lucide-react';
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
  EventCalendar,
  type CalendarEvent,
} from '@/components/ui/event-calendar';
import { FilterToolbar } from '@/components/ui/filter-toolbar';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { EmployeeIdentity } from '../../employees/components/employee-identity';
import {
  createWorkItem,
  deleteWorkItem,
  loadCurrentWorkEmployeeId,
  loadWorkEmployeeOptions,
  loadWorkItems,
  loadWorkLinkOptions,
  loadWorkTemplates,
  updateWorkItem,
  updateWorkItemStatus,
} from '../api/work.api';
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
import { useWorkForm, WorkFormDialog } from '../forms/work-form.generated';
import {
  isWorkOverdue,
  toWorkFormValues,
  WORK_PRIORITY_LABELS,
  WORK_STATUS_LABELS,
  type WorkFormValues,
  type WorkItem,
  type WorkListFilters,
  type WorkPriority,
  type WorkStatus,
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
const priorityFilterOptions = [
  { value: '', searchableText: 'Tất Cả', label: 'Tất Cả' },
  ...priorityOptions,
];
const boardViewContentClassName =
  'flex min-h-0 flex-1 overflow-auto px-4 pb-4 pt-0';

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
    color: work.color,
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
  const [showAllKanbanStatuses, setShowAllKanbanStatuses] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<WorkItem | null>(null);
  const [deletingWork, setDeletingWork] = useState<WorkItem | null>(null);
  const [createChildOf, setCreateChildOf] = useState<WorkItem | null>(null);
  const [kanbanColumns, setKanbanColumns] = useState<WorkKanbanColumns>(() =>
    createWorkKanbanColumns([]),
  );
  const kanbanColumnsRef = useRef(kanbanColumns);
  const statusSaveQueueRef = useRef<Map<string, PendingWorkStatusSave>>(
    new Map(),
  );
  const [savingWorkIds, setSavingWorkIds] = useState<Set<string>>(new Set());
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
  const templateQuery = useQuery({
    queryKey: ['project', 'work', 'templates', tenantId],
    queryFn: () => loadWorkTemplates(tenantId!),
    enabled: Boolean(tenantId),
  });
  const filters: WorkListFilters = {
    search,
    statuses:
      view === 'kanban' && status ? [] : status ? [status as WorkStatus] : [],
    priority,
    assigneeEmployeeId:
      scope === 'mine' ? (currentEmployeeQuery.data ?? '') : '',
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
  const templates = templateQuery.data ?? [];

  const employeeOptions = (employeeQuery.data ?? []).map((item) => ({
    value: item.id,
    label: (
      <EmployeeIdentity
        employee={{
          displayName: item.label,
          employeeCode: item.employeeCode,
          avatarUrl: item.avatarUrl,
          userId: item.userId,
        }}
      />
    ),
    searchableText: `${item.label} ${item.employeeCode}`,
  }));
  const assigneeAvatarUrls = useMemo(
    () =>
      new Map(
        (employeeQuery.data ?? []).map((item) => [item.id, item.avatarUrl]),
      ),
    [employeeQuery.data],
  );
  const parentOptions = works
    .filter((item) => !item.parentId)
    .map((item) => ({
      value: item.id,
      label: item.title,
      searchableText: `${item.code} ${item.title}`,
    }));
  const templateOptions = templates
    .filter((item) => item.isActive)
    .map((item) => ({ value: item.id, label: `${item.code} - ${item.name}` }));
  const customerOptions = (linkQuery.data?.customers ?? []).map((item) => ({
    value: item.id,
    label: item.label,
    searchableText: `${item.label} ${item.secondaryLabel ?? ''}`,
  }));
  const contractOptions = (linkQuery.data?.contracts ?? []).map((item) => ({
    value: item.id,
    label: item.label,
    searchableText: `${item.label} ${item.secondaryLabel ?? ''}`,
  }));

  const openCreate = useCallback(
    (parent?: WorkItem | null, calendarStartAt?: Date) => {
      setCreateChildOf(parent ?? null);
      const nextValues = {
        ...createForm.getValues(),
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
  useEffect(() => {
    const parentId = searchParams.get('parent');
    if (!parentId || createOpen || !works.length) return;
    const parent = works.find((item) => item.id === parentId);
    if (!parent) return;
    openCreate(parent);
    navigate(ROUTES.PROJECT.WORK, { replace: true });
  }, [createOpen, navigate, openCreate, searchParams, works]);
  const openEdit = (work: WorkItem) => {
    setEditingWork(work);
    editForm.reset(toWorkFormValues(work));
    setEditOpen(true);
  };
  const createMutation = useMutation({
    mutationFn: (values: WorkFormValues) => createWorkItem(tenantId!, values),
    onSuccess: async () => {
      toast.success('Đã tạo công việc.');
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['project', 'work'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const editMutation = useMutation({
    mutationFn: (values: WorkFormValues) =>
      updateWorkItem(tenantId!, editingWork!.id, values),
    onSuccess: async () => {
      toast.success('Đã cập nhật công việc.');
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['project', 'work'] });
      await queryClient.refetchQueries({
        queryKey: ['project', 'work', 'list'],
        type: 'active',
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
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
    onView: (work) =>
      navigate(buildPath(ROUTES.PROJECT.WORK_DETAIL, { id: work.id })),
    onEdit: openEdit,
    onDelete: setDeletingWork,
    renderWork: (work) => (
      <div className="min-w-0">
        <button
          type="button"
          className="line-clamp-2 text-left font-medium hover:text-primary"
          onClick={() =>
            navigate(buildPath(ROUTES.PROJECT.WORK_DETAIL, { id: work.id }))
          }
        >
          {work.title}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span>{work.code}</span>
        </div>
      </div>
    ),
    renderAssignee: (work) => (
      <span className="text-sm">
        {work.assigneeName || 'Chưa giao'}
        {work.assigneeCode ? (
          <span className="block text-xs text-muted-foreground">
            {work.assigneeCode}
          </span>
        ) : null}
      </span>
    ),
    renderPlannedStartDate: (work) => (
      <span className={isWorkOverdue(work) ? 'text-admin-red-dark' : 'text-sm'}>
        {work.plannedStartDate ? formatDate(work.plannedStartDate) : '—'}
      </span>
    ),
    renderPlannedEndDate: (work) => (
      <span className={isWorkOverdue(work) ? 'text-admin-red-dark' : 'text-sm'}>
        {work.plannedEndDate ? formatDate(work.plannedEndDate) : '—'}
      </span>
    ),
    renderActualStartedAt: (work) => (
      <span className="text-sm">
        {work.actualStartedAt ? formatDateTime(work.actualStartedAt) : '—'}
      </span>
    ),
    renderActualCompletedAt: (work) => (
      <span className="text-sm">
        {work.actualCompletedAt ? formatDateTime(work.actualCompletedAt) : '—'}
      </span>
    ),
    renderLinks: (work) => (
      <div className="flex max-w-[190px] flex-wrap gap-1">
        {work.customers.slice(0, 2).map((item) => (
          <Badge
            key={`customer-${item.id}`}
            variant="secondary"
            className="max-w-full truncate text-[10px]"
          >
            KH: {item.label}
          </Badge>
        ))}
        {work.contracts.slice(0, 2).map((item) => (
          <Badge
            key={`contract-${item.id}`}
            variant="outline"
            className="max-w-full truncate text-[10px]"
          >
            HĐ: {item.label}
          </Badge>
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
  const submitProps = {
    statusOptions,
    priorityOptions,
    assigneeEmployeeIdOptions: employeeOptions,
    parentIdOptions: parentOptions,
    templateIdOptions: templateOptions,
    customerIdsOptions: customerOptions,
    contractIdsOptions: contractOptions,
  };
  const pageTitle = scope === 'mine' ? 'Việc của tôi' : 'Quản lý công việc';

  if (workQuery.isError) {
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
      layout="split"
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
      priorityOptions={priorityFilterOptions}
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
            <Button onClick={() => openCreate()}>
              <Plus /> Thêm công việc
            </Button>
          </>
        }
      />
      {view === 'overview' ? (
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader className="flex-row items-center gap-4">
            {kanbanFilterBar}
          </CardHeader>
          <CardContent className={boardViewContentClassName}>
            <WorkOverview
              works={works}
              onOpen={(work) =>
                navigate(buildPath(ROUTES.PROJECT.WORK_DETAIL, { id: work.id }))
              }
              savingWorkIds={savingWorkIds}
              assigneeAvatarUrls={assigneeAvatarUrls}
              isLoading={workQuery.isPending}
            />
          </CardContent>
        </Card>
      ) : view === 'list' ? (
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader className="flex-row items-center gap-4">
            {workFilterBar}
          </CardHeader>
          <DataGrid
            table={table}
            recordCount={workQuery.data?.total ?? 0}
            isLoading={workQuery.isPending}
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
            <WorkKanban
              columns={kanbanColumns}
              onColumnsChange={updateKanbanColumns}
              onMove={moveKanban}
              onOpen={(work) =>
                navigate(buildPath(ROUTES.PROJECT.WORK_DETAIL, { id: work.id }))
              }
              savingWorkIds={savingWorkIds}
              assigneeAvatarUrls={assigneeAvatarUrls}
              isLoading={workQuery.isPending}
              showAllStatuses={showAllKanbanStatuses}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <EventCalendar
            events={calendarEvents}
            initialView="month"
            allowEventCreation
            onEventCreate={(startTime) => openCreate(null, startTime)}
            onEventSelect={(event) =>
              navigate(buildPath(ROUTES.PROJECT.WORK_DETAIL, { id: event.id }))
            }
            onEventUpdate={(event) => {
              const work = works.find((item) => item.id === event.id);
              if (!work) return;
              calendarUpdateMutation.mutate({ work, event });
            }}
          />
        </div>
      )}
      <WorkFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        form={createForm}
        onSubmit={(values) => createMutation.mutate(values)}
        isSaving={createMutation.isPending}
        title={
          createChildOf
            ? `Thêm đầu mục con cho “${createChildOf.title}”`
            : 'Thêm công việc'
        }
        {...submitProps}
      />
      <WorkFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        form={editForm}
        onSubmit={(values) => editMutation.mutate(values)}
        isSaving={editMutation.isPending}
        title="Chỉnh sửa công việc"
        {...submitProps}
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
