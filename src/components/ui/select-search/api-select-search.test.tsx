import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiSelectSearch } from './api-select-search';

function setup(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  }),
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper, user: userEvent.setup() };
}
const option = (value: string) => ({ value, label: value });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ApiSelectSearch', () => {
  it('loads only on open, searches on the server without filtering server labels, and reuses fresh cache', async () => {
    const { wrapper, user } = setup();
    const loader = vi.fn(async () => [option('Server label')]);
    render(<ApiSelectSearch loadOptions={loader} debounceMs={0} />, {
      wrapper,
    });
    expect(loader).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: 'Server label' });
    await user.click(screen.getByPlaceholderText('Tìm...'));
    await user.paste('xyz');
    await waitFor(() =>
      expect(loader).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: 'xyz',
          page: 1,
          pageSize: 30,
          signal: expect.any(AbortSignal),
        }),
      ),
    );
    expect(
      await screen.findByRole('option', { name: 'Server label' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('shares a cache across instances but separates scopes and structurally different filters', async () => {
    const { wrapper, user } = setup();
    const loader = vi.fn(async (_params: unknown) => [option('A')]);
    const view = render(
      <ApiSelectSearch
        cacheKey={['domain', 'tenant-a']}
        filters={{ a: 1, b: 2 }}
        loadOptions={loader}
      />,
      { wrapper },
    );
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: 'A' });
    view.rerender(
      <ApiSelectSearch
        cacheKey={['domain', 'tenant-a']}
        filters={{ b: 2, a: 1 }}
        loadOptions={async (params) => loader(params)}
      />,
    );
    expect(loader).toHaveBeenCalledTimes(1);
    view.unmount();
    const next = render(
      <ApiSelectSearch
        cacheKey={['domain', 'tenant-a']}
        filters={{ a: 1, b: 2 }}
        loadOptions={loader}
      />,
      { wrapper },
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);
    next.rerender(
      <ApiSelectSearch
        cacheKey={['domain', 'tenant-b']}
        filters={{ a: 2 }}
        loadOptions={loader}
      />,
    );
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(loader).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: { a: 2 } }),
    );
  });

  it('aborts obsolete requests and ignores late results after filters change', async () => {
    const { wrapper, user } = setup();
    const old = deferred<ReturnType<typeof option>[]>();
    const loader = vi.fn(
      ({ filters }: { filters: { id: number } | undefined }) =>
        filters?.id === 1 ? old.promise : Promise.resolve([option('New')]),
    );
    const view = render(
      <ApiSelectSearch filters={{ id: 1 }} loadOptions={loader} />,
      { wrapper },
    );
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    const signal = (
      loader.mock.calls[0][0] as unknown as { signal: AbortSignal }
    ).signal;
    view.rerender(<ApiSelectSearch filters={{ id: 2 }} loadOptions={loader} />);
    await screen.findByRole('option', { name: 'New' });
    expect(signal.aborted).toBe(true);
    old.resolve([option('Old')]);
    await waitFor(() =>
      expect(
        screen.queryByRole('option', { name: 'Old' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('deduplicates pages, prevents scroll retry loops and explicitly retries a failed page', async () => {
    const { wrapper, user } = setup();
    let failed = false;
    const loader = vi.fn(async ({ page }: { page: number }) => {
      if (page === 2 && !failed) {
        failed = true;
        throw new Error('backend error');
      }
      return {
        options: page === 1 ? [option('A')] : [option('A'), option('B')],
        hasMore: page === 1,
      };
    });
    render(
      <ApiSelectSearch
        value="Chosen"
        selectedOption={option('Chosen')}
        loadOptions={loader}
      />,
      { wrapper },
    );
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: 'A' });
    fireEvent.scroll(screen.getByRole('listbox'));
    await screen.findByRole('alert');
    fireEvent.scroll(screen.getByRole('listbox'));
    expect(loader).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('option', { name: 'Chosen' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByRole('option', { name: 'B' });
    expect(screen.getAllByRole('option', { name: 'A' })).toHaveLength(1);
    expect(loader.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 2]);
  });

  it('retains displayed results during invalidation and prevents pagination from interrupting refetch', async () => {
    const { wrapper, user, client } = setup();
    const refresh = deferred<{
      options: ReturnType<typeof option>[];
      hasMore: boolean;
    }>();
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ options: [option('Cached')], hasMore: true })
      .mockImplementation(() => refresh.promise);
    render(<ApiSelectSearch cacheKey={['domain']} loadOptions={loader} />, {
      wrapper,
    });
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: 'Cached' });
    void client.invalidateQueries({ queryKey: ['domain'] });
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('option', { name: 'Cached' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.scroll(screen.getByRole('listbox'));
    expect(loader).toHaveBeenCalledTimes(2);
    refresh.resolve({ options: [option('Refreshed')], hasMore: false });
    await screen.findByRole('option', { name: 'Refreshed' });
  });

  it('shows first-page errors even with a selected option and retries only on explicit action', async () => {
    const { wrapper, user } = setup();
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('Internal details'))
      .mockResolvedValue([]);
    render(
      <ApiSelectSearch
        value="Chosen"
        selectedOption={option('Chosen')}
        loadOptions={loader}
      />,
      { wrapper },
    );
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không thể tải dữ liệu',
    );
    expect(screen.getByRole('option', { name: 'Chosen' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not fetch below minimum search length or when disabled', async () => {
    const { wrapper, user } = setup();
    const loader = vi.fn(async () => []);
    const view = render(
      <ApiSelectSearch
        minSearchLength={2}
        loadOptions={loader}
        debounceMs={0}
      />,
      { wrapper },
    );
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Tìm...'), 'a');
    expect(loader).not.toHaveBeenCalled();
    view.rerender(
      <ApiSelectSearch
        enabled={false}
        minSearchLength={2}
        loadOptions={loader}
        debounceMs={0}
      />,
    );
    await user.type(screen.getByPlaceholderText('Tìm...'), 'b');
    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument(),
    );
    expect(loader).not.toHaveBeenCalled();
  });
});
