/**
 * Scaffolded by form-builder from `src/project/material-specifications/forms/material-specification.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState, type KeyboardEvent } from 'react';
import { CodeInputField } from '@/project/code-generation/components/code-input-field';
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
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Textarea } from '@/components/ui/textarea';
import {
  mapMaterialSpecificationToFormValues as mapSpecificationValues,
  materialSpecificationDefaultValues,
  materialSpecificationFormSchema,
  type MaterialSpecification,
  type MaterialSpecificationDataType,
  type MaterialSpecificationFormValues,
} from '../model/material-specification';
import { MaterialSpecificationDataTypeSelect } from './material-specification-data-type-select';
import { MaterialSpecificationOptionsField } from './material-specification-options-field';

const dataTypeOptions = [
  { value: 'text', label: 'Văn bản' },
  { value: 'number', label: 'Số + đơn vị' },
  { value: 'boolean', label: 'Có / Không' },
  { value: 'date', label: 'Ngày tháng' },
  { value: 'color', label: 'Màu sắc' },
  { value: 'length', label: 'Độ dài' },
  { value: 'weight', label: 'Cân nặng' },
];

export function useMaterialSpecificationForm(
  options?: Omit<UseFormProps<MaterialSpecificationFormValues>, 'resolver'>,
) {
  return useForm<MaterialSpecificationFormValues>({
    resolver: zodResolver(materialSpecificationFormSchema),
    defaultValues: materialSpecificationDefaultValues,
    ...options,
  });
}

export function mapMaterialSpecificationToFormValues(
  entity: MaterialSpecification,
): MaterialSpecificationFormValues {
  return mapSpecificationValues(entity);
}

interface MaterialSpecificationFormProps {
  form: UseFormReturn<MaterialSpecificationFormValues>;
  onSubmit: (values: MaterialSpecificationFormValues) => void;
  mode: 'create' | 'edit';
  pattern: string;
  resetKey?: string;
  id?: string;
}

export function MaterialSpecificationForm({
  form,
  onSubmit,
  mode,
  pattern,
  resetKey,
  id = 'materialSpecification-form',
}: MaterialSpecificationFormProps) {
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
                alignment="first-control"
              >
                <FormLabel>
                  {intl.formatMessage({
                    id: 'materialSpecifications.fields.code',
                  })}
                  <span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <CodeInputField
                    {...field}
                    variant="md"
                    mode={mode}
                    codeMode={form.watch('codeMode')}
                    pattern={pattern}
                    resetKey={resetKey}
                    showCodeModeSelector
                    onCodeModeChange={(value) =>
                      form.setValue('codeMode', value)
                    }
                  />
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
                  {intl.formatMessage({
                    id: 'materialSpecifications.fields.name',
                  })}
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
            name="description"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
                alignment="start"
              >
                <FormLabel>
                  {intl.formatMessage({
                    id: 'materialSpecifications.fields.description',
                  })}
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
            name="dataType"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
              >
                <FormLabel>
                  {intl.formatMessage({
                    id: 'materialSpecifications.fields.dataType',
                  })}
                </FormLabel>
                <FormControl>
                  <MaterialSpecificationDataTypeSelect
                    value={field.value}
                    onChange={(nextValue) => {
                      const value = nextValue as MaterialSpecificationDataType;
                      field.onChange(value);
                      form.setValue('options', [], { shouldDirty: true });
                      form.setValue('defaultValue', null, {
                        shouldDirty: true,
                      });
                      form.setValue(
                        'unit',
                        value === 'length'
                          ? 'mm'
                          : value === 'weight'
                            ? 'kg'
                            : '',
                        { shouldDirty: true },
                      );
                    }}
                    options={dataTypeOptions}
                    searchable={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch('dataType') === 'number' ? (
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem
                  className="md:col-span-12"
                  layout="horizontal"
                  labelWidth="md"
                >
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'materialSpecifications.fields.unit',
                    })}
                  </FormLabel>
                  <FormControl>
                    <Input variant="md" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <MaterialSpecificationOptionsField form={form} />
        </div>
      </form>
    </Form>
  );
}

interface MaterialSpecificationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<MaterialSpecificationFormValues>;
  onSubmit: (values: MaterialSpecificationFormValues) => void;
  isSaving?: boolean;
  title?: string;
  pattern: string;
  resetKey?: string;
}

export function MaterialSpecificationFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  pattern,
  resetKey,
}: MaterialSpecificationFormDialogProps) {
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
          onOpenAutoFocus={(event) => {
            if (mode !== 'edit') return;
            event.preventDefault();
            form.setFocus('name');
          }}
        >
          <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 text-start">
            <DialogTitle>
              {title ??
                intl.formatMessage({
                  id: 'materialSpecifications.dialogs.createTitle',
                })}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <MaterialSpecificationForm
              form={form}
              onSubmit={onSubmit}
              mode={mode}
              pattern={pattern}
              resetKey={resetKey}
              id="materialSpecification-form"
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
                form="materialSpecification-form"
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
