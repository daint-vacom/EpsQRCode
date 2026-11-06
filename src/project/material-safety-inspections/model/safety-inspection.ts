import { z } from 'zod';
import type { SafetyInspectionChecklistGroup } from './safety-inspection-checklist';

export const safetyInspectionResultSchema = z.enum(['passed', 'failed']);

export const safetyInspectionCriterionResultSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  passed: z.boolean(),
  note: z.string(),
});

export const safetyInspectionGroupResultSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  criteria: z.array(safetyInspectionCriterionResultSchema),
});

export const safetyInspectionFormSchema = z
  .object({
    inspectedAt: z.string().min(1, 'Vui lòng chọn thời gian kiểm định.'),
    inspectorName: z.string().trim().min(1, 'Vui lòng nhập người kiểm định.'),
    checklistResult: z.array(safetyInspectionGroupResultSchema).min(1),
    overallNote: z.string(),
    overallResult: safetyInspectionResultSchema.optional(),
  })
  .superRefine((values, context) => {
    if (!values.overallResult) {
      context.addIssue({
        code: 'custom',
        path: ['overallResult'],
        message: 'Vui lòng chọn kết quả kiểm định.',
      });
    }
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
  inspectedAt: string;
  inspectorUserId: string;
  inspectorName: string;
  checklistResult: SafetyInspectionGroupResult[];
  overallNote: string;
  overallResult: SafetyInspectionResult;
  attachments: SafetyInspectionAttachment[];
  createdAt: string;
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
        passed: false,
        note: '',
      })),
    })),
    overallNote: '',
    overallResult: undefined,
  };
}
