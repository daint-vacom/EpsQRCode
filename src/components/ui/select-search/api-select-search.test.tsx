import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiSelectSearch } from './api-select-search';

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('ApiSelectSearch', () => {
  it('loads options when opened and searches through the loader', async () => {
    const user = userEvent.setup();
    const loadOptions = vi.fn(async ({ search }: { search: string }) => [
      {
        value: search ? 'quan-ly' : 'nhan-vien',
        label: search ? 'Quản lý' : 'Nhân viên',
      },
    ]);

    renderWithQueryClient(
      <ApiSelectSearch
        loadOptions={loadOptions}
        cacheKey={['test', 'roles']}
        debounceMs={0}
        placeholder="Chọn vai trò"
      />,
    );

    await user.click(screen.getByRole('combobox'));
    await waitFor(() =>
      expect(loadOptions).toHaveBeenCalledWith(
        expect.objectContaining({ search: '' }),
      ),
    );
    expect(
      screen.getByRole('option', { name: 'Nhân viên' }),
    ).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Tìm...'), 'quan');
    await waitFor(() =>
      expect(loadOptions).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'quan' }),
      ),
    );

    const listbox = screen.getByRole('listbox');
    expect(
      within(listbox).getByRole('option', { name: 'Quản lý' }),
    ).toBeInTheDocument();
  });

  it('keeps the selected option visible while the API result is empty', async () => {
    const user = userEvent.setup();
    const loadOptions = vi.fn(async () => []);

    renderWithQueryClient(
      <ApiSelectSearch
        value="nhan-vien"
        selectedOption={{ value: 'nhan-vien', label: 'Nhân viên' }}
        cacheKey={['test', 'selected-role']}
        loadOptions={loadOptions}
        debounceMs={0}
      />,
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Nhân viên' }),
      ).toBeInTheDocument();
    });
  });

  it('loads and appends the next page when the options list is scrolled to its end', async () => {
    const user = userEvent.setup();
    const loadOptions = vi.fn(
      async ({ page }: { page: number; pageSize: number; search: string }) => ({
        options: [{ value: `item-${page}`, label: `Vật tư ${page}` }],
        total: 2,
      }),
    );

    renderWithQueryClient(
      <ApiSelectSearch
        loadOptions={loadOptions}
        cacheKey={['test', 'paged-items']}
        debounceMs={0}
        pageSize={1}
        placeholder="Chọn vật tư"
      />,
    );

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: 'Vật tư 1' });
    const list = screen.getByRole('listbox');
    Object.defineProperties(list, {
      scrollTop: { configurable: true, value: 280 },
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 300 },
    });
    fireEvent.scroll(list);

    await waitFor(() => {
      expect(loadOptions).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 1 }),
      );
      expect(
        screen.getByRole('option', { name: 'Vật tư 2' }),
      ).toBeInTheDocument();
    });
  });

  it('reuses cached results when the select is closed and opened again', async () => {
    const user = userEvent.setup();
    const loadOptions = vi.fn(async () => [
      { value: 'item-1', label: 'Vật tư 1' },
    ]);

    renderWithQueryClient(
      <ApiSelectSearch
        loadOptions={loadOptions}
        cacheKey={['test', 'reopen-items']}
        debounceMs={0}
        placeholder="Chọn vật tư"
      />,
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Vật tư 1' }));
    await user.click(screen.getByRole('combobox'));

    await waitFor(() =>
      expect(
        screen.getByRole('option', { name: 'Vật tư 1' }),
      ).toBeInTheDocument(),
    );
    expect(loadOptions).toHaveBeenCalledTimes(1);
  });
});
