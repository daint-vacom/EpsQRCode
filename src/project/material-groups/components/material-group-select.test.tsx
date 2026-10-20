import type { ReactNode } from 'react';
import { useState } from 'react';
import { vi as messages } from '@/i18n/messages/vi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialGroupSelect } from './material-group-select';

const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../api/material-groups.api', () => ({
  loadAvailableMaterialGroups: api.load,
}));
const group = {
  id: 'g1',
  code: 'G1',
  name: 'Nhóm A',
  description: '',
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
beforeEach(() => {
  vi.clearAllMocks();
  api.load.mockResolvedValue([group]);
});
describe('MaterialGroupSelect catalog', () => {
  it('loads the full catalog lazily, searches locally and reuses cache on reopen', async () => {
    const user = userEvent.setup();
    render(<MaterialGroupSelect />, { wrapper: Wrapper });
    expect(api.load).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option');
    await user.type(
      screen.getByPlaceholderText(messages['materialGroups.select.search']),
      'Nhóm',
    );
    expect(api.load).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('combobox'));
    expect(api.load).toHaveBeenCalledTimes(1);
  });
  it('uses options without calling the catalog API', async () => {
    const user = userEvent.setup();
    render(
      <MaterialGroupSelect sourceMode="options" groups={[group]} value="g1" />,
      { wrapper: Wrapper },
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option')).toHaveTextContent('Nhóm A');
    expect(api.load).not.toHaveBeenCalled();
  });
  it('shows an explicit retryable error instead of disguising the error as empty results', async () => {
    const user = userEvent.setup();
    api.load.mockRejectedValueOnce(new Error('Không tải được nhóm'));
    render(<MaterialGroupSelect />, { wrapper: Wrapper });
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('option')).toHaveTextContent('Nhóm A');
  });
});
