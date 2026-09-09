import { z } from 'zod';

export const accountPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự.')
      .max(128, 'Mật khẩu mới không được vượt quá 128 ký tự.'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu xác nhận không khớp.',
  })
  .refine((values) => values.currentPassword !== values.newPassword, {
    path: ['newPassword'],
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  });

export type AccountPasswordFormValues = z.infer<typeof accountPasswordSchema>;
