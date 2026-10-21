/**
 * Scaffolded by form-builder from `src/project/warehouses/forms/warehouse.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
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
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import type { MultiSelectOption } from '@/components/ui/multi-select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  warehouseFormSchema,
  type Warehouse,
  type WarehouseFormValues,
} from '../model/warehouse';

export const warehouseDefaultValues: WarehouseFormValues = {
  code: '',
  name: '',
  address: '',
  accountUserIds: [],
  isActive: true,
};

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type WarehouseFormSource = Warehouse;

export function useWarehouseForm(
  options?: Omit<UseFormProps<WarehouseFormValues>, 'resolver'>,
) {
  return useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: warehouseDefaultValues,
    ...options,
  });
}

export function mapWarehouseToFormValues(
  entity: WarehouseFormSource,
): WarehouseFormValues {
  return {
    code: entity.code,
    name: entity.name,
    address: entity.address,
    accountUserIds: entity.accountUserIds,
    isActive: entity.isActive,
  };
}

interface WarehouseFormProps {
  form: UseFormReturn<WarehouseFormValues>;
  onSubmit: (values: WarehouseFormValues) => void;
  id?: string;
  mode: 'create' | 'edit';
  accountUserIdsOptions: MultiSelectOption[];
}

export function WarehouseForm({
  form,
  onSubmit,
  id = 'warehouse-form',
  mode,
  accountUserIdsOptions,
}: WarehouseFormProps) {
  const intl = useIntl();
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
              >
                <FormLabel>
                  {intl.formatMessage({ id: 'warehouses.fields.code' })}
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
            name="name"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
              >
                <FormLabel>
                  {intl.formatMessage({ id: 'warehouses.fields.name' })}
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
            name="address"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
                alignment="start"
              >
                <FormLabel>
                  {intl.formatMessage({ id: 'warehouses.fields.address' })}
                </FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="accountUserIds"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
              >
                <FormLabel>
                  {intl.formatMessage({ id: 'warehouses.fields.accounts' })}
                </FormLabel>
                <FormControl>
                  <MultiSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={accountUserIdsOptions}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {mode === 'edit' && (
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem
                  className="md:col-span-12 flex-row items-center gap-2.5"
                  layout="horizontal"
                  labelWidth="md"
                >
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal text-foreground">
                    {intl.formatMessage({
                      id: 'warehouses.fields.availability',
                    })}
                  </FormLabel>
                </FormItem>
              )}
            />
          )}
        </div>
      </form>
    </Form>
  );
}

interface WarehouseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<WarehouseFormValues>;
  onSubmit: (values: WarehouseFormValues) => void;
  isSaving?: boolean;
  title?: string;
  accountUserIdsOptions: MultiSelectOption[];
}

export function WarehouseFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  accountUserIdsOptions,
}: WarehouseFormDialogProps) {
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
                intl.formatMessage({ id: 'warehouses.dialogs.createTitle' })}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <WarehouseForm
              form={form}
              onSubmit={onSubmit}
              id="warehouse-form"
              mode={mode}
              accountUserIdsOptions={accountUserIdsOptions}
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
                form="warehouse-form"
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
