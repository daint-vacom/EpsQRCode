import { z } from 'zod';

export const custodianFormSchema = z.object({
  type: z.enum(['department', 'team', 'person', 'external']),
  code: z.string().trim().min(1, 'Nhập mã chủ thể.'),
  name: z.string().trim().min(1, 'Nhập tên chủ thể.'),
  parentId: z.string(),
  accountUserId: z.string(),
  representativeUserId: z.string(),
  isActive: z.boolean(),
});

export type CustodianFormValues = z.infer<typeof custodianFormSchema>;
