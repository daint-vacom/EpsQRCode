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
    safetyInspectionChecklist: safetyInspectionChecklistSchema,
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
