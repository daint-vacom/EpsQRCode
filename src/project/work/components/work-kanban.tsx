import * as React from 'react';
import type { DragStartEvent } from '@dnd-kit/core';
import { GripVertical, LoaderCircle } from 'lucide-react';
import { getRichTextPlainText } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
  type KanbanMoveEvent,
  type KanbanMovePreviewEvent,
} from '@/components/ui/kanban';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getAvatarInitials } from '@/components/common/avatar-identity';
import {
  GradientAvatar,
  IDENTITY_AVATAR_TONES,
} from '@/components/common/gradient-avatar';
import {
  WORK_PRIORITY_LABELS,
  WORK_STATUS_LABELS,
  WORK_STATUSES,
  type WorkItem,
  type WorkStatus,
} from '../model/work';
import { WorkPriorityIcon } from './work-priority-icon';

export const WORK_KANBAN_STATUS_ORDER: readonly WorkStatus[] = [
  ...WORK_STATUSES,
];

export const WORK_KANBAN_PRIMARY_STATUS_ORDER: readonly WorkStatus[] = [
  'todo',
  'in_progress',
  'completed',
];

export type WorkKanbanColumns = Record<WorkStatus, WorkItem[]>;

function getWorkKanbanItemId(work: WorkItem): string {
  return work.id;
}

export function getWorkKanbanVisibleStatuses(
  showAllStatuses = false,
): readonly WorkStatus[] {
  return showAllStatuses
    ? WORK_KANBAN_STATUS_ORDER
    : WORK_KANBAN_PRIMARY_STATUS_ORDER;
}

export function createWorkKanbanColumns(
  works: readonly WorkItem[],
): WorkKanbanColumns {
  const columns = Object.fromEntries(
    WORK_KANBAN_STATUS_ORDER.map((status) => [status, [] as WorkItem[]]),
  ) as WorkKanbanColumns;

  works.forEach((work) => {
    columns[work.status].push(work);
  });

  return columns;
}

function cloneWorkKanbanColumns(columns: WorkKanbanColumns): WorkKanbanColumns {
  return Object.fromEntries(
    WORK_KANBAN_STATUS_ORDER.map((status) => [status, [...columns[status]]]),
  ) as WorkKanbanColumns;
}

export function moveWorkKanbanItem({
  columns,
  activeContainer,
  overContainer,
  activeIndex,
  overIndex,
}: {
  columns: WorkKanbanColumns;
  activeContainer: string;
  overContainer: string;
  activeIndex: number;
  overIndex: number;
}): { columns: WorkKanbanColumns; work: WorkItem } | null {
  if (
    !WORK_KANBAN_STATUS_ORDER.includes(activeContainer as WorkStatus) ||
    !WORK_KANBAN_STATUS_ORDER.includes(overContainer as WorkStatus) ||
    activeContainer === overContainer
  ) {
    return null;
  }

  const activeStatus = activeContainer as WorkStatus;
  const overStatus = overContainer as WorkStatus;
  const activeItems = columns[activeStatus];
  const overItems = columns[overStatus];
  const movedWork = activeItems[activeIndex];

  if (!movedWork) return null;

  const nextColumns: WorkKanbanColumns = {
    ...columns,
    [activeStatus]: [...activeItems],
    [overStatus]: [...overItems],
  };
  nextColumns[activeStatus].splice(activeIndex, 1);

  const nextWork = { ...movedWork, status: overStatus };
  const insertAt = Math.max(0, Math.min(overIndex, overItems.length));
  nextColumns[overStatus].splice(insertAt, 0, nextWork);

  return { columns: nextColumns, work: nextWork };
}

