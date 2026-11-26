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
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
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
  requestRegistrationScope: 'all',
  requestRegistrationPartyIds: [],
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
    requestRegistrationScope: entity.requestRegistrationScope ?? 'all',
    requestRegistrationPartyIds: entity.requestRegistrationPartyIds ?? [],
    lines: entity.lines.flatMap((line) => {
      const activeItems = line.items.filter((item) => item.status === 'active');
      if (activeItems.length === 0) return [];
      return {
        clientId: line.id,
        lineId: line.id,
        modelId: line.modelId ?? '',
        quantity: activeItems.length,
        receivingPartyId: line.receivingPartyId ?? null,
        condition: activeItems[0]?.condition ?? 'good',
        note:
          activeItems.find((item) => item.note.trim())?.note ??
          activeItems.find((item) => item.conditionNote?.trim())
            ?.conditionNote ??
          '',
        conditionNote:
          activeItems.find((item) => item.condition === 'damaged')
            ?.conditionNote ?? '',
        specificationOverrides: line.specificationOverrides ?? {},
        specificationOverrideLabels: line.specificationOverrideLabels ?? {},
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
  readOnly?: boolean;
  warehouseName?: string;
  requestRegistrationScopeOptions: SelectOption[];
  onEditRequestRegistrationParties: () => void;
  requestRegistrationReadOnly?: boolean;
}

export function MaterialReceiptHeaderForm({
  form,
  onSubmit,
  id = 'materialReceipt-form',
  warehouses,
  readOnly = false,
  warehouseName,
  requestRegistrationScopeOptions,
  onEditRequestRegistrationParties,
  requestRegistrationReadOnly = false,
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
                  {readOnly || requestRegistrationReadOnly ? (
                    <span className="text-sm text-foreground">
                      {warehouseName || '—'}
                    </span>
                  ) : (
                    <WarehouseSelect
                      sourceMode="options"
                      warehouses={warehouses}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="requestRegistrationScope"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
                alignment="start"
              >
                <FormLabel>
                  {intl.formatMessage({
                    id: 'receipts.fields.requestRegistrationScope',
                  })}
                </FormLabel>
                <FormControl>
                  <div className="flex w-full flex-col gap-3">
                    {readOnly ? (
                      <span className="text-sm text-foreground">
                        {requestRegistrationScopeOptions.find(
                          (option) => option.value === field.value,
                        )?.label ?? '—'}
                      </span>
                    ) : (
                      <OptionSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={requestRegistrationScopeOptions}
                        canDeselect={false}
                      />
                    )}
                    {field.value === 'selected' ? (
                      <FormField
                        control={form.control}
                        name="requestRegistrationPartyIds"
                        render={({ field: partyField }) => (
                          <FormItem className="gap-1.5">
                            <FormControl>
                              <div className="flex w-full items-start justify-between gap-4">
                                <span className="min-w-0 flex-1 text-sm text-foreground">
                                  {intl.formatMessage(
                                    {
                                      id: 'receipts.fields.selectedRegistrationPartyCount',
                                    },
                                    { count: partyField.value.length },
                                  )}
                                </span>
                                {!readOnly && !requestRegistrationReadOnly ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="md"
                                    onClick={onEditRequestRegistrationParties}
                                  >
                                    {intl.formatMessage({
                                      id: 'receipts.actions.chooseRegistrationParties',
                                    })}
                                  </Button>
                                ) : null}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : null}
                  </div>
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
                  <Textarea rows={3} readOnly={readOnly} {...field} />
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
  requestRegistrationScopeOptions: SelectOption[];
  onEditRequestRegistrationParties: () => void;
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
  requestRegistrationScopeOptions,
  onEditRequestRegistrationParties,
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
              requestRegistrationScopeOptions={requestRegistrationScopeOptions}
              onEditRequestRegistrationParties={
                onEditRequestRegistrationParties
              }
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
