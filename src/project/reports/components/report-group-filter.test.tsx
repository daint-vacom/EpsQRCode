import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReportGroupFilter } from './report-group-filter';

describe('ReportGroupFilter', () => {
  it('renders pill filters and changes the selected group', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<ReportGroupFilter value="all" onValueChange={onValueChange} />);

    expect(screen.getByRole('button', { name: 'Tất cả' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Tài chính' }));

    expect(onValueChange).toHaveBeenCalledWith('finance');
  });
});
