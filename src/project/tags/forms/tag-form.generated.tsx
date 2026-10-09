/**
 * Scaffolded by form-builder from `src/project/tags/forms/tag.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { ColorInput } from '@/components/ui/color-input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Textarea } from '@/components/ui/textarea';
import { tagFormSchema, type TagFormValues } from '../model/tag';

export const tagDefaultValues: TagFormValues = {
  groupId: '',
  name: '',
  description: '',
  code: '',
  color: '',
};

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type TagFormSource = unknown;

export function useTagForm(
  options?: Omit<UseFormProps<TagFormValues>, 'resolver'>,
) {
  return useForm<TagFormValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: tagDefaultValues,
    ...options,
  });
}

export function mapTagToFormValues(entity: TagFormSource): TagFormValues {
  // TODO(scaffold): map entity → form values for edit mode.
  void entity;
  return tagDefaultValues;
}

interface TagFormProps {
  form: UseFormReturn<TagFormValues>;
  onSubmit: (values: TagFormValues) => void;
  id?: string;
  groupIdOptions: { value: string; label: string }[];
  autoFocusName?: boolean;
}

export function TagForm({
  form,
  onSubmit,
  id = 'tag-form',
  groupIdOptions,
  autoFocusName = false,
}: TagFormProps) {
  const intl = useIntl();
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="groupId"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>
                  {intl.formatMessage({ id: 'tags.items.fields.group' })}
                  <span className="text-destructive"> *</span>
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {groupIdOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>
                  {intl.formatMessage({ id: 'tags.items.fields.name' })}
                  <span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <Input variant="md" autoFocus={autoFocusName} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>
                  {intl.formatMessage({ id: 'common.fields.description' })}
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
            name="code"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  {intl.formatMessage({ id: 'tags.items.fields.code' })}
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
            name="color"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  {intl.formatMessage({ id: 'tags.items.fields.color' })}
                  <span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <ColorInput
                    defaultValue="#2563eb"
                    expanded
                    variant="md"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
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

interface TagFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<TagFormValues>;
  onSubmit: (values: TagFormValues) => void;
  isSaving?: boolean;
  title?: string;
  groupIdOptions: { value: string; label: string }[];
}

export function TagFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  groupIdOptions,
}: TagFormDialogProps) {
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
                intl.formatMessage({ id: 'tags.dialogs.itemCreateTitle' })}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <TagForm
              form={form}
              onSubmit={onSubmit}
              id="tag-form"
              groupIdOptions={groupIdOptions}
              autoFocusName={mode === 'create'}
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
                form="tag-form"
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
