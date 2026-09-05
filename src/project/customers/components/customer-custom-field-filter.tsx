import type { CustomField } from '@/project/data-configuration/model/custom-field';
import type { UseFormReturn } from 'react-hook-form';
import { cn } from '@/lib/utils';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/inputs/search-input';
import {
  OptionSelect,
  type OptionSelectProps,
} from '@/components/ui/option-select';
import type { CustomerFilterFormValues } from '../model/customer';

export function getCustomerCustomFieldDisplayValue(
  field: CustomField,
  value: string,
): string {
  if (!value) return 'Chưa có dữ liệu';
  if (field.fieldType !== 'select') return value;
  return field.options.find((option) => option.value === value)?.label ?? value;
}

export function CustomerCustomFieldColumnFilter({
  field,
  value,
  onChange,
  disabled = false,
  className,
}: {
  field: CustomField;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (field.fieldType === 'select') {
    return (
      <OptionSelect
        value={value}
        onChange={onChange}
        options={field.options
          .filter((option) => option.isActive)
          .map((option) => ({ value: option.value, label: option.label }))}
        placeholder="Tất cả"
        searchable={false}
        canDeselect
        ariaLabel={`Lọc theo ${field.label}`}
        size="sm"
        disabled={disabled}
        className={cn('min-w-0 bg-background', className)}
      />
    );
  }

  return (
    <SearchInput
      value={value}
      onSearch={onChange}
      debounceMs={300}
      placeholder=""
      aria-label={`Tìm theo ${field.label}`}
      variant="sm"
      className={cn('min-w-0 w-full shrink-0 bg-background', className)}
      disabled={disabled}
    />
  );
}

type CustomFieldFormProps = {
  form: UseFormReturn<CustomerFilterFormValues>;
  customFields: CustomField[];
};

export function CustomerCustomFieldFilterFields({
  form,
  customFields,
}: CustomFieldFormProps) {
  const activeFields = customFields.filter((field) => field.isActive);
  if (activeFields.length === 0) return null;

  return (
    <div className="contents">
      <div className="md:col-span-12 pt-1 text-sm font-semibold text-foreground">
        Thông tin bổ sung
      </div>
      {activeFields.map((customField) => {
        const name = `customFields.${customField.key}` as never;
        return (
          <FormField
            key={customField.id}
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>{customField.label}</FormLabel>
                <FormControl>
                  {customField.fieldType === 'select' ? (
                    <OptionSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={customField.options
                        .filter((option) => option.isActive)
                        .map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                      placeholder="Chọn giá trị"
                      searchPlaceholder={`Tìm ${customField.label.toLowerCase()}...`}
                      ariaLabel={customField.label}
                      size="md"
                      aria-invalid={!!fieldState.error}
                    />
                  ) : (
                    <Input
                      type={
                        customField.fieldType === 'number' ? 'number' : 'text'
                      }
                      placeholder={`Nhập ${customField.label.toLowerCase()}`}
                      variant="md"
                      {...field}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      })}
    </div>
  );
}

export type CustomerCustomFieldOptionSelectSize = OptionSelectProps['size'];
