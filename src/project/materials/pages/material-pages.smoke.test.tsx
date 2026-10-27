import type { ReactNode } from 'react';
import { vi as messagesVi } from '@/i18n/messages/vi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Material } from '../model/material';

const mocks = vi.hoisted(() => ({
  material: null as Material | null,
  headerActions: null as ReactNode | null,
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
  useDetailEntryLayoutHeader: (header: { actions?: ReactNode }) => {
    mocks.headerActions = header.actions ?? null;
  },
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
        valueLabels: [],
        values: ['0–100'],
      },
    ],
    images: [],
    capturedAt: '2026-10-01T00:00:00Z',
  },
  nameOverride: null,
  descriptionOverride: null,
  images: [],
  specificationOverrides: {},
  specificationOverrideLabels: {},
  serialNumber: 'SER-1',
  ownerPartyId: 'party-1',
  ownerSnapshot: {
    kind: 'eps',
    type: 'department',
    partyId: 'party-1',
    catalogPartyId: 'party-1',
    sourceType: 'eps_department',
    sourceId: 'source-party-1',
    departmentId: 'party-1',
    departmentCode: 'P01',
    departmentName: 'Phòng Kỹ thuật',
    departmentSourceId: 'source-party-1',
    teamId: null,
    teamCode: null,
    teamName: null,
    teamSourceId: null,
    employeeId: null,
    employeeCode: null,
    employeeName: null,
    employeeSourceId: null,
    externalOrganizationId: null,
    warehouseId: null,
    scopePartyId: null,
    code: 'P01',
    name: 'Phòng Kỹ thuật',
    representativeName: '',
    phone: '',
    email: '',
    capturedAt: '2026-10-01T00:00:00Z',
  },
  borrowerPartyId: null,
  condition: 'good',
  note: null,
  status: 'available',
  reservedHandoverId: null,
  reservationStatus: null,
  activeLoanHandoverId: null,
  isActive: true,
  version: 1,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

function renderPage(path: string, element: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="vi" messages={messagesVi}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/materials/:id" element={element} />
            <Route path="/materials/new" element={element} />
          </Routes>
        </MemoryRouter>
      </IntlProvider>
    </QueryClientProvider>,
  );
}

