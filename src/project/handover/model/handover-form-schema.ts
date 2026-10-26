import { z } from 'zod';

const itemSchema = z.object({
  materialId: z.string().uuid('Chọn vật tư hợp lệ.'),
  condition: z.enum(['good', 'damaged']),
  note: z.string().trim(),
});

const optionalPartyIdSchema = z
  .string()
  .refine(
    (value) => value === '' || z.string().uuid().safeParse(value).success,
    'Chọn đối tượng hợp lệ.',
  );

export const handoverFormSchema = z
  .object({
    type: z.enum(['transfer', 'loan', 'return']),
    senderPartyId: optionalPartyIdSchema,
    recipientPartyId: optionalPartyIdSchema,
    senderPartyKind: z.enum(['eps', 'external', 'other']),
    recipientPartyKind: z.enum(['eps', 'external', 'other']),
    senderPartyCode: z.string().trim(),
    recipientPartyCode: z.string().trim(),
    senderPartyName: z.string().trim(),
    recipientPartyName: z.string().trim(),
    senderPartyPhone: z.string().trim(),
    recipientPartyPhone: z.string().trim(),
    senderPartyEmail: z.string().trim(),
    recipientPartyEmail: z.string().trim(),
    senderRepresentativeName: z.string().trim(),
    recipientRepresentativeName: z.string().trim(),
    senderPartyScopePartyId: optionalPartyIdSchema,
    recipientPartyScopePartyId: optionalPartyIdSchema,
    senderRepresentativeUserId: z.string().uuid().nullable(),
    recipientRepresentativeUserId: z.string().uuid().nullable(),
    plannedDate: z.string().min(1, 'Chọn ngày dự kiến.'),
    dueDate: z.string(),
    note: z.string().trim(),
    items: z.array(itemSchema).min(1, 'Thêm ít nhất một vật tư.'),
    attachmentFileIds: z.array(z.string().uuid()),
    reverseFromHandoverId: z.string().uuid().nullable().optional(),
  })
  .superRefine((values, context) => {
    if (
      values.senderPartyId &&
      values.recipientPartyId &&
      values.senderPartyId === values.recipientPartyId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['recipientPartyId'],
        message: 'Bên giao và bên nhận phải khác nhau.',
      });
    }
    (['sender', 'recipient'] as const).forEach((side) => {
      const kind = values[`${side}PartyKind`];
      const partyId = values[`${side}PartyId`];
      const name = values[`${side}PartyName`];
      if (!name) {
        context.addIssue({
          code: 'custom',
          path: [`${side}PartyName`],
          message: 'Nhập tên đơn vị.',
        });
      }
      if (kind !== 'other' && !partyId) {
        context.addIssue({
          code: 'custom',
          path: [`${side}PartyId`],
          message: side === 'sender' ? 'Chọn bên giao.' : 'Chọn bên nhận.',
        });
      }
      if (kind === 'other' && side === 'sender' && !partyId) {
        context.addIssue({
          code: 'custom',
          path: ['senderPartyId'],
          message: 'Không tìm thấy đối tượng sở hữu vật tư theo tên đã nhập.',
        });
      }
    });
    (['senderPartyEmail', 'recipientPartyEmail'] as const).forEach((field) => {
      const value = values[field];
      if (value && !/^\S+@\S+\.\S+$/.test(value)) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'Nhập email hợp lệ.',
        });
      }
    });
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
    });
  });

export type HandoverFormValues = z.infer<typeof handoverFormSchema>;
