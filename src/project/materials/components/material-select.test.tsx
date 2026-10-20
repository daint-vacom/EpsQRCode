import type { ReactNode } from 'react';
import { useState } from 'react';
import { vi as messages } from '@/i18n/messages/vi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Material } from '../model/material';
import { MaterialSelect } from './material-select';

const api = vi.hoisted(() => ({ load: vi.fn(), hydrate: vi.fn() }));
vi.mock('../api/materials.api', () => ({ loadMaterials: api.load }));
vi.mock('../hooks/use-materials', () => ({
  materialKeys: { all: ['project', 'materials'] },
  useMaterialQuery: api.hydrate,
}));
vi.mock('@/providers/user-provider', () => ({
  useUser: () => ({ userId: 'user' }),
}));
const material = {
  id: '1',
  code: 'VT001',
  modelId: 'model',
  modelSnapshot: { code: 'M1', name: 'Vật tư A', groupId: 'group' },
  status: 'available',
  condition: 'good',
} as Material;
function Wrapper({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <IntlProvider locale="vi" messages={messages}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </IntlProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  api.load.mockResolvedValue({
    items: [material],
    total: 1,
    page: 1,
    pageSize: 30,
  });
  api.hydrate.mockReturnValue({ data: undefined });
});
describe('MaterialSelect server behavior', () => {
  it('includes reservation scope in request and cache, with structurally equal filters reusing data', async () => {
    const user = userEvent.setup();
    const view = render(
      <MaterialSelect
        filters={{ modelId: 'model', groupId: 'group' }}
        allowReservedByHandoverId="handover-a"
      />,
      { wrapper: Wrapper },
    );
    expect(api.load).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option');
    expect(api.load).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'model',
        groupId: 'group',
        excludeReserved: true,
        allowReservedByHandoverId: 'handover-a',
        page: 1,
        pageSize: 30,
      }),
      expect.any(AbortSignal),
    );
    view.rerender(
      <MaterialSelect
        filters={{ groupId: 'group', modelId: 'model' }}
        allowReservedByHandoverId="handover-a"
      />,
    );
    expect(api.load).toHaveBeenCalledTimes(1);
    view.rerender(
      <MaterialSelect
        filters={{ modelId: 'model', groupId: 'group' }}
        allowReservedByHandoverId="handover-b"
      />,
    );
    await waitFor(() => expect(api.load).toHaveBeenCalledTimes(2));
    expect(api.load).toHaveBeenLastCalledWith(
      expect.objectContaining({ allowReservedByHandoverId: 'handover-b' }),
      expect.any(AbortSignal),
    );
  });
  it('normalizes a scanned QR URL to a server ID filter and displays initial search in the input', async () => {
    const user = userEvent.setup();
    const id = '12345678-1234-1234-1234-123456789abc';
    const url = `https://example.com/vat-tu/${id}`;
    render(<MaterialSelect initialSearch={url} />, { wrapper: Wrapper });
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option');
    expect(
      screen.getByPlaceholderText(messages['project.materials.select.search']),
    ).toHaveValue(url);
    expect(api.load).toHaveBeenCalledWith(
      expect.objectContaining({ id, search: undefined, excludeReserved: true }),
      expect.any(AbortSignal),
    );
  });
  it('keeps the selected record when a new server search returns no matching rows', async () => {
    const user = userEvent.setup();
    render(<MaterialSelect value="1" selectedMaterial={material} />, {
      wrapper: Wrapper,
    });
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('option');
    api.load.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 });
    await user.click(
      screen.getByPlaceholderText(messages['project.materials.select.search']),
    );
    await user.paste('missing');
    await waitFor(() => expect(api.load).toHaveBeenCalledTimes(2));
    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('VT001');
  });
  it('uses supplied records without fetch or selection hydration', () => {
    render(
      <IntlProvider locale="vi" messages={messages}>
        <MaterialSelect sourceMode="options" materials={[material]} value="1" />
      </IntlProvider>,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('VT001');
    expect(api.load).not.toHaveBeenCalled();
    expect(api.hydrate).not.toHaveBeenCalled();
  });
});
