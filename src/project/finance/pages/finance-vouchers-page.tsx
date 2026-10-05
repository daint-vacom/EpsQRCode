import { useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  FilePlus2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  WalletCards,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import { Card, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnVisibility } from '@/components/ui/data-grid-column-visibility';
import { DataGridFilterDrawer } from '@/components/ui/data-grid-filter-drawer';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const query = useQuery({
    queryKey: [
      'project',
      'finance',
      'vouchers',
      tenantId,
      voucherType,
      status,
      keyword,
      dateFrom,
      dateTo,
    ],
    queryFn: () =>
      loadFinanceVouchers(tenantId!, {
        voucherType,
        status,
        keyword,
        from: dateFrom,
        to: dateTo,
      }),
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
  const hasFilters =
    voucherType !== 'all' ||
    status !== 'all' ||
    Boolean(keyword.trim()) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);
  const resetFilters = () => {
    setVoucherType('all');
    setStatus('all');
    setKeyword('');
    setDateFrom('');
    setDateTo('');
    setDraftDateFrom('');
    setDraftDateTo('');
  };
  const openFilterDrawer = () => {
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setFilterDrawerOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:overflow-hidden xl:p-5">
      <PageHeader
        title="Sổ thu chi"
        icon={WalletCards}
        className="shrink-0"
        actions={
          canCreate ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="primary">
                <Link
                  to={`${ROUTES.PROJECT.FINANCE_VOUCHERS}/new?type=receipt`}
                >
                  <Plus /> Lập phiếu thu
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  to={`${ROUTES.PROJECT.FINANCE_VOUCHERS}/new?type=payment`}
                >
                  <FilePlus2 /> Lập phiếu chi
                </Link>
              </Button>
            </div>
          ) : null
        }
      />
      <DataGrid
        table={table}
        recordCount={rows.length}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        tableLayout={{ dense: true }}
        emptyMessage={
          query.isError
            ? getApiErrorMessage(query.error)
            : hasFilters
              ? 'Không tìm thấy phiếu thu chi phù hợp'
              : 'Chưa có phiếu thu chi'
        }
      >
        <Card className="min-h-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            stats={
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="Tìm số phiếu, đối tượng..."
                    aria-label="Tìm số phiếu, đối tượng"
                    className="ps-9"
                  />
                </div>
                <OptionSelect
                  value={voucherType === 'all' ? '' : voucherType}
                  onChange={(value) =>
                    setVoucherType((value || 'all') as typeof voucherType)
                  }
                  options={[
                    { value: 'receipt', label: 'Phiếu thu' },
                    { value: 'payment', label: 'Phiếu chi' },
                  ]}
                  searchable={false}
                  placeholder="Thu/Chi"
                  ariaLabel="Lọc theo loại phiếu"
                  className="w-36 shrink-0"
                />
                <OptionSelect
                  value={status === 'all' ? '' : status}
                  onChange={(value) => setStatus(value || 'all')}
                  options={[
                    { value: 'draft', label: 'Nháp' },
                    { value: 'posted', label: 'Đã ghi nhận' },
                    { value: 'cancelled', label: 'Đã hủy' },
                    { value: 'reversed', label: 'Đã đảo' },
                  ]}
                  searchable={false}
                  placeholder="Trạng thái"
                  ariaLabel="Lọc theo trạng thái phiếu"
                  className="w-40 shrink-0"
                />
                <DataGridFilterDrawer
                  open={filterDrawerOpen}
                  onOpenChange={setFilterDrawerOpen}
                  title="Lọc phiếu thu chi"
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openFilterDrawer}
                    >
                      <SlidersHorizontal /> Lọc chi tiết
                    </Button>
                  }
                  footer={
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={resetFilters}
                      >
                        Xóa bộ lọc
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => {
                          setDateFrom(draftDateFrom);
                          setDateTo(draftDateTo);
                          setFilterDrawerOpen(false);
                        }}
                      >
                        Áp dụng
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label variant="secondary">Từ ngày</Label>
                      <Input
                        type="date"
                        value={draftDateFrom}
                        onChange={(event) =>
                          setDraftDateFrom(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label variant="secondary">Đến ngày</Label>
                      <Input
                        type="date"
                        value={draftDateTo}
                        onChange={(event) => setDraftDateTo(event.target.value)}
                      />
                    </div>
                  </div>
                </DataGridFilterDrawer>
              </div>
            }
            toolbar={
              <div className="ms-auto flex shrink-0 items-center gap-2.5">
                <Button
                  variant="outline"
                  mode="icon"
                  aria-label="Làm mới"
                  title="Làm mới"
                  onClick={() => void query.refetch()}
                >
                  <RefreshCw />
                </Button>
                <DataGridColumnVisibility table={table} mode="drawer" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      mode="icon"
                      aria-label="Tùy chọn bộ lọc"
                      title="Tùy chọn bộ lọc"
                    >
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Bộ lọc</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={openFilterDrawer}>
                      <SlidersHorizontal /> Mở bộ lọc chi tiết
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={!hasFilters}
                      onSelect={resetFilters}
                    >
                      <X /> Xóa tất cả bộ lọc
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />
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
