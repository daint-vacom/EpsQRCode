import { z } from 'zod';

export const materialFormSchema = z
  .object({
    code: z.string().trim().min(1, 'Vui lòng nhập mã vật tư.'),
    modelId: z.string().uuid('Vui lòng chọn mẫu vật tư.'),
    nameOverride: z.string().trim(),
    descriptionOverride: z.string().trim(),
    serialNumber: z.string().trim(),
    ownerPartyId: z.string().uuid('Vui lòng chọn chủ sở hữu.'),
    condition: z.enum(['good', 'damaged']),
    note: z.string().trim(),
    specificationOverrides: z.record(z.string(), z.array(z.string())),
    specificationOverrideLabels: z
      .record(z.string(), z.array(z.string()))
      .optional(),
  })
  .superRefine((values, context) => {
    if (!values.modelId)
      context.addIssue({
        code: 'custom',
        path: ['modelId'],
        message: 'Vui lòng chọn mẫu vật tư.',
      });
    if (!values.ownerPartyId)
      context.addIssue({
        code: 'custom',
        path: ['ownerPartyId'],
        message: 'Vui lòng chọn chủ sở hữu.',
      });
  });

export type MaterialFormSchemaValues = z.infer<typeof materialFormSchema>;
