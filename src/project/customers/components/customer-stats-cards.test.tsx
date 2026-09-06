import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomerStatsCards } from './customer-stats-cards';

const stats = {
  total: 10,
  active: 6,
  inactive: 2,
  withoutContact: 2,
};

describe('CustomerStatsCards', () => {
  it('filters by status and resets the status filter from total', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    render(
      <CustomerStatsCards
        stats={stats}
        activeFilters={['active']}
        onFilterChange={onFilterChange}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Lọc khách hàng: Đang hoạt động' }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Lọc khách hàng: Tổng số khách hàng',
      }),
    );

    expect(onFilterChange).toHaveBeenNthCalledWith(1, 'active');
    expect(onFilterChange).toHaveBeenNthCalledWith(2, null);
  });

  it('dims non-selected indicators while a status filter is active', () => {
    render(
      <CustomerStatsCards
        stats={stats}
        activeFilters={['inactive']}
        onFilterChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Lọc khách hàng: Ngừng hoạt động' }),
    ).toHaveClass('before:bg-admin-red-primary');
    expect(
      screen.getByRole('button', {
        name: 'Lọc khách hàng: Tổng số khách hàng',
      }),
    ).toHaveClass('before:bg-muted-foreground/30');
    expect(
      screen.getByRole('button', { name: 'Lọc khách hàng: Đang hoạt động' }),
    ).toHaveClass('before:bg-muted-foreground/30');

    const inactiveCard = screen.getByRole('button', {
      name: 'Lọc khách hàng: Tổng số khách hàng',
    });
    const inactiveContent = inactiveCard.querySelector<HTMLElement>(
      '[data-slot="card-content"]',
    );
    const inactiveIconContainer =
      inactiveCard.querySelector<HTMLElement>('span');

    expect(inactiveContent).toHaveClass('opacity-70');
    expect(inactiveIconContainer).toHaveClass(
      'bg-muted',
      'text-muted-foreground',
    );
    expect(inactiveIconContainer?.querySelector('svg')).toHaveClass(
      'text-muted-foreground',
    );

    const activeCard = screen.getByRole('button', {
      name: 'Lọc khách hàng: Ngừng hoạt động',
    });
    expect(
      activeCard.querySelector<HTMLElement>('[data-slot="card-content"]'),
    ).toHaveClass('opacity-100');
  });

  it('uses the card tone for each stat label', () => {
    render(<CustomerStatsCards stats={stats} onFilterChange={vi.fn()} />);

    expect(screen.getByText('Tổng số khách hàng')).toHaveClass(
      'text-admin-blue-primary',
    );
    expect(screen.getByText('Đang hoạt động')).toHaveClass(
      'text-admin-success-text',
    );
    expect(screen.getByText('Ngừng hoạt động')).toHaveClass(
      'text-admin-red-dark',
    );
    expect(screen.getByText('Chưa liên hệ')).toHaveClass(
      'text-admin-neutral-800',
    );
    expect(screen.getByText('Chưa liên hệ')).toHaveClass('font-semibold');
  });

  it('shows the total comparison copy and status share of customers', () => {
    render(<CustomerStatsCards stats={stats} onFilterChange={vi.fn()} />);

    expect(screen.getByText('So với tháng trước')).toBeInTheDocument();
    expect(screen.getByText('60% tổng khách hàng')).toBeInTheDocument();
    expect(screen.getAllByText('20% tổng khách hàng')).toHaveLength(2);
  });

  it('shows month-over-month badges when a previous snapshot exists', () => {
    render(
      <CustomerStatsCards
        stats={stats}
        previousMonthStats={{
          snapshotDate: '2026-08-31',
          stats: {
            total: 8,
            active: 8,
            inactive: 1,
            withoutContact: 2,
          },
        }}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Tăng 25% so với tháng trước')).toHaveClass(
      'bg-admin-success-bg',
    );
    expect(screen.getByLabelText('Giảm 25% so với tháng trước')).toHaveClass(
      'bg-admin-red-bg',
    );
    expect(screen.getByLabelText('Tăng 100% so với tháng trước')).toHaveClass(
      'bg-admin-red-bg',
    );
    expect(
      screen.getAllByLabelText('Không đổi 0% so với tháng trước'),
    ).toHaveLength(1);
  });

  it('uses a success color when inactive customers decrease', () => {
    render(
      <CustomerStatsCards
        stats={stats}
        previousMonthStats={{
          snapshotDate: '2026-08-31',
          stats: {
            total: 10,
            active: 6,
            inactive: 4,
            withoutContact: 2,
          },
        }}
        onFilterChange={vi.fn()}
      />,
    );

    const improvingBadge = screen.getByLabelText('Giảm 50% so với tháng trước');
    expect(improvingBadge).toHaveClass('bg-admin-success-bg');
    expect(improvingBadge).toHaveClass('text-admin-success-text');
  });

  it('uses a success color when uncontacted customers increase', () => {
    render(
      <CustomerStatsCards
        stats={stats}
        previousMonthStats={{
          snapshotDate: '2026-08-31',
          stats: {
            total: 10,
            active: 6,
            inactive: 2,
            withoutContact: 1,
          },
        }}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Tăng 100% so với tháng trước')).toHaveClass(
      'bg-admin-success-bg',
    );
  });

  it('hides month-over-month badges without a previous snapshot', () => {
    render(<CustomerStatsCards stats={stats} onFilterChange={vi.fn()} />);

    expect(
      screen.queryByLabelText(/so với tháng trước$/i),
    ).not.toBeInTheDocument();
  });
});
