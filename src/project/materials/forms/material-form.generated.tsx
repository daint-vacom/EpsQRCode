/**
 * Scaffolded by form-builder from `src/project/materials/forms/material.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState, type KeyboardEvent } from 'react';
import { MaterialModelSelect } from '@/project/material-models/components/material-model-select';
import type { MaterialModel } from '@/project/material-models/model/material-model';
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
import { OptionSelect } from '@/components/ui/option-select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Textarea } from '@/components/ui/textarea';
import {
  materialFormSchema,
  type MaterialFormSchemaValues,
} from './material-form.schema';

const conditionOptions = [
  { value: 'good', label: 'Còn tốt' },
  { value: 'damaged', label: 'Hỏng hóc' },
];

export const materialDefaultValues: MaterialFormSchemaValues = {
  code: '',
  modelId: '',
  serialNumber: '',
  nameOverride: '',
  descriptionOverride: '',
  ownerPartyId: '',
  condition: 'good',
  note: '',
  specificationOverrides: {},
};

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type MaterialFormSource = unknown;

export function useMaterialForm(
  options?: Omit<UseFormProps<MaterialFormSchemaValues>, 'resolver'>,
) {
  return useForm<MaterialFormSchemaValues>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: materialDefaultValues,
    ...options,
  });
}

export function mapMaterialToFormValues(
  entity: MaterialFormSource,
): MaterialFormSchemaValues {
  // TODO(scaffold): map entity → form values for edit mode.
  void entity;
  return materialDefaultValues;
}

interface MaterialFormProps {
  form: UseFormReturn<MaterialFormSchemaValues>;
  onSubmit: (values: MaterialFormSchemaValues) => void;
  id?: string;
  renderFormElement?: boolean;
  mode: 'create' | 'edit';
  models: MaterialModel[];
}

export function MaterialForm({
  form,
  onSubmit,
  id = 'material-form',
  renderFormElement = true,
  mode,
  models,
}: MaterialFormProps) {
  const intl = useIntl();
  const fields = (
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
              {intl.formatMessage({
                id: 'project.materials.fields.code',
              })}
              <span className="text-destructive"> *</span>
            </FormLabel>
            <FormControl>
              <Input variant="md" {...field} readOnly={mode === 'edit'} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="modelId"
        render={({ field }) => (
          <FormItem
            className="md:col-span-12"
            layout="horizontal"
            labelWidth="md"
          >
            <FormLabel>
              {intl.formatMessage({
                id: 'project.materials.fields.model',
              })}
              <span className="text-destructive"> *</span>
            </FormLabel>
            <FormControl>
              <MaterialModelSelect
                sourceMode="options"
                models={models}
                selectedModel={models.find((model) => model.id === field.value)}
                value={field.value}
                onChange={field.onChange}
                disabled={mode === 'edit'}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="serialNumber"
        render={({ field }) => (
          <FormItem
            className="md:col-span-12"
            layout="horizontal"
            labelWidth="md"
          >
            <FormLabel>
              {intl.formatMessage({
                id: 'project.materials.fields.serialNumber',
              })}
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
        name="nameOverride"
        render={({ field }) => (
          <FormItem
            className="md:col-span-12"
            layout="horizontal"
            labelWidth="md"
          >
            <FormLabel>
              {intl.formatMessage({ id: 'project.materials.fields.name' })}
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
        name="descriptionOverride"
        render={({ field }) => (
          <FormItem
            className="md:col-span-12"
            layout="horizontal"
            labelWidth="md"
            alignment="start"
          >
            <FormLabel>
              {intl.formatMessage({
                id: 'project.materials.fields.description',
              })}
            </FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {mode === 'create' && (
        <FormField
          control={form.control}
          name="condition"
          render={({ field }) => (
            <FormItem
              className="md:col-span-12"
              layout="horizontal"
              labelWidth="md"
            >
              <FormLabel>
                {intl.formatMessage({
                  id: 'project.materials.fields.condition',
                })}
                <span className="text-destructive"> *</span>
              </FormLabel>
              <FormControl>
                <OptionSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={conditionOptions}
                  searchable={false}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

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
              {intl.formatMessage({ id: 'project.materials.fields.note' })}
            </FormLabel>
            <FormControl>
              <Textarea rows={2} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  return (
    <Form {...form}>
      {renderFormElement ? (
        <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
          {fields}
        </form>
      ) : (
        fields
      )}
    </Form>
  );
}

interface MaterialFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<MaterialFormSchemaValues>;
  onSubmit: (values: MaterialFormSchemaValues) => void;
  isSaving?: boolean;
  title?: string;
  models: MaterialModel[];
}

export function MaterialFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  models,
}: MaterialFormDialogProps) {
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
                intl.formatMessage({ id: 'project.materials.page.title' })}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <MaterialForm
              form={form}
              onSubmit={onSubmit}
              id="material-form"
              mode={mode}
              models={models}
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
                form="material-form"
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
