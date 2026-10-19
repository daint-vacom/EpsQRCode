import type { MaterialSpecificationOption } from '@/project/material-specifications/model/material-specification';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import { materialModelSpecificationSchema } from '../model/material-model';
import { MaterialModelSpecificationValues } from './material-model-specification-values';

function renderColorValues(
  values: string[],
  onChange: (nextValues: string[]) => void,
  valueLabels: string[] = [],
  onValueLabelsChange?: (labels: string[]) => void,
  suggestions: MaterialSpecificationOption[] = [],
  mode: 'model' | 'material' = 'model',
) {
  return render(
    <IntlProvider
      locale="vi"
      messages={{
        'materialSpecifications.fields.colorPicker': 'Mở bảng chọn màu',
        'materialModels.specifications.addValue': 'Thêm giá trị',
        'materialModels.specifications.addValuePlaceholder': 'Nhập giá trị',
        'materialModels.specifications.colorLabel': 'Tên màu',
        'materialModels.specifications.chooseSuggestion': 'Chọn giá trị gợi ý',
        'materialModels.specifications.removeValue': 'Xóa giá trị {index}',
        'materialModels.specifications.values': 'Giá trị',
      }}
    >
      <MaterialModelSpecificationValues
        mode={mode}
        dataType="color"
        isList
        values={values}
        valueLabels={valueLabels}
        suggestions={suggestions}
        rowIndex={0}
        onChange={onChange}
        onValueLabelsChange={onValueLabelsChange}
      />
    </IntlProvider>,
  );
}

