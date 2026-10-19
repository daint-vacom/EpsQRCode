import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCustodianAccountOptions } from './custodians.api';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  assertSupabaseConfigured: vi.fn(),
  supabaseApi: { get, post },
}));

describe('custodian account options API', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it('loads active account choices from the permission-checked RPC', async () => {
    const options = [
      { id: 'user-1', username: 'linh', displayName: 'Linh Nguyễn' },
    ];
    const signal = new AbortController().signal;
    post.mockResolvedValue(options);

    await expect(loadCustodianAccountOptions(signal)).resolves.toEqual(options);

    expect(post).toHaveBeenCalledWith(
      '/rpc/list_custodian_account_options',
      {},
      { signal },
    );
    expect(get).not.toHaveBeenCalled();
  });
});
