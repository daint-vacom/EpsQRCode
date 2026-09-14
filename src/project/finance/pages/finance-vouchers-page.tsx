import { useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { FilePlus2, Plus, Receipt, Search, WalletCards } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTable,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { loadFinanceVouchers } from '../api/finance.api';
import {
  FINANCE_VOUCHER_COLUMN_PINNING,
  useFinanceVoucherColumns,
} from '../table/finance-voucher.columns.generated';

export function FinanceVouchersPage() {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { hasPermission } = useUser();
  const [voucherType, setVoucherType] = useState<'all' | 'receipt' | 'payment'>(
    'all',
  );
  const [status, setStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  const query = useQuery({
    queryKey: [
      'project',
      'finance',
      'vouchers',
      tenantId,
      voucherType,
      status,
      keyword,
    ],
    queryFn: () =>
      loadFinanceVouchers(tenantId!, { voucherType, status, keyword }),
    enabled: Boolean(tenantId && hasPermission('finance:voucher:view')),
  });
  const rows = query.data ?? [];
  const columns = useFinanceVoucherColumns({
    onView: (row) => navigate(`${ROUTES.PROJECT.FINANCE_VOUCHERS}/${row.id}`),
    onEdit: (row) =>
      row.status === 'draft' &&
      navigate(`${ROUTES.PROJECT.FINANCE_VOUCHERS}/${row.id}/edit`),
  });
  const table = useReactTable({
    data: rows,
    columns,
    state: { columnPinning: FINANCE_VOUCHER_COLUMN_PINNING },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });
  const canCreate = hasPermission('finance:voucher:create');

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:overflow-hidden xl:p-5">
      <PageHeader title="Sổ thu chi" icon={WalletCards} className="shrink-0" />
      <DataGrid
        table={table}
        recordCount={rows.length}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        tableLayout={{ dense: true }}
        emptyMessage={
          query.isError
            ? getApiErrorMessage(query.error)
            : 'Chưa có phiếu thu chi'
        }
      >
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader className="flex-col items-stretch gap-3 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4 text-primary" /> Danh sách phiếu
            </CardTitle>
            <CardToolbar className="flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Tìm số phiếu, đối tượng..."
                  className="ps-8"
                />
              </div>
              <OptionSelect
                value={voucherType}
                onChange={(value) =>
                  setVoucherType((value || 'all') as typeof voucherType)
                }
                options={[
                  { value: 'all', label: 'Tất cả' },
                  { value: 'receipt', label: 'Phiếu thu' },
                  { value: 'payment', label: 'Phiếu chi' },
                ]}
                searchable={false}
                className="w-36"
              />
              <OptionSelect
                value={status}
                onChange={(value) => setStatus(value || 'all')}
                options={[
                  { value: 'all', label: 'Mọi trạng thái' },
                  { value: 'draft', label: 'Nháp' },
                  { value: 'posted', label: 'Đã ghi nhận' },
                  { value: 'reversed', label: 'Đã đảo' },
                ]}
                searchable={false}
                className="w-40"
              />
              {canCreate ? (
                <>
                  <Button asChild variant="primary">
                    <Link
                      to={`${ROUTES.PROJECT.FINANCE_VOUCHERS}/new?type=receipt`}
                    >
                      <Plus className="size-4" /> Lập phiếu thu
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link
                      to={`${ROUTES.PROJECT.FINANCE_VOUCHERS}/new?type=payment`}
                    >
                      <FilePlus2 className="size-4" /> Lập phiếu chi
                    </Link>
                  </Button>
                </>
              ) : null}
            </CardToolbar>
          </CardHeader>
          <CardTable className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardTable>
        </Card>
      </DataGrid>
    </div>
  );
}
