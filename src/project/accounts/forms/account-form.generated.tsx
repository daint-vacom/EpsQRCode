/**
 * Scaffolded by form-builder from `src/project/accounts/forms/account.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
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
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  accountFormSchema,
  type Account,
  type AccountFormValues,
} from '../model/account';

const accountTypeOptions = [
  { value: 'eps', label: 'EPS' },
  { value: 'external', label: 'Bên ngoài' },
];

const statusOptions = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'suspended', label: 'Tạm khóa' },
  { value: 'deactivated', label: 'Ngừng sử dụng' },
];

export const accountDefaultValues: AccountFormValues = {
  accountType: 'eps',
  epsEmployeeId: '',
  externalOrganizationId: '',
  displayName: '',
  username: '',
  password: '',
  status: 'active',
  roleIds: [],
  warehouseIds: [],
};

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type AccountFormSource = Account;

export function useAccountForm(
  options?: Omit<UseFormProps<AccountFormValues>, 'resolver'>,
) {
  return useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: accountDefaultValues,
    ...options,
  });
}

export function mapAccountToFormValues(
  entity: AccountFormSource,
): AccountFormValues {
  return {
    ...accountDefaultValues,
    accountType: entity.accountType === 'unmapped' ? 'eps' : entity.accountType,
    epsEmployeeId: entity.epsEmployeeId ?? '',
    externalOrganizationId: entity.externalOrganizationId ?? '',
    displayName: entity.accountType === 'external' ? entity.displayName : '',
    status: entity.status,
    roleIds: entity.roleIds,
    warehouseIds: entity.warehouseIds,
  };
}

interface AccountFormProps {
  form: UseFormReturn<AccountFormValues>;
  onSubmit: (values: AccountFormValues) => void;
  id?: string;
  mode: 'create' | 'edit';
  epsEmployeeIdOptions: SelectOption[];
  externalOrganizationIdOptions: SelectOption[];
  roleIdsOptions: MultiSelectOption[];
  warehouseIdsOptions: MultiSelectOption[];
}

export function AccountForm({
  form,
  onSubmit,
  id = 'account-form',
  mode,
  epsEmployeeIdOptions,
  externalOrganizationIdOptions,
  roleIdsOptions,
  warehouseIdsOptions,
}: AccountFormProps) {
  const intl = useIntl();
  const accountType = form.watch('accountType');
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="accountType"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
              >
                <FormLabel>
                  {intl.formatMessage({ id: 'accounts.fields.type' })}
                  <span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      if (value === 'eps')
                        form.setValue('externalOrganizationId', '');
                      if (value === 'external')
                        form.setValue('epsEmployeeId', '');
                    }}
                    options={accountTypeOptions}
                    searchable={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {accountType === 'eps' ? (
            <FormField
              control={form.control}
              name="epsEmployeeId"
              render={({ field }) => (
                <FormItem
                  className="md:col-span-12"
                  layout="horizontal"
                  labelWidth="md"
                >
                  <FormLabel>
                    {intl.formatMessage({ id: 'accounts.fields.epsEmployee' })}
                  </FormLabel>
                  <FormControl>
                    <OptionSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={epsEmployeeIdOptions}
                      searchable
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          {accountType === 'external' ? (
            <FormField
              control={form.control}
              name="externalOrganizationId"
              render={({ field }) => (
                <FormItem
                  className="md:col-span-12"
                  layout="horizontal"
                  labelWidth="md"
                >
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'accounts.fields.externalOrganization',
                    })}
                  </FormLabel>
                  <FormControl>
                    <OptionSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={externalOrganizationIdOptions}
                      searchable
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          {accountType === 'external' ? (
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem
                  className="md:col-span-12"
                  layout="horizontal"
                  labelWidth="md"
                >
                  <FormLabel>
                    {intl.formatMessage({ id: 'accounts.fields.displayName' })}
                  </FormLabel>
                  <FormControl>
                    <Input variant="md" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          {mode === 'create' && (
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem
                  className="md:col-span-12"
                  layout="horizontal"
                  labelWidth="md"
                >
                  <FormLabel>
                    {intl.formatMessage({ id: 'accounts.fields.username' })}
                    <span className="text-destructive"> *</span>
                  </FormLabel>
                  <FormControl>
                    <Input variant="md" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {mode === 'create' && (
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem
                  className="md:col-span-12"
                  layout="horizontal"
                  labelWidth="md"
                >
                  <FormLabel>
                    {intl.formatMessage({ id: 'accounts.fields.password' })}
                    <span className="text-destructive"> *</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="password" variant="md" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
              >
                <FormLabel>
                  {intl.formatMessage({ id: 'accounts.fields.status' })}
                </FormLabel>
                <FormControl>
                  <OptionSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={statusOptions}
                    searchable={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="roleIds"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
              >
                <FormLabel>
                  {intl.formatMessage({ id: 'accounts.fields.roles' })}
                </FormLabel>
                <FormControl>
                  <MultiSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={roleIdsOptions}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="warehouseIds"
            render={({ field }) => (
              <FormItem
                className="md:col-span-12"
                layout="horizontal"
                labelWidth="md"
              >
                <FormLabel>
                  {intl.formatMessage({ id: 'accounts.fields.warehouses' })}
                </FormLabel>
                <FormControl>
                  <MultiSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={warehouseIdsOptions}
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

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<AccountFormValues>;
  onSubmit: (values: AccountFormValues) => void;
  isSaving?: boolean;
  title?: string;
  epsEmployeeIdOptions: SelectOption[];
  externalOrganizationIdOptions: SelectOption[];
  roleIdsOptions: MultiSelectOption[];
  warehouseIdsOptions: MultiSelectOption[];
}

export function AccountFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  epsEmployeeIdOptions,
  externalOrganizationIdOptions,
  roleIdsOptions,
  warehouseIdsOptions,
}: AccountFormDialogProps) {
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
              {title ?? intl.formatMessage({ id: 'accounts.dialog.title' })}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <AccountForm
              form={form}
              onSubmit={onSubmit}
              id="account-form"
              mode={mode}
              epsEmployeeIdOptions={epsEmployeeIdOptions}
              externalOrganizationIdOptions={externalOrganizationIdOptions}
              roleIdsOptions={roleIdsOptions}
              warehouseIdsOptions={warehouseIdsOptions}
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
                form="account-form"
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
