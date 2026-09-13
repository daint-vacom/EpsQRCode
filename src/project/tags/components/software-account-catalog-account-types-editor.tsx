import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  SoftwareAccountCatalogAccountType,
  SoftwareAccountCatalogFormValues,
} from '../model/software-account-catalog';

export function SoftwareAccountCatalogAccountTypesEditor({
  form,
}: {
  form: UseFormReturn<SoftwareAccountCatalogFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'accountTypes',
    keyName: 'fieldId',
  });
  const errors = form.formState.errors.accountTypes;

  const setDefault = (index: number, checked: boolean) => {
    const rows = form.getValues('accountTypes');
    rows.forEach((_, rowIndex) => {
      form.setValue(
        `accountTypes.${rowIndex}.isDefault`,
        checked && rowIndex === index,
        { shouldDirty: true, shouldValidate: true },
      );
    });
  };

  return (
    <div className="space-y-3 md:col-span-12">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Loại tài khoản</TableHead>
            <TableHead className="w-24 text-center">Mặc định</TableHead>
            <TableHead className="w-12" aria-hidden="true" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field, index) => (
            <TableRow key={field.fieldId}>
              <TableCell className="px-3 py-1.5">
                <Controller
                  control={form.control}
                  name={`accountTypes.${index}.name`}
                  render={({ field: inputField }) => (
                    <Input
                      {...inputField}
                      variant="ghost"
                      placeholder="Tên loại tài khoản"
                      aria-label={`Loại tài khoản dòng ${index + 1}`}
                      aria-invalid={Boolean(errors?.[index]?.name)}
                    />
                  )}
                />
              </TableCell>
              <TableCell className="px-3 py-1.5 text-center">
                <Controller
                  control={form.control}
                  name={`accountTypes.${index}.isDefault`}
                  render={({ field: checkboxField }) => (
                    <Checkbox
                      checked={checkboxField.value}
                      onCheckedChange={(checked) =>
                        setDefault(index, checked === true)
                      }
                      aria-label={`Đặt loại tài khoản dòng ${index + 1} làm mặc định`}
                    />
                  )}
                />
              </TableCell>
              <TableCell className="px-3 py-1.5">
                <Button
                  type="button"
                  variant="destructive"
                  appearance="ghost"
                  mode="icon"
                  size="sm"
                  aria-label={`Xóa loại tài khoản ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {typeof errors?.message === 'string' ? (
        <div className="-mt-0.5 text-xs font-normal text-destructive">
          {errors.message}
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({
            name: '',
            isDefault: fields.length === 0,
          } satisfies SoftwareAccountCatalogAccountType)
        }
      >
        <Plus className="size-4" />
        Thêm lựa chọn
      </Button>
    </div>
  );
}
