/**
 * Scaffolded by form-builder from `src/project/work/forms/work.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState, type KeyboardEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { MultiSelect } from '@/components/ui/multi-select';
import type { MultiSelectOption } from '@/components/ui/multi-select';
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Textarea } from '@/components/ui/textarea';
import { workFormSchema, type WorkFormValues } from '../model/work';
// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
import type { WorkItem } from '../model/work';

export const workDefaultValues: WorkFormValues = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'normal',
  assigneeEmployeeId: '',
  parentId: '',
  templateId: '',
  plannedStartDate: '',
  plannedEndDate: '',
  customerIds: [],
  contractIds: [],
};

type WorkFormSource = WorkItem;

export function useWorkForm(
  options?: Omit<UseFormProps<WorkFormValues>, 'resolver'>,
) {
  return useForm<WorkFormValues>({
    resolver: zodResolver(workFormSchema),
    defaultValues: workDefaultValues,
    ...options,
  });
}

export function mapWorkToFormValues(entity: WorkFormSource): WorkFormValues {
  return {
    title: entity.title,
    description: entity.description,
    status: entity.status,
    priority: entity.priority,
    assigneeEmployeeId: entity.assigneeEmployeeId ?? '',
    parentId: entity.parentId ?? '',
    templateId: entity.templateId ?? '',
    plannedStartDate: entity.plannedStartDate ?? '',
    plannedEndDate: entity.plannedEndDate ?? '',
    customerIds: entity.customers.map((item) => item.id),
    contractIds: entity.contracts.map((item) => item.id),
  };
}

interface WorkFormProps {
  form: UseFormReturn<WorkFormValues>;
  onSubmit: (values: WorkFormValues) => void;
  id?: string;
  statusOptions: SelectOption[];
  priorityOptions: SelectOption[];
  assigneeEmployeeIdOptions: SelectOption[];
  parentIdOptions: SelectOption[];
  templateIdOptions: SelectOption[];
  customerIdsOptions: MultiSelectOption[];
  contractIdsOptions: MultiSelectOption[];
}

export function WorkForm({
  form,
  onSubmit,
  id = 'work-form',
  statusOptions,
  priorityOptions,
  assigneeEmployeeIdOptions,
  parentIdOptions,
  templateIdOptions,
  customerIdsOptions,
  contractIdsOptions,
}: WorkFormProps) {
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>
                  Tên công việc<span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <Input variant="md" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>Mô tả</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Trạng thái</FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={statusOptions}
                    searchable={false}
                    placeholder="Chọn trạng thái"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Mức độ ưu tiên</FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={priorityOptions}
                    searchable={false}
                    placeholder="Chọn mức độ"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="assigneeEmployeeId"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Nhân viên phụ trách</FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={assigneeEmployeeIdOptions}
                    searchable={false}
                    placeholder="Chọn nhân viên"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="parentId"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Thuộc công việc</FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={parentIdOptions}
                    searchable={false}
                    placeholder="Công việc cha (nếu có)"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="templateId"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>Mẫu công việc</FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={templateIdOptions}
                    searchable={false}
                    placeholder="Áp dụng mẫu công việc (nếu có)"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="plannedStartDate"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Ngày bắt đầu dự kiến</FormLabel>
                <FormControl>
                  <DatePickerInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    calendarLabel="Chọn ngày bắt đầu dự kiến"
                    valueMode="iso-date"
                    variant="md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="plannedEndDate"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Ngày hoàn thành dự kiến</FormLabel>
                <FormControl>
                  <DatePickerInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    calendarLabel="Chọn ngày hoàn thành dự kiến"
                    valueMode="iso-date"
                    variant="md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="customerIds"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>Khách hàng liên quan</FormLabel>
                <FormControl>
                  <MultiSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={customerIdsOptions}
                    searchPlaceholder="Tìm khách hàng..."
                    emptyMessage="Không có khách hàng phù hợp"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contractIds"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>Hợp đồng liên quan</FormLabel>
                <FormControl>
                  <MultiSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={contractIdsOptions}
                    searchPlaceholder="Tìm hợp đồng..."
                    emptyMessage="Không có hợp đồng phù hợp"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}

interface WorkFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<WorkFormValues>;
  onSubmit: (values: WorkFormValues) => void;
  isSaving?: boolean;
  title?: string;
  statusOptions: SelectOption[];
  priorityOptions: SelectOption[];
  assigneeEmployeeIdOptions: SelectOption[];
  parentIdOptions: SelectOption[];
  templateIdOptions: SelectOption[];
  customerIdsOptions: MultiSelectOption[];
  contractIdsOptions: MultiSelectOption[];
}

export function WorkFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  statusOptions,
  priorityOptions,
  assigneeEmployeeIdOptions,
  parentIdOptions,
  templateIdOptions,
  customerIdsOptions,
  contractIdsOptions,
}: WorkFormDialogProps) {
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

  const confirmClose = () => {
    setConfirmCloseOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent
          className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0"
          onKeyDown={handleDialogKeyDown}
        >
          <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 text-start">
            <DialogTitle>{title ?? 'Thêm công việc'}</DialogTitle>
            <DialogDescription>
              Giao việc, gắn bối cảnh nghiệp vụ và theo dõi tiến độ thực hiện.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <WorkForm
              form={form}
              onSubmit={onSubmit}
              id="work-form"
              statusOptions={statusOptions}
              priorityOptions={priorityOptions}
              assigneeEmployeeIdOptions={assigneeEmployeeIdOptions}
              parentIdOptions={parentIdOptions}
              templateIdOptions={templateIdOptions}
              customerIdsOptions={customerIdsOptions}
              contractIdsOptions={contractIdsOptions}
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
                form="work-form"
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
        onConfirm={confirmClose}
      />
    </>
  );
}
