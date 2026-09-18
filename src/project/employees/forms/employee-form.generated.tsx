/**
 * Scaffolded by form-builder from `src/project/employees/forms/employee.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useEffect, useState, type KeyboardEvent } from 'react';
import type { CustomerTableController } from '@/project/customers/components/customer-table';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import type {
  ControllerRenderProps,
  UseFormProps,
  UseFormReturn,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
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
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  Stepper,
  StepperConnector,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getAvatarInitials } from '@/components/common/avatar-identity';
import { IDENTITY_AVATAR_TONES } from '@/components/common/gradient-avatar';
import { EmployeeAccountFields } from '../components/employee-account-fields';
import { EmployeeStatusBadge } from '../components/employee-badges';
import {
  EmployeeCustomerRoleStep,
  EmployeeCustomerSelectionStep,
} from '../components/employee-responsibility-editor';
import {
  EMPLOYEE_MIN_PASSWORD_LENGTH,
  employeeFormSchema,
  type Employee,
  type EmployeeFormValues,
  type EmployeeRoleOption,
  type EmployeeStatus,
} from '../model/employee';
import type {
  EmployeeCustomerAssignmentInput,
  EmployeeCustomerOption,
} from '../model/employee-responsibility';

const statusOptions = [
  { value: 'active', label: 'Còn làm việc' },
  { value: 'inactive', label: 'Ngừng làm việc' },
] satisfies { value: EmployeeStatus; label: string }[];

export const employeeDefaultValues: EmployeeFormValues = {
  imageUrl: '',
  employeeCode: '',
  firstName: '',
  lastName: '',
  phone: '',
  status: 'active',
  joinedAt: null,
  note: '',
  roleIds: [],
  createAccount: false,
  accountUsername: '',
  initialPassword: '',
  customFields: {},
};

export function useEmployeeForm(
  options?: Omit<UseFormProps<EmployeeFormValues>, 'resolver'>,
) {
  return useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: employeeDefaultValues,
    ...options,
  });
}

export function mapEmployeeToFormValues(
  employee: Employee,
): EmployeeFormValues {
  return {
    imageUrl: employee.avatarUrl ?? '',
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    phone: employee.phone,
    status: employee.status,
    joinedAt: employee.joinedAt
      ? new Date(`${employee.joinedAt}T00:00:00`)
      : null,
    note: employee.note,
    roleIds: [...employee.roleIds],
    createAccount: Boolean(employee.userId),
    accountUsername: employee.username ?? '',
    initialPassword: '',
    customFields: {},
  };
}

interface EmployeeFormProps {
  form: UseFormReturn<EmployeeFormValues>;
  onSubmit: (values: EmployeeFormValues) => void;
  id?: string;
  mode: 'create' | 'edit';
  onImageUrlFileChange?: (file: File | null) => void;
  customFields?: CustomField[];
  onAddCustomField?: () => void;
  onReloadCustomFields?: () => void;
  isReloadingCustomFields?: boolean;
  roleOptions?: EmployeeRoleOption[];
  canManageRoles?: boolean;
  canManageAccount?: boolean;
  employeeHasLinkedAccount?: boolean;
}

export function EmployeeForm({
  form,
  onSubmit,
  id = 'employee-form',
  mode,
  onImageUrlFileChange,
  customFields = [],
  onAddCustomField,
  onReloadCustomFields,
  isReloadingCustomFields = false,
  roleOptions = [],
  canManageRoles = false,
  canManageAccount = false,
  employeeHasLinkedAccount = false,
}: EmployeeFormProps) {
  const activeCustomFields = customFields.filter((field) => field.isActive);
  const accountRequested = useWatch({
    control: form.control,
    name: 'createAccount',
  });
  const canUseEmployeeAccount = employeeHasLinkedAccount || accountRequested;

  return (
    <Form {...form}>
      <form
        id={id}
        className="min-h-0 lg:h-full"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="grid min-h-0 grid-cols-1 gap-6 lg:h-full lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)]">
          <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:ps-1 lg:pe-1">
            <div className="space-y-5">
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <EmployeeAvatarUploadField
                        form={form}
                        field={field}
                        onFileChange={onImageUrlFileChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <EmployeeTextField
                form={form}
                name="employeeCode"
                label="Mã nhân viên"
                required
              />
              <EmployeeTextField
                form={form}
                name="firstName"
                label="Tên"
                required
              />
              <EmployeeTextField
                form={form}
                name="lastName"
                label="Họ và tên đệm"
              />
              <EmployeeTextField
                form={form}
                name="phone"
                label="Số điện thoại"
                inputType="tel"
              />
            </div>
          </div>

          <div className="min-w-0 lg:min-h-0">
            <Tabs
              defaultValue="general"
              className="flex min-h-0 flex-col lg:h-full"
            >
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="general">Thông tin chung</TabsTrigger>
                <TabsTrigger value="custom">Thông tin bổ sung</TabsTrigger>
              </TabsList>

              <TabsContent
                value="general"
                className="mt-5 min-h-0 lg:flex-1 lg:overflow-y-auto lg:pe-1"
              >
                <div className="grid grid-cols-1 gap-x-4 gap-y-5 px-1 pb-1 md:grid-cols-2">
                  <EmployeeAccountFields
                    form={form}
                    mode={mode}
                    employeeHasLinkedAccount={employeeHasLinkedAccount}
                    canManageAccount={canManageAccount}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trạng thái</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                <EmployeeStatusBadge status={option.value} />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="joinedAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ngày vào làm</FormLabel>
                        <FormControl>
                          <DatePickerInput
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            calendarLabel="Chọn ngày vào làm"
                            valueMode="date"
                            variant="md"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Ghi chú</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roleIds"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Vai trò</FormLabel>
                        {!canUseEmployeeAccount ? (
                          <p className="text-xs text-muted-foreground">
                            Liên kết tài khoản cho nhân viên để cấp vai trò.
                          </p>
                        ) : roleOptions.length > 0 ? (
                          <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
                            {roleOptions.map((role) => (
                              <label
                                key={role.id}
                                className="flex items-start gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/60"
                              >
                                <Checkbox
                                  checked={field.value.includes(role.id)}
                                  disabled={!canManageRoles || !role.isActive}
                                  onCheckedChange={(checked) => {
                                    const nextRoleIds = new Set(field.value);
                                    if (checked === true)
                                      nextRoleIds.add(role.id);
                                    else nextRoleIds.delete(role.id);
                                    field.onChange([...nextRoleIds]);
                                  }}
                                  className="mt-0.5"
                                />
                                <span className="flex min-w-0 items-center gap-1">
                                  <span className="min-w-0 truncate font-medium text-foreground">
                                    {role.name}
                                  </span>
                                  {role.customerAssignable ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          aria-label="Phân theo khách hàng"
                                          className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                                          tabIndex={0}
                                        >
                                          <UsersRound className="size-3.5" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent variant="light">
                                        Phân theo khách hàng
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : null}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                            Chưa có vai trò khả dụng.
                          </p>
                        )}
                        {!canManageRoles && canUseEmployeeAccount ? (
                          <p className="text-xs text-muted-foreground">
                            Bạn không có quyền thay đổi vai trò nhân viên.
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent
                value="custom"
                className="mt-5 min-h-0 lg:flex-1 lg:overflow-y-auto lg:pe-1"
              >
                <div className="space-y-5 px-1 pb-1">
                  {activeCustomFields.length > 0 ? (
                    <div className="space-y-5">
                      {activeCustomFields.map((customField) => (
                        <EmployeeCustomFieldInput
                          key={customField.id}
                          form={form}
                          customField={customField}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Chưa có trường bổ sung cho nhân viên.
                      </p>
                      {onAddCustomField || onReloadCustomFields ? (
                        <div className="flex items-center gap-2">
                          {onAddCustomField ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={onAddCustomField}
                            >
                              <Plus />
                              Thêm trường
                            </Button>
                          ) : null}
                          {onReloadCustomFields ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={onReloadCustomFields}
                              disabled={isReloadingCustomFields}
                            >
                              <RefreshCw
                                className={
                                  isReloadingCustomFields ? 'animate-spin' : ''
                                }
                              />
                              Tải lại
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </form>
    </Form>
  );
}

function EmployeeAvatarUploadField({
  form,
  field,
  onFileChange,
}: {
  form: UseFormReturn<EmployeeFormValues>;
  field: ControllerRenderProps<EmployeeFormValues, 'imageUrl'>;
  onFileChange?: (file: File | null) => void;
}) {
  const [lastName, firstName] = useWatch({
    control: form.control,
    name: ['lastName', 'firstName'],
  });
  const employeeName = [lastName, firstName].filter(Boolean).join(' ');

  return (
    <ImageUploadField
      value={field.value}
      onValueChange={field.onChange}
      onFileChange={onFileChange}
      accept="image/png,image/jpeg,image/webp"
      maxSizeMb={5}
      label="Ảnh nhân viên"
      fallbackText={getAvatarInitials(employeeName) || 'NV'}
      fallbackTone={IDENTITY_AVATAR_TONES.employee}
    />
  );
}

function EmployeeTextField({
  form,
  name,
  label,
  inputType = 'text',
  required = false,
}: {
  form: UseFormReturn<EmployeeFormValues>;
  name: 'employeeCode' | 'firstName' | 'lastName' | 'phone';
  label: string;
  inputType?: string;
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
            <Input type={inputType} variant="md" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

type EmployeeCustomFieldName = `customFields.${string}`;

function EmployeeCustomFieldInput({
  form,
  customField,
}: {
  form: UseFormReturn<EmployeeFormValues>;
  customField: CustomField;
}) {
  const fieldName =
    `customFields.${customField.key}` as EmployeeCustomFieldName;

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
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue
                    placeholder={`Chọn ${customField.label.toLowerCase()}`}
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {customField.options
                  .filter((option) => option.isActive)
                  .map((option) => (
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
                variant="md"
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

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<EmployeeFormValues>;
  onSubmit: (values: EmployeeFormValues) => void;
  isSaving?: boolean;
  title?: string;
  onImageUrlFileChange?: (file: File | null) => void;
  customFields?: CustomField[];
  onAddCustomField?: () => void;
  onReloadCustomFields?: () => void;
  isReloadingCustomFields?: boolean;
  roleOptions?: EmployeeRoleOption[];
  customerOptions?: EmployeeCustomerOption[];
  customerTable?: CustomerTableController;
  customerAssignments?: EmployeeCustomerAssignmentInput[];
  onCustomerAssignmentsChange?: (
    assignments: EmployeeCustomerAssignmentInput[],
  ) => void;
  canManageRoles?: boolean;
  canManageAccount?: boolean;
  canManageCustomerAssignments?: boolean;
  employeeHasLinkedAccount?: boolean;
  accessIsLoading?: boolean;
  accessError?: unknown;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  onImageUrlFileChange,
  customFields = [],
  onAddCustomField,
  onReloadCustomFields,
  isReloadingCustomFields = false,
  roleOptions = [],
  customerOptions = [],
  customerTable,
  customerAssignments = [],
  onCustomerAssignmentsChange = () => undefined,
  canManageRoles = false,
  canManageAccount = false,
  canManageCustomerAssignments = false,
  employeeHasLinkedAccount = false,
  accessIsLoading = false,
  accessError,
}: EmployeeFormDialogProps) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const employeeRoleIds = useWatch({
    control: form.control,
    name: 'roleIds',
  });
  const accountRequested = useWatch({
    control: form.control,
    name: 'createAccount',
  });
  const canUseEmployeeAccount = employeeHasLinkedAccount || accountRequested;

  useEffect(() => {
    if (open) {
      setStep(1);
      setMaxStep(1);
    }
  }, [open]);

  async function handleNext() {
    if (step === 1) {
      const isValid = await form.trigger();
      const accountIsValid = await validateAccountFields();
      if (!isValid || !accountIsValid) return;
    }
    const nextStep = Math.min(step + 1, 3);
    setStep(nextStep);
    setMaxStep((currentMaxStep) => Math.max(currentMaxStep, nextStep));
  }

  async function validateAccountFields() {
    const values = form.getValues();
    if (!values.createAccount) return true;

    let isValid = true;
    if (!values.accountUsername.trim()) {
      form.setError('accountUsername', {
        type: 'required',
        message: 'Vui lòng nhập tên đăng nhập.',
      });
      isValid = false;
    }

    const requiresPassword = mode === 'create' || !employeeHasLinkedAccount;
    if (
      requiresPassword &&
      values.initialPassword.length < EMPLOYEE_MIN_PASSWORD_LENGTH
    ) {
      form.setError('initialPassword', {
        type: 'required',
        message: `Mật khẩu phải có ít nhất ${EMPLOYEE_MIN_PASSWORD_LENGTH} ký tự.`,
      });
      isValid = false;
    }

    const fieldsAreValid = await form.trigger([
      'accountUsername',
      'initialPassword',
    ]);
    return isValid && fieldsAreValid;
  }

  async function handlePrimaryAction() {
    if (step < 3) {
      void handleNext();
      return;
    }

    if (!(await validateAccountFields())) return;
    void form.handleSubmit(onSubmit)();
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isSaving || !(event.ctrlKey || event.metaKey)) return;

    const key = event.key.toLowerCase();
    if (key !== 's' && key !== 'enter') return;

    event.preventDefault();
    handlePrimaryAction();
  };
  const requestClose = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (mode === 'edit') {
      setConfirmCloseOpen(true);
      return;
    }

    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent
          size="large"
          className="flex h-[min(90dvh,760px)] flex-col gap-0 overflow-hidden p-0"
          onKeyDown={handleDialogKeyDown}
        >
          <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 text-start">
            <DialogTitle>{title ?? 'Thêm nhân viên'}</DialogTitle>
          </DialogHeader>

          <Stepper
            value={step}
            onValueChange={(nextStep) => {
              if (nextStep <= maxStep) setStep(nextStep);
            }}
            variant="success"
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <StepperNav className="shrink-0 gap-2 border-b border-border px-6 py-4">
              {[
                { value: 1, label: 'Thông tin nhân viên, vai trò' },
                { value: 2, label: 'Chọn khách hàng phụ trách' },
                { value: 3, label: 'Phân công vai trò phụ trách' },
              ].map((item, index, items) => (
                <div
                  key={item.value}
                  className="flex min-w-0 flex-1 items-center last:flex-none"
                >
                  <StepperItem
                    step={item.value}
                    completed={item.value < step}
                    disabled={item.value > maxStep}
                    fill={false}
                    className="min-w-0 justify-start"
                  >
                    <StepperTrigger className="min-w-0 px-1 text-left">
                      <StepperIndicator>
                        {item.value < step ? (
                          <Check className="size-3.5" />
                        ) : (
                          item.value
                        )}
                      </StepperIndicator>
                      <StepperTitle className="hidden truncate sm:block">
                        {item.label}
                      </StepperTitle>
                    </StepperTrigger>
                  </StepperItem>
                  {index < items.length - 1 ? (
                    <StepperConnector
                      completed={item.value < step}
                      className="mx-2 h-0.5 min-w-4"
                    />
                  ) : null}
                </div>
              ))}
            </StepperNav>

            <StepperPanel className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <StepperContent value={1} className="min-h-full">
                <EmployeeForm
                  form={form}
                  onSubmit={onSubmit}
                  id="employee-form"
                  mode={mode}
                  onImageUrlFileChange={onImageUrlFileChange}
                  customFields={customFields}
                  onAddCustomField={onAddCustomField}
                  onReloadCustomFields={onReloadCustomFields}
                  isReloadingCustomFields={isReloadingCustomFields}
                  roleOptions={roleOptions}
                  canManageRoles={canManageRoles}
                  canManageAccount={canManageAccount}
                  employeeHasLinkedAccount={employeeHasLinkedAccount}
                />
              </StepperContent>
              <StepperContent
                value={2}
                className="flex h-full min-h-0 flex-col overflow-hidden"
              >
                <EmployeeCustomerSelectionStep
                  roleOptions={roleOptions}
                  employeeRoleIds={employeeRoleIds ?? []}
                  customers={customerOptions}
                  customerTable={customerTable}
                  assignments={customerAssignments}
                  onAssignmentsChange={onCustomerAssignmentsChange}
                  canManage={canManageCustomerAssignments}
                  employeeHasLinkedAccount={canUseEmployeeAccount}
                  isLoading={accessIsLoading}
                  error={accessError}
                />
              </StepperContent>
              <StepperContent value={3} className="flex min-h-full flex-col">
                <EmployeeCustomerRoleStep
                  roleOptions={roleOptions}
                  employeeRoleIds={employeeRoleIds ?? []}
                  customers={customerOptions}
                  customerTable={customerTable}
                  assignments={customerAssignments}
                  onAssignmentsChange={onCustomerAssignmentsChange}
                  canManage={canManageCustomerAssignments}
                  employeeHasLinkedAccount={canUseEmployeeAccount}
                  isLoading={accessIsLoading}
                  error={accessError}
                />
              </StepperContent>
            </StepperPanel>
          </Stepper>

          <DialogFooter className="shrink-0 px-6 py-4">
            <ShortcutTooltip label="Hủy" shortcut="Esc">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (step > 1) setStep((currentStep) => currentStep - 1);
                  else requestClose(false);
                }}
                disabled={isSaving}
              >
                {step > 1 ? <ArrowLeft /> : null}
                {step > 1 ? 'Quay lại' : 'Hủy'}
              </Button>
            </ShortcutTooltip>
            <ShortcutTooltip
              label={step === 3 ? 'Lưu' : 'Tiếp tục'}
              shortcut="Ctrl/Cmd + S"
            >
              <Button
                type="button"
                variant="primary"
                onClick={handlePrimaryAction}
                loading={isSaving}
                loadingText="Đang lưu..."
                disabled={
                  isSaving ||
                  (step === 3 &&
                    customerAssignments.some(
                      (assignment) =>
                        !assignment.allRoles &&
                        assignment.responsibilityRoleIds.length === 0,
                    ))
                }
              >
                {step === 3 ? <Check /> : <ArrowRight />}
                {step === 3 ? 'Lưu' : 'Tiếp tục'}
              </Button>
            </ShortcutTooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        title="Đóng chỉnh sửa?"
        description="Bạn có thay đổi chưa lưu. Nếu đóng, các thay đổi hiện tại sẽ bị mất."
        confirmLabel="Đóng"
        confirmVariant="destructive"
        onConfirm={() => {
          setConfirmCloseOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
