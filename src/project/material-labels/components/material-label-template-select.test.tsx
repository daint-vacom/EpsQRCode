import type { ReactNode } from 'react';
import { useState } from 'react';
import { vi as messages } from '@/i18n/messages/vi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import { MaterialLabelTemplateSelect } from './material-label-template-select';

const template = {
  id: 'template-1',
  name: 'Tem nhãn thiết bị',
  description: 'Dùng cho thiết bị đang quản lý',
  widthMm: 30,
  heightMm: 50,
  design: { version: 1 },
  isDefault: false,
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

function Wrapper({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <IntlProvider locale="vi" messages={messages}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </IntlProvider>
  );
}

describe('MaterialLabelTemplateSelect', () => {
  it('shows template name, description and size, and searches by description', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <MaterialLabelTemplateSelect
        sourceMode="options"
        templates={[template]}
        onChange={onChange}
      />,
      { wrapper: Wrapper },
    );

    await user.click(screen.getByRole('combobox'));
    const search = screen.getByPlaceholderText(
      messages['project.materialLabels.select.searchTemplates'],
    );
    await user.type(search, 'thiết bị đang quản lý');

    const option = await screen.findByRole('option');
    expect(option).toHaveTextContent(template.name);
    expect(option).toHaveTextContent(template.description);
    expect(option).toHaveTextContent('30x50');
    await user.click(option);
    expect(onChange).toHaveBeenCalledWith(template.id);
    rerender(
      <MaterialLabelTemplateSelect
        sourceMode="options"
        templates={[template]}
        value={template.id}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent(template.name);
    expect(screen.getByRole('combobox')).not.toHaveTextContent(
      template.description,
    );
    expect(screen.getByRole('combobox')).not.toHaveTextContent('30 × 50 mm');
  });
});
