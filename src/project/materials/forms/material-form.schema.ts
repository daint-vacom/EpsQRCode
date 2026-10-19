import { z } from 'zod';

export const materialFormSchema = z
  .object({
    code: z.string().trim().min(1, 'Vui lòng nhập mã vật tư.'),
    modelId: z.string().uuid('Vui lòng chọn mẫu vật tư.'),
    nameOverride: z.string().trim(),
    descriptionOverride: z.string().trim(),
    imageUrlOverride: z
      .string()
      .trim()
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      }, 'Vui lòng nhập đường dẫn ảnh HTTP hoặc HTTPS hợp lệ.'),
    serialNumber: z.string().trim(),
    ownerPartyId: z.string().uuid('Vui lòng chọn chủ sở hữu.'),
    condition: z.enum(['good', 'damaged']),
    conditionNote: z.string().trim(),
    specificationOverrides: z.record(z.string(), z.array(z.string())),
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
    if (values.condition === 'damaged' && !values.conditionNote) {
      context.addIssue({
        code: 'custom',
        path: ['conditionNote'],
        message: 'Vui lòng mô tả tình trạng hỏng hóc.',
      });
    }
  });

export type MaterialFormSchemaValues = z.infer<typeof materialFormSchema>;
