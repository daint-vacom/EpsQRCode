import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { ColorInput } from '@/components/ui/color-input';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { OptionSelect } from '@/components/ui/option-select';
import type {
  MaterialSpecificationDataType,
  MaterialSpecificationFormValues,
  MaterialSpecificationOption,
} from '../model/material-specification';
import { getMaterialSpecificationUnits } from '../model/material-specification';

const booleanOptions = [
  { value: 'true', label: 'Có' },
  { value: 'false', label: 'Không' },
];

export function MaterialSpecificationOptionsField({
  form,
}: {
  form: UseFormReturn<MaterialSpecificationFormValues>;
}) {
  const intl = useIntl();
  const dataType = useWatch({ control: form.control, name: 'dataType' });
  const options = useWatch({ control: form.control, name: 'options' }) ?? [];
  const unit = useWatch({ control: form.control, name: 'unit' }) ?? '';
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'options',
  });
  return (
    <>
      <FormField
        control={form.control}
        name="options"
        render={() => (
          <FormItem
            className="md:col-span-12"
            layout="horizontal"
            labelWidth="md"
          >
            <FormLabel>
              {intl.formatMessage({
                id: 'materialSpecifications.fields.options',
              })}
            </FormLabel>
            <div className="space-y-3">
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {intl.formatMessage({
                    id: 'materialSpecifications.fields.optionsEmpty',
                  })}
                </p>
              ) : null}
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-2"
                >
                  <FormField
                    control={form.control}
                    name={`options.${index}.label` as const}
                    render={({ field: optionField }) => (
                      <FormItem variant="compact">
                        <FormControl>
                          {dataType === 'color' ? (
                            <ColorInput
                              value={optionField.value}
                              onValueChange={optionField.onChange}
                              onBlur={optionField.onBlur}
                              aria-label={`${intl.formatMessage({
                                id: 'materialSpecifications.fields.optionPlaceholder',
                              })} ${index + 1}`}
                              pickerLabel={intl.formatMessage({
                                id: 'materialSpecifications.fields.colorPicker',
                              })}
                              variant="md"
                            />
                          ) : dataType === 'boolean' ? (
                            <OptionSelect
                              value={optionField.value}
                              onChange={optionField.onChange}
                              options={booleanOptions}
                              searchable={false}
                              aria-label={`${intl.formatMessage({
                                id: 'materialSpecifications.fields.optionPlaceholder',
                              })} ${index + 1}`}
                            />
                          ) : (
                            <Input
                              {...optionField}
                              type={
                                dataType === 'date'
                                  ? 'date'
                                  : ['number', 'length', 'weight'].includes(
                                        dataType,
                                      )
                                    ? 'number'
                                    : 'text'
                              }
                              step={
                                ['number', 'length', 'weight'].includes(
                                  dataType,
                                )
                                  ? 'any'
                                  : undefined
                              }
                              aria-label={`${intl.formatMessage({
                                id: 'materialSpecifications.fields.optionPlaceholder',
                              })} ${index + 1}`}
                              placeholder={intl.formatMessage({
                                id: 'materialSpecifications.fields.optionPlaceholder',
                              })}
                              variant="md"
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    appearance="ghost"
                    mode="icon"
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'materialSpecifications.actions.removeOption',
                    })}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {form.formState.errors.options?.message && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.options.message}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    id: crypto.randomUUID(),
                    label: dataType === 'color' ? '#1677ff' : '',
                  })
                }
              >
                <Plus />
                {intl.formatMessage({
                  id: 'materialSpecifications.actions.addOption',
                })}
              </Button>
            </div>
          </FormItem>
        )}
      />

      <DefaultValueField
        form={form}
        dataType={dataType}
        options={options}
        unit={unit}
      />
    </>
  );
}

function DefaultValueField({
  form,
  dataType,
  options,
  unit,
}: {
  form: UseFormReturn<MaterialSpecificationFormValues>;
  dataType: MaterialSpecificationDataType;
  options: MaterialSpecificationOption[];
  unit: string;
}) {
  const intl = useIntl();
  const selectOptions = options.map((option) => ({
    value: option.id,
    label: option.label,
  }));

  return (
    <FormField
      control={form.control}
      name="defaultValue"
      render={({ field }) => (
        <FormItem
          className="md:col-span-12"
          layout="horizontal"
          labelWidth="md"
        >
          <FormLabel>
            {intl.formatMessage({
              id: 'materialSpecifications.fields.defaultValue',
            })}
          </FormLabel>
          <FormControl>
            {Array.isArray(field.value) ? (
              <MultiSelect
                value={field.value}
                onChange={field.onChange}
                options={selectOptions}
                className="w-full"
                size="md"
              />
            ) : dataType === 'boolean' ? (
              <OptionSelect
                value={
                  typeof field.value === 'boolean' ? String(field.value) : ''
                }
                onChange={(value) =>
                  field.onChange(value ? value === 'true' : null)
                }
                options={booleanOptions}
                searchable={false}
              />
            ) : ['number', 'length', 'weight'].includes(dataType) ? (
              <div className="flex w-full gap-2">
                <Input
                  type="number"
                  step="any"
                  value={
                    typeof field.value === 'object' && field.value !== null
                      ? field.value.amount
                      : ''
                  }
                  onChange={(event) => {
                    const amount =
                      event.target.value === ''
                        ? null
                        : Number(event.target.value);
                    field.onChange(
                      amount === null
                        ? null
                        : {
                            amount,
                            unit: unit || undefined,
                          },
                    );
                  }}
                />
                {dataType === 'length' || dataType === 'weight' ? (
                  <OptionSelect
                    value={unit}
                    onChange={(value) => {
                      form.setValue('unit', value, { shouldDirty: true });
                      if (
                        typeof field.value === 'object' &&
                        field.value !== null &&
                        'amount' in field.value
                      ) {
                        field.onChange({ ...field.value, unit: value });
                      }
                    }}
                    options={getMaterialSpecificationUnits(dataType).map(
                      (value) => ({ value, label: value }),
                    )}
                    searchable={false}
                    className="w-32 shrink-0"
                  />
                ) : null}
              </div>
            ) : dataType === 'color' ? (
              <ColorInput
                value={typeof field.value === 'string' ? field.value : ''}
                onValueChange={field.onChange}
                pickerLabel={intl.formatMessage({
                  id: 'materialSpecifications.fields.colorPicker',
                })}
                variant="md"
              />
            ) : (
              <Input
                type={dataType === 'date' ? 'date' : 'text'}
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={(event) => field.onChange(event.target.value || null)}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