export function restoreWorkKanbanItemStatus({
  columns,
  workId,
  status,
  index,
}: {
  columns: WorkKanbanColumns;
  workId: string;
  status: WorkStatus;
  index: number;
}): WorkKanbanColumns {
  let work: WorkItem | undefined;
  const nextColumns = Object.fromEntries(
    WORK_KANBAN_STATUS_ORDER.map((columnStatus) => [
      columnStatus,
      columns[columnStatus].filter((item) => {
        if (item.id !== workId) return true;
        work = item;
        return false;
      }),
    ]),
  ) as WorkKanbanColumns;

  if (!work) return columns;

  const targetItems = nextColumns[status];
  const insertAt = Math.max(0, Math.min(index, targetItems.length));
  targetItems.splice(insertAt, 0, { ...work, status });

  return nextColumns;
}

const WORK_KANBAN_STATUS_INDICATOR_CLASSES: Record<WorkStatus, string> = {
  draft: 'bg-muted-foreground',
  todo: 'bg-admin-blue-primary',
  in_progress: 'bg-admin-amber-primary',
  paused: 'bg-muted-foreground',
  completed: 'bg-admin-success-text',
  cancelled: 'bg-admin-red-primary',
};

export interface WorkKanbanCardProps {
  work: WorkItem;
  onOpen: (work: WorkItem) => void;
  assigneeAvatarUrl?: string | null;
  isOverlay?: boolean;
  disabled?: boolean;
  isSaving?: boolean;
}

export function WorkKanbanCard({
  work,
  onOpen,
  assigneeAvatarUrl,
  isOverlay = false,
  disabled = false,
  isSaving = false,
}: WorkKanbanCardProps) {
  const descriptionPreview = getRichTextPlainText(work.description);

  const cardContent = (
    <div
      className={cn(
        'rounded-md border border-border border-s-4 bg-card p-3 shadow-xs transition-shadow hover:shadow-sm',
      )}
      style={{ borderInlineStartColor: work.color }}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Button
              type="button"
              variant="ghost"
              mode="link"
              className="h-auto max-w-full justify-start whitespace-normal p-0 text-left text-sm font-medium leading-5 text-foreground hover:text-primary"
              onClick={() => onOpen(work)}
            >
              <span
                className={cn(
                  'line-clamp-2',
                  work.status === 'completed' && 'line-through',
                  work.status === 'cancelled' &&
                    'text-destructive line-through decoration-destructive',
                )}
              >
                {work.title}
              </span>
            </Button>
          </div>
          {isSaving ? (
            <LoaderCircle
              className="size-3.5 shrink-0 animate-spin text-primary"
              aria-label="Đang lưu trạng thái"
              title="Đang lưu trạng thái"
            />
          ) : null}
        </div>

        {descriptionPreview ? (
          <p className="line-clamp-3 text-xs text-muted-foreground">
            {descriptionPreview}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="size-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: work.color }}
                  role="img"
                  aria-label="Màu công việc"
                  tabIndex={0}
                />
              </TooltipTrigger>
              <TooltipContent>Màu công việc</TooltipContent>
            </Tooltip>
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">
              {work.code}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex shrink-0"
                  role="img"
                  aria-label={`Độ ưu tiên: ${WORK_PRIORITY_LABELS[work.priority]}`}
                  tabIndex={0}
                >
                  <WorkPriorityIcon
                    priority={work.priority}
                    className="!size-5"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Độ ưu tiên: {WORK_PRIORITY_LABELS[work.priority]}
              </TooltipContent>
            </Tooltip>

            {work.assigneeName ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex shrink-0"
                    role="img"
                    aria-label={`Người phụ trách: ${work.assigneeName}`}
                    tabIndex={0}
                  >
                    <GradientAvatar
                      src={assigneeAvatarUrl}
                      alt={work.assigneeName}
                      fallback={getAvatarInitials(work.assigneeName)}
                      tone={IDENTITY_AVATAR_TONES.employee}
                      className="size-6 rounded-lg text-[10px]"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Người phụ trách: {work.assigneeName}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );

  if (isOverlay) return cardContent;

  return (
    <KanbanItem value={work.id} disabled={disabled}>
      <KanbanItemHandle asChild>{cardContent}</KanbanItemHandle>
    </KanbanItem>
  );
}

export function WorkKanbanCardSkeleton() {
  return (
    <Skeleton
      aria-hidden="true"
      className="h-28 w-full rounded-md border border-border border-s-4 shadow-xs"
    />
  );
}

function WorkKanbanColumn({
  status,
  works,
  onOpen,
  disabled = false,
  isLoading = false,
  savingWorkIds,
  assigneeAvatarUrls,
}: {
  status: WorkStatus;
  works: WorkItem[];
  onOpen: (work: WorkItem) => void;
  disabled?: boolean;
  isLoading?: boolean;
  savingWorkIds?: ReadonlySet<string>;
  assigneeAvatarUrls?: ReadonlyMap<string, string | null>;
}) {
  return (
    <KanbanColumn
      value={status}
      disabled={disabled}
      className="min-h-[34rem] rounded-md border border-border bg-muted/40 p-2.5 shadow-xs"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'size-4 shrink-0 rounded-full ring-2 ring-background',
              WORK_KANBAN_STATUS_INDICATOR_CLASSES[status],
            )}
            aria-hidden="true"
          />
          <span className="truncate text-sm font-semibold">
            {WORK_STATUS_LABELS[status]}
          </span>
          <Badge variant="secondary" size="sm">
            {works.length}
          </Badge>
        </div>
        <KanbanColumnHandle asChild>
          <Button
            type="button"
            variant="dim"
            size="sm"
            mode="icon"
            disabled={disabled}
            aria-label={'Kéo cột ' + WORK_STATUS_LABELS[status]}
            title="Kéo để sắp xếp cột"
          >
            <GripVertical aria-hidden="true" />
          </Button>
        </KanbanColumnHandle>
      </div>

      <KanbanColumnContent
        value={status}
        className="min-h-[27rem] gap-2.5 p-0.5"
      >
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <WorkKanbanCardSkeleton key={index} />
          ))
        ) : works.length ? (
          works.map((work) => (
            <WorkKanbanCard
              key={work.id}
              work={work}
              onOpen={onOpen}
              assigneeAvatarUrl={
                work.assigneeEmployeeId
                  ? assigneeAvatarUrls?.get(work.assigneeEmployeeId)
                  : undefined
              }
              disabled={disabled}
              isSaving={savingWorkIds?.has(work.id)}
            />
          ))
        ) : (
          <p className="px-2 py-2 text-center text-sm text-muted-foreground">
            Công việc trống
          </p>
        )}
      </KanbanColumnContent>
    </KanbanColumn>
  );
}

