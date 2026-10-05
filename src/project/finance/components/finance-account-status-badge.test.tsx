import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FinanceAccountStatusBadge } from './finance-account-status-badge';

describe('FinanceAccountStatusBadge', () => {
  it('uses the shared inline active status indicator', () => {
    render(<FinanceAccountStatusBadge isActive />);

    const status = screen.getByText('Đang hoạt động');
    expect(status).toHaveClass(
      'inline-flex',
      'items-center',
      'gap-2',
      'text-sm',
      'font-normal',
      'text-foreground',
    );
    expect(status.querySelector('[aria-hidden="true"]')).toHaveClass(
      'size-2',
      'bg-admin-success-dot',
    );
  });

  it('uses the destructive dot and black label for inactive accounts', () => {
    render(<FinanceAccountStatusBadge isActive={false} />);

    const status = screen.getByText('Ngừng hoạt động');
    expect(status).toHaveClass('text-foreground');
    expect(status).not.toHaveClass('bg-destructive');
    expect(status.querySelector('[aria-hidden="true"]')).toHaveClass(
      'size-2',
      'bg-admin-red-primary',
    );
  });
});
