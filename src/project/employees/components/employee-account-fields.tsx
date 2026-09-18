import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import type { EmployeeFormValues } from '../model/employee';

interface EmployeeAccountFieldsProps {
  form: UseFormReturn<EmployeeFormValues>;
  mode: 'create' | 'edit';
  employeeHasLinkedAccount: boolean;
  canManageAccount: boolean;
}

export function EmployeeAccountFields({
  form,
  mode,
  employeeHasLinkedAccount,
  canManageAccount,
}: EmployeeAccountFieldsProps) {
  const createAccount = useWatch({
    control: form.control,
    name: 'createAccount',
  });
  const accountRequested =
    mode === 'create' || employeeHasLinkedAccount || createAccount;

  return (
    <div className="md:col-span-2">
      {mode === 'edit' && !employeeHasLinkedAccount ? (
        <FormField
          control={form.control}
          name="createAccount"
          render={({ field }) => (
            <FormItem className="mb-3">
              <div className="flex items-center gap-2">
                <FormControl>
                  <Checkbox
                    aria-label="Tạo tài khoản đăng nhập cho nhân viên"
                    checked={field.value}
                    disabled={!canManageAccount}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                  />
                </FormControl>
                <FormLabel>Tạo tài khoản đăng nhập</FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      {accountRequested ? (
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="accountUsername"
            render={({ field: usernameField }) => (
              <FormItem>
                <FormLabel>Tên đăng nhập</FormLabel>
                <FormControl>
                  <Input
                    {...usernameField}
                    autoComplete="username"
                    disabled={!canManageAccount}
                    placeholder="vd: nguyenvana"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {mode === 'create' || !employeeHasLinkedAccount ? (
            <FormField
              control={form.control}
              name="initialPassword"
              render={({ field: passwordField }) => (
                <FormItem>
                  <FormLabel>Mật khẩu ban đầu</FormLabel>
                  <FormControl>
                    <PasswordInput
                      {...passwordField}
                      autoComplete="new-password"
                      disabled={!canManageAccount}
                      placeholder="Nhập mật khẩu ban đầu"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
        </div>
      ) : null}

      {!canManageAccount ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Bạn không có quyền quản lý tài khoản nhân viên.
        </p>
      ) : null}
    </div>
  );
}
