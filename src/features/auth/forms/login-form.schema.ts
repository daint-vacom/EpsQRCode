import { z } from 'zod';

export const loginFormSchema = z.object({
  email: z.string().trim().email('Vui lòng nhập email hợp lệ.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
