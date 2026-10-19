import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DetailEntryLayout } from '@/components/layouts/detail-entry-layout';
import { handoverMessagesVi } from '../messages';
import type { HandoverDocument } from '../model/handover';
import { HandoverDetailPage } from './handover-detail-page';

const pendingDocument: HandoverDocument = {
  id: 'handover-1',
  code: 'BB-2026-001',
  type: 'loan',
  status: 'pending',
  senderParty: {
    id: 'sender-1',
    code: 'S-1',
    name: 'Bộ phận giao',
    type: 'department',
  },
  recipientParty: {
    id: 'recipient-1',
    code: 'R-1',
    name: 'Bộ phận nhận',
    type: 'department',
  },
  senderRepresentative: null,
  recipientRepresentative: null,
  plannedDate: '2026-10-20',
  dueDate: '2026-11-20',
  note: null,
  items: [
    {
      id: 'item-1',
      materialId: 'material-1',
      materialCode: 'MAT-001',
      materialName: 'Thiết bị kiểm tra',
      modelCode: 'MODEL-1',
      modelName: 'Thiết bị',
      serialNumber: null,
      condition: 'good',
      conditionNote: null,
      senderCondition: 'good',
      senderConditionNote: null,
    },
  ],
  attachments: [],
  version: 2,
  createdBy: 'user-sender',
  confirmedBy: null,
  createdAt: '2026-10-19T10:00:00Z',
  completedAt: null,
};

const mocks = vi.hoisted(() => ({ document: null as HandoverDocument | null }));

vi.mock('@/providers/user-provider', () => ({
  useUser: () => ({ userId: 'user-receiver', hasPermission: () => true }),
}));
vi.mock('@/providers/workspace-provider', () => ({
  useWorkspace: () => ({ isPermissionsPending: false }),
}));
vi.mock('@/project/custodians/hooks/use-custodians', () => ({
  useCustodiansQuery: () => ({
    data: [
      {
        id: 'sender-1',
        code: 'S-1',
        name: 'Bộ phận giao',
        type: 'department',
        isActive: true,
        accountUserId: 'user-sender',
        representativeUserId: null,
      },
      {
        id: 'recipient-1',
        code: 'R-1',
        name: 'Bộ phận nhận',
        type: 'department',
        isActive: true,
        accountUserId: 'user-receiver',
        representativeUserId: null,
      },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('../hooks/use-handovers', () => ({
  useHandoverQuery: () => ({
    data: mocks.document,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useHandoverHistoryQuery: () => ({
    data: [],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useHandoverActionMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

describe('handover detail inside the real detail-entry layout', () => {
  beforeEach(() => {
    mocks.document = pendingDocument;
  });

  it('publishes a stable toolbar and receiver actions without a layout update loop', () => {
    render(
      <IntlProvider locale="vi" messages={handoverMessagesVi}>
        <MemoryRouter initialEntries={['/handovers/handover-1']}>
          <Routes>
            <Route path="/" element={<DetailEntryLayout />}>
              <Route path="handovers/:id" element={<HandoverDetailPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </IntlProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'BB-2026-001', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Xác nhận nhận đủ' }),
    ).toBeInTheDocument();
  });
});
