import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataGrid } from '@/components/ui/data-grid';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import { DataGridTable } from './data-grid-table';

interface TestRow {
  id: string;
  name: string;
}

function LoadingTable({ columns }: { columns: ColumnDef<TestRow>[] }) {
  const table = useReactTable({
    data: [],
    columns,
    state: { pagination: { pageIndex: 0, pageSize: 3 } },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataGrid table={table} recordCount={0} isLoading>
      <DataGridTable />
    </DataGrid>
  );
}

function FetchingTable() {
  const table = useReactTable({
    data: [{ id: '1', name: 'Nhân viên cũ' }],
    columns: [{ id: 'name', accessorKey: 'name', header: 'Tên' }],
    state: { pagination: { pageIndex: 0, pageSize: 3 } },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataGrid table={table} recordCount={1} isFetching>
      <DataGridTable />
    </DataGrid>
  );
}

function HiddenInlineFilterTable() {
  const table = useReactTable({
    data: [],
    columns: [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Tên',
        meta: {
          headerFilter: (
            <input aria-label="Lọc theo tên" data-testid="header-filter" />
          ),
        },
      },
    ],
    state: { pagination: { pageIndex: 0, pageSize: 3 } },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataGrid
      table={table}
      recordCount={0}
      tableLayout={{ showInlineFilters: false }}
    >
      <DataGridTable />
    </DataGrid>
  );
}

function PinnedTable() {
  const table = useReactTable({
    data: [{ id: '1', name: 'Nhân viên' }],
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Tên' },
      { id: 'actions', header: 'Thao tác', cell: () => 'Sửa', size: 80 },
    ],
    state: {
      pagination: { pageIndex: 0, pageSize: 3 },
      columnPinning: { right: ['actions'] },
    },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataGrid table={table} recordCount={1}>
      <DataGridTable />
    </DataGrid>
  );
}

function ActionSpacingTable({ dense }: { dense: boolean }) {
  const col = createColumnHelpers<TestRow>();
  const table = useReactTable({
    data: [{ id: '1', name: 'Tài khoản mẫu' }],
    columns: [
      col.actions({
        id: 'actions',
        header: '',
        size: getDataGridActionsColumnSize(1),
        cell: () => (
          <DataGridActionButton
            action="edit"
            type="button"
            mode="icon"
            size="sm"
            aria-label="Sửa"
          >
            <span className="size-4" aria-hidden="true" />
          </DataGridActionButton>
        ),
      }),
    ],
    state: { columnPinning: { right: ['actions'] } },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataGrid table={table} recordCount={1} tableLayout={{ dense }}>
      <DataGridTable />
    </DataGrid>
  );
}

describe('DataGridTable loading state', () => {
  it('renders default skeleton cells for every loading row and column', () => {
    render(
      <LoadingTable
        columns={[
          { id: 'name', accessorKey: 'name', header: 'Tên' },
          { id: 'total', accessorKey: 'total', header: 'Tổng tiền' },
        ]}
      />,
    );

    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(6);
    expect(
      document.querySelector('[data-slot="data-grid-fetching-overlay"]'),
    ).not.toBeInTheDocument();
  });

  it('keeps a column-specific skeleton override', () => {
    render(
      <LoadingTable
        columns={[
          {
            id: 'name',
            accessorKey: 'name',
            header: 'Tên',
            meta: { skeleton: <span data-testid="custom-skeleton" /> },
          },
        ]}
      />,
    );

    expect(screen.getAllByTestId('custom-skeleton')).toHaveLength(3);
    expect(
      document.querySelector('[data-slot="skeleton"]'),
    ).not.toBeInTheDocument();
  });

  it('keeps previous rows visible with a fetching shimmer state', () => {
    render(<FetchingTable />);

    expect(screen.getByText('Nhân viên cũ')).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="data-grid-fetching-overlay"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="data-grid-table-body"]'),
    ).toHaveAttribute('data-fetching', 'true');
  });

  it('renders an inline header filter below the column label', () => {
    render(
      <LoadingTable
        columns={[
          {
            id: 'name',
            accessorKey: 'name',
            header: 'Tên',
            meta: {
              headerFilter: (
                <input aria-label="Lọc theo tên" data-testid="header-filter" />
              ),
            },
          },
        ]}
      />,
    );

    const header = screen.getByRole('columnheader');
    expect(header).toHaveTextContent('Tên');
    expect(header).toContainElement(screen.getByTestId('header-filter'));
  });

  it('hides inline header filters when the table layout disables them', () => {
    render(<HiddenInlineFilterTable />);

    expect(screen.getByRole('columnheader')).toHaveTextContent('Tên');
    expect(screen.queryByTestId('header-filter')).not.toBeInTheDocument();
  });

  it('styles state-pinned columns without enabling pin controls', () => {
    render(<PinnedTable />);

    const pinnedHeader = screen
      .getAllByRole('columnheader')
      .find((header) => header.dataset.pinned === 'right');

    expect(pinnedHeader).toHaveStyle({ position: 'sticky' });
    expect(pinnedHeader).toHaveTextContent('Thao tác');
    expect(screen.queryByText('Ghim phải')).not.toBeInTheDocument();
  });
});

describe('DataGridTable action column spacing', () => {
  it.each([false, true])('fits the action button with dense=%s', (dense) => {
    render(<ActionSpacingTable dense={dense} />);

    const cell = screen.getByRole('cell');
    const button = screen.getByRole('button', { name: 'Sửa' });

    expect(cell).toHaveClass('px-2.5');
    expect(cell).not.toHaveClass('px-6');
    expect(cell).toHaveStyle({ width: '48px' });
    expect(button).toHaveClass('w-7', 'h-7', 'p-0');
  });
});
