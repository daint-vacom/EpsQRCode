import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { materialMessagesVi } from '../messages';
import type { Material } from '../model/material';

const mocks = vi.hoisted(() => ({
  material: null as Material | null,
  createSignedStorageUrl: vi.fn(() =>
    Promise.resolve('https://example.test/signed-image'),
  ),
}));

vi.mock('@/lib/storage', () => ({
  createSignedStorageUrl: mocks.createSignedStorageUrl,
}));

vi.mock('@/providers/user-provider', () => ({
  useUser: () => ({ userId: 'user-1', hasPermission: () => true }),
}));
vi.mock('@/providers/workspace-provider', () => ({
  useWorkspace: () => ({ isPermissionsPending: false }),
}));
vi.mock('@/components/layouts/detail-entry-layout', () => ({
  useDetailEntryLayoutHeader: vi.fn(),
}));
vi.mock('@/project/material-models/hooks/use-material-models', () => ({
  useMaterialModelsQuery: () => ({
    data: [
      {
        id: 'model-1',
        code: 'MOD-1',
        name: 'Máy đo',
        isActive: true,
        specifications: [],
        images: [],
        description: '',
      },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/project/custodians/hooks/use-custodians', () => ({
  useCustodiansQuery: () => ({
    data: [
      {
        id: 'party-1',
        code: 'P-1',
        name: 'Phòng kỹ thuật',
        type: 'department',
        isActive: true,
        accountUserId: 'user-1',
        representativeUserId: null,
      },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/project/material-groups/hooks/use-material-groups', () => ({
  useMaterialGroupsQuery: () => ({
    data: [],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('../hooks/use-materials', () => ({
  useMaterialsQuery: () => ({
    data: {
      items: mocks.material ? [mocks.material] : [],
      total: mocks.material ? 1 : 0,
      page: 1,
      pageSize: 25,
    },
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useMaterialQuery: () => ({
    data: mocks.material,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useMaterialHistoryQuery: () => ({
    data: [],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSaveMaterialMutation: () => ({ isPending: false, mutate: vi.fn() }),
  usePreviewMaterialModelSyncQuery: () => ({
    data: {
      changedFields: [],
      preservedOverrides: [],
      currentSnapshot: mocks.material!.modelSnapshot,
      proposedSnapshot: mocks.material!.modelSnapshot,
      modelUpdatedAt: '2026-10-01T00:00:00Z',
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useApplyMaterialModelSyncMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));
vi.mock('@/project/handover/hooks/use-handovers', () => ({
  useHandoversQuery: () => ({
    data: { items: [], total: 0, page: 1, pageSize: 100 },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

const sample: Material = {
  id: 'material-1',
  code: 'MAT-001',
  modelId: 'model-1',
  modelSnapshot: {
    id: 'model-1',
    code: 'MOD-1',
    name: 'Máy đo',
    groupId: null,
    description: 'Thiết bị đo',
    requiresInspection: false,
    specifications: [
      {
        id: 'spec-1',
        dataType: 'text',
        name: 'Dải đo',
        isList: false,
        values: ['0–100'],
      },
    ],
    images: [],
    capturedAt: '2026-10-01T00:00:00Z',
  },
  nameOverride: null,
  descriptionOverride: null,
  imageUrlOverride: null,
  specificationOverrides: {},
  serialNumber: 'SER-1',
  ownerPartyId: 'party-1',
  borrowerPartyId: null,
  condition: 'good',
  conditionNote: null,
  status: 'available',
  reservedHandoverId: null,
  reservationStatus: null,
  activeLoanHandoverId: null,
  version: 1,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

function renderPage(path: string, element: ReactNode) {
  return render(
    <IntlProvider locale="vi" messages={materialMessagesVi}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/materials/:id" element={element} />
          <Route path="/materials/new" element={element} />
        </Routes>
      </MemoryRouter>
    </IntlProvider>,
  );
}

describe('production material pages', () => {
  beforeEach(() => {
    mocks.material = sample;
    mocks.createSignedStorageUrl.mockClear();
  });

  it('renders the create form without example-store dependencies', async () => {
    mocks.material = null;
    const { MaterialEditorPage } = await import('./material-editor-page');
    renderPage('/materials/new', <MaterialEditorPage />);
    expect(
      screen.getByRole('textbox', { name: /Mã vật tư/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Thông tin mẫu đã lưu')).toBeInTheDocument();
  });

  it('renders the authenticated detail and its stable QR destination', async () => {
    const { MaterialDetailPage } = await import('./material-detail-page');
    const { container } = renderPage(
      '/materials/material-1',
      <MaterialDetailPage />,
    );
    expect(screen.getAllByText('MAT-001').length).toBeGreaterThan(0);
    expect(
      container.querySelector('svg[aria-label="QR MAT-001"]'),
    ).toHaveAttribute(
      'data-qr-value',
      `${window.location.origin}/materials/material-1`,
    );
  });

  it('keeps the selected gallery image when switching detail tabs', async () => {
    mocks.material = {
      ...sample,
      modelSnapshot: {
        ...sample.modelSnapshot,
        images: [
          {
            id: 'image-1',
            storagePath: 'material-1/image-1.jpg',
            externalUrl: null,
            sortOrder: 0,
            isCover: true,
          },
          {
            id: 'image-2',
            storagePath: 'material-1/image-2.jpg',
            externalUrl: null,
            sortOrder: 1,
            isCover: false,
          },
        ],
      },
    };

    const { MaterialDetailPage } = await import('./material-detail-page');
    renderPage('/materials/material-1', <MaterialDetailPage />);

    const imageButtons = await screen.findAllByRole('button', {
      name: 'Xem ảnh Máy đo',
    });
    fireEvent.click(imageButtons[1]);
    expect(imageButtons[1]).toHaveAttribute('aria-current', 'true');

    const signedUrlRequestCount =
      mocks.createSignedStorageUrl.mock.calls.length;
    fireEvent.click(screen.getByRole('tab', { name: /Lịch sử kiểm kê/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Thông tin chung/ }));

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: 'Xem ảnh Máy đo' })[1],
      ).toHaveAttribute('aria-current', 'true');
    });
    expect(mocks.createSignedStorageUrl).toHaveBeenCalledTimes(
      signedUrlRequestCount,
    );
  });
});
