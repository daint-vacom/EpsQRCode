import {
  getSoftwareAccountCatalogDefaultAccountType,
  type SoftwareAccountCatalog,
} from '@/project/tags/model/software-account-catalog';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  AutocompleteInput,
  type AutocompleteOption,
} from '@/components/ui/autocomplete-input';
import { Button } from '@/components/ui/button';
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
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import {
  createEmptyCustomerSoftwareAccount,
  customerSoftwareAccountSchema,
  type CustomerSoftwareAccount,
} from '../model/customer';
import { SoftwareAccountCatalogSuggestionInput } from './software-account-catalog-suggestion-input';

export function CustomerSoftwareAccountDialog({
  open,
  onOpenChange,
  customerName,
  account,
  isSaving,
  catalogs,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  account: CustomerSoftwareAccount | null;
  isSaving: boolean;
  catalogs: SoftwareAccountCatalog[];
  onSubmit: (account: CustomerSoftwareAccount) => void;
}) {
  const form = useForm<CustomerSoftwareAccount>({
    resolver: zodResolver(customerSoftwareAccountSchema),
    defaultValues: account ?? createEmptyCustomerSoftwareAccount(),
  });

  function handleSubmit(values: CustomerSoftwareAccount) {
    onSubmit({ ...values, hasPassword: Boolean(values.password) });
  }

  const isEditing = Boolean(account);
  const selectedCatalogId = form.watch('catalogId');
  const accountTypeOptions: AutocompleteOption[] =
    catalogs
      .find((catalog) => catalog.id === selectedCatalogId)
      ?.accountTypes.map((accountType) => ({
        value: accountType.name,
        label: accountType.name,
      })) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 text-start">
          <DialogTitle>
            {isEditing
              ? 'Sửa tài khoản phần mềm: '
              : 'Thêm tài khoản phần mềm: '}
            <span className="font-semibold text-primary">{customerName}</span>
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="softwareName"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>
                        Tên phần mềm <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <SoftwareAccountCatalogSuggestionInput
                          value={field.value}
                          catalogs={catalogs}
                          variant="md"
                          aria-label="Tên phần mềm"
                          aria-invalid={!!form.formState.errors.softwareName}
                          onBlur={field.onBlur}
                          onChange={(value) => {
                            field.onChange(value);
                            form.setValue('catalogId', null, {
                              shouldDirty: true,
                            });
                          }}
                          onCatalogSelect={(catalog) => {
                            form.setValue('catalogId', catalog.id, {
                              shouldDirty: true,
                            });
                            form.setValue(
                              'accessUrl',
                              catalog.defaultAccessUrl,
                            );
                            form.setValue('username', catalog.defaultUsername);
                            form.setValue('password', catalog.defaultPassword);
                            form.setValue(
                              'accountType',
                              getSoftwareAccountCatalogDefaultAccountType(
                                catalog,
                              ),
                            );
                          }}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accessUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Địa chỉ truy cập</FormLabel>
                      <FormControl>
                        <Input type="url" variant="md" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tài khoản</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          defaultValue={field.value}
                          name="softwareLogin"
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          ref={field.ref}
                          variant="md"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mật khẩu</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="new-password"
                          type="password"
                          variant="md"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loại tài khoản</FormLabel>
                      <FormControl>
                        <AutocompleteInput
                          aria-label="Loại tài khoản"
                          options={accountTypeOptions}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          variant="md"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ngày hết hạn</FormLabel>
                      <FormControl>
                        <DatePickerInput
                          variant="md"
                          value={field.value}
                          valueMode="iso-date"
                          calendarLabel="Chọn ngày hết hạn"
                          onBlur={field.onBlur}
                          onChange={(value) => field.onChange(value ?? null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <DialogFooter className="shrink-0 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSaving}
                loadingText="Đang lưu..."
              >
                {isEditing ? 'Lưu thay đổi' : 'Thêm tài khoản'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
