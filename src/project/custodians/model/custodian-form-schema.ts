import { z } from 'zod';

export const custodianFormSchema = z.object({
  sourceKey: z.string().min(1, 'Chọn dữ liệu từ danh mục EPS giả lập.'),
  representativeUserId: z.string(),
});

export type CustodianFormValues = z.infer<typeof custodianFormSchema>;
