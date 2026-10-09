import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { EMPLOYEE_MIN_PASSWORD_LENGTH, type Employee } from '../model/employee';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(
        EMPLOYEE_MIN_PASSWORD_LENGTH,
        `Mật khẩu phải có ít nhất ${EMPLOYEE_MIN_PASSWORD_LENGTH} ký tự.`,
      ),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp.',
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

interface EmployeeResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  isSaving?: boolean;
  onSubmit: (password: string) => void;
}

export function EmployeeResetPasswordDialog({
  open,
  onOpenChange,
  employee,
  isSaving = false,
  onSubmit,
}: EmployeeResetPasswordDialogProps) {
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (open) form.reset({ password: '', confirmPassword: '' });
  }, [form, open, employee?.id]);

  function handleSubmit(values: ResetPasswordValues) {
    onSubmit(values.password);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 text-start">
          <DialogTitle>Đổi mật khẩu tài khoản</DialogTitle>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <Form {...form}>
            <form
              id="employee-reset-password-form"
              className="space-y-4"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mật khẩu mới</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="new-password"
                        placeholder="Nhập mật khẩu mới"
                        type="password"
                        variant="md"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhập lại mật khẩu mới</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="new-password"
                        placeholder="Nhập lại mật khẩu mới"
                        type="password"
                        variant="md"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </DialogBody>
        <DialogFooter className="shrink-0 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form="employee-reset-password-form"
            variant="primary"
            loading={isSaving}
            loadingText="Đang đổi"
          >
            Đổi mật khẩu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
