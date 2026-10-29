import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyMaterialModelSync,
  loadMaterials,
  saveMaterial,
} from './materials.api';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  assertSupabaseConfigured: vi.fn(),
  supabaseApi: { post },
}));

describe('materials API RPC contract', () => {
  beforeEach(() => post.mockReset());

  it('sends list filters and the abort signal to the list RPC', async () => {
    const filters = { groupId: 'group-1', status: 'loaned' as const, page: 2 };
    const signal = new AbortController().signal;
    post.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 20 });

    await loadMaterials(filters, signal);

    expect(post).toHaveBeenCalledWith(
      '/rpc/list_materials',
      { p_filters: filters },
      { signal },
    );
  });

  it('sends the expected version for edits and leaves it null for creation', async () => {
    const values = {
      code: 'MAT-001',
      modelId: 'model-1',
      nameOverride: '',
      descriptionOverride: '',
      specificationOverrides: {},
      specificationOverrideLabels: { 'spec-color': ['Xanh'] },
      serialNumber: '',
      ownerPartyId: 'party-1',
      condition: 'good' as const,
      note: '',
    };
    post.mockResolvedValue('material-1');

    await saveMaterial(null, null, values, [], []);
    await saveMaterial('material-1', 4, values, [], []);

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/rpc/save_material_with_public_display_settings',
      {
        p_id: null,
        p_expected_version: null,
        p_values: { ...values, images: [] },
        p_public_display_settings: { basicInfo: false, specifications: false },
        p_public_specification_settings: {},
      },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/rpc/save_material_with_public_display_settings',
      {
        p_id: 'material-1',
        p_expected_version: 4,
        p_values: { ...values, images: [] },
        p_public_display_settings: { basicInfo: false, specifications: false },
        p_public_specification_settings: {},
      },
    );
  });

  it('binds model sync approval to both material and model revisions', async () => {
    post.mockResolvedValue('material-1');

    await applyMaterialModelSync('material-1', 7, '2026-10-19T03:00:00Z');

    expect(post).toHaveBeenCalledWith('/rpc/apply_material_model_sync', {
      p_id: 'material-1',
      p_expected_version: 7,
      p_expected_model_updated_at: '2026-10-19T03:00:00Z',
    });
  });
});
