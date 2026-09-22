/**
 * Scaffolded by form-builder from `src/project/customers/forms/customer.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — keep create and edit dialog state separate in the parent. Create forms
 * keep their draft when closed; edit forms reset after the selected entity is assigned on the next
 * open. Never clear the selected entity or reset the form while an edit dialog is closing. To change
 * fields, widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits.
 * Do not hand-edit this banner or the generated options consts — that's how review detects a
 * bypassed builder.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import { TagSelect } from '@/project/tags/components/tag-select';
import type { SoftwareAccountCatalog } from '@/project/tags/model/software-account-catalog';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, MapPin, Plus, RefreshCw, UserRound } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import type {
  ControllerRenderProps,
  FieldErrors,
  Path,
  UseFormProps,
  UseFormReturn,
} from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import { FormSection } from '@/components/ui/form-section';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getAvatarInitials } from '@/components/common/avatar-identity';
import { IDENTITY_AVATAR_TONES } from '@/components/common/gradient-avatar';
import { CustomerResponsibilityTab } from '../components/customer-responsibility-tab';
import { CustomerSoftwareAccountsEditorTable } from '../components/customer-software-accounts-editor.generated';
import {
  createEmptyCustomerSoftwareAccount,
  customerFormSchema,
  type Customer,
  type CustomerFormValues,
} from '../model/customer';
import type { CustomerResponsibilityAssignmentInput } from '../model/customer-responsibility';

const businessTypeOptions = [
  { value: 'individual', label: 'Cá nhân' },
  { value: 'household', label: 'Hộ kinh doanh' },
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
  { value: 'uncontacted', label: 'Chưa liên hệ' },
];

const vatDeclarationPeriodOptions = [
  { value: 'monthly', label: 'Theo tháng' },
  { value: 'quarterly', label: 'Theo quý' },
  { value: 'yearly', label: 'Theo năm' },
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
  districtName: '',
  wardName: '',
  streetAddress: '',
  status: 'active',
  phone: '',
  email: '',
  addressDetail: '',
  contactName: '',
  contactTitle: '',
  establishedDate: null,
  vatDeclarationPeriod: '',
  customerGroupTagIds: [],
  softwareAccounts: [],
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
    districtName: entity.districtName,
    wardName: entity.wardName,
    streetAddress: entity.streetAddress,
    status: entity.status,
    phone: entity.phone,
    email: entity.email,
    addressDetail: entity.addressDetail,
    contactName: entity.contactName,
    contactTitle: entity.contactTitle,
    establishedDate: entity.establishedDate
      ? new Date(`${entity.establishedDate}T00:00:00`)
      : null,
    vatDeclarationPeriod:
      entity.vatDeclarationPeriod === 'unspecified'
        ? ''
        : entity.vatDeclarationPeriod,
    customerGroupTagIds: [],
    softwareAccounts: [],
    customFields: entity.customFields,
  };
}

export interface CustomerResponsibilityFormContext {
  tenantId: string;
  customerId: string;
  canManage: boolean;
  isValid: boolean;
  draftAssignments: CustomerResponsibilityAssignmentInput[] | null;
  onAssignmentsChange: (
    assignments: CustomerResponsibilityAssignmentInput[],
  ) => void;
  onValidationChange?: (isValid: boolean) => void;
}

interface CustomerFormProps {
  form: UseFormReturn<CustomerFormValues>;
  onSubmit: (values: CustomerFormValues) => void;
  activeTab: CustomerFormTab;
  onActiveTabChange: (tab: CustomerFormTab) => void;
  onValidationError: (errors: FieldErrors<CustomerFormValues>) => void;
  id?: string;
  mode: 'create' | 'edit';
  regionCodeOptions: { value: string; label: string }[];
  onImageUrlFileChange?: (file: File | null) => void;
  customFields?: CustomField[];
  onAddCustomField?: () => void;
  onReloadCustomFields?: () => void;
  isReloadingCustomFields?: boolean;
  customerResponsibility?: CustomerResponsibilityFormContext;
  softwareAccountCatalogs?: SoftwareAccountCatalog[];
}

export function CustomerForm({
  form,
  onSubmit,
  activeTab,
  onActiveTabChange,
  onValidationError,
  id = 'customer-form',
  mode,
  regionCodeOptions,
  onImageUrlFileChange,
  customFields = [],
  onAddCustomField,
  onReloadCustomFields,
  isReloadingCustomFields = false,
  customerResponsibility,
  softwareAccountCatalogs = [],
}: CustomerFormProps) {
  const formErrors = form.formState.errors;
  const tabErrorCounts = {
    general: getCustomerFormTabErrorCount(formErrors, 'general'),
    custom: getCustomerFormTabErrorCount(formErrors, 'custom'),
    softwareAccounts: getCustomerFormTabErrorCount(
      formErrors,
      'softwareAccounts',
    ),
  };
  const countryCode = form.watch('countryCode');
  const activeCustomFields = customFields.filter(
    (customField) => customField.isActive,
  );
  return (
    <Form {...form}>
      <form
        id={id}
        className="min-h-0 lg:h-full"
        onSubmit={form.handleSubmit(onSubmit, onValidationError)}
      >
        <div className="grid min-h-0 grid-cols-1 gap-6 lg:h-full lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)]">
          <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:ps-1 lg:pe-1">
            <div className="space-y-4 pb-5 lg:pb-6">
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <CustomerAvatarUploadField
                        form={form}
                        field={field}
                        onFileChange={onImageUrlFileChange}
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
                name="customerGroupTagIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhóm khách hàng</FormLabel>
                    <FormControl>
                      <TagSelect
                        value={field.value}
                        onChange={field.onChange}
                        moduleCodes={['customers']}
                        allowCustomGroups={false}
                        placeholder="Chọn nhóm khách hàng"
                        searchPlaceholder="Tìm nhóm khách hàng..."
                        emptyMessage="Không tìm thấy nhóm khách hàng"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="min-w-0 lg:min-h-0">
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                onActiveTabChange(value as CustomerFormTab)
              }
              className="flex min-h-0 flex-col lg:h-full"
            >
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="general">
                  Thông tin chung
                  <CustomerFormTabErrorBadge count={tabErrorCounts.general} />
                </TabsTrigger>
                <TabsTrigger value="custom">
                  Thông tin bổ sung
                  <CustomerFormTabErrorBadge count={tabErrorCounts.custom} />
                </TabsTrigger>
                {mode === 'edit' && customerResponsibility ? (
                  <TabsTrigger value="responsibility">
                    Nhân viên phụ trách
                  </TabsTrigger>
                ) : null}
                <TabsTrigger value="softwareAccounts">
                  Tài khoản phần mềm
                  <CustomerFormTabErrorBadge
                    count={tabErrorCounts.softwareAccounts}
                  />
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="general"
                className="mt-5 min-h-0 lg:flex-1 lg:overflow-y-auto lg:pe-1"
              >
                <div className="space-y-10 px-1 pb-6">
                  <FormSection heading="Thông tin cơ bản" icon={Building2}>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
                      {mode === 'edit' && (
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
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
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                    >
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
                        name="establishedDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ngày thành lập</FormLabel>
                            <FormControl>
                              <DatePickerInput
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                calendarLabel="Chọn ngày thành lập"
                                valueMode="date"
                                variant="md"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="vatDeclarationPeriod"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>
                              Kỳ kê khai thuế GTGT
                              <span className="text-destructive"> *</span>
                            </FormLabel>
                            <FormControl>
                              <RadioGroup
                                value={field.value}
                                name={field.name}
                                onValueChange={field.onChange}
                                className="flex flex-wrap gap-x-6 gap-y-2"
                                aria-label="Kỳ kê khai thuế GTGT"
                              >
                                {vatDeclarationPeriodOptions.map((opt) => (
                                  <label
                                    key={opt.value}
                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                  >
                                    <RadioGroupItem value={opt.value} />
                                    <span>{opt.label}</span>
                                  </label>
                                ))}
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </FormSection>

                  <FormSection
                    heading="Thông tin người liên hệ"
                    icon={UserRound}
                  >
                    <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="contactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Người liên hệ</FormLabel>
                            <FormControl>
                              <Input variant="md" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="contactTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Chức danh</FormLabel>
                            <FormControl>
                              <Input variant="md" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                    </div>
                  </FormSection>

                  <FormSection heading="Thông tin địa chỉ" icon={MapPin}>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
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

                      {countryCode === 'VN' ? (
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
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (
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
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="districtName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quận/Huyện</FormLabel>
                            <FormControl>
                              <Input variant="md" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="wardName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phường/Xã</FormLabel>
                            <FormControl>
                              <Input variant="md" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="streetAddress"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Số nhà, tên đường</FormLabel>
                            <FormControl>
                              <Input variant="md" {...field} />
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
                            <FormLabel>Địa chỉ đầy đủ</FormLabel>
                            <FormControl>
                              <Input variant="md" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </FormSection>
                </div>
              </TabsContent>

              {mode === 'edit' && customerResponsibility ? (
                <TabsContent
                  value="responsibility"
                  className="mt-5 min-h-0 lg:flex-1 lg:overflow-y-auto lg:pe-1"
                >
                  <CustomerResponsibilityTab
                    tenantId={customerResponsibility.tenantId}
                    customerId={customerResponsibility.customerId}
                    canManage={customerResponsibility.canManage}
                    draftAssignments={customerResponsibility.draftAssignments}
                    onAssignmentsChange={
                      customerResponsibility.onAssignmentsChange
                    }
                    onValidationChange={
                      customerResponsibility.onValidationChange
                    }
                  />
                </TabsContent>
              ) : null}

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

              <TabsContent
                value="softwareAccounts"
                className="mt-5 min-h-0 lg:flex-1 lg:overflow-hidden"
              >
                <CustomerSoftwareAccountsEditorTable
                  form={form}
                  createRow={createEmptyCustomerSoftwareAccount}
                  catalogs={softwareAccountCatalogs}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </form>
    </Form>
  );
}

function CustomerAvatarUploadField({
  form,
  field,
  onFileChange,
}: {
  form: UseFormReturn<CustomerFormValues>;
  field: ControllerRenderProps<CustomerFormValues, 'imageUrl'>;
  onFileChange?: (file: File | null) => void;
}) {
  const customerName = useWatch({ control: form.control, name: 'name' });

  return (
    <ImageUploadField
      value={field.value}
      onValueChange={field.onChange}
      onFileChange={onFileChange}
      accept="image/png,image/jpeg,image/webp"
      maxSizeMb={5}
      label="Ảnh khách hàng"
      fallbackText={getAvatarInitials(customerName) || 'K'}
      fallbackTone={IDENTITY_AVATAR_TONES.customer}
    />
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
  title?: ReactNode;
  regionCodeOptions: { value: string; label: string }[];
  onImageUrlFileChange?: (file: File | null) => void;
  customFields?: CustomField[];
  onAddCustomField?: () => void;
  onReloadCustomFields?: () => void;
  isReloadingCustomFields?: boolean;
  customerResponsibility?: CustomerResponsibilityFormContext;
  softwareAccountCatalogs?: SoftwareAccountCatalog[];
  isSubmitDisabled?: boolean;
}

type CustomerFormTab =
  | 'general'
  | 'custom'
  | 'responsibility'
  | 'softwareAccounts';

function collectCustomerFormErrorPaths(
  errors: FieldErrors<CustomerFormValues>,
  prefix = '',
): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object') continue;

    const path = prefix ? `${prefix}.${key}` : key;
    const fieldError = value as { message?: unknown; type?: unknown };
    if (typeof fieldError.message === 'string' || fieldError.type) {
      paths.push(path);
      continue;
    }

    paths.push(
      ...collectCustomerFormErrorPaths(
        value as FieldErrors<CustomerFormValues>,
        path,
      ),
    );
  }

  return paths;
}

function findFirstCustomerFormErrorPath(
  errors: FieldErrors<CustomerFormValues>,
  prefix = '',
): string | undefined {
  return collectCustomerFormErrorPaths(errors, prefix)[0];
}

function getCustomerFormTabForError(path: string): CustomerFormTab | undefined {
  if (path.startsWith('customFields.')) return 'custom';
  if (path.startsWith('softwareAccounts.')) return 'softwareAccounts';

  const leftColumnFields = new Set([
    'imageUrl',
    'customerCode',
    'name',
    'businessRegistrationCode',
    'customerGroupTagIds',
  ]);
  if (
    leftColumnFields.has(path) ||
    [...leftColumnFields].some((field) => path.startsWith(`${field}.`))
  ) {
    return undefined;
  }

  return 'general';
}

function getCustomerFormTabErrorCount(
  errors: FieldErrors<CustomerFormValues>,
  tab: CustomerFormTab,
) {
  return collectCustomerFormErrorPaths(errors).filter(
    (path) => getCustomerFormTabForError(path) === tab,
  ).length;
}

function CustomerFormTabErrorBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="destructive"
          size="xs"
          shape="circle"
          className="size-4 min-w-4 p-0.5"
          tabIndex={0}
          aria-label={`Tab có ${count} lỗi`}
        >
          <span className="text-xs font-bold leading-none text-destructive-foreground!">
            !
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent variant="destructive">
        Có {count} lỗi cần kiểm tra
      </TooltipContent>
    </Tooltip>
  );
}

function focusCustomerFormError(
  form: UseFormReturn<CustomerFormValues>,
  path: string,
) {
  form.setFocus(path as Path<CustomerFormValues>);

  const focusSelector = `[name="${path.replaceAll('"', '\\"')}"]`;
  window.setTimeout(() => {
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(focusSelector)?.focus();
    });
  });
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
  customerResponsibility,
  softwareAccountCatalogs = [],
  isSubmitDisabled = false,
}: CustomerFormDialogProps) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CustomerFormTab>('general');
  const handledValidationErrorRef = useRef<string | null>(null);
  const firstErrorPath = findFirstCustomerFormErrorPath(form.formState.errors);

  const reportValidationError = useCallback(
    (errors: FieldErrors<CustomerFormValues>) => {
      const errorPath = findFirstCustomerFormErrorPath(errors);
      if (!errorPath) return;

      handledValidationErrorRef.current = errorPath;
      const errorTab = getCustomerFormTabForError(errorPath);
      if (errorTab) setActiveTab(errorTab);
      toast.error('Vui lòng kiểm tra lại thông tin trong biểu mẫu.');
      focusCustomerFormError(form, errorPath);
    },
    [form],
  );

  useEffect(() => {
    if (!open) {
      handledValidationErrorRef.current = null;
      return;
    }

    setActiveTab('general');
    handledValidationErrorRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!firstErrorPath) {
      handledValidationErrorRef.current = null;
      return;
    }

    if (handledValidationErrorRef.current === firstErrorPath) return;
    reportValidationError(form.formState.errors);
  }, [firstErrorPath, form.formState.errors, reportValidationError]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isSaving || isSubmitDisabled || !(event.ctrlKey || event.metaKey)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key !== 's' && key !== 'enter') return;

    event.preventDefault();
    void form.handleSubmit(onSubmit, reportValidationError)();
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
          className="flex flex-col gap-0 overflow-hidden p-0"
          onKeyDown={handleDialogKeyDown}
        >
          <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 text-start">
            <DialogTitle>{title ?? 'Thêm khách hàng'}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:overflow-hidden">
            <CustomerForm
              form={form}
              onSubmit={onSubmit}
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
              onValidationError={reportValidationError}
              id="customer-form"
              mode={mode}
              regionCodeOptions={regionCodeOptions}
              onImageUrlFileChange={onImageUrlFileChange}
              customFields={customFields}
              onAddCustomField={onAddCustomField}
              onReloadCustomFields={onReloadCustomFields}
              isReloadingCustomFields={isReloadingCustomFields}
              customerResponsibility={customerResponsibility}
              softwareAccountCatalogs={softwareAccountCatalogs}
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
                disabled={isSubmitDisabled}
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
