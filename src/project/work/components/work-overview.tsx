import * as React from 'react';
import { cn } from '@/lib/utils';
import { isWorkOverdue, type WorkItem } from '../model/work';
import { WorkKanbanCard, WorkKanbanCardSkeleton } from './work-kanban';

export const WORK_OVERVIEW_COLUMN_ORDER = [
  'overdue',
  'today',
  'this_week',
  'this_month',
  'no_due_date',
] as const;

export type WorkOverviewColumnKey = (typeof WORK_OVERVIEW_COLUMN_ORDER)[number];

export interface WorkOverviewColumn {
  key: WorkOverviewColumnKey;
  label: string;
  headerClassName: string;
  works: WorkItem[];
}

const WORK_OVERVIEW_COLUMN_META: Record<
  WorkOverviewColumnKey,
  Omit<WorkOverviewColumn, 'works'>
> = {
  overdue: {
    key: 'overdue',
    label: 'Quá hạn',
    headerClassName: 'bg-admin-red-primary',
  },
  today: {
    key: 'today',
    label: 'Hôm nay',
    headerClassName: 'bg-admin-blue-primary',
  },
  this_week: {
    key: 'this_week',
    label: 'Tuần này',
    headerClassName: 'bg-admin-amber-primary',
  },
  this_month: {
    key: 'this_month',
    label: 'Tháng này',
    headerClassName: 'bg-admin-success-text',
  },
  no_due_date: {
    key: 'no_due_date',
    label: 'Không có hạn',
    headerClassName: 'bg-muted-foreground',
  },
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseWorkDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getNextWeekStart(today: Date): Date {
  const mondayOffset = (today.getDay() + 6) % 7;
  const weekStart = addDays(today, -mondayOffset);
  return addDays(weekStart, 7);
}

function getNextMonthStart(today: Date): Date {
  return new Date(today.getFullYear(), today.getMonth() + 1, 1);
}

function getWorkOverviewColumnKey(
  work: WorkItem,
  todayValue: Date,
): WorkOverviewColumnKey {
  if (!work.plannedEndDate) return 'no_due_date';

  const today = startOfDay(todayValue);
  const plannedEndDate = parseWorkDate(work.plannedEndDate);

  if (isWorkOverdue(work, today)) return 'overdue';
  // Keep terminal work with a past date visible in the dated overview instead
  // of treating it as active overdue work.
  if (plannedEndDate <= today) return 'today';
  if (plannedEndDate < getNextWeekStart(today)) return 'this_week';
  if (plannedEndDate < getNextMonthStart(today)) return 'this_month';

  return 'no_due_date';
}

export function createWorkOverviewColumns(
  works: readonly WorkItem[],
  today = new Date(),
): WorkOverviewColumn[] {
  const columns = Object.fromEntries(
    WORK_OVERVIEW_COLUMN_ORDER.map((key) => [
      key,
      { ...WORK_OVERVIEW_COLUMN_META[key], works: [] as WorkItem[] },
    ]),
  ) as Record<WorkOverviewColumnKey, WorkOverviewColumn>;

  works.forEach((work) => {
    columns[getWorkOverviewColumnKey(work, today)].works.push(work);
  });

  return WORK_OVERVIEW_COLUMN_ORDER.map((key) => columns[key]);
}

export interface WorkOverviewProps {
  works: readonly WorkItem[];
  onOpen: (work: WorkItem) => void;
  isLoading?: boolean;
  savingWorkIds?: ReadonlySet<string>;
  assigneeAvatarUrls?: ReadonlyMap<string, string | null>;
}

function WorkOverviewColumn({
  column,
  onOpen,
  isLoading,
  savingWorkIds,
  assigneeAvatarUrls,
}: {
  column: WorkOverviewColumn;
  onOpen: WorkOverviewProps['onOpen'];
  isLoading: boolean;
  savingWorkIds?: ReadonlySet<string>;
  assigneeAvatarUrls?: ReadonlyMap<string, string | null>;
}) {
  return (
    <section className="flex h-full min-h-[34rem] min-w-0 flex-col gap-2">
      <header
        className={cn(
          'flex h-10 shrink-0 items-center justify-between gap-2 rounded-md px-3 text-sm font-semibold text-white',
          column.headerClassName,
        )}
      >
        <h2 className="truncate">{column.label}</h2>
        <span className="shrink-0 tabular-nums">{column.works.length}</span>
      </header>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <WorkKanbanCardSkeleton key={index} />
          ))
        ) : column.works.length ? (
          column.works.map((work) => (
            <WorkKanbanCard
              key={work.id}
              work={work}
              onOpen={onOpen}
              assigneeAvatarUrl={
                work.assigneeEmployeeId
                  ? assigneeAvatarUrls?.get(work.assigneeEmployeeId)
                  : undefined
              }
              isSaving={savingWorkIds?.has(work.id)}
              isOverlay
            />
          ))
        ) : (
          <p className="px-2 py-2 text-center text-sm text-muted-foreground">
            Công việc trống
          </p>
        )}
      </div>
    </section>
  );
}

export function WorkOverview({
  works,
  onOpen,
  isLoading = false,
  savingWorkIds,
  assigneeAvatarUrls,
}: WorkOverviewProps) {
  const columns = React.useMemo(
    () => createWorkOverviewColumns(works),
    [works],
  );

  return (
    <div className="grid h-full min-h-[34rem] min-w-[1400px] grid-cols-5 gap-3">
      {columns.map((column) => (
        <WorkOverviewColumn
          key={column.key}
          column={column}
          onOpen={onOpen}
          isLoading={isLoading}
          savingWorkIds={savingWorkIds}
          assigneeAvatarUrls={assigneeAvatarUrls}
        />
      ))}
    </div>
  );
}
