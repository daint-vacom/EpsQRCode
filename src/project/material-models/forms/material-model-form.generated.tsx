/**
 * Scaffolded by form-builder from `src/project/material-models/forms/material-model.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState, type KeyboardEvent } from 'react';
import { CodeInputField } from '@/project/code-generation/components/code-input-field';
import { MaterialGroupSelect } from '@/project/material-groups/components/material-group-select';
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
import { NumericInput } from '@/components/ui/inputs/numeric-input';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Textarea } from '@/components/ui/textarea';
import {
  materialModelFormSchema,
  type MaterialModel,
  type MaterialModelFormValues,
} from '../model/material-model';

export const materialModelDefaultValues: MaterialModelFormValues = {
  code: '',
  codeMode: 'auto',
  name: '',
  groupId: '',
  description: '',
  manufacturer: '',
  unit: '',
  unitPriceDefault: null,
  externalCodesText: '',
  requiresInspection: false,
  inspectionIntervalValue: 1,
  inspectionIntervalUnit: 'month',
  skipInitialInspection: false,
  useGroupSafetyInspectionChecklist: true,
  specifications: [],
  safetyInspectionChecklist: [],
};

type MaterialModelFormSource = MaterialModel;

export function useMaterialModelForm(
  options?: Omit<UseFormProps<MaterialModelFormValues>, 'resolver'>,
) {
  return useForm<MaterialModelFormValues>({
    resolver: zodResolver(materialModelFormSchema),
    defaultValues: materialModelDefaultValues,
    ...options,
  });
}

export function mapMaterialModelToFormValues(
  entity: MaterialModelFormSource,
): MaterialModelFormValues {
  return {
    code: entity.code,
    codeMode: 'manual',
    name: entity.name,
    groupId: entity.groupId ?? '',
    description: entity.description,
    manufacturer: entity.manufacturer,
    unit: entity.unit,
    unitPriceDefault: entity.unitPriceDefault,
    externalCodesText: entity.externalCodes.join('\n'),
    requiresInspection: entity.requiresInspection,
    inspectionIntervalValue: entity.inspectionIntervalValue,
    inspectionIntervalUnit: entity.inspectionIntervalUnit,
    skipInitialInspection: entity.skipInitialInspection,
    useGroupSafetyInspectionChecklist: entity.useGroupSafetyInspectionChecklist,
    specifications: entity.specifications.map((specification) => ({
      ...specification,
      valueLabels: [...specification.valueLabels],
      values: [...specification.values],
    })),
    safetyInspectionChecklist: (entity.safetyInspectionChecklist ?? []).map(
      (group) => ({
        ...group,
        criteria: group.criteria.map((criterion) => ({ ...criterion })),
      }),
    ),
  };
}

interface MaterialModelFormProps {
  form: UseFormReturn<MaterialModelFormValues>;
  onSubmit: (values: MaterialModelFormValues) => void;
  renderFormElement?: boolean;
  id?: string;
  mode: 'create' | 'edit';
  codePattern: string;
  resetKey: string;
}

export function MaterialModelForm({
  form,
  onSubmit,
  renderFormElement = true,
  id = 'materialModel-form',
  mode,
  codePattern,
  resetKey,
}: MaterialModelFormProps) {
  const intl = useIntl();
  const codeMode = form.watch('codeMode');
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
            alignment="first-control"
          >
            <FormLabel>
              {intl.formatMessage({ id: 'materialModels.fields.code' })}
              {codeMode === 'manual' && (
                <span className="text-destructive"> *</span>
              )}
            </FormLabel>
            <FormControl>
              <CodeInputField
                variant="md"
                {...field}
                mode={mode}
                codeMode={codeMode}
                pattern={codePattern}
                resetKey={resetKey}
                showCodeModeSelector={mode === 'create'}
                onCodeModeChange={(nextCodeMode) => {
                  form.setValue('codeMode', nextCodeMode, {
                    shouldDirty: true,
                  });
                  form.setValue('code', '');
                  form.clearErrors('code');
                }}
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
              {intl.formatMessage({ id: 'materialModels.fields.name' })}
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
        name="groupId"
        render={({ field }) => (
          <FormItem
            className="md:col-span-12"
            layout="horizontal"
            labelWidth="md"
          >
            <FormLabel>
              {intl.formatMessage({ id: 'materialModels.fields.group' })}
              <span className="text-destructive"> *</span>
            </FormLabel>
            <FormControl>
              <MaterialGroupSelect
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
        name="manufacturer"
        render={({ field }) => (
          <FormItem
            className="md:col-span-12"
            layout="horizontal"
            labelWidth="md"
          >
            <FormLabel>
              {intl.formatMessage({ id: 'materialModels.fields.manufacturer' })}
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
        name="unit"
        render={({ field }) => (
          <FormItem
            className="md:col-span-12"
            layout="horizontal"
            labelWidth="md"
          >
            <FormLabel>
              {intl.formatMessage({ id: 'materialModels.fields.unit' })}
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
        name="unitPriceDefault"
        render={({ field }) => (
          <FormItem
            className="md:col-span-12"
            layout="horizontal"
            labelWidth="md"
          >
            <FormLabel>
              {intl.formatMessage({
                id: 'materialModels.fields.unitPriceDefault',
              })}
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
                id: 'materialModels.fields.description',
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
        name="externalCodesText"
        render={({ field }) => (
          <FormItem
            className="md:col-span-12"
            layout="horizontal"
            labelWidth="md"
            alignment="start"
          >
            <FormLabel>
              {intl.formatMessage({
                id: 'materialModels.fields.externalCodes',
              })}
            </FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} />
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

interface MaterialModelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<MaterialModelFormValues>;
  onSubmit: (values: MaterialModelFormValues) => void;
  isSaving?: boolean;
  title?: string;
  codePattern: string;
  resetKey?: string;
}

export function MaterialModelFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  codePattern,
  resetKey,
}: MaterialModelFormDialogProps) {
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
          onOpenAutoFocus={(event) => {
            if (mode !== 'edit') return;

            event.preventDefault();
            form.setFocus('name');
          }}
          onKeyDown={handleDialogKeyDown}
        >
          <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 text-start">
            <DialogTitle>
              {title ??
                intl.formatMessage({
                  id: 'materialModels.dialogs.createTitle',
                })}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <MaterialModelForm
              form={form}
              onSubmit={onSubmit}
              id="materialModel-form"
              mode={mode}
              codePattern={codePattern}
              resetKey={resetKey ?? mode}
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
                form="materialModel-form"
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
