/**
 * Scaffolded by form-builder from `src/project/customers/forms/customer-debt.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  customerDebtFormSchema,
  type CustomerDebtFormValues,
} from '@/project/customers/model/customer-finance';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { NumericInput } from '@/components/ui/inputs/numeric-input';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Textarea } from '@/components/ui/textarea';

export const customerDebtDefaultValues: CustomerDebtFormValues = {
  code: '',
  description: '',
  documentDate: undefined,
  dueDate: undefined,
  originalAmount: 0,
};

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type CustomerDebtFormSource = unknown;

export function useCustomerDebtForm(
  options?: Omit<UseFormProps<CustomerDebtFormValues>, 'resolver'>,
) {
  return useForm<CustomerDebtFormValues>({
    resolver: zodResolver(customerDebtFormSchema),
    defaultValues: customerDebtDefaultValues,
    ...options,
  });
}

export function mapCustomerDebtToFormValues(
  entity: CustomerDebtFormSource,
): CustomerDebtFormValues {
  // TODO(scaffold): map entity → form values for edit mode.
  void entity;
  return customerDebtDefaultValues;
}

interface CustomerDebtFormProps {
  form: UseFormReturn<CustomerDebtFormValues>;
  onSubmit: (values: CustomerDebtFormValues) => void;
  id?: string;
}

export function CustomerDebtForm({
  form,
  onSubmit,
  id = 'customerDebt-form',
}: CustomerDebtFormProps) {
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Mã công nợ<span className="text-destructive"> *</span>
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
            name="originalAmount"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Số tiền<span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <NumericInput
                    suffix=" ₫"
                    value={field.value}
                    variant="md"
                    onBlur={field.onBlur}
                    onValueChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="documentDate"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Ngày ghi nhận<span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <DatePickerInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    calendarLabel="Chọn ngày ghi nhận"
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
            name="dueDate"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Hạn thanh toán</FormLabel>
                <FormControl>
                  <DatePickerInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    calendarLabel="Chọn hạn thanh toán"
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
            name="description"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>
                  Diễn giải<span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
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

interface CustomerDebtFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<CustomerDebtFormValues>;
  onSubmit: (values: CustomerDebtFormValues) => void;
  isSaving?: boolean;
  title?: ReactNode;
}

export function CustomerDebtFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
}: CustomerDebtFormDialogProps) {
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
            <DialogTitle>{title ?? 'Thêm công nợ'}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <CustomerDebtForm
              form={form}
              onSubmit={onSubmit}
              id="customerDebt-form"
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
                form="customerDebt-form"
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
