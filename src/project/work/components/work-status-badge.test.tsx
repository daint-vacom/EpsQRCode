import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkStatusBadge } from './work-status-badge';

describe('WorkStatusBadge', () => {
  it('renders a solid status badge', () => {
    render(<WorkStatusBadge status="in_progress" />);

    const badge = screen.getByText('Đang thực hiện');
    expect(badge).toHaveClass('bg-admin-amber-primary');
    expect(badge).toHaveClass('text-white');
  });
});
