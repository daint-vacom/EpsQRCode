import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FinanceAccountStatusBadge } from './finance-account-status-badge';

describe('FinanceAccountStatusBadge', () => {
  it('uses the solid active account badge shared by all finance surfaces', () => {
    render(<FinanceAccountStatusBadge isActive />);

    const badge = screen.getByText('Đang hoạt động');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-[var(--color-success-accent');
  });

  it('keeps the inactive account label in the shared component', () => {
    render(<FinanceAccountStatusBadge isActive={false} />);

    expect(screen.getByText('Ngừng hoạt động')).toBeInTheDocument();
  });
});
