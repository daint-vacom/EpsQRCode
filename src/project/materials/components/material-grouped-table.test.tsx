import { vi as messagesVi } from '@/i18n/messages/vi';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import { MaterialGroupedTable } from './material-grouped-table';

describe('MaterialGroupedTable', () => {
  it('shows common and mixed values and opens the physical group by quantity', () => {
    const onOpenGroup = vi.fn();
    render(
      <IntlProvider locale="vi" messages={messagesVi}>
        <MaterialGroupedTable
          groups={[
            {
              groupKey: '["model-1",["warehouse"] ,null]',
              modelId: 'model-1',
              modelName: 'Máy đo',
              modelCode: 'MD-01',
              modelImage: null,
              modelImageUrl: 'https://example.com/model-cover.png',
              ownerName: 'Kho chính',
              condition: null,
              quantity: 3,
              common: {
                ownerName: 'Kho chính',
                code: '…',
                condition: 'good',
                groupId: null,
                holder: '—',
                status: 'available',
                availability: 'true',
              },
            },
          ]}
          total={1}
          pagination={{ pageIndex: 0, pageSize: 25 }}
          setPagination={vi.fn()}
          onOpenGroup={onOpenGroup}
          groupNameById={new Map()}
        />
      </IntlProvider>,
    );

    expect(screen.getByText('Máy đo')).toBeInTheDocument();
    expect(screen.getByText('MD-01')).toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/model-cover.png',
    );
    expect(screen.getByText('Còn tốt')).toBeInTheDocument();
    expect(screen.getByText('Còn tốt')).toHaveAttribute('data-slot', 'badge');
    expect(screen.getByText('Sẵn sàng')).toHaveAttribute('data-slot', 'badge');
    expect(screen.getByText('…')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Xem vật tư trong nhóm' }),
    );
    expect(onOpenGroup).toHaveBeenCalledWith('["model-1",["warehouse"] ,null]');
  });
});
