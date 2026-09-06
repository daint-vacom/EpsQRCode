import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CUSTOMER_LIST_INITIAL_FILTERS } from '../model/customer';
import type { CustomerSavedView } from '../model/customer-saved-view';
import { CustomerFilterViewControl } from './customer-filter-view-control';

vi.mock('./customer-filter-drawer', () => ({
  CustomerFilterDrawer: ({ trigger }: { trigger: ReactNode }) => trigger,
}));

const view: CustomerSavedView = {
  id: 'view-1',
  tenantId: 'tenant-1',
  resource: 'customers',
  name: 'View A',
  config: {
    version: 1,
    keyword: '',
    filters: CUSTOMER_LIST_INITIAL_FILTERS,
    columnVisibility: {},
    columnOrder: [],
  },
  isDefault: false,
  version: 1,
  createdBy: null,
  updatedBy: null,
  createdAt: '',
  updatedAt: '',
};

describe('CustomerFilterViewControl', () => {
  it('shows the edit action for a view and opens its editor', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onSelect = vi.fn();

    render(
      <CustomerFilterViewControl
        views={[view]}
        activeViewId={null}
        canManage
        showInlineFilters={false}
        onShowInlineFiltersChange={vi.fn()}
        filters={CUSTOMER_LIST_INITIAL_FILTERS}
        onSelect={onSelect}
        onCreate={vi.fn()}
        onEdit={onEdit}
        onSaveCurrent={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Chọn chế độ xem hoặc thao tác bộ lọc',
      }),
    );

    const viewItem = screen.getByRole('menuitem', { name: /View A/ });
    expect(viewItem.parentElement).toHaveClass('group');
    await user.hover(viewItem);

    await user.click(screen.getByRole('button', { name: 'Sửa view View A' }));

    expect(onEdit).toHaveBeenCalledWith(view);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
