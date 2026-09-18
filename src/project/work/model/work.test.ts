import { describe, expect, it } from 'vitest';
import { isWorkOverdue, workProgress, type WorkItem } from './work';

const baseWork: WorkItem = {
  id: 'work-1',
  tenantId: 'tenant-1',
  code: 'CV-1',
  parentId: null,
  templateId: null,
  title: 'Lập tờ khai',
  description: '',
  status: 'in_progress',
  priority: 'normal',
  assigneeEmployeeId: null,
  assigneeName: '',
  assigneeCode: '',
  sortOrder: 0,
  plannedStartDate: '2026-09-01',
  plannedEndDate: '2026-09-10',
  actualStartedAt: null,
  actualCompletedAt: null,
  childCount: 4,
  completedChildCount: 1,
  customers: [],
  contracts: [],
  createdAt: '',
  updatedAt: '',
};

describe('work model helpers', () => {
  it('calculates progress from child completion and caps completed work at 100', () => {
    expect(workProgress(baseWork)).toBe(25);
    expect(workProgress({ ...baseWork, status: 'completed' })).toBe(100);
  });

  it('detects overdue planned completion dates but not terminal work', () => {
    expect(isWorkOverdue(baseWork, new Date('2026-09-11T08:00:00Z'))).toBe(
      true,
    );
    expect(
      isWorkOverdue(
        { ...baseWork, status: 'completed' },
        new Date('2026-09-11T08:00:00Z'),
      ),
    ).toBe(false);
  });
});
