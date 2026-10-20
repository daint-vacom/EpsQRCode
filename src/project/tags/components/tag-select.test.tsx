import type { ReactNode } from 'react';
import { vi as messages } from '@/i18n/messages/vi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagSelect } from './tag-select';

const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../api/tags.api', () => ({ loadTagSelectOptions: api.load }));
vi.mock('@/providers/user-provider', () => ({
  useUser: () => ({ userId: 'user' }),
}));

const tag = {
  id: 'tag',
  name: 'VIP',
  color: null,
  groupId: 'group',
  groupCode: 'custom',
  groupName: 'Nhóm',
  moduleCode: null,
  isSystem: false,
  isActive: true,
};
function wrapper({ children }: { children: ReactNode }) {
  return (
    <IntlProvider locale="vi" messages={messages}>
      <QueryClientProvider client={new QueryClient()}>
        {children}
      </QueryClientProvider>
    </IntlProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  api.load.mockResolvedValue([tag]);
});
describe('TagSelect', () => {
  it('never fetches in options mode', async () => {
    const user = userEvent.setup();
    render(
      <TagSelect
        sourceMode="options"
        providedOptions={[tag]}
        value={['tag']}
      />,
      {
        wrapper,
      },
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.getAllByText('VIP').length).toBeGreaterThan(0);
    expect(api.load).not.toHaveBeenCalled();
  });
  it('loads lazily with normalized scope and reuses fresh data', async () => {
    const user = userEvent.setup();
    render(<TagSelect moduleCodes={['work', 'customers', 'work']} />, {
      wrapper,
    });
    expect(api.load).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox'));
    await screen.findByText('VIP');
    expect(api.load).toHaveBeenCalledWith(
      'user',
      { moduleCodes: ['customers', 'work'], allowCustomGroups: true },
      expect.any(AbortSignal),
    );
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('combobox'));
    expect(api.load).toHaveBeenCalledTimes(1);
  });
  it('provides explicit retry on an input variant load failure', async () => {
    const user = userEvent.setup();
    api.load.mockRejectedValueOnce(new Error('Không thể tải nhãn'));
    render(<TagSelect />, { wrapper });
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('VIP')).toBeInTheDocument();
    expect(api.load).toHaveBeenCalledTimes(2);
  });
});
