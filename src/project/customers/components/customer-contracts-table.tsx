import { useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ContractDetailDialog } from '../../contracts/components/contract-detail-dialog';
import { useContractDetailQuery } from '../../contracts/hooks/use-contract-detail-query';
import { useCustomerContractList } from '../hooks/use-customer-contract-list';
import {
  CONTRACT_COLUMN_PINNING,
  useContractColumns,
} from '../table/customer-contract.columns.generated';

export function CustomerContractsTable({ customerId }: { customerId: string }) {
  const navigate = useNavigate();
  const [detailContractId, setDetailContractId] = useState<string | null>(null);
  const {
    contracts,
    total,
    pagination,
    onPaginationChange,
    tenantQuery,
    workspaceQuery,
  } = useCustomerContractList(customerId);
  const detailQuery = useContractDetailQuery(detailContractId ?? undefined);
  const columns = useContractColumns({
    onView: (contract) => setDetailContractId(contract.id),
    onOther: (contract) =>
      navigate(buildPath(ROUTES.PROJECT.CONTRACT_DETAIL, { id: contract.id })),
  });
  const table = useReactTable({
    data: contracts,
    columns,
    getRowId: (row) => row.id,
    state: { pagination, columnPinning: CONTRACT_COLUMN_PINNING },
    onPaginationChange,
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.pageSize),
    getCoreRowModel: getCoreRowModel(),
  });

  const error = tenantQuery.error ?? workspaceQuery.error;
  const isLoading = tenantQuery.isPending || workspaceQuery.isLoading;

  if (tenantQuery.isError || workspaceQuery.isError) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <TriangleAlert className="size-7 text-destructive" />
        <div>
          <CardTitle>Không tải được hợp đồng</CardTitle>
          <CardDescription className="mt-1">
            {getApiErrorMessage(error)}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void tenantQuery.refetch();
            void workspaceQuery.refetch();
          }}
        >
          Thử lại
        </Button>
      </Card>
    );
  }

  return (
    <>
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isLoading}
        isFetching={workspaceQuery.isFetching}
        emptyMessage="Khách hàng chưa có hợp đồng"
      >
        <Card className="min-h-0 overflow-hidden">
          <CardHeader>
            <CardHeading>
              <CardTitle>Hợp đồng</CardTitle>
              <CardDescription>{total} hợp đồng</CardDescription>
            </CardHeading>
          </CardHeader>
          <CardTable className="min-h-0">
            <ScrollArea className="h-[420px]">
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardTable>
          <CardFooter className="justify-between">
            <DataGridPagination />
          </CardFooter>
        </Card>
      </DataGrid>
      <ContractDetailDialog
        open={Boolean(detailContractId)}
        onOpenChange={(open) => {
          if (!open) setDetailContractId(null);
        }}
        contract={detailQuery.data ?? null}
        isLoading={detailQuery.isPending}
      />
    </>
  );
}
