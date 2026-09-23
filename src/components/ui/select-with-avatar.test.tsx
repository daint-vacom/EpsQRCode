import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { IDENTITY_AVATAR_TONES } from '@/components/common/gradient-avatar';
import {
  SelectWithAvatar,
  type SelectWithAvatarOption,
} from './select-with-avatar';

const OPTIONS: SelectWithAvatarOption[] = [
  {
    value: 'employee-1',
    label: 'Trần Minh',
    code: 'NV-01',
    avatarFallback: 'TM',
    avatarTone: IDENTITY_AVATAR_TONES.employee,
  },
];

describe('SelectWithAvatar', () => {
  it('uses the compact md layout without showing the business code', () => {
    render(
      <SelectWithAvatar
        value="employee-1"
        options={OPTIONS}
        placeholder="Chọn nhân viên"
      />,
    );

    const trigger = screen.getByRole('combobox');

    expect(trigger).toHaveTextContent('Trần Minh');
    expect(trigger).not.toHaveTextContent('NV-01');
    expect(trigger).toHaveClass('border-input', 'shadow-xs');
    expect(screen.getByText('TM')).toHaveClass('from-[#ecf0f1]');
    expect(screen.getByText('TM').closest('[data-slot="avatar"]')).toHaveClass(
      'size-6',
      'rounded-lg',
    );
  });

  it('shows the shared identity tooltip from the base selector', async () => {
    const user = userEvent.setup();

    render(
      <SelectWithAvatar
        value="employee-1"
        options={OPTIONS}
        placeholder="Chọn nhân viên"
      />,
    );

    await user.hover(screen.getByText('Trần Minh'));

    expect(
      await screen.findByRole('tooltip', { name: 'NV-01 - Trần Minh' }),
    ).toBeInTheDocument();
  });

  it('keeps the popover identity layout independent from the trigger size', async () => {
    const user = userEvent.setup();

    render(
      <SelectWithAvatar
        value="employee-1"
        options={OPTIONS}
        size="md"
        variant="normal"
      />,
    );

    await user.click(screen.getByRole('combobox'));

    expect(
      screen.getByRole('option', { name: /Trần MinhNV-01/ }),
    ).toBeInTheDocument();
  });

  it('uses the large ghost layout with the avatar code underneath', () => {
    render(
      <SelectWithAvatar
        value="employee-1"
        options={OPTIONS}
        size="lg"
        variant="ghost"
      />,
    );

    const trigger = screen.getByRole('combobox');

    expect(trigger).toHaveTextContent('Trần Minh');
    expect(trigger).toHaveTextContent('NV-01');
    expect(trigger).toHaveClass(
      'min-h-14',
      'border-transparent',
      'bg-transparent',
    );
  });
});
