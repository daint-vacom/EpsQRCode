/**
 * Scaffolded by form-builder from `src/project/material-groups/forms/material-group.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState, type KeyboardEvent } from 'react';
import { CodeInputField } from '@/project/code-generation/components/code-input-field';
import type { MaterialModelFormValues } from '@/project/material-models/model/material-model';
import { MaterialSpecificationsTable } from '@/project/material-models/table/material-specifications-table';
import { SafetyInspectionChecklistEditor } from '@/project/material-safety-inspections/components/safety-inspection-checklist-editor';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardCheck, Info, SlidersHorizontal } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type {
  SubmitErrorHandler,
  UseFormProps,
  UseFormReturn,
} from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogBody,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  materialGroupFormSchema,
  type MaterialGroupFormValues,
} from '../model/material-group';
import type { MaterialGroup } from '../model/material-group';

export const materialGroupDefaultValues: MaterialGroupFormValues = {
  code: '',
  codeMode: 'auto',
  name: '',
  description: '',
  specifications: [],
  safetyInspectionChecklist: [],
};

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type MaterialGroupFormSource = MaterialGroup;

export function useMaterialGroupForm(
  options?: Omit<UseFormProps<MaterialGroupFormValues>, 'resolver'>,
) {
  return useForm<MaterialGroupFormValues>({
    resolver: zodResolver(materialGroupFormSchema),
    defaultValues: materialGroupDefaultValues,
    ...options,
  });
}

export function mapMaterialGroupToFormValues(
  entity: MaterialGroupFormSource,
): MaterialGroupFormValues {
  return {
    code: entity.code,
    codeMode: 'manual',
    name: entity.name,
    description: entity.description,
    specifications: entity.specifications.map((specification) => ({
      ...specification,
      values: [...specification.values],
      valueLabels: [...specification.valueLabels],
    })),
    safetyInspectionChecklist: (entity.safetyInspectionChecklist ?? []).map(
      (group) => ({
        ...group,
        criteria: group.criteria.map((criterion) => ({ ...criterion })),
      }),
    ),
  };
}

interface MaterialGroupFormProps {
  form: UseFormReturn<MaterialGroupFormValues>;
  onSubmit: (values: MaterialGroupFormValues) => void;
  id?: string;
  mode: 'create' | 'edit';
  codePattern: string;
  resetKey: string;
}

export function MaterialGroupForm({
  form,
  onSubmit,
  id = 'materialGroup-form',
  mode,
  codePattern,
  resetKey,
}: MaterialGroupFormProps) {
  const intl = useIntl();
  const codeMode = form.watch('codeMode');
  const [activeTab, setActiveTab] = useState('general');
  const handleInvalidSubmit: SubmitErrorHandler<MaterialGroupFormValues> = (
    errors,
  ) => {
    setActiveTab(
      errors.safetyInspectionChecklist
        ? 'inspection'
        : errors.specifications
          ? 'technical'
          : 'general',
    );
  };

  return (
    <Form {...form}>
      <form
        id={id}
        onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)}
        className="h-full min-h-0"
      >
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex h-full min-h-0 min-w-0 flex-col"
        >
          <TabsList variant="line" size="md" className="w-full shrink-0 px-6">
            <TabsTrigger value="general">
              <Info className="size-4" aria-hidden="true" />
              {intl.formatMessage({ id: 'materialGroups.tabs.general' })}
            </TabsTrigger>
            <TabsTrigger value="technical">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {intl.formatMessage({ id: 'materialGroups.tabs.technical' })}
            </TabsTrigger>
            <TabsTrigger value="inspection">
              <ClipboardCheck className="size-4" aria-hidden="true" />
              {intl.formatMessage({ id: 'materialGroups.tabs.inspection' })}
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="general"
            className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-5"
          >
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
                      {intl.formatMessage({ id: 'materialGroups.fields.code' })}
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
                      {intl.formatMessage({ id: 'materialGroups.fields.name' })}
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
                        id: 'materialGroups.fields.description',
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
          </TabsContent>
          <TabsContent
            value="technical"
            className="mt-0 min-h-0 flex-1 overflow-hidden px-6 pb-5 pt-4"
          >
            <Card className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <MaterialSpecificationsTable
                mode="model"
                form={form as unknown as UseFormReturn<MaterialModelFormValues>}
                allowClipboard={false}
              />
            </Card>
          </TabsContent>
          <TabsContent
            value="inspection"
            className="mt-0 min-h-0 flex-1 overflow-hidden px-6 pb-5 pt-4"
          >
            <SafetyInspectionChecklistEditor
              groups={form.watch('safetyInspectionChecklist') ?? []}
              fillHeight
              onChange={(groups) =>
                form.setValue('safetyInspectionChecklist', groups, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
}

interface MaterialGroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<MaterialGroupFormValues>;
  onSubmit: (values: MaterialGroupFormValues) => void;
  isSaving?: boolean;
  title?: string;
  codePattern: string;
  resetKey: string;
}

export function MaterialGroupFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  codePattern,
  resetKey,
}: MaterialGroupFormDialogProps) {
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
          className="flex h-[min(90dvh,760px)] max-w-5xl flex-col gap-0 overflow-hidden p-0"
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
                  id: 'materialGroups.dialogs.createTitle',
                })}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="min-h-0 flex-1 overflow-hidden p-0">
            <MaterialGroupForm
              form={form}
              onSubmit={onSubmit}
              id="materialGroup-form"
              mode={mode}
              codePattern={codePattern}
              resetKey={resetKey}
            />
          </DialogBody>

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
                form="materialGroup-form"
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
