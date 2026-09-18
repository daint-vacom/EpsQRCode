import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  useReactTable,
  type PaginationState,
} from '@tanstack/react-table';
import {
  CalendarDays,
  ClipboardList,
  Plus,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '@/lib/date';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
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
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanOverlay,
} from '@/components/ui/kanban';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
import { WorkViewSwitcher } from '../components/work-view-switcher.generated';
import { useWorkForm, WorkFormDialog } from '../forms/work-form.generated';
import {
  isWorkOverdue,
  WORK_PRIORITY_LABELS,
  WORK_STATUS_LABELS,
  workProgress,
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

type WorkView = 'list' | 'kanban' | 'calendar';

const statusOptions = Object.entries(WORK_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const priorityOptions = Object.entries(WORK_PRIORITY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

function workStatusClass(status: WorkStatus) {
  return {
    draft: 'bg-muted text-muted-foreground',
    todo: 'bg-admin-blue-bg text-admin-blue-text',
    in_progress: 'bg-admin-amber-bg text-admin-amber-dark',
    paused: 'bg-muted text-muted-foreground',
    completed: 'bg-admin-success-bg text-admin-success-text',
    cancelled: 'bg-admin-red-bg text-admin-red-dark',
  }[status];
}

function WorkCard({
  work,
  onOpen,
}: {
  work: WorkItem;
  onOpen: (work: WorkItem) => void;
}) {
  return (
    <button
      type="button"
      className="w-full rounded-lg border bg-card p-3 text-left shadow-xs transition hover:border-primary/50 hover:shadow-sm"
      onClick={() => onOpen(work)}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium">{work.title}</span>
        <div className="flex shrink-0 gap-1">
          <Badge variant="outline" className="text-[10px]">
            {WORK_PRIORITY_LABELS[work.priority]}
          </Badge>
          <Badge
            variant="secondary"
            className={`text-[10px] ${workStatusClass(work.status)}`}
          >
            {WORK_STATUS_LABELS[work.status]}
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{work.assigneeName || 'Chưa giao'}</span>
        <span>
          {work.plannedEndDate ? formatDate(work.plannedEndDate) : ''}
        </span>
      </div>
      {work.childCount > 0 ? (
        <div className="mt-2 text-xs text-muted-foreground">
          {work.completedChildCount}/{work.childCount} đầu mục con
        </div>
      ) : null}
    </button>
  );
}

function WorkPage({ scope = 'all' }: { scope?: 'all' | 'mine' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenantId } = useTenant();
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const [view, setView] = useState<WorkView>('list');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState<WorkPriority | ''>('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<WorkItem | null>(null);
  const [deletingWork, setDeletingWork] = useState<WorkItem | null>(null);
  const [createChildOf, setCreateChildOf] = useState<WorkItem | null>(null);
  const [kanbanColumns, setKanbanColumns] = useState<
    Record<string, WorkItem[]>
  >({});
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
    statuses: status ? [status as WorkStatus] : [],
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
  const works = useMemo(
    () => workQuery.data?.items ?? [],
    [workQuery.data?.items],
  );
  const templates = templateQuery.data ?? [];

  const employeeOptions = (employeeQuery.data ?? []).map((item) => ({
    value: item.id,
    label: item.label,
    searchableText: `${item.label} ${item.employeeCode}`,
  }));
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
    (parent?: WorkItem | null) => {
      setCreateChildOf(parent ?? null);
      createForm.reset({
        ...createForm.getValues(),
        parentId: parent?.id ?? '',
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
    editForm.reset({
      title: work.title,
      description: work.description,
      status: work.status,
      priority: work.priority,
      assigneeEmployeeId: work.assigneeEmployeeId ?? '',
      parentId: work.parentId ?? '',
      templateId: work.templateId ?? '',
      plannedStartDate: work.plannedStartDate ?? '',
      plannedEndDate: work.plannedEndDate ?? '',
      customerIds: work.customers.map((item) => item.id),
      contractIds: work.contracts.map((item) => item.id),
    });
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
  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkItem(tenantId!, deletingWork!.id),
    onSuccess: async () => {
      toast.success('Đã xóa công việc.');
      setDeletingWork(null);
      await queryClient.invalidateQueries({ queryKey: ['project', 'work'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status: nextStatus,
    }: {
      id: string;
      status: WorkStatus;
    }) => updateWorkItemStatus(tenantId!, id, nextStatus),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project', 'work'] });
      await queryClient.refetchQueries({
        queryKey: ['project', 'work', 'list'],
        type: 'active',
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

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
          {work.childCount ? (
            <>
              <span>·</span>
              <span>
                {work.completedChildCount}/{work.childCount} đầu mục con
              </span>
            </>
          ) : null}
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
    renderDates: (work) => (
      <div className={isWorkOverdue(work) ? 'text-admin-red-dark' : 'text-sm'}>
        <div>
          {work.plannedStartDate ? formatDate(work.plannedStartDate) : '—'} →{' '}
          {work.plannedEndDate ? formatDate(work.plannedEndDate) : '—'}
        </div>
        <div className="text-xs text-muted-foreground">
          {work.actualCompletedAt
            ? `Hoàn thành ${formatDateTime(work.actualCompletedAt)}`
            : `${workProgress(work)}% tiến độ`}
        </div>
      </div>
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

  const columnsByStatus = useMemo(() => {
    const next: Record<string, WorkItem[]> = Object.fromEntries(
      WORK_STATUS_ORDER.map((item) => [item, []]),
    );
    works.forEach((item) => {
      (next[item.status] ?? next.todo).push(item);
    });
    return next;
  }, [works]);
  useEffect(() => {
    setKanbanColumns(columnsByStatus);
  }, [columnsByStatus]);
  const calendarWorks = works.filter((work) => {
    if (!selectedDate) return true;
    const iso = selectedDate.toISOString().slice(0, 10);
    return work.plannedStartDate === iso || work.plannedEndDate === iso;
  });
  const submitProps = {
    statusOptions,
    priorityOptions,
    assigneeEmployeeIdOptions: employeeOptions,
    parentIdOptions: parentOptions,
    templateIdOptions: templateOptions,
    customerIdsOptions: customerOptions,
    contractIdsOptions: contractOptions,
  };
  const pageTitle = scope === 'mine' ? 'Việc của tôi' : 'Công việc';

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
  }: {
    activeContainer: string;
    overContainer: string;
    activeIndex: number;
    overIndex: number;
  }) => {
    const item = kanbanColumns[activeContainer]?.[activeIndex];
    const nextStatus = overContainer as WorkStatus;
    if (!item || item.status === nextStatus) return;
    setKanbanColumns((current) => {
      const copy = Object.fromEntries(
        Object.entries(current).map(([key, value]) => [key, [...value]]),
      );
      const [moved] = copy[activeContainer].splice(activeIndex, 1);
      copy[overContainer].splice(Math.max(overIndex, 0), 0, {
        ...moved,
        status: nextStatus,
      });
      return copy;
    });
    statusMutation.mutate({ id: item.id, status: nextStatus });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-auto p-4 lg:p-5">
      <PageHeader
        title={pageTitle}
        icon={ClipboardList}
        titleAside={
          <span className="text-sm text-muted-foreground">
            {workQuery.data?.total ?? 0} công việc
          </span>
        }
        actions={
          <Button onClick={() => openCreate()}>
            <Plus /> Thêm công việc
          </Button>
        }
      />
      <Card className="min-h-0 flex-1 overflow-hidden">
        <CardHeader className="flex-col items-stretch gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <WorkFilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value);
                setPagination((current) => ({ ...current, pageIndex: 0 }));
              }}
              status={status}
              onStatusChange={setStatus}
              statusOptions={statusOptions}
              priority={priority}
              onPriorityChange={(value) =>
                setPriority(value as WorkPriority | '')
              }
              priorityOptions={priorityOptions}
            />
            <Button
              variant="outline"
              mode="icon"
              aria-label="Làm mới"
              onClick={() => void workQuery.refetch()}
            >
              <RefreshCw />
            </Button>
          </div>
          <WorkViewSwitcher
            value={view}
            onValueChange={(value) => setView(value as WorkView)}
          />
        </CardHeader>
        {view === 'list' ? (
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
        ) : view === 'kanban' ? (
          <div className="min-h-0 flex-1 overflow-auto p-5">
            <Kanban
              value={kanbanColumns}
              onValueChange={setKanbanColumns}
              getItemValue={(item) => item.id}
              onMove={moveKanban}
            >
              <KanbanBoard className="min-w-[1100px] grid-cols-6">
                <>
                  {WORK_STATUS_ORDER.map((statusKey) => (
                    <KanbanColumn
                      key={statusKey}
                      value={statusKey}
                      className="min-h-[28rem] rounded-xl bg-muted/40 p-2"
                    >
                      <div className="mb-3 flex items-center justify-between px-2">
                        <span className="text-sm font-semibold">
                          {WORK_STATUS_LABELS[statusKey]}
                        </span>
                        <Badge variant="secondary">
                          {columnsByStatus[statusKey]?.length ?? 0}
                        </Badge>
                      </div>
                      <KanbanColumnContent value={statusKey}>
                        {(kanbanColumns[statusKey] ?? []).map((work) => (
                          <KanbanItem key={work.id} value={work.id}>
                            <WorkCard
                              work={work}
                              onOpen={(item) =>
                                navigate(
                                  buildPath(ROUTES.PROJECT.WORK_DETAIL, {
                                    id: item.id,
                                  }),
                                )
                              }
                            />
                          </KanbanItem>
                        ))}
                      </KanbanColumnContent>
                    </KanbanColumn>
                  ))}
                </>
              </KanbanBoard>
              <KanbanOverlay>
                {({ value }) => {
                  const work = works.find((item) => item.id === value);
                  return work ? (
                    <WorkCard work={work} onOpen={() => undefined} />
                  ) : null;
                }}
              </KanbanOverlay>
            </Kanban>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-5 overflow-auto p-5 xl:grid-cols-[auto_minmax(0,1fr)]">
            <div className="rounded-xl border bg-card">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
              />
            </div>
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="size-4 text-primary" /> Công việc trong
                ngày đã chọn
              </div>
              <div className="space-y-2">
                {calendarWorks.length ? (
                  calendarWorks.map((work) => (
                    <WorkCard
                      key={work.id}
                      work={work}
                      onOpen={(item) =>
                        navigate(
                          buildPath(ROUTES.PROJECT.WORK_DETAIL, {
                            id: item.id,
                          }),
                        )
                      }
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Không có công việc có mốc dự kiến trong ngày này.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
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

const WORK_STATUS_ORDER: WorkStatus[] = [
  'draft',
  'todo',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
];

export { WorkPage };
