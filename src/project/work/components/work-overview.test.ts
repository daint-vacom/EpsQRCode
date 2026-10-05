import { describe, expect, it } from 'vitest';
import type { WorkItem } from '../model/work';
import {
  createWorkOverviewColumns,
  WORK_OVERVIEW_COLUMN_ORDER,
} from './work-overview';

function makeWork(id: string, plannedEndDate: string | null): WorkItem {
  return {
    id,
    tenantId: 'tenant-1',
    code: id,
    parentId: null,
    templateId: null,
    title: id,
    description: '',
    status: 'todo',
    priority: 'normal',
    assigneeEmployeeId: null,
    assigneeName: '',
    assigneeCode: '',
    sortOrder: 0,
    plannedStartDate: null,
    plannedEndDate,
    plannedStartTime: null,
    plannedEndTime: null,
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

describe('work overview helpers', () => {
  it('keeps the five overview columns in display order', () => {
    expect(WORK_OVERVIEW_COLUMN_ORDER).toEqual([
      'overdue',
      'today',
      'this_week',
      'this_month',
      'no_due_date',
    ]);
  });

  it('separates overdue work from today and groups upcoming work by period', () => {
    const columns = createWorkOverviewColumns(
      [
        makeWork('overdue', '2026-09-15'),
        makeWork('today', '2026-09-16'),
        makeWork('week', '2026-09-19'),
        makeWork('month', '2026-09-30'),
        makeWork('undated', null),
      ],
      new Date(2026, 8, 16),
    );

    expect(
      columns.map((column) => column.works.map((work) => work.id)),
    ).toEqual([['overdue'], ['today'], ['week'], ['month'], ['undated']]);
  });
});
