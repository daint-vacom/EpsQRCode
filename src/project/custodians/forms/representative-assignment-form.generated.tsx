/**
 * Scaffolded by form-builder from `src/project/custodians/forms/representative-assignment.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
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
import { MultiSelect } from '@/components/ui/multi-select';
import type { MultiSelectOption } from '@/components/ui/multi-select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  representativeAssignmentFormSchema,
  type RepresentativeAssignment,
  type RepresentativeAssignmentFormValues,
} from '../model/representative-assignment';

export const representativeAssignmentDefaultValues: RepresentativeAssignmentFormValues =
  {
    userIds: [],
  };

type RepresentativeAssignmentFormSource = RepresentativeAssignment;

export function useRepresentativeAssignmentForm(
  options?: Omit<UseFormProps<RepresentativeAssignmentFormValues>, 'resolver'>,
) {
  return useForm<RepresentativeAssignmentFormValues>({
    resolver: zodResolver(representativeAssignmentFormSchema),
    defaultValues: representativeAssignmentDefaultValues,
    ...options,
  });
}

export function mapRepresentativeAssignmentToFormValues(
  entity: RepresentativeAssignmentFormSource,
): RepresentativeAssignmentFormValues {
  return { userIds: [...entity.userIds] };
}

interface RepresentativeAssignmentFormProps {
  form: UseFormReturn<RepresentativeAssignmentFormValues>;
  onSubmit: (values: RepresentativeAssignmentFormValues) => void;
  id?: string;
  disabled?: boolean;
  userIdsOptions: MultiSelectOption[];
}

export function RepresentativeAssignmentForm({
  form,
  onSubmit,
  id = 'representativeAssignment-form',
  disabled = false,
  userIdsOptions,
}: RepresentativeAssignmentFormProps) {
  const intl = useIntl();
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="userIds"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
              >
                <FormLabel>
                  {intl.formatMessage({
                    id: 'custodians.representatives.fields.accounts',
                  })}
                </FormLabel>
                <FormControl>
                  <MultiSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={userIdsOptions}
                    disabled={disabled}
                    placeholder={intl.formatMessage({
                      id: 'custodians.representatives.select.placeholder',
                    })}
                    searchPlaceholder={intl.formatMessage({
                      id: 'custodians.representatives.select.search',
                    })}
                    emptyMessage={intl.formatMessage({
                      id: 'custodians.representatives.select.empty',
                    })}
                    ariaLabel={intl.formatMessage({
                      id: 'custodians.representatives.fields.accounts',
                    })}
                  />
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

interface RepresentativeAssignmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<RepresentativeAssignmentFormValues>;
  onSubmit: (values: RepresentativeAssignmentFormValues) => void;
  isSaving?: boolean;
  title?: string;
  userIdsOptions: MultiSelectOption[];
}

export function RepresentativeAssignmentFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  userIdsOptions,
}: RepresentativeAssignmentFormDialogProps) {
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
                intl.formatMessage({
                  id: 'custodians.representatives.dialog.title',
                })}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <RepresentativeAssignmentForm
              form={form}
              onSubmit={onSubmit}
              id="representativeAssignment-form"
              disabled={isSaving}
              userIdsOptions={userIdsOptions}
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
                form="representativeAssignment-form"
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
