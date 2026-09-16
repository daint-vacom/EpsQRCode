import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ReactRouterDom from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type * as FinanceApi from '../../finance/api/finance.api';
import { CustomerDebtsTab } from './customer-debts-tab';

vi.mock('@/providers/tenant-provider', () => ({
  useTenant: () => ({ tenantId: 'tenant-1' }),
}));

vi.mock('@/providers/user-provider', () => ({
  useUser: () => ({ hasPermission: () => true }),
}));

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof ReactRouterDom>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../finance/api/finance.api', async () => {
  const actual = await vi.importActual<typeof FinanceApi>(
    '../../finance/api/finance.api',
  );
  return {
    ...actual,
    loadFinanceAccounts: vi.fn().mockResolvedValue([]),
    loadFinanceCategories: vi.fn().mockResolvedValue([]),
    loadFinanceObligations: vi.fn().mockResolvedValue([
      {
        id: 'obligation-1',
        tenantId: 'tenant-1',
        code: 'N-001',
        description: 'Công nợ test',
        partyType: 'customer',
        customerId: 'customer-1',
        employeeId: null,
        partyNameSnapshot: 'Khách hàng test',
        direction: 'receivable',
        sourceType: 'manual',
        contractId: null,
        contractName: '',
        documentDate: '2026-09-16',
        dueDate: '2026-09-30',
        originalAmount: 1000000,
        adjustmentAmount: 0,
        obligationAmount: 1000000,
        settledAmount: 0,
        outstandingAmount: 1000000,
        currencyCode: 'VND',
        status: 'posted',
      },
    ]),
    createFinanceObligation: vi.fn(),
  };
});

const customer = {
  id: 'customer-1',
  tenantId: 'tenant-1',
  name: 'Khách hàng test',
} as never;

function Harness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <CustomerDebtsTab customer={customer} />
    </QueryClientProvider>
  );
}

describe('CustomerDebtsTab', () => {
  it('opens the create dialog from the debt list', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      await screen.findByRole('button', { name: 'Thêm công nợ' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Thêm công nợ: Khách hàng test' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: /Diễn giải/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });
});
