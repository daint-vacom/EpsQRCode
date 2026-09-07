/**
 * Scaffolded by form-builder from `src/project/employees/forms/employee.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState, type KeyboardEvent } from 'react';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, RefreshCw } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import type {
  ControllerRenderProps,
  UseFormProps,
  UseFormReturn,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getAvatarInitials } from '@/components/common/avatar-identity';
import { IDENTITY_AVATAR_TONES } from '@/components/common/gradient-avatar';
import {
  employeeFormSchema,
  type Employee,
  type EmployeeFormValues,
} from '../model/employee';

const statusOptions = [
  { value: 'active', label: 'Đang làm việc' },
  { value: 'inactive', label: 'Ngừng làm việc' },
];

export const employeeDefaultValues: EmployeeFormValues = {
  imageUrl: '',
  employeeCode: '',
  firstName: '',
  lastName: '',
  jobTitle: '',
  department: '',
  phone: '',
  status: 'active',
  joinedAt: null,
  note: '',
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
    jobTitle: employee.jobTitle,
    department: employee.department,
    phone: employee.phone,
    status: employee.status,
    joinedAt: employee.joinedAt
      ? new Date(`${employee.joinedAt}T00:00:00`)
      : null,
    note: employee.note,
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
}: EmployeeFormProps) {
  const activeCustomFields = customFields.filter((field) => field.isActive);

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
                  {mode === 'edit' ? (
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
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
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}

                  <EmployeeTextField
                    form={form}
                    name="jobTitle"
                    label="Chức vụ"
                  />
                  <EmployeeTextField
                    form={form}
                    name="department"
                    label="Phòng ban"
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
  name:
    | 'employeeCode'
    | 'firstName'
    | 'lastName'
    | 'jobTitle'
    | 'department'
    | 'phone';
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
}: EmployeeFormDialogProps) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isSaving || !(event.ctrlKey || event.metaKey)) return;

    const key = event.key.toLowerCase();
    if (key !== 's' && key !== 'enter') return;

    event.preventDefault();
    void form.handleSubmit(onSubmit)();
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

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:overflow-hidden">
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
            />
          </div>

          <DialogFooter className="shrink-0 px-6 py-4">
            <ShortcutTooltip label="Hủy" shortcut="Esc">
              <Button
                type="button"
                variant="outline"
                onClick={() => requestClose(false)}
                disabled={isSaving}
              >
                Hủy
              </Button>
            </ShortcutTooltip>
            <ShortcutTooltip label="Lưu" shortcut="Ctrl/Cmd + S">
              <Button
                type="submit"
                variant="primary"
                form="employee-form"
                loading={isSaving}
                loadingText="Đang lưu..."
              >
                Lưu
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
