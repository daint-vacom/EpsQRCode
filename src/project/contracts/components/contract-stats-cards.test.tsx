import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContractStatsCards } from './contract-stats-cards';

const stats = {
  total: 10,
  active: 6,
  expiring: 2,
  expired: 2,
};

describe('ContractStatsCards', () => {
  it('keeps the plan and trend cards fully visible while a status is selected', () => {
    render(
      <ContractStatsCards
        stats={stats}
        activeStatusFilters={['active']}
        onStatusFilterChange={vi.fn()}
        onExpiringFilterChange={vi.fn()}
      />,
    );

    const planCard = screen
      .getByRole('button', { name: 'Xóa bộ lọc trạng thái hợp đồng' })
      .querySelector<HTMLElement>('[data-slot="card-content"]');
    const trendCard = screen
      .getByText('Xu hướng kế hoạch thu')
      .closest('[data-slot="card"]');

    expect(planCard).not.toHaveClass('opacity-70');
    expect(trendCard).not.toHaveClass('opacity-70');
  });

  it('makes the expiring stat filterable', async () => {
    const user = userEvent.setup();
    const onExpiringFilterChange = vi.fn();

    render(
      <ContractStatsCards
        stats={stats}
        onStatusFilterChange={vi.fn()}
        onExpiringFilterChange={onExpiringFilterChange}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Lọc hợp đồng: Sắp hết hạn' }),
    );

    expect(onExpiringFilterChange).toHaveBeenCalledOnce();
  });

  it('shows a pointer cursor and search icon for every status count', () => {
    render(
      <ContractStatsCards
        stats={stats}
        onStatusFilterChange={vi.fn()}
        onExpiringFilterChange={vi.fn()}
      />,
    );

    const statusButtons = ['Đang hiệu lực', 'Sắp hết hạn', 'Đã hết hạn'].map(
      (label) => screen.getByRole('button', { name: `Lọc hợp đồng: ${label}` }),
    );

    expect(
      statusButtons.every((card) => card.classList.contains('cursor-pointer')),
    ).toBe(true);
    expect(
      document.querySelectorAll('[data-slot="contract-stat-filter-icon"]'),
    ).toHaveLength(3);
  });

  it('shows only the expiring stat as selected when its active-status filter is applied', () => {
    render(
      <ContractStatsCards
        stats={stats}
        activeStatusFilters={['active']}
        isExpiringFilterActive
        onStatusFilterChange={vi.fn()}
        onExpiringFilterChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Lọc hợp đồng: Sắp hết hạn' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Lọc hợp đồng: Đang hiệu lực' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
