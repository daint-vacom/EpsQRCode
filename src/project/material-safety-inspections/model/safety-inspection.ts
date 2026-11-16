import { z } from 'zod';
import type { SafetyInspectionChecklistGroup } from './safety-inspection-checklist';

export const safetyInspectionResultSchema = z.enum(['passed', 'failed']);

export const safetyInspectionCriterionResultSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  passed: z.boolean().nullable(),
  note: z.string(),
});

export const safetyInspectionGroupResultSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  criteria: z.array(safetyInspectionCriterionResultSchema),
});

export const safetyInspectionDraftFormSchema = z.object({
  inspectedAt: z.string().min(1, 'Vui lòng chọn thời gian kiểm tra.'),
  inspectorName: z.string().trim().min(1, 'Vui lòng nhập người thực hiện.'),
  checklistResult: z.array(safetyInspectionGroupResultSchema).min(1),
  overallNote: z.string(),
  overallResult: safetyInspectionResultSchema.optional(),
});

export const safetyInspectionFormSchema =
  safetyInspectionDraftFormSchema.superRefine((values, context) => {
    if (!values.overallResult) {
      context.addIssue({
        code: 'custom',
        path: ['overallResult'],
        message: 'Vui lòng chọn kết quả kiểm tra.',
      });
    }
    values.checklistResult.forEach((group, groupIndex) => {
      group.criteria.forEach((criterion, criterionIndex) => {
        if (criterion.passed === null) {
          context.addIssue({
            code: 'custom',
            path: [
              'checklistResult',
              groupIndex,
              'criteria',
              criterionIndex,
              'passed',
            ],
            message: 'Vui lòng đánh giá nội dung kiểm tra này.',
          });
        }
      });
    });
  });

export type SafetyInspectionResult = z.infer<
  typeof safetyInspectionResultSchema
>;
export type SafetyInspectionCriterionResult = z.infer<
  typeof safetyInspectionCriterionResultSchema
>;
export type SafetyInspectionGroupResult = z.infer<
  typeof safetyInspectionGroupResultSchema
>;
export type SafetyInspectionFormValues = z.infer<
  typeof safetyInspectionFormSchema
>;

export interface SafetyInspectionAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  url?: string;
}

export interface SafetyInspection {
  id: string;
  materialId: string;
  status: SafetyInspectionStatus;
  inspectedAt: string;
  inspectorUserId: string;
  inspectorName: string;
  checklistResult: SafetyInspectionGroupResult[];
  overallNote: string;
  overallResult: SafetyInspectionResult | null;
  attachments: SafetyInspectionAttachment[];
  createdAt: string;
}

export type SafetyInspectionStatus = 'in_progress' | 'completed';

export interface MaterialSafetyInspectionQueueRow {
  id: string;
  code: string;
  name: string;
  lastInspectedAt: string | null;
  nextDueDate: string;
  daysRemaining: number;
  status: 'due' | 'upcoming' | 'in_progress';
  activeInspectionId: string | null;
  hasChecklist: boolean;
}

export interface SafetyInspectionListRow {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  inspectedAt: string;
  inspectorName: string;
  status: SafetyInspectionStatus;
  overallResult: SafetyInspectionResult | null;
}

export interface SafetyInspectionListFilters {
  search?: string;
  status?: SafetyInspectionStatus;
  overallResult?: SafetyInspectionResult | 'none';
  page?: number;
  pageSize?: number;
}

export interface SafetyInspectionListSummary {
  total: number;
  inProgress: number;
  completed: number;
  passed: number;
  failed: number;
  noResult: number;
}

export interface MaterialSafetyInspectionQueueFilters {
  search?: string;
  groupIds?: string[];
  status?: MaterialSafetyInspectionQueueRow['status'];
  ownerPartyId?: string;
  page?: number;
  pageSize?: number;
}

export interface MaterialSafetyInspectionQueueSummary {
  total: number;
  due: number;
  upcoming: number;
  inProgress: number;
}

export interface MaterialSafetyInspectionQueueChartPoint {
  name: string;
  value: number;
  fill: string;
}

export interface MaterialSafetyInspectionPlanFilters {
  search?: string;
  groupIds?: string[];
  ownerPartyId?: string;
  year: number;
}

export interface MaterialSafetyInspectionPlanPoint {
  month: number;
  notInspected: number;
  inProgress: number;
  completed: number;
}

export interface MaterialSafetyInspectionPlanChartPoint extends MaterialSafetyInspectionPlanPoint {
  monthLabel: string;
}

export interface MaterialSafetyInspectionPlanResult {
  year: number;
  items: MaterialSafetyInspectionPlanPoint[];
}

export type MaterialSafetyInspectionQueueOwnerFilterType =
  | 'department'
  | 'team'
  | 'person'
  | 'warehouse'
  | 'external';

export interface MaterialSafetyInspectionQueueOwnerFilter {
  types: MaterialSafetyInspectionQueueOwnerFilterType[];
  departmentId: string | null;
  teamId: string | null;
}

export interface MaterialSafetyInspectionQueueResult extends SafetyInspectionListResult<MaterialSafetyInspectionQueueRow> {
  summary: MaterialSafetyInspectionQueueSummary;
  ownerFilter: MaterialSafetyInspectionQueueOwnerFilter;
  groupCounts: Record<string, number>;
  groupCountsTotal: number;
}

export interface SafetyInspectionListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function makeSafetyInspectionFormValues(
  groups: SafetyInspectionChecklistGroup[],
  inspectorName: string,
  inspectedAt: string,
): SafetyInspectionFormValues {
  return {
    inspectedAt,
    inspectorName,
    checklistResult: groups.map((group) => ({
      id: group.id,
      name: group.name,
      criteria: group.criteria.map((criterion) => ({
        id: criterion.id,
        content: criterion.content,
        passed: null,
        note: '',
      })),
    })),
    overallNote: '',
    overallResult: undefined,
  };
}
