import { describe, expect, it } from 'vitest';
import type { WorkItem } from '../model/work';
import {
  createWorkKanbanColumns,
  getWorkKanbanVisibleStatuses,
  moveWorkKanbanItem,
  restoreWorkKanbanItemStatus,
} from './work-kanban';

function makeWork(id: string, status: WorkItem['status']): WorkItem {
  return {
    id,
    tenantId: 'tenant-1',
    code: id,
    parentId: null,
    templateId: null,
    title: id,
    description: '',
    status,
    priority: 'normal',
    assigneeEmployeeId: null,
    assigneeName: '',
    assigneeCode: '',
    sortOrder: 0,
    plannedStartDate: null,
    plannedEndDate: null,
    plannedStartTime: null,
    plannedEndTime: null,
    color: '#2563eb',
    actualStartedAt: null,
    actualCompletedAt: null,
    childCount: 0,
    completedChildCount: 0,
    customers: [],
    contracts: [],
    createdAt: '',
    updatedAt: '',
  };
}

describe('work kanban helpers', () => {
  it('shows the primary workflow columns by default and all statuses on demand', () => {
    expect(getWorkKanbanVisibleStatuses()).toEqual([
      'todo',
      'in_progress',
      'completed',
    ]);
    expect(getWorkKanbanVisibleStatuses(true)).toHaveLength(6);
  });

  it('keeps every work status as a visible column', () => {
    const works = [
      makeWork('draft-1', 'draft'),
      makeWork('done-1', 'completed'),
    ];
    const columns = createWorkKanbanColumns(works);

    expect(columns.draft).toHaveLength(1);
    expect(columns.completed).toHaveLength(1);
    expect(columns.cancelled).toEqual([]);
  });

  it('moves a work item between columns and updates its status', () => {
    const columns = createWorkKanbanColumns([
      makeWork('todo-1', 'todo'),
      makeWork('progress-1', 'in_progress'),
    ]);

    const result = moveWorkKanbanItem({
      columns,
      activeContainer: 'todo',
      overContainer: 'in_progress',
      activeIndex: 0,
      overIndex: 1,
    });

    expect(result?.work).toMatchObject({ id: 'todo-1', status: 'in_progress' });
    expect(result?.columns.todo).toEqual([]);
    expect(result?.columns.in_progress.map((work) => work.id)).toEqual([
      'progress-1',
      'todo-1',
    ]);
  });

  it('does not persist a move within the same status column', () => {
    const columns = createWorkKanbanColumns([makeWork('todo-1', 'todo')]);

    expect(
      moveWorkKanbanItem({
        columns,
        activeContainer: 'todo',
        overContainer: 'todo',
        activeIndex: 0,
        overIndex: 0,
      }),
    ).toBeNull();
  });

  it('restores only the failed work item to its original status and position', () => {
    const columns = createWorkKanbanColumns([
      makeWork('todo-1', 'todo'),
      makeWork('todo-2', 'todo'),
      makeWork('progress-1', 'in_progress'),
    ]);
    const moved = moveWorkKanbanItem({
      columns,
      activeContainer: 'todo',
      overContainer: 'in_progress',
      activeIndex: 1,
      overIndex: 1,
    });

    expect(moved).not.toBeNull();
    const restored = restoreWorkKanbanItemStatus({
      columns: moved!.columns,
      workId: 'todo-2',
      status: 'todo',
      index: 1,
    });

    expect(restored.todo.map((work) => work.id)).toEqual(['todo-1', 'todo-2']);
    expect(restored.in_progress.map((work) => work.id)).toEqual(['progress-1']);
  });
});
