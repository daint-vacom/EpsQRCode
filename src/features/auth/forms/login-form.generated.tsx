/**
 * Scaffolded by form-builder from `src/features/auth/forms/login.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
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
import { loginFormSchema, type LoginFormValues } from './login-form.schema';

export const loginDefaultValues: LoginFormValues = {
  email: '',
  password: '',
};

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type LoginFormSource = unknown;

export function useLoginForm(
  options?: Omit<UseFormProps<LoginFormValues>, 'resolver'>,
) {
  return useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: loginDefaultValues,
    ...options,
  });
}

export function mapLoginToFormValues(entity: LoginFormSource): LoginFormValues {
  // TODO(scaffold): map entity → form values for edit mode.
  void entity;
  return loginDefaultValues;
}

interface LoginFormProps {
  form: UseFormReturn<LoginFormValues>;
  onSubmit: (values: LoginFormValues) => void;
  id?: string;
}

export function LoginForm({
  form,
  onSubmit,
  id = 'login-form',
}: LoginFormProps) {
  const intl = useIntl();
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>
                  {intl.formatMessage({ id: 'auth.login.email' })}
                  <span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <Input type="email" variant="md" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>
                  {intl.formatMessage({ id: 'auth.login.password' })}
                  <span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <Input type="password" variant="md" {...field} />
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

interface LoginFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<LoginFormValues>;
  onSubmit: (values: LoginFormValues) => void;
  isSaving?: boolean;
  title?: string;
}

export function LoginFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
}: LoginFormDialogProps) {
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
              {title ?? intl.formatMessage({ id: 'auth.login.title' })}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <LoginForm form={form} onSubmit={onSubmit} id="login-form" />
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
                form="login-form"
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