export interface WorkKanbanProps {
  columns: WorkKanbanColumns;
  onColumnsChange: (columns: WorkKanbanColumns) => void;
  onMove: (event: KanbanMoveEvent) => void;
  onOpen: (work: WorkItem) => void;
  showAllStatuses?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  savingWorkIds?: ReadonlySet<string>;
  assigneeAvatarUrls?: ReadonlyMap<string, string | null>;
}

export function WorkKanban({
  columns,
  onColumnsChange,
  onMove,
  onOpen,
  showAllStatuses = false,
  disabled = false,
  isLoading = false,
  savingWorkIds,
  assigneeAvatarUrls,
}: WorkKanbanProps) {
  const [previewColumns, setPreviewColumns] =
    React.useState<WorkKanbanColumns | null>(null);
  const dragOriginColumnsRef = React.useRef<WorkKanbanColumns | null>(null);
  const displayColumns = previewColumns ?? columns;
  const visibleStatuses = React.useMemo(
    () => getWorkKanbanVisibleStatuses(showAllStatuses),
    [showAllStatuses],
  );
  const visibleColumns = React.useMemo(
    () =>
      Object.fromEntries(
        visibleStatuses.map((status) => [status, displayColumns[status]]),
      ),
    [displayColumns, visibleStatuses],
  );

  const handleVisibleColumnsChange = (
    nextColumns: Record<string, WorkItem[]>,
  ) => {
    const mergedColumns = {
      ...(previewColumns ?? columns),
      ...nextColumns,
    } as WorkKanbanColumns;

    if (previewColumns) {
      setPreviewColumns(mergedColumns);
    } else {
      onColumnsChange(mergedColumns);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (WORK_KANBAN_STATUS_ORDER.includes(event.active.id as WorkStatus)) {
      return;
    }

    dragOriginColumnsRef.current = cloneWorkKanbanColumns(columns);
    setPreviewColumns(cloneWorkKanbanColumns(columns));
  };

  const handleDragOver = (event: KanbanMovePreviewEvent) => {
    setPreviewColumns((currentColumns) => {
      const nextColumns = currentColumns ?? columns;
      const moved = moveWorkKanbanItem({
        columns: nextColumns,
        activeContainer: event.activeContainer,
        overContainer: event.overContainer,
        activeIndex: event.activeIndex,
        overIndex: event.overIndex,
      });

      return moved?.columns ?? currentColumns;
    });
  };

  const handleDragCancel = () => {
    dragOriginColumnsRef.current = null;
    setPreviewColumns(null);
  };

  const handleMove = (event: KanbanMoveEvent) => {
    const originColumns = dragOriginColumnsRef.current ?? columns;
    const activeId = String(event.event.active.id);
    const originEntry = Object.entries(originColumns).find(([, works]) =>
      works.some((work) => work.id === activeId),
    );
    const currentColumns = previewColumns ?? columns;
    const targetItems = currentColumns[event.overContainer].filter(
      (work) => work.id !== activeId,
    );
    const overId = event.event.over?.id;
    const overIndex =
      overId && !WORK_KANBAN_STATUS_ORDER.includes(overId as WorkStatus)
        ? targetItems.findIndex((work) => work.id === String(overId))
        : targetItems.length;

    onMove({
      ...event,
      activeContainer: originEntry?.[0] ?? event.activeContainer,
      activeIndex:
        originEntry?.[1].findIndex((work) => work.id === activeId) ??
        event.activeIndex,
      overIndex: overIndex >= 0 ? overIndex : targetItems.length,
    });

    dragOriginColumnsRef.current = null;
    setPreviewColumns(null);
  };

  return (
    <div className="min-h-full min-w-0">
      <Kanban
        value={visibleColumns}
        onValueChange={handleVisibleColumnsChange}
        getItemValue={getWorkKanbanItemId}
        onMove={handleMove}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
      >
        <KanbanBoard
          className={
            showAllStatuses
              ? '!grid-cols-6 min-w-[1560px] gap-3'
              : 'grid-cols-3 min-w-[860px] gap-3'
          }
        >
          {Object.entries(visibleColumns).map(([status, works]) => (
            <WorkKanbanColumn
              key={status}
              status={status as WorkStatus}
              works={works}
              onOpen={onOpen}
              disabled={disabled}
              isLoading={isLoading}
              savingWorkIds={savingWorkIds}
              assigneeAvatarUrls={assigneeAvatarUrls}
            />
          ))}
        </KanbanBoard>
        <KanbanOverlay>
          {({ value }) => {
            const work = Object.values(visibleColumns)
              .flat()
              .find((item) => item.id === value);
            return work ? (
              <WorkKanbanCard
                work={work}
                onOpen={() => undefined}
                assigneeAvatarUrl={
                  work.assigneeEmployeeId
                    ? assigneeAvatarUrls?.get(work.assigneeEmployeeId)
                    : undefined
                }
                disabled={disabled}
                isSaving={savingWorkIds?.has(work.id)}
                isOverlay
              />
            ) : null;
          }}
        </KanbanOverlay>
      </Kanban>
    </div>
  );
}
