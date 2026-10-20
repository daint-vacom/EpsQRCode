/**
 * Scaffolded by form-builder from `src/project/handover/forms/handover.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import type { HandoverDocument } from '../model/handover';
import {
  handoverFormSchema,
  type HandoverFormValues,
} from '../model/handover-form-schema';

const typeOptions = [
  { value: 'transfer', label: 'Chuyển sở hữu' },
  { value: 'loan', label: 'Cho mượn' },
  { value: 'return', label: 'Trả lại' },
];

export const handoverDefaultValues: HandoverFormValues = {
  type: 'transfer',
  senderPartyId: '',
  recipientPartyId: '',
  senderRepresentativeUserId: null,
  recipientRepresentativeUserId: null,
  plannedDate: '',
  dueDate: '',
  note: '',
  items: [],
  attachmentFileIds: [],
};

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type HandoverFormSource = HandoverDocument;

export function useHandoverForm(
  options?: Omit<UseFormProps<HandoverFormValues>, 'resolver'>,
) {
  return useForm<HandoverFormValues>({
    resolver: zodResolver(handoverFormSchema),
    defaultValues: handoverDefaultValues,
    ...options,
  });
}

export function mapHandoverToFormValues(
  entity: HandoverFormSource,
): HandoverFormValues {
  return {
    type: entity.type,
    senderPartyId: entity.senderParty.id,
    recipientPartyId: entity.recipientParty.id,
    senderRepresentativeUserId: entity.senderRepresentative?.userId ?? null,
    recipientRepresentativeUserId:
      entity.recipientRepresentative?.userId ?? null,
    plannedDate: entity.plannedDate ?? '',
    dueDate: entity.dueDate ?? '',
    note: entity.note ?? '',
    items: entity.items.map((item) => ({
      materialId: item.materialId,
      condition: item.senderCondition,
      note: item.note ?? '',
    })),
    attachmentFileIds: entity.attachments.map(
      (attachment) => attachment.fileId,
    ),
  };
}

interface HandoverFormProps {
  children?: ReactNode;
  sideContent?: ReactNode;
  form: UseFormReturn<HandoverFormValues>;
  onSubmit: (values: HandoverFormValues) => void;
  id?: string;
  senderPartyIdOptions: SelectOption[];
  recipientPartyIdOptions: SelectOption[];
  senderRepresentativeUserIdOptions: SelectOption[];
  recipientRepresentativeUserIdOptions: SelectOption[];
}

export function HandoverForm({
  children,
  sideContent,
  form,
  onSubmit,
  id = 'handover-form',
  senderPartyIdOptions,
  recipientPartyIdOptions,
  senderRepresentativeUserIdOptions,
  recipientRepresentativeUserIdOptions,
}: HandoverFormProps) {
  const intl = useIntl();
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 items-stretch gap-admin-page-section xl:grid-cols-2">
          <Card className="h-full min-w-0">
            <CardContent>
              <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem
                      className="md:col-span-12"
                      layout="horizontal"
                      labelWidth="md"
                    >
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.handover.fields.type',
                        })}
                        <span className="text-destructive"> *</span>
                      </FormLabel>
                      <FormControl>
                        <OptionSelect
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          options={typeOptions}
                          searchable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="senderPartyId"
                  render={({ field }) => (
                    <FormItem
                      className="md:col-span-12"
                      layout="horizontal"
                      labelWidth="md"
                    >
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.handover.fields.sender',
                        })}
                        <span className="text-destructive"> *</span>
                      </FormLabel>
                      <FormControl>
                        <OptionSelect
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          options={senderPartyIdOptions}
                          searchable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipientPartyId"
                  render={({ field }) => (
                    <FormItem
                      className="md:col-span-12"
                      layout="horizontal"
                      labelWidth="md"
                    >
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.handover.fields.recipient',
                        })}
                        <span className="text-destructive"> *</span>
                      </FormLabel>
                      <FormControl>
                        <OptionSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={recipientPartyIdOptions}
                          searchable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="senderRepresentativeUserId"
                  render={({ field }) => (
                    <FormItem
                      className="md:col-span-12"
                      layout="horizontal"
                      labelWidth="md"
                    >
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.handover.fields.senderRepresentative',
                        })}
                      </FormLabel>
                      <FormControl>
                        <OptionSelect
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          options={senderRepresentativeUserIdOptions}
                          searchable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipientRepresentativeUserId"
                  render={({ field }) => (
                    <FormItem
                      className="md:col-span-12"
                      layout="horizontal"
                      labelWidth="md"
                    >
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.handover.fields.recipientRepresentative',
                        })}
                      </FormLabel>
                      <FormControl>
                        <OptionSelect
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          options={recipientRepresentativeUserIdOptions}
                          searchable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plannedDate"
                  render={({ field }) => (
                    <FormItem
                      className="md:col-span-12"
                      layout="horizontal"
                      labelWidth="md"
                    >
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.handover.fields.plannedDate',
                        })}
                        <span className="text-destructive"> *</span>
                      </FormLabel>
                      <FormControl>
                        <DatePickerInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          calendarLabel="Chọn ngày dự kiến"
                          valueMode="iso-date"
                          variant="md"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem
                      className="md:col-span-12"
                      layout="horizontal"
                      labelWidth="md"
                    >
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.handover.fields.dueDate',
                        })}
                      </FormLabel>
                      <FormControl>
                        <DatePickerInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          calendarLabel="Chọn hạn trả"
                          valueMode="iso-date"
                          variant="md"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
          {sideContent}
        </div>
        {children}
      </form>
    </Form>
  );
}

interface HandoverFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<HandoverFormValues>;
  onSubmit: (values: HandoverFormValues) => void;
  isSaving?: boolean;
  title?: string;
  senderPartyIdOptions: SelectOption[];
  recipientPartyIdOptions: SelectOption[];
  senderRepresentativeUserIdOptions: SelectOption[];
  recipientRepresentativeUserIdOptions: SelectOption[];
}

export function HandoverFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  senderPartyIdOptions,
  recipientPartyIdOptions,
  senderRepresentativeUserIdOptions,
  recipientRepresentativeUserIdOptions,
}: HandoverFormDialogProps) {
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
                  id: 'project.handover.dialogs.createTitle',
                })}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <HandoverForm
              form={form}
              onSubmit={onSubmit}
              id="handover-form"
              senderPartyIdOptions={senderPartyIdOptions}
              recipientPartyIdOptions={recipientPartyIdOptions}
              senderRepresentativeUserIdOptions={
                senderRepresentativeUserIdOptions
              }
              recipientRepresentativeUserIdOptions={
                recipientRepresentativeUserIdOptions
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
                form="handover-form"
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
