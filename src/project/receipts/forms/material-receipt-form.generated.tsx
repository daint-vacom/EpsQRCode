/**
 * Scaffolded by form-builder from `src/project/receipts/forms/material-receipt.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState, type KeyboardEvent } from 'react';
import { WarehouseSelect } from '@/project/warehouses/components/warehouse-select';
import type { Warehouse } from '@/project/warehouses/model/warehouse';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
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
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Textarea } from '@/components/ui/textarea';
import {
  materialReceiptFormSchema,
  type MaterialReceipt,
  type MaterialReceiptFormValues,
} from '../model/material-receipt';

export const materialReceiptDefaultValues: MaterialReceiptFormValues = {
  warehouseId: '',
  note: '',
  lines: [],
};

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type MaterialReceiptFormSource = MaterialReceipt;

export function useMaterialReceiptForm(
  options?: Omit<UseFormProps<MaterialReceiptFormValues>, 'resolver'>,
) {
  return useForm<MaterialReceiptFormValues>({
    resolver: zodResolver(materialReceiptFormSchema),
    defaultValues: materialReceiptDefaultValues,
    ...options,
  });
}

export function mapMaterialReceiptToFormValues(
  entity: MaterialReceiptFormSource,
): MaterialReceiptFormValues {
  return {
    warehouseId: entity.warehouseId,
    note: entity.note,
    lines: entity.lines.flatMap((line) => {
      const activeItems = line.items.filter((item) => item.status === 'active');
      if (activeItems.length === 0) return [];
      return {
        clientId: line.id,
        lineId: line.id,
        modelMode: line.modelId ? ('existing' as const) : ('new' as const),
        modelId: line.modelId ?? '',
        newModelCode: line.model.code ?? '',
        newModelName: line.model.name,
        groupId: line.model.groupId ?? '',
        description: '',
        requiresInspection: line.model.requiresInspection ?? false,
        externalCode: line.externalCode ?? '',
        quantity: activeItems.length,
        items: activeItems.map((item) => ({
          receiptItemId: item.id,
          serialNumber: item.serialNumber ?? '',
          condition: item.condition,
          conditionNote: item.conditionNote ?? '',
          note: item.note,
        })),
      };
    }),
  };
}

interface MaterialReceiptHeaderFormProps {
  form: UseFormReturn<MaterialReceiptFormValues>;
  onSubmit: (values: MaterialReceiptFormValues) => void;
  id?: string;
  warehouses: readonly Warehouse[];
}

export function MaterialReceiptHeaderForm({
  form,
  onSubmit,
  id = 'materialReceipt-form',
  warehouses,
}: MaterialReceiptHeaderFormProps) {
  const intl = useIntl();
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="warehouseId"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
              >
                <FormLabel>
                  {intl.formatMessage({ id: 'receipts.fields.warehouse' })}
                  <span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <WarehouseSelect
                    sourceMode="options"
                    warehouses={warehouses}
                    value={field.value}
                    onChange={field.onChange}
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
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
                alignment="start"
              >
                <FormLabel>
                  {intl.formatMessage({ id: 'receipts.fields.note' })}
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

interface MaterialReceiptHeaderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<MaterialReceiptFormValues>;
  onSubmit: (values: MaterialReceiptFormValues) => void;
  isSaving?: boolean;
  title?: string;
  warehouses: readonly Warehouse[];
}

export function MaterialReceiptHeaderFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  warehouses,
}: MaterialReceiptHeaderFormDialogProps) {
  const intl = useIntl();
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
            <DialogTitle>
              {title ??
                intl.formatMessage({ id: 'receipts.dialogs.formTitle' })}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <MaterialReceiptHeaderForm
              form={form}
              onSubmit={onSubmit}
              id="materialReceipt-form"
              warehouses={warehouses}
            />
          </div>

          <DialogFooter className="shrink-0 px-6 py-4">
            <ShortcutTooltip
              label={intl.formatMessage({ id: 'common.actions.cancel' })}
              shortcut="Esc"
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => requestClose(false)}
                disabled={isSaving}
              >
                {intl.formatMessage({ id: 'common.actions.cancel' })}
              </Button>
            </ShortcutTooltip>
            <ShortcutTooltip
              label={intl.formatMessage({ id: 'common.actions.save' })}
              shortcut="Ctrl/Cmd + S"
            >
              <Button
                type="submit"
                variant="primary"
                form="materialReceipt-form"
                loading={isSaving}
                loadingText={intl.formatMessage({ id: 'common.state.saving' })}
              >
                {intl.formatMessage({ id: 'common.actions.save' })}
              </Button>
            </ShortcutTooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        title={intl.formatMessage({
          id: 'common.dialogs.closeWithUnsavedTitle',
        })}
        description={intl.formatMessage({
          id: 'common.dialogs.closeWithUnsavedDescription',
        })}
        confirmLabel={intl.formatMessage({ id: 'common.actions.close' })}
        confirmVariant="destructive"
        onConfirm={confirmClose}
      />
    </>
  );
}
