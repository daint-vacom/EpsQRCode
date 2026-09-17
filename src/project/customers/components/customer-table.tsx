import type { ReactNode } from 'react';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import type { TagSelectOption } from '@/project/tags/model/tag';
import type { OnChangeFn, PaginationState, Table } from '@tanstack/react-table';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { Customer, CustomerListFilters } from '../model/customer';

export interface CustomerTableController {
  customers: Customer[];
  total: number;
  keyword: string;
  setKeyword: (value: string) => void;
  filters: CustomerListFilters;
  setFilter: <TKey extends keyof CustomerListFilters>(
    key: TKey,
    value: CustomerListFilters[TKey],
  ) => void;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  customFields: CustomField[];
  tagsByCustomerId: Record<string, TagSelectOption[]>;
  isLoading: boolean;
  isFetching: boolean;
}

export interface CustomerTableProps {
  table: Table<Customer>;
  total: number;
  isLoading?: boolean;
  isFetching?: boolean;
  title?: ReactNode;
  toolbar?: ReactNode;
  secondaryRow?: ReactNode;
  emptyMessage?: ReactNode;
  className?: string;
  cardClassName?: string;
  tableLayout?: {
    dense?: boolean;
    showInlineFilters?: boolean;
    columnsVisibility?: boolean;
  };
}

/**
 * Shared customer-table shell. Page-level toolbars and bulk actions stay in
 * the owning feature; this component only owns the DataGrid/table layout.
 */
export function CustomerTable({
  table,
  total,
  isLoading = false,
  isFetching = false,
  title,
  toolbar,
  secondaryRow,
  emptyMessage = 'Chưa có khách hàng',
  className,
  cardClassName,
  tableLayout,
}: CustomerTableProps) {
  return (
    <DataGrid
      table={table}
      recordCount={total}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyMessage={emptyMessage}
      className={className}
      tableLayout={{
        dense: true,
        columnsVisibility: false,
        showInlineFilters: true,
        ...tableLayout,
      }}
    >
      <Card className={`min-w-0 flex-1 overflow-hidden ${cardClassName ?? ''}`}>
        <DataGridHeader
          title={title}
          toolbar={toolbar}
          secondaryRow={secondaryRow}
        />
        <CardTable className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <DataGridTable />
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardTable>
        <CardFooter className="justify-between">
          <DataGridPagination />
        </CardFooter>
      </Card>
    </DataGrid>
  );
}
