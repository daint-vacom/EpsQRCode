/**
 * Scaffolded by form-builder from `src/project/files/forms/file-folder-create.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
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
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  fileFolderCreateFormSchema,
  type FileFolderCreateFormValues,
} from '../model/file-manager';

export const fileFolderCreateDefaultValues: FileFolderCreateFormValues = {
  name: '',
};

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type FileFolderCreateFormSource = unknown;

export function useFileFolderCreateForm(
  options?: Omit<UseFormProps<FileFolderCreateFormValues>, 'resolver'>,
) {
  return useForm<FileFolderCreateFormValues>({
    resolver: zodResolver(fileFolderCreateFormSchema),
    defaultValues: fileFolderCreateDefaultValues,
    ...options,
  });
}

export function mapFileFolderCreateToFormValues(
  entity: FileFolderCreateFormSource,
): FileFolderCreateFormValues {
  // TODO(scaffold): map entity → form values for edit mode.
  void entity;
  return fileFolderCreateDefaultValues;
}

interface FileFolderCreateFormProps {
  form: UseFormReturn<FileFolderCreateFormValues>;
  onSubmit: (values: FileFolderCreateFormValues) => void;
  id?: string;
}

export function FileFolderCreateForm({
  form,
  onSubmit,
  id = 'fileFolderCreate-form',
}: FileFolderCreateFormProps) {
  const intl = useIntl();
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>
                  {intl.formatMessage({ id: 'files.fields.name' })}
                  <span className="text-destructive"> *</span>
                </FormLabel>
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

interface FileFolderCreateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<FileFolderCreateFormValues>;
  onSubmit: (values: FileFolderCreateFormValues) => void;
  isSaving?: boolean;
  title?: string;
}

export function FileFolderCreateFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
}: FileFolderCreateFormDialogProps) {
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
                intl.formatMessage({ id: 'files.actions.createFolder' })}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <FileFolderCreateForm
              form={form}
              onSubmit={onSubmit}
              id="fileFolderCreate-form"
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
                form="fileFolderCreate-form"
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
