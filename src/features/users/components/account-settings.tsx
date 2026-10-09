import { useEffect, useState } from 'react';
import { changeSupabasePassword } from '@/features/auth/api/auth.api';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import {
  loadEmployeeCustomFields,
  loadEmployeeCustomFieldValues,
  saveEmployeeCustomFieldValues,
  updateCurrentEmployeeProfile,
  uploadEmployeeAvatar,
} from '@/project/employees/api/employees.api';
import { EmployeeStatusBadge } from '@/project/employees/components/employee-badges';
import { useCurrentEmployeeProfile } from '@/project/employees/hooks/use-current-employee-profile';
import {
  employeeFormSchema,
  emptyEmployeeForm,
  mapEmployeeToFormValues,
  type EmployeeFormValues,
} from '@/project/employees/model/employee';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { KeyRound, LockKeyhole, Save, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { Label } from '@/components/ui/label';
import { CardLoading } from '@/components/ui/loading';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getAvatarInitials } from '@/components/common/avatar-identity';
import { IDENTITY_AVATAR_TONES } from '@/components/common/gradient-avatar';
import {
  accountPasswordSchema,
  type AccountPasswordFormValues,
} from '../model/account-password';

const employeeFormId = 'account-employee-form';
const passwordFormId = 'account-password-form';

