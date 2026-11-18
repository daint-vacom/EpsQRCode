import { vi as messages } from '@/i18n/messages/vi';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import { MaterialGroupingControls } from './material-grouping-controls';

describe('MaterialGroupingControls', () => {
  it('previews all four quantity modes and applies only the selected configuration', () => {
    const onApply = vi.fn();
    render(
      <IntlProvider locale="vi" messages={messages}>
        <MaterialGroupingControls
          enabled
          onEnabledChange={vi.fn()}
          config={{ owner: true, condition: false }}
          onApply={onApply}
        />
      </IntlProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Thiết lập cách gom nhóm' }),
    );
    const table = () =>
      within(screen.getByRole('table', { name: 'Ví dụ minh họa' }));
    expect(
      screen.getByRole('radio', { name: 'Theo từng đơn vị quản lý' }),
    ).toBeChecked();
    expect(table().getAllByRole('row')).toHaveLength(3);
    expect(table().getByText('3')).toBeInTheDocument();
    expect(table().getByText('2')).toBeInTheDocument();
    expect(screen.queryByText(/\{dimensions\}/)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('radio', { name: 'Tổng số lượng của các đơn vị' }),
    );
    expect(table().getAllByRole('row')).toHaveLength(2);
    expect(table().getByText('5')).toBeInTheDocument();
    expect(
      table().queryByRole('columnheader', { name: 'Đơn vị quản lý' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Hiển thị riêng từng tình trạng' }),
    );
    expect(table().getAllByRole('row')).toHaveLength(3);
    expect(table().getByText('Còn tốt')).toBeInTheDocument();
    expect(table().getByText('Hỏng hóc')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('radio', { name: 'Theo từng đơn vị quản lý' }),
    );
    expect(table().getAllByRole('row')).toHaveLength(5);
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(onApply).toHaveBeenCalledWith({ owner: true, condition: true });
  });
});
