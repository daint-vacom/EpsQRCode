/**
 * Scaffolded by form-builder from `src/project/tags/forms/software-account-catalog.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { SoftwareAccountCatalogAccountTypesEditor } from '../components/software-account-catalog-account-types-editor';
import {
  softwareAccountCatalogFormSchema,
  type SoftwareAccountCatalogFormValues,
} from '../model/software-account-catalog';

export const softwareAccountCatalogDefaultValues: SoftwareAccountCatalogFormValues =
  {
    name: '',
    description: '',
    defaultAccessUrl: '',
    defaultUsername: '',
    defaultPassword: '',
    accountTypes: [],
    isActive: true,
  };

// TODO(scaffold): replace with the real entity type used for edit-mode mapping.
type SoftwareAccountCatalogFormSource = unknown;

export function useSoftwareAccountCatalogForm(
  options?: Omit<UseFormProps<SoftwareAccountCatalogFormValues>, 'resolver'>,
) {
  return useForm<SoftwareAccountCatalogFormValues>({
    resolver: zodResolver(softwareAccountCatalogFormSchema),
    defaultValues: softwareAccountCatalogDefaultValues,
    ...options,
  });
}

export function mapSoftwareAccountCatalogToFormValues(
  entity: SoftwareAccountCatalogFormSource,
): SoftwareAccountCatalogFormValues {
  // TODO(scaffold): map entity → form values for edit mode.
  void entity;
  return softwareAccountCatalogDefaultValues;
}

interface SoftwareAccountCatalogFormProps {
  form: UseFormReturn<SoftwareAccountCatalogFormValues>;
  onSubmit: (values: SoftwareAccountCatalogFormValues) => void;
  id?: string;
}

export function SoftwareAccountCatalogForm({
  form,
  onSubmit,
  id = 'softwareAccountCatalog-form',
}: SoftwareAccountCatalogFormProps) {
  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Tên phần mềm<span className="text-destructive"> *</span>
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
            name="isActive"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel className="invisible" aria-hidden="true">
                  Đang sử dụng
                </FormLabel>
                <div className="flex items-center gap-2.5">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Đang sử dụng"
                    />
                  </FormControl>
                  <span className="text-sm font-normal text-foreground">
                    Đang sử dụng
                  </span>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>Mô tả</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultAccessUrl"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>Địa chỉ truy cập mặc định</FormLabel>
                <FormControl>
                  <Input type="url" variant="md" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultUsername"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Tài khoản mặc định</FormLabel>
                <FormControl>
                  <Input variant="md" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultPassword"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Mật khẩu mặc định</FormLabel>
                <FormControl>
                  <Input type="password" variant="md" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <SoftwareAccountCatalogAccountTypesEditor form={form} />
        </div>
      </form>
    </Form>
  );
}

interface SoftwareAccountCatalogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<SoftwareAccountCatalogFormValues>;
  onSubmit: (values: SoftwareAccountCatalogFormValues) => void;
  isSaving?: boolean;
  title?: string;
}

export function SoftwareAccountCatalog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
}: SoftwareAccountCatalogProps) {
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
            <DialogTitle>{title ?? 'Tài khoản phần mềm'}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <SoftwareAccountCatalogForm
              form={form}
              onSubmit={onSubmit}
              id="softwareAccountCatalog-form"
            />
          </div>

          <DialogFooter className="shrink-0 px-6 py-4">
            <ShortcutTooltip label="Hủy" shortcut="Esc">
              <Button
                type="button"
                variant="outline"
                onClick={() => requestClose(false)}
                disabled={isSaving}
              >
                Hủy
              </Button>
            </ShortcutTooltip>
            <ShortcutTooltip label="Lưu" shortcut="Ctrl/Cmd + S">
              <Button
                type="submit"
                variant="primary"
                form="softwareAccountCatalog-form"
                loading={isSaving}
                loadingText="Đang lưu..."
              >
                Lưu
              </Button>
            </ShortcutTooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        title="Đóng chỉnh sửa?"
        description="Bạn có thay đổi chưa lưu. Nếu đóng, các thay đổi hiện tại sẽ bị mất."
        confirmLabel="Đóng"
        confirmVariant="destructive"
        onConfirm={confirmClose}
      />
    </>
  );
}
