import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actOnHandover, loadHandovers, saveHandover } from './handovers.api';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  assertSupabaseConfigured: vi.fn(),
  supabaseApi: { post },
}));

describe('handovers API RPC contract', () => {
  beforeEach(() => post.mockReset());

  it('passes the supported parties, material, date and pagination filters', async () => {
    const filters = {
      senderPartyId: 'sender-1',
      recipientPartyId: 'receiver-1',
      materialId: 'material-1',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
      page: 3,
      pageSize: 25,
    };
    const signal = new AbortController().signal;
    post.mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 25 });

    await loadHandovers(filters, signal);

    expect(post).toHaveBeenCalledWith(
      '/rpc/list_handovers',
      { p_filters: filters },
      { signal },
    );
  });

  it('saves attachments and configured party representatives with the draft', async () => {
    const values = {
      type: 'loan' as const,
      senderPartyId: 'sender-1',
      recipientPartyId: 'receiver-1',
      senderRepresentativeUserId: 'user-1',
      recipientRepresentativeUserId: 'user-2',
      plannedDate: '2026-10-19',
      dueDate: '2026-10-26',
      note: 'Bàn giao thiết bị',
      items: [
        {
          materialId: 'material-1',
          condition: 'good' as const,
          conditionNote: '',
        },
      ],
      attachmentFileIds: ['file-1'],
    };
    post.mockResolvedValue('handover-1');

    await saveHandover(null, values);

    expect(post).toHaveBeenCalledWith('/rpc/save_handover', {
      p_id: null,
      p_values: values,
    });
  });

  it('sends receiver condition evidence and the document version on confirmation', async () => {
    post.mockResolvedValue('handover-1');

    await actOnHandover({
      id: 'handover-1',
      action: 'confirm',
      expectedVersion: 2,
      itemConditions: [
        {
          materialId: 'material-1',
          condition: 'damaged',
          conditionNote: 'Vỏ bị nứt',
        },
      ],
    });

    expect(post).toHaveBeenCalledWith('/rpc/act_on_handover', {
      p_id: 'handover-1',
      p_action: 'confirm',
      p_expected_version: 2,
      p_note: null,
      p_item_conditions: [
        {
          materialId: 'material-1',
          condition: 'damaged',
          conditionNote: 'Vỏ bị nứt',
        },
      ],
    });
  });
});
