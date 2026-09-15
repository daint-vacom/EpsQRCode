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

  it('uses a solid destructive badge for inactive accounts', () => {
    render(<FinanceAccountStatusBadge isActive={false} />);

    const badge = screen.getByText('Ngừng hoạt động');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-destructive');
  });
});