export function AccountSettings() {
  const { tenantId } = useTenant();
  const { user, userId, hasPermission } = useUser();
  const queryClient = useQueryClient();
  const employeeQuery = useCurrentEmployeeProfile();
  const [employeeImageFile, setEmployeeImageFile] = useState<File | null>(null);
  const employeeForm = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: emptyEmployeeForm,
  });
  const passwordForm = useForm<AccountPasswordFormValues>({
    resolver: zodResolver(accountPasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const employeeId = employeeQuery.data?.id ?? null;
  const customFieldsQuery = useQuery({
    queryKey: ['project', 'employees', 'custom-fields', tenantId],
    queryFn: () => loadEmployeeCustomFields(tenantId!),
    enabled: Boolean(tenantId),
    staleTime: 60 * 1000,
  });
  const customValuesQuery = useQuery({
    queryKey: ['project', 'employees', 'custom-values', tenantId, employeeId],
    queryFn: () => loadEmployeeCustomFieldValues(tenantId!, employeeId!),
    enabled: Boolean(tenantId && employeeId),
  });

  const canManageEmployee = hasPermission('organization:employee:update');
  const activeCustomFields = (customFieldsQuery.data ?? []).filter(
    (field) => field.isActive,
  );

  useEffect(() => {
    const employee = employeeQuery.data;
    if (!employee) return;

    employeeForm.reset({
      ...mapEmployeeToFormValues(employee),
      customFields: customValuesQuery.data ?? {},
    });
    setEmployeeImageFile(null);
  }, [customValuesQuery.data, employeeForm, employeeQuery.data]);

  const employeeMutation = useMutation({
    mutationFn: async (values: EmployeeFormValues) => {
      if (!tenantId || !employeeQuery.data) {
        throw new Error('Chưa tải được hồ sơ nhân viên hiện tại.');
      }

      const avatarUrl = employeeImageFile
        ? await uploadEmployeeAvatar(
            tenantId,
            employeeQuery.data.id,
            employeeImageFile,
          )
        : employeeQuery.data.avatarUrl;

      const savedEmployee = await updateCurrentEmployeeProfile(
        tenantId,
        employeeQuery.data.id,
        {
          employeeCode: values.employeeCode,
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone,
          status: values.status,
          joinedAt: values.joinedAt
            ? format(values.joinedAt, 'yyyy-MM-dd')
            : null,
          note: values.note,
          avatarUrl,
        },
      );

      if (canManageEmployee && activeCustomFields.length > 0) {
        await saveEmployeeCustomFieldValues(
          tenantId,
          employeeQuery.data.id,
          values.customFields,
        );
      }

      return savedEmployee;
    },
    onSuccess: async (employee) => {
      employeeForm.reset({
        ...mapEmployeeToFormValues(employee),
        customFields: employeeForm.getValues('customFields'),
      });
      setEmployeeImageFile(null);
      await queryClient.invalidateQueries({
        queryKey: ['project', 'current-employee-profile', tenantId, userId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['project', 'employees'],
      });
      toast.success('Đã cập nhật thông tin nhân viên.');
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, {
          fallbackMessage: 'Không thể cập nhật thông tin nhân viên.',
        }),
      );
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (values: AccountPasswordFormValues) => {
      if (!user?.email) throw new Error('Tài khoản chưa có email đăng nhập.');

      await changeSupabasePassword(
        user.email,
        values.currentPassword,
        values.newPassword,
      );
    },
    onSuccess: () => {
      passwordForm.reset();
      toast.success('Đã đổi mật khẩu.');
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, {
          fallbackMessage: 'Không thể đổi mật khẩu.',
        }),
      );
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-5">
          <CardHeading>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" />
              Thông tin nhân viên
            </CardTitle>
          </CardHeading>
        </CardHeader>
        <CardContent className="p-5">
          {employeeQuery.isPending ? (
            <CardLoading label="Đang tải thông tin nhân viên..." />
          ) : employeeQuery.isError ? (
            <p className="text-sm text-destructive">
              Không thể tải thông tin nhân viên.
            </p>
          ) : !employeeQuery.data ? (
            <p className="text-sm text-muted-foreground">
              Tài khoản chưa được liên kết với hồ sơ nhân viên trong tổ chức
              hiện tại.
            </p>
          ) : (
            <Form {...employeeForm}>
              <form
                id={employeeFormId}
                onSubmit={employeeForm.handleSubmit((values) =>
                  employeeMutation.mutate(values),
                )}
                className="space-y-5"
              >
                <ImageUploadField
                  value={employeeForm.watch('imageUrl')}
                  onValueChange={(value) =>
                    employeeForm.setValue('imageUrl', value, {
                      shouldDirty: true,
                    })
                  }
                  onFileChange={setEmployeeImageFile}
                  label="Ảnh nhân viên"
                  fallbackText={getAvatarInitials(
                    [
                      employeeForm.watch('lastName'),
                      employeeForm.watch('firstName'),
                    ]
                      .filter(Boolean)
                      .join(' '),
                  )}
                  fallbackTone={IDENTITY_AVATAR_TONES.employee}
                />

                <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                  <EmployeeTextField
                    form={employeeForm}
                    name="employeeCode"
                    label="Mã nhân viên"
                    readOnly={!canManageEmployee}
                    required
                  />
                  <EmployeeTextField
                    form={employeeForm}
                    name="phone"
                    label="Số điện thoại"
                    inputType="tel"
                  />
                  <EmployeeTextField
                    form={employeeForm}
                    name="firstName"
                    label="Tên"
                    required
                  />
                  <EmployeeTextField
                    form={employeeForm}
                    name="lastName"
                    label="Họ và tên đệm"
                  />
                  <FormField
                    control={employeeForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trạng thái</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!canManageEmployee}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">
                              <EmployeeStatusBadge status="active" />
                            </SelectItem>
                            <SelectItem value="inactive">
                              <EmployeeStatusBadge status="inactive" />
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={employeeForm.control}
                    name="joinedAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ngày vào làm</FormLabel>
                        <FormControl>
                          {canManageEmployee ? (
                            <DatePickerInput
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              calendarLabel="Chọn ngày vào làm"
                              valueMode="date"
                              variant="md"
                            />
                          ) : (
                            <Input
                              readOnly
                              value={formatEmployeeDate(field.value)}
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={employeeForm.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Ghi chú</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            readOnly={!canManageEmployee}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {activeCustomFields.length > 0 ? (
                  <div className="space-y-3 border-t border-border pt-5">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Thông tin bổ sung
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Các trường bổ sung được cấu hình cho hồ sơ nhân viên.
                      </p>
                    </div>
                    <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                      {activeCustomFields.map((field) => (
                        <EmployeeCustomFieldInput
                          key={field.id}
                          form={employeeForm}
                          customField={field}
                          readOnly={!canManageEmployee}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={
                      !employeeForm.formState.isDirty && !employeeImageFile
                    }
                    loading={employeeMutation.isPending}
                    loadingText="Đang lưu"
                  >
                    <Save />
                    Lưu thông tin nhân viên
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5">
          <CardHeading>
            <CardTitle className="flex items-center gap-2 text-base">
              <LockKeyhole className="size-4 text-primary" />
              Thông tin tài khoản
            </CardTitle>
          </CardHeading>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="space-y-2">
            <Label htmlFor="account-email">Email đăng nhập</Label>
            <Input id="account-email" value={user?.email ?? ''} readOnly />
            <p className="text-xs text-muted-foreground">
              Email dùng để đăng nhập và xác thực tài khoản.
            </p>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="size-4 text-muted-foreground" />
              Đổi mật khẩu
            </h3>
            <Form {...passwordForm}>
              <form
                id={passwordFormId}
                onSubmit={passwordForm.handleSubmit((values) =>
                  passwordMutation.mutate(values),
                )}
                className="mt-4 space-y-5"
              >
                <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                  <PasswordField
                    form={passwordForm}
                    name="currentPassword"
                    label="Mật khẩu hiện tại"
                    autoComplete="current-password"
                    className="md:col-span-2"
                  />
                  <PasswordField
                    form={passwordForm}
                    name="newPassword"
                    label="Mật khẩu mới"
                    autoComplete="new-password"
                  />
                  <PasswordField
                    form={passwordForm}
                    name="confirmPassword"
                    label="Xác nhận mật khẩu mới"
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Bạn sẽ cần nhập mật khẩu hiện tại để xác nhận thay đổi.
                  </p>
                  <Button
                    type="submit"
                    variant="primary"
                    className="shrink-0"
                    loading={passwordMutation.isPending}
                    loadingText="Đang đổi"
                  >
                    Đổi mật khẩu
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeTextField({
  form,
  name,
  label,
  inputType = 'text',
  readOnly = false,
  required = false,
}: {
  form: ReturnType<typeof useForm<EmployeeFormValues>>;
  name: 'employeeCode' | 'firstName' | 'lastName' | 'phone';
  label: string;
  inputType?: string;
  readOnly?: boolean;
  required?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required ? <span className="text-destructive"> *</span> : null}
          </FormLabel>
          <FormControl>
            <Input type={inputType} readOnly={readOnly} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function EmployeeCustomFieldInput({
  form,
  customField,
  readOnly,
}: {
  form: ReturnType<typeof useForm<EmployeeFormValues>>;
  customField: CustomField;
  readOnly: boolean;
}) {
  const fieldName =
    `customFields.${customField.key}` as `customFields.${string}`;

  return (
    <FormField
      control={form.control}
      name={fieldName as never}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {customField.label}
            {customField.isRequired ? (
              <span className="text-destructive"> *</span>
            ) : null}
          </FormLabel>
          {customField.fieldType === 'select' ? (
            <Select
              value={(field.value as string) || undefined}
              onValueChange={field.onChange}
              disabled={readOnly}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue
                    placeholder={`Chọn ${customField.label.toLowerCase()}`}
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {customField.options.map((option) => (
                  <SelectItem key={option.id} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <FormControl>
              <Input
                type={customField.fieldType === 'number' ? 'number' : 'text'}
                readOnly={readOnly}
                {...field}
              />
            </FormControl>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PasswordField({
  form,
  name,
  label,
  autoComplete,
  className,
}: {
  form: ReturnType<typeof useForm<AccountPasswordFormValues>>;
  name: keyof AccountPasswordFormValues;
  label: string;
  autoComplete: string;
  className?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            <span className="text-destructive"> *</span>
          </FormLabel>
          <FormControl>
            <Input
              type="password"
              autoComplete={autoComplete}
              placeholder={label}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function formatEmployeeDate(value: Date | null): string {
  return value ? value.toLocaleDateString('vi-VN') : '';
}
