import { safetyInspectionChecklistSchema } from '@/project/material-safety-inspections/model/safety-inspection-checklist';
import { z } from 'zod';
import { formatMessage } from '@/lib/validation';

const ownerSnapshotString = () =>
  z.string({ error: () => formatMessage('validation.required') });

export const materialFormSchema = z
  .object({
    code: z.string().trim().min(1, 'Vui lòng nhập mã vật tư.'),
    modelId: z.string().uuid('Vui lòng chọn mẫu vật tư.'),
    nameOverride: z.string().trim(),
    descriptionOverride: z.string().trim(),
    serialNumber: z.string().trim(),
    ownerPartyId: z
      .string()
      .refine(
        (value) => value === '' || z.string().uuid().safeParse(value).success,
        'Vui lòng chọn chủ sở hữu hợp lệ.',
      ),
    ownerSnapshot: z
      .object({
        kind: z.enum(['eps', 'external', 'warehouse', 'other']),
        code: ownerSnapshotString().trim(),
        name: ownerSnapshotString().trim(),
        representativeName: ownerSnapshotString().trim(),
        phone: ownerSnapshotString().trim(),
        email: ownerSnapshotString().trim(),
        departmentId: z.string().uuid().nullable().optional(),
        departmentCode: z.string().nullable().optional(),
        departmentName: z.string().nullable().optional(),
        teamId: z.string().uuid().nullable().optional(),
        teamCode: z.string().nullable().optional(),
        teamName: z.string().nullable().optional(),
        employeeId: z.string().uuid().nullable().optional(),
        scopePartyId: z.string().uuid().nullable().optional(),
      })
      .optional(),
    condition: z.enum(['good', 'damaged']),
    note: z.string().trim(),
    specificationOverrides: z.record(z.string(), z.array(z.string())),
    specificationOverrideLabels: z
      .record(z.string(), z.array(z.string()))
      .optional(),
    inspectionSettingsOverrideEnabled: z.boolean().optional(),
    requiresInspectionOverride: z.boolean().optional(),
    inspectionIntervalValueOverride: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.coerce.number().int().optional(),
    ),
    inspectionIntervalUnitOverride: z.enum(['day', 'month']).optional(),
    safetyInspectionChecklistOverrideEnabled: z.boolean().optional(),
    safetyInspectionChecklistOverride:
      safetyInspectionChecklistSchema.optional(),
  })
  .superRefine((values, context) => {
    if (!values.modelId)
      context.addIssue({
        code: 'custom',
        path: ['modelId'],
        message: 'Vui lòng chọn mẫu vật tư.',
      });
    const ownerKind = values.ownerSnapshot?.kind ?? 'eps';
    if (!values.ownerPartyId && ownerKind !== 'other')
      context.addIssue({
        code: 'custom',
        path: ['ownerPartyId'],
        message: 'Vui lòng chọn chủ sở hữu.',
      });
    if (
      !values.ownerPartyId &&
      ownerKind === 'other' &&
      !values.ownerSnapshot?.name
    )
      context.addIssue({
        code: 'custom',
        path: ['ownerSnapshot', 'name'],
        message: 'Vui lòng nhập tên chủ sở hữu.',
      });
    if (
      values.ownerPartyId &&
      values.ownerSnapshot &&
      !values.ownerSnapshot.name
    )
      context.addIssue({
        code: 'custom',
        path: ['ownerSnapshot', 'name'],
        message: 'Vui lòng nhập tên chủ sở hữu.',
      });
    if (values.inspectionSettingsOverrideEnabled) {
      if (values.requiresInspectionOverride === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['requiresInspectionOverride'],
          message: 'Vui lòng chọn có cần kiểm tra định kỳ hay không.',
        });
      } else if (values.requiresInspectionOverride) {
        if (
          values.inspectionIntervalValueOverride === undefined ||
          values.inspectionIntervalValueOverride < 1
        ) {
          context.addIssue({
            code: 'custom',
            path: ['inspectionIntervalValueOverride'],
            message: 'Nhập thời hạn kiểm tra là số nguyên lớn hơn 0.',
          });
        }
        if (!values.inspectionIntervalUnitOverride) {
          context.addIssue({
            code: 'custom',
            path: ['inspectionIntervalUnitOverride'],
            message: 'Vui lòng chọn đơn vị thời hạn kiểm tra.',
          });
        }
      }
    }
    if (
      values.safetyInspectionChecklistOverrideEnabled &&
      values.safetyInspectionChecklistOverride === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['safetyInspectionChecklistOverride'],
        message: formatMessage(
          'project.materials.safetyInspection.checklist.overrideRequired',
        ),
      });
    }
    if (
      values.ownerSnapshot?.email &&
      !/^\S+@\S+\.\S+$/.test(values.ownerSnapshot.email)
    )
      context.addIssue({
        code: 'custom',
        path: ['ownerSnapshot', 'email'],
        message: 'Nhập email hợp lệ.',
      });
  });

export type MaterialFormSchemaValues = z.infer<typeof materialFormSchema>;
