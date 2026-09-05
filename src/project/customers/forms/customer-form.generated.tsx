/**
 * Scaffolded by form-builder from `src/project/customers/forms/customer.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CountrySelect } from '@/components/ui/country-select';
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
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { Input } from '@/components/ui/input';
import { VietnamRegionSelect } from '@/components/ui/region-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  customerFormSchema,
  type Customer,
  type CustomerFormValues,
} from '../model/customer';

const businessTypeOptions = [
  { value: 'individual', label: 'Cá nhân' },
  { value: 'organization', label: 'Doanh nghiệp' },
];

const countryCodeOptions = [
  { value: 'VN', label: 'Việt Nam' },
  { value: 'US', label: 'Hoa Kỳ' },
  { value: 'JP', label: 'Nhật Bản' },
  { value: 'KR', label: 'Hàn Quốc' },
  { value: 'CN', label: 'Trung Quốc' },
  { value: 'SG', label: 'Singapore' },
  { value: 'TH', label: 'Thái Lan' },
  { value: 'MY', label: 'Malaysia' },
  { value: 'AU', label: 'Úc' },
  { value: 'GB', label: 'Vương quốc Anh' },
  { value: 'DE', label: 'Đức' },
  { value: 'FR', label: 'Pháp' },
  { value: 'CA', label: 'Canada' },
  { value: 'IN', label: 'Ấn Độ' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'PH', label: 'Philippines' },
  { value: 'TW', label: 'Đài Loan' },
  { value: 'HK', label: 'Hồng Kông' },
  { value: 'AE', label: 'Các Tiểu vương quốc Ả Rập Thống nhất' },
  { value: 'IT', label: 'Ý' },
  { value: 'ES', label: 'Tây Ban Nha' },
  { value: 'RU', label: 'Nga' },
  { value: 'BR', label: 'Brazil' },
  { value: 'CH', label: 'Thụy Sĩ' },
  { value: 'SE', label: 'Thụy Điển' },
  { value: 'NZ', label: 'New Zealand' },
];

const statusOptions = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Ngừng hoạt động' },
];

export const customerDefaultValues: CustomerFormValues = {
  customerCode: '',
  name: '',
  businessType: 'individual',
  businessRegistrationCode: '',
  imageUrl: '',
  countryCode: 'VN',
  regionCode: '',
  regionName: '',
  status: 'active',
  phone: '',
  email: '',
  addressDetail: '',
  note: '',
  customFields: {},
};

export function useCustomerForm(
  options?: Omit<UseFormProps<CustomerFormValues>, 'resolver'>,
) {
  return useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: customerDefaultValues,
    ...options,
  });
}

export function mapCustomerToFormValues(entity: Customer): CustomerFormValues {
  return {
    customerCode: entity.customerCode,
    name: entity.name,
    businessType: entity.businessType,
    businessRegistrationCode: entity.businessRegistrationCode,
    imageUrl: entity.imageUrl ?? '',
    countryCode: entity.countryCode,
    regionCode: entity.regionCode ?? '',
    regionName: entity.regionName,
    status: entity.status,
    phone: entity.phone,
    email: entity.email,
    addressDetail: entity.addressDetail,
    note: entity.note,
    customFields: entity.customFields,
  };
}

interface CustomerFormProps {
  form: UseFormReturn<CustomerFormValues>;
  onSubmit: (values: CustomerFormValues) => void;
  id?: string;
  mode: 'create' | 'edit';
  regionCodeOptions: { value: string; label: string }[];
  onImageUrlFileChange?: (file: File | null) => void;
  customFields?: CustomField[];
  onAddCustomField?: () => void;
  onReloadCustomFields?: () => void;
  isReloadingCustomFields?: boolean;
}

export function CustomerForm({
  form,
  onSubmit,
  id = 'customer-form',
  mode,
  regionCodeOptions,
  onImageUrlFileChange,
  customFields = [],
  onAddCustomField,
  onReloadCustomFields,
  isReloadingCustomFields = false,
}: CustomerFormProps) {
  const countryCode = form.watch('countryCode');
  const activeCustomFields = customFields.filter(
    (customField) => customField.isActive,
  );
  return (
    <Form {...form}>
      <form
        id={id}
        className="h-full min-h-0"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="grid min-h-0 grid-cols-1 gap-6 lg:h-full lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)]">
          <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pe-1">
            <div className="space-y-5">
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ImageUploadField
                        value={field.value}
                        onValueChange={field.onChange}
                        onFileChange={onImageUrlFileChange}
                        accept="image/png,image/jpeg,image/webp"
                        maxSizeMb={5}
                        label="Ảnh khách hàng"
                        fallbackText="K"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Mã khách hàng<span className="text-destructive"> *</span>
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Tên khách hàng<span className="text-destructive"> *</span>
                    </FormLabel>
                    <FormControl>
                      <Input variant="md" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="min-w-0 lg:min-h-0">
            <Tabs
              defaultValue="general"
              className="flex min-h-0 flex-col lg:h-full"
            >
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="general">Thông tin chung</TabsTrigger>
                <TabsTrigger value="custom">Thông tin bổ sung</TabsTrigger>
              </TabsList>

              <TabsContent
                value="general"
                className="mt-5 min-h-0 lg:flex-1 lg:overflow-y-auto lg:pe-1"
              >
                <div className="space-y-5 px-1 pb-1">
                  <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="businessType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Loại hình đơn vị</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {businessTypeOptions.map((opt) => (
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
                      name="businessRegistrationCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mã số thuế / QHNS / ĐKKD</FormLabel>
                          <FormControl>
                            <Input variant="md" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="countryCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quốc gia</FormLabel>
                          <FormControl>
                            <CountrySelect
                              value={field.value}
                              options={countryCodeOptions}
                              onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue('regionCode', '');
                                form.setValue('regionName', '');
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="regionCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tỉnh/Thành phố</FormLabel>
                          <FormControl>
                            <VietnamRegionSelect
                              value={field.value}
                              onValueChange={field.onChange}
                              options={regionCodeOptions}
                              disabled={countryCode !== 'VN'}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="regionName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tỉnh/Bang/Khu vực</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Nhập khu vực hành chính"
                              variant="md"
                              disabled={countryCode === 'VN'}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {mode === 'edit' && (
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Trạng thái</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {statusOptions.map((opt) => (
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
                    )}

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Số điện thoại</FormLabel>
                          <FormControl>
                            <Input type="tel" variant="md" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" variant="md" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="addressDetail"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Địa chỉ chi tiết</FormLabel>
                          <FormControl>
                            <Input variant="md" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Ghi chú</FormLabel>
                          <FormControl>
                            <Textarea rows={3} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="custom"
                className="mt-5 min-h-0 lg:flex-1 lg:overflow-y-auto lg:pe-1"
              >
                <div className="space-y-5 px-1 pb-1">
                  {activeCustomFields.length > 0 ? (
                    <div className="space-y-5">
                      {activeCustomFields.map((customField) => (
                        <CustomerCustomFieldInput
                          key={customField.id}
                          form={form}
                          customField={customField}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Chưa có trường bổ sung cho khách hàng.
                      </p>
                      {onAddCustomField || onReloadCustomFields ? (
                        <div className="flex items-center gap-2">
                          {onAddCustomField ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={onAddCustomField}
                            >
                              <Plus className="size-4" />
                              Thêm trường
                            </Button>
                          ) : null}
                          {onReloadCustomFields ? (
                            <Button
                              type="button"
                              variant="outline"
                              mode="icon"
                              size="sm"
                              aria-label="Tải lại trường bổ sung"
                              title="Tải lại trường bổ sung"
                              disabled={isReloadingCustomFields}
                              onClick={onReloadCustomFields}
                            >
                              <RefreshCw
                                className={
                                  isReloadingCustomFields
                                    ? 'animate-spin'
                                    : undefined
                                }
                              />
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </form>
    </Form>
  );
}

type CustomerCustomFieldName = `customFields.${string}`;

function CustomerCustomFieldInput({
  form,
  customField,
}: {
  form: UseFormReturn<CustomerFormValues>;
  customField: CustomField;
}) {
  const fieldName =
    `customFields.${customField.key}` as CustomerCustomFieldName;

  return (
    <FormField
      control={form.control}
      name={fieldName as never}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {customField.label}
            {customField.isRequired ? (
              <span className="text-destructive"> *</span>
            ) : null}
          </FormLabel>
          {customField.fieldType === 'select' ? (
            <Select
              value={(field.value as string) || undefined}
              onValueChange={field.onChange}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue
                    placeholder={`Chọn ${customField.label.toLowerCase()}`}
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {customField.options
                  .filter((option) => option.isActive)
                  .map((option) => (
                    <SelectItem key={option.id} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <FormControl>
              <Input
                type={customField.fieldType === 'number' ? 'number' : 'text'}
                variant="md"
                {...field}
              />
            </FormControl>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: UseFormReturn<CustomerFormValues>;
  onSubmit: (values: CustomerFormValues) => void;
  isSaving?: boolean;
  title?: string;
  regionCodeOptions: { value: string; label: string }[];
  onImageUrlFileChange?: (file: File | null) => void;
  customFields?: CustomField[];
  onAddCustomField?: () => void;
  onReloadCustomFields?: () => void;
  isReloadingCustomFields?: boolean;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onSubmit,
  isSaving = false,
  title,
  regionCodeOptions,
  onImageUrlFileChange,
  customFields = [],
  onAddCustomField,
  onReloadCustomFields,
  isReloadingCustomFields = false,
}: CustomerFormDialogProps) {
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
          size="large"
          className="flex h-[min(90dvh,760px)] flex-col gap-0 overflow-hidden p-0"
          onKeyDown={handleDialogKeyDown}
        >
          <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 text-start">
            <DialogTitle>{title ?? 'Thêm khách hàng'}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
            <CustomerForm
              form={form}
              onSubmit={onSubmit}
              id="customer-form"
              mode={mode}
              regionCodeOptions={regionCodeOptions}
              onImageUrlFileChange={onImageUrlFileChange}
              customFields={customFields}
              onAddCustomField={onAddCustomField}
              onReloadCustomFields={onReloadCustomFields}
              isReloadingCustomFields={isReloadingCustomFields}
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
                form="customer-form"
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
