import { useState } from 'react';
import type { SoftwareAccountCatalog } from '@/project/tags/model/software-account-catalog';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SoftwareAccountCatalogSuggestionInput } from './software-account-catalog-suggestion-input';

const CATALOG: SoftwareAccountCatalog = {
  id: 'catalog-vashop',
  tenantId: 'tenant-1',
  groupId: 'group-1',
  name: 'Vashop',
  description: '',
  defaultAccessUrl: 'https://web.vashop.vn/',
  defaultUsername: 'admin',
  defaultPassword: 'secret',
  accountTypes: [],
  sortOrder: 0,
  isActive: true,
  hasDefaultPassword: true,
  createdAt: '',
  updatedAt: '',
};

function TestInput({
  onCatalogSelect = vi.fn(),
}: {
  onCatalogSelect?: (catalog: SoftwareAccountCatalog) => void;
}) {
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <SoftwareAccountCatalogSuggestionInput
        aria-label="Tên phần mềm"
        catalogs={[CATALOG]}
        onCatalogSelect={onCatalogSelect}
        onChange={() => undefined}
        value=""
      />
      <input aria-label="Trường khác" />
      <button type="submit">Lưu</button>
    </form>
  );
}

function ControlledInput() {
  const [value, setValue] = useState('');

  return (
    <SoftwareAccountCatalogSuggestionInput
      aria-label="Tên phần mềm"
      catalogs={[CATALOG]}
      onCatalogSelect={() => undefined}
      onChange={setValue}
      value={value}
    />
  );
}

describe('SoftwareAccountCatalogSuggestionInput', () => {
  it('selects the active suggestion with Enter instead of submitting the form', async () => {
    const user = userEvent.setup();
    const onCatalogSelect = vi.fn();
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <SoftwareAccountCatalogSuggestionInput
          aria-label="Tên phần mềm"
          catalogs={[CATALOG]}
          onCatalogSelect={onCatalogSelect}
          onChange={() => undefined}
          value=""
        />
      </form>,
    );

    const input = screen.getByRole('combobox', { name: 'Tên phần mềm' });
    await user.type(input, 'Va');
    await user.keyboard('{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCatalogSelect).toHaveBeenCalledWith(CATALOG);
  });

  it('reopens suggestions after focus moves to another field and returns', async () => {
    const user = userEvent.setup();

    render(<TestInput />);

    const input = screen.getByRole('combobox', { name: 'Tên phần mềm' });
    const otherInput = screen.getByRole('textbox', { name: 'Trường khác' });

    await user.click(input);
    expect(screen.getByRole('option', { name: /Vashop/ })).toBeInTheDocument();

    await user.click(otherInput);
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await user.click(input);
    expect(screen.getByRole('option', { name: /Vashop/ })).toBeInTheDocument();
  });

  it('allows deleting the typed value without restoring the hint', async () => {
    const user = userEvent.setup();

    render(<ControlledInput />);

    const input = screen.getByRole('combobox', { name: 'Tên phần mềm' });
    await user.type(input, 'V');
    expect(input).toHaveValue('V');
    expect(screen.getByRole('textbox', { hidden: true })).toHaveValue('ashop');

    await user.keyboard('{Backspace}');

    expect(input).toHaveValue('');
    expect(screen.getByRole('textbox', { hidden: true })).toHaveValue('');
  });

  it('keeps the typed prefix separate from the inline completion', async () => {
    const user = userEvent.setup();

    render(<ControlledInput />);

    const input = screen.getByRole('combobox', { name: 'Tên phần mềm' });
    await user.type(input, 'V');

    expect(input).toHaveValue('V');
    expect(screen.getByRole('textbox', { hidden: true })).toHaveValue('ashop');
  });

  it('does not replace Vietnamese IME composition with an inline suggestion', () => {
    render(<ControlledInput />);

    const input = screen.getByRole('combobox', { name: 'Tên phần mềm' });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'Vá' } });
    fireEvent.compositionUpdate(input, { data: 'Vá' });
    fireEvent.compositionEnd(input);
    fireEvent.change(input, { target: { value: 'Vás' } });

    expect(input).toHaveValue('Vás');
    expect(input).not.toHaveValue('Vásh');
    expect(input).not.toHaveValue('Váss');
  });

  it('hides the popover when no option matches', async () => {
    const user = userEvent.setup();

    render(<ControlledInput />);

    const input = screen.getByRole('combobox', { name: 'Tên phần mềm' });
    await user.type(input, 'Z');

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});