describe('production material pages', () => {
  beforeEach(() => {
    mocks.material = sample;
    mocks.headerActions = null;
    mocks.createSignedStorageUrl.mockClear();
  });

  it('renders the create form in the two-column gallery and tab layout', async () => {
    const user = userEvent.setup();
    mocks.material = null;
    const { MaterialEditorPage } = await import('./material-editor-page');
    renderPage('/materials/new', <MaterialEditorPage />);
    expect(
      screen.getByRole('textbox', { name: /Mã vật tư/ }),
    ).toBeInTheDocument();
    const headerActions = render(mocks.headerActions);
    expect(
      headerActions.getByRole('button', { name: 'Lưu vật tư' }),
    ).toBeInTheDocument();
    expect(
      headerActions.queryByRole('button', { name: 'Hủy' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Thêm ảnh vật tư')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Thông tin chung' })).toBeVisible();
    const specificationTab = screen.getByRole('tab', {
      name: /Thông số kỹ thuật/,
    });
    await user.click(specificationTab);
    expect(
      screen.getByText('Chọn mẫu vật tư để xem thông tin được lưu khi tạo.'),
    ).toBeInTheDocument();
  }, 30000);

  it('renders the authenticated detail and its stable QR destination', async () => {
    mocks.material = {
      ...sample,
      specificationOverrides: { 'spec-color': ['#f44336'] },
      specificationOverrideLabels: { 'spec-color': ['Đỏ tùy chỉnh'] },
      modelSnapshot: {
        ...sample.modelSnapshot,
        specifications: [
          ...sample.modelSnapshot.specifications,
          {
            id: 'spec-list',
            dataType: 'text',
            name: 'Phụ kiện',
            isList: true,
            valueLabels: [],
            values: ['Cable', 'Nozzle'],
          },
          {
            id: 'spec-color',
            dataType: 'color',
            name: 'Màu sắc',
            isList: false,
            valueLabels: ['Xanh Huyền Bí'],
            values: ['#1677ff'],
          },
        ],
      },
    };
    const { MaterialDetailPage } = await import('./material-detail-page');
    const { container } = renderPage(
      '/materials/material-1',
      <MaterialDetailPage />,
    );
    expect(screen.getAllByText('MAT-001').length).toBeGreaterThan(0);
    expect(screen.getByText('Đỏ tùy chỉnh')).toBeInTheDocument();
    expect(screen.queryByText('Cable')).not.toBeInTheDocument();
    expect(
      container.querySelector('svg[aria-label="QR MAT-001"]'),
    ).toHaveAttribute(
      'data-qr-value',
      `${window.location.origin}/vat-tu/material-1`,
    );
  });

  it('shares the model specification table and keeps material values editable', async () => {
    mocks.material = {
      ...sample,
      specificationOverrides: {
        'spec-choice': ['Blue'],
        'spec-list': ['Cable'],
      },
      modelSnapshot: {
        ...sample.modelSnapshot,
        specifications: [
          {
            id: 'spec-fixed',
            dataType: 'text',
            name: 'Mã sản phẩm',
            isList: false,
            valueLabels: [],
            values: ['ES2'],
          },
          {
            id: 'spec-choice',
            dataType: 'text',
            name: 'Màu sắc',
            isList: false,
            valueLabels: [],
            values: ['Red', 'Blue'],
          },
          {
            id: 'spec-list',
            dataType: 'text',
            name: 'Phụ kiện',
            isList: true,
            valueLabels: [],
            values: ['Cable', 'Nozzle'],
          },
        ],
      },
    };

    const { MaterialEditorPage } = await import('./material-editor-page');
    const user = userEvent.setup();
    renderPage('/materials/material-1', <MaterialEditorPage />);

    await user.click(screen.getByRole('tab', { name: /Thông số kỹ thuật/ }));

    expect(screen.getByText('3 thông số')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Thông số' }),
    ).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Giá trị' })).toBeVisible();
    expect(screen.getByText('ES2')).toBeInTheDocument();
    const productCodeEdit = screen.getByRole('checkbox', {
      name: 'Cho phép sửa thông số Mã sản phẩm',
    });
    expect(productCodeEdit).not.toBeChecked();
    expect(screen.queryByRole('textbox', { name: 'Mã sản phẩm' })).toBeNull();
    await user.click(productCodeEdit);
    const editableProductCode = screen.getByRole('textbox', {
      name: 'Mã sản phẩm',
    });
    expect(editableProductCode).toHaveValue('ES2');
    expect(
      screen.queryByRole('checkbox', { name: 'ES2' }),
    ).not.toBeInTheDocument();
    await user.clear(editableProductCode);
    await user.type(editableProductCode, 'CUSTOM-1');
    expect(editableProductCode).toHaveValue('CUSTOM-1');

    expect(
      screen.queryByRole('textbox', { name: 'Màu sắc' }),
    ).not.toBeInTheDocument();
    const redSuggestion = screen.getByRole('checkbox', { name: 'Red' });
    const blueSuggestion = screen.getByRole('checkbox', { name: 'Blue' });
    expect(blueSuggestion).toBeChecked();
    expect(redSuggestion).not.toBeChecked();
    await user.click(redSuggestion);
    expect(redSuggestion).toBeChecked();
    expect(blueSuggestion).not.toBeChecked();
    const colorEdit = screen.getByRole('checkbox', {
      name: 'Cho phép sửa thông số Màu sắc',
    });
    expect(colorEdit).not.toBeChecked();
    await user.click(colorEdit);
    const customColorInput = screen.getByRole('textbox', { name: 'Màu sắc' });
    await user.type(customColorInput, 'Purple{Enter}');
    expect(screen.getByText('Purple')).toBeInTheDocument();

    const cableSuggestion = screen.getByRole('checkbox', { name: 'Cable' });
    const nozzleSuggestion = screen.getByRole('checkbox', { name: 'Nozzle' });
    expect(cableSuggestion).toBeChecked();
    expect(nozzleSuggestion).not.toBeChecked();
    expect(
      screen.queryByRole('textbox', { name: 'Phụ kiện 1' }),
    ).not.toBeInTheDocument();
    await user.click(nozzleSuggestion);
    expect(cableSuggestion).toBeChecked();
    expect(nozzleSuggestion).toBeChecked();
    expect(
      screen.queryByRole('button', { name: /Chọn giá trị gợi ý/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Thêm thông số' }),
    ).not.toBeInTheDocument();
  }, 15000);

  it('keeps the selected gallery image when switching detail tabs', async () => {
    const user = userEvent.setup();
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
    const generalTab = screen.getByRole('tab', { name: /Thông tin chung/ });
    const generalPanel = document.getElementById(
      generalTab.getAttribute('aria-controls') ?? '',
    );
    const inventoryTab = screen.getByRole('tab', {
      name: /Lịch sử kiểm kê/,
    });
    await user.click(inventoryTab);
    await waitFor(() => {
      expect(inventoryTab).toHaveAttribute('aria-selected', 'true');
    });
    expect(generalPanel).toHaveAttribute('data-state', 'inactive');
    expect(generalPanel).toHaveClass('data-[state=inactive]:hidden');
    await user.click(screen.getByRole('tab', { name: /Thông tin chung/ }));

    await waitFor(() => {
      expect(generalPanel).toHaveAttribute('data-state', 'active');
      expect(
        screen.getAllByRole('button', { name: 'Xem ảnh Máy đo' })[1],
      ).toHaveAttribute('aria-current', 'true');
    });
    expect(mocks.createSignedStorageUrl).toHaveBeenCalledTimes(
      signedUrlRequestCount,
    );
  });
});
