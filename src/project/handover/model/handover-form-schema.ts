import { z } from 'zod';

const itemSchema = z.object({
  materialId: z.string().uuid('Chọn vật tư hợp lệ.'),
  condition: z.enum(['good', 'damaged']),
  conditionNote: z.string().trim(),
});

export const handoverFormSchema = z
  .object({
    type: z.enum(['transfer', 'loan', 'return']),
    senderPartyId: z.string().uuid('Chọn bên giao.'),
    recipientPartyId: z.string().uuid('Chọn bên nhận.'),
    senderRepresentativeUserId: z.string().uuid().nullable(),
    recipientRepresentativeUserId: z.string().uuid().nullable(),
    plannedDate: z.string().min(1, 'Chọn ngày dự kiến.'),
    dueDate: z.string(),
    note: z.string().trim(),
    items: z.array(itemSchema).min(1, 'Thêm ít nhất một vật tư.'),
    attachmentFileIds: z.array(z.string().uuid()),
  })
  .superRefine((values, context) => {
    if (values.senderPartyId === values.recipientPartyId) {
      context.addIssue({
        code: 'custom',
        path: ['recipientPartyId'],
        message: 'Bên giao và bên nhận phải khác nhau.',
      });
    }
    if (values.type === 'loan' && !values.dueDate) {
      context.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Chọn hạn trả cho phiếu cho mượn.',
      });
    }
    const seen = new Set<string>();
    values.items.forEach((item, index) => {
      if (seen.has(item.materialId)) {
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'materialId'],
          message: 'Vật tư đã có trong phiếu.',
        });
      }
      seen.add(item.materialId);
      if (item.condition === 'damaged' && !item.conditionNote.trim()) {
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'conditionNote'],
          message: 'Ghi chú tình trạng bắt buộc khi vật tư bị hỏng.',
        });
      }
    });
  });

export type HandoverFormValues = z.infer<typeof handoverFormSchema>;
