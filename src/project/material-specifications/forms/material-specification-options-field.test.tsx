import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { IntlProvider } from 'react-intl';
import { describe, expect, it } from 'vitest';
import { Form } from '@/components/ui/form';
import {
  materialSpecificationDefaultValues,
  materialSpecificationFormSchema,
} from '../model/material-specification';
import type { MaterialSpecificationFormValues } from '../model/material-specification';
import { MaterialSpecificationOptionsField } from './material-specification-options-field';

function ColorOptionsForm() {
  const form = useForm<MaterialSpecificationFormValues>({
    defaultValues: {
      ...materialSpecificationDefaultValues,
      dataType: 'color',
      options: [
        {
          id: 'e4f3dbea-94e2-4c31-a4db-f497405beed8',
          label: '#1677ff',
        },
      ],
    },
  });

  return (
    <IntlProvider
      locale="vi"
      messages={{
        'materialSpecifications.actions.addOption': 'Thêm giá trị',
        'materialSpecifications.actions.removeOption': 'Xóa giá trị',
        'materialSpecifications.fields.colorPicker': 'Chọn màu',
        'materialSpecifications.fields.defaultValue': 'Giá trị mặc định',
        'materialSpecifications.fields.optionPlaceholder': 'Giá trị gợi ý',
        'materialSpecifications.fields.options': 'Giá trị gợi ý',
        'materialSpecifications.fields.optionsEmpty': 'Chưa có giá trị',
        'materialModels.specifications.colorLabel': 'Tên màu',
      }}
    >
      <Form {...form}>
        <MaterialSpecificationOptionsField form={form} />
      </Form>
    </IntlProvider>
  );
}

describe('material specification color options', () => {
  it('renders an optional ghost-underline name input for each suggested color', () => {
    render(<ColorOptionsForm />);

    const colorName = screen.getByRole('textbox', { name: 'Tên màu 1' });
    expect(colorName).toHaveAttribute('placeholder', 'Tên màu');
    expect(colorName).toHaveClass('border-b', 'rounded-none', 'bg-transparent');

    fireEvent.change(colorName, { target: { value: 'Xanh Huyền Bí' } });
    expect(colorName).toHaveValue('Xanh Huyền Bí');
  });

  it('accepts a color suggestion without a name', () => {
    const result = materialSpecificationFormSchema.safeParse({
      ...materialSpecificationDefaultValues,
      code: 'TS-00123',
      codeMode: 'manual',
      name: 'Màu sắc',
      dataType: 'color',
      options: [
        {
          id: 'e4f3dbea-94e2-4c31-a4db-f497405beed8',
          label: '#1677ff',
          name: '',
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
