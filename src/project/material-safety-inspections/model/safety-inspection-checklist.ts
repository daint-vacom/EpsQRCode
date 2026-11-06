import { z } from 'zod';

export const safetyInspectionCriterionSchema = z.object({
  id: z.string().uuid(),
  content: z.string().trim().min(1, 'Vui lòng nhập nội dung kiểm định.'),
});

export const safetyInspectionChecklistGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Vui lòng nhập tên nhóm nội dung kiểm định.'),
  criteria: z
    .array(safetyInspectionCriterionSchema)
    .min(1, 'Mỗi nhóm cần có ít nhất một nội dung kiểm định.'),
});

export const safetyInspectionChecklistSchema = z.array(
  safetyInspectionChecklistGroupSchema,
);

export type SafetyInspectionCriterion = z.infer<
  typeof safetyInspectionCriterionSchema
>;
export type SafetyInspectionChecklistGroup = z.infer<
  typeof safetyInspectionChecklistGroupSchema
>;

export function mergeSafetyInspectionChecklists(
  ...checklists: Array<
    readonly SafetyInspectionChecklistGroup[] | null | undefined
  >
): SafetyInspectionChecklistGroup[] {
  const groups = new Map<string, SafetyInspectionChecklistGroup>();

  for (const checklist of checklists) {
    for (const group of checklist ?? []) {
      const existing = groups.get(group.id);
      if (!existing) {
        groups.set(group.id, {
          ...group,
          criteria: [...group.criteria],
        });
        continue;
      }

      const criterionIds = new Set(existing.criteria.map((item) => item.id));
      existing.criteria.push(
        ...group.criteria.filter((item) => !criterionIds.has(item.id)),
      );
    }
  }

  return [...groups.values()];
}