describe('material model color values editor', () => {
  it('adds the default color without requiring a color selection first', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onValueLabelsChange = vi.fn();

    renderColorValues([], onChange, [], onValueLabelsChange);

    await user.click(screen.getByRole('button', { name: 'Thêm giá trị' }));

    expect(onChange).toHaveBeenCalledWith(['#1677ff']);
    expect(onValueLabelsChange).toHaveBeenCalledWith(['']);
  });

  it('lets the user edit an existing color from the color picker', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderColorValues(['#1677ff'], onChange);

    await user.click(screen.getByRole('button', { name: 'Mở bảng chọn màu' }));
    await user.click(await screen.findByRole('button', { name: 'Đỏ' }));

    expect(onChange).toHaveBeenCalledWith(['#f44336']);
  });

  it('allows an empty color name', () => {
    expect(
      materialModelSpecificationSchema.safeParse({
        id: 'e4f3dbea-94e2-4c31-a4db-f497405beed8',
        dataType: 'color',
        name: 'Màu sắc',
        isList: false,
        valueLabels: [],
        values: ['#1677ff'],
      }).success,
    ).toBe(true);
  });

  it('copies the optional color name when selecting a catalog suggestion', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onValueLabelsChange = vi.fn();

    renderColorValues(['#1677ff'], onChange, [''], onValueLabelsChange, [
      {
        id: 'e4f3dbea-94e2-4c31-a4db-f497405beed8',
        label: '#2196f3',
        name: 'Xanh Huyền Bí',
      },
    ]);

    await user.click(
      screen.getByRole('button', {
        name: 'Giá trị 1.1 - Chọn giá trị gợi ý',
      }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: 'Xanh Huyền Bí' }),
    );

    expect(onChange).toHaveBeenCalledWith(['#2196f3']);
    expect(onValueLabelsChange).toHaveBeenCalledWith(['Xanh Huyền Bí']);
  });

  it('shows vertical rows with editable labels for every color', () => {
    const onChange = vi.fn();
    const onValueLabelsChange = vi.fn();

    renderColorValues(
      ['#f44336', '#2196f3'],
      onChange,
      ['Đỏ', 'Xanh'],
      onValueLabelsChange,
    );

    const colorName = screen.getByRole('textbox', { name: 'Tên màu 2' });
    expect(colorName).toHaveAttribute('placeholder', 'Tên màu');
    expect(colorName).toHaveClass('border-b', 'rounded-none', 'bg-transparent');
    expect(screen.queryByText('Tên màu')).not.toBeInTheDocument();
    fireEvent.change(colorName, { target: { value: 'Xanh Huyền Bí' } });

    expect(onValueLabelsChange).toHaveBeenLastCalledWith([
      'Đỏ',
      'Xanh Huyền Bí',
    ]);
    const firstRow = screen.getByRole('button', {
      name: 'Xóa giá trị 1',
    }).parentElement?.parentElement;
    expect(firstRow).toHaveClass('flex', 'w-full', 'items-center');
    expect(firstRow?.parentElement).toHaveClass('flex-col');
  });

  it('uses a single suggested color as the material color input value', () => {
    renderColorValues(
      [],
      vi.fn(),
      [],
      undefined,
      [
        {
          id: 'e4f3dbea-94e2-4c31-a4db-f497405beed8',
          label: '#2196f3',
          name: 'Xanh Huyền Bí',
        },
      ],
      'material',
    );

    expect(
      screen.queryByRole('checkbox', { name: 'Xanh Huyền Bí' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mở bảng chọn màu' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Tên màu 1' })).toHaveValue(
      'Xanh Huyền Bí',
    );
  });

  it('shows multiple color suggestions as selectable vertical rows with labels in material mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onValueLabelsChange = vi.fn();

    renderColorValues(
      [],
      onChange,
      [],
      onValueLabelsChange,
      [
        {
          id: 'e4f3dbea-94e2-4c31-a4db-f497405beed8',
          label: '#2196f3',
          name: 'Xanh Huyền Bí',
        },
        {
          id: 'f235be2a-a02f-46bc-b457-3c4b0f1db340',
          label: '#f44336',
          name: 'Đỏ',
        },
      ],
      'material',
    );

    const suggestion = screen.getByRole('checkbox', {
      name: 'Xanh Huyền Bí',
    });
    expect(suggestion).not.toBeChecked();
    expect(screen.getByText('Xanh Huyền Bí')).toBeInTheDocument();
    await user.click(suggestion);

    expect(onChange).toHaveBeenCalledWith(['#2196f3']);
  });

  it('adds a default color without a leading swatch and lets its label be edited', async () => {
    const onChange = vi.fn();
    const onValueLabelsChange = vi.fn();
    const { container } = renderColorValues(
      ['#1677ff'],
      onChange,
      [''],
      onValueLabelsChange,
      [
        {
          id: 'e4f3dbea-94e2-4c31-a4db-f497405beed8',
          label: '#2196f3',
          name: 'Xanh Huyền Bí',
        },
        {
          id: 'f235be2a-a02f-46bc-b457-3c4b0f1db340',
          label: '#f44336',
          name: 'Đỏ',
        },
      ],
      'material',
    );

    const addButton = screen.getByRole('button', { name: 'Thêm giá trị' });
    expect(addButton.previousElementSibling).toBeNull();
    expect(
      container.querySelector('input[placeholder="Tên màu"]'),
    ).toBeTruthy();
    const labelInput = screen.getByRole('textbox', { name: 'Tên màu 1' });
    fireEvent.change(labelInput, { target: { value: 'Xanh mặc định' } });

    expect(onValueLabelsChange).toHaveBeenLastCalledWith(['Xanh mặc định']);
  });

  it('removes a color and its label together', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onValueLabelsChange = vi.fn();

    renderColorValues(
      ['#f44336', '#2196f3'],
      onChange,
      ['Đỏ', 'Xanh'],
      onValueLabelsChange,
    );

    await user.click(screen.getByRole('button', { name: 'Xóa giá trị 1' }));

    expect(onChange).toHaveBeenCalledWith(['#2196f3']);
    expect(onValueLabelsChange).toHaveBeenCalledWith(['Xanh']);
    expect(
      screen.getAllByRole('button', { name: 'Mở bảng chọn màu' }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Xóa giá trị 1' }).parentElement,
    ).toHaveClass('group/color', 'relative', 'size-9');
    const firstRow = screen.getByRole('button', {
      name: 'Xóa giá trị 1',
    }).parentElement?.parentElement;
    expect(firstRow?.parentElement).toHaveClass('flex-col');
    expect(screen.getByRole('button', { name: 'Xóa giá trị 1' })).toHaveClass(
      'group-hover/color:opacity-100',
    );
  });
});
