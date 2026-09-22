/**
 * Scaffolded by form-builder from `src/project/finance/forms/finance-voucher.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState, type KeyboardEvent } from 'react';
import {
  financeVoucherDefaultValues as domainFinanceVoucherDefaultValues,
  financeVoucherFormSchema,
  mapFinanceVoucherToFormValues as mapDomainFinanceVoucherToFormValues,
  type FinanceVoucherFormValues,
} from '@/project/finance/model/finance';
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
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Textarea } from '@/components/ui/textarea';

const voucherTypeOptions = [
  { value: 'receipt', label: 'Phiếu thu' },
  { value: 'payment', label: 'Phiếu chi' },
];

const partyTypeOptions = [
  { value: 'customer', label: 'Khách hàng' },
  { value: 'employee', label: 'Nhân viên' },
  { value: 'other', label: 'Vãng lai' },
];

export const financeVoucherDefaultValues: FinanceVoucherFormValues =
  domainFinanceVoucherDefaultValues;

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type FinanceVoucherFormSource = Parameters<
  typeof mapDomainFinanceVoucherToFormValues
>[0];

export function useFinanceVoucherForm(
  options?: Omit<UseFormProps<FinanceVoucherFormValues>, 'resolver'>,
) {
  return useForm<FinanceVoucherFormValues>({
    resolver: zodResolver(financeVoucherFormSchema),
    defaultValues: financeVoucherDefaultValues,
    ...options,
  });
}

export function mapFinanceVoucherToFormValues(
  entity: FinanceVoucherFormSource,
): FinanceVoucherFormValues {
  return mapDomainFinanceVoucherToFormValues(entity);
}

interface FinanceVoucherFormProps {
  form: UseFormReturn<FinanceVoucherFormValues>;
  onSubmit: (values: FinanceVoucherFormValues) => void;
  id?: string;
  accountIdOptions: SelectOption[];
  customerIdOptions: SelectOption[];
  employeeIdOptions: SelectOption[];
}

export function FinanceVoucherForm({
  form,
  onSubmit,
  id = 'financeVoucher-form',
  accountIdOptions,
  customerIdOptions,
  employeeIdOptions,
}: FinanceVoucherFormProps) {
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="voucherType"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Loại phiếu<span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={voucherTypeOptions}
                    searchable={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="voucherDate"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Ngày chứng từ<span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <DatePickerInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    calendarLabel="Chọn ngày chứng từ"
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
            name="transactionAt"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Thời điểm giao dịch
                  <span className="text-destructive"> *</span>
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
            name="accountId"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Quỹ/tài khoản<span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={accountIdOptions}
                    searchable
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="partyType"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Loại đối tượng<span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={partyTypeOptions}
                    searchable={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Khách hàng</FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={customerIdOptions}
                    searchable
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Nhân viên</FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={employeeIdOptions}
                    searchable
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="partyName"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Tên đối tượng<span className="text-destructive"> *</span>
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
            name="contactName"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Người giao/nhận</FormLabel>
                <FormControl>
                  <Input variant="md" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>Địa chỉ</FormLabel>
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
                <FormLabel>Nội dung chung</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="externalReference"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Mã giao dịch/chứng từ ngoài</FormLabel>
                <FormControl>
                  <Input variant="md" {...field} />
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

interface FinanceVoucherFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<FinanceVoucherFormValues>;
  onSubmit: (values: FinanceVoucherFormValues) => void;
  isSaving?: boolean;
  title?: string;
  accountIdOptions: SelectOption[];
  customerIdOptions: SelectOption[];
  employeeIdOptions: SelectOption[];
}

export function FinanceVoucherFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  accountIdOptions,
  customerIdOptions,
  employeeIdOptions,
}: FinanceVoucherFormDialogProps) {
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
          className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0"
          onKeyDown={handleDialogKeyDown}
        >
          <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 text-start">
            <DialogTitle>{title ?? 'Phiếu thu chi'}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <FinanceVoucherForm
              form={form}
              onSubmit={onSubmit}
              id="financeVoucher-form"
              accountIdOptions={accountIdOptions}
              customerIdOptions={customerIdOptions}
              employeeIdOptions={employeeIdOptions}
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
                form="financeVoucher-form"
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
