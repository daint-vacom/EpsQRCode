import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  CircleDollarSign,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { loadCustomerSelectOptions } from '../../customers/api/customers.api';
import {
  createFinanceObligation,
  loadFinanceObligations,
} from '../api/finance.api';
import type { FinanceObligation } from '../model/finance';
import {
  FINANCE_OBLIGATION_COLUMN_PINNING,
  useFinanceObligationColumns,
} from '../table/finance-obligation.columns.generated';

export function FinanceObligationsPage() {
  const { tenantId } = useTenant();
  const { userId, hasPermission } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<'receivable' | 'payable'>(
    'receivable',
  );
  const [keyword, setKeyword] = useState('');
  const [partyType, setPartyType] = useState<'all' | 'customer' | 'employee'>(
    'all',
  );
  const [dueOnOrBefore, setDueOnOrBefore] = useState('');
  const [minimumOutstanding, setMinimumOutstanding] = useState('');
  const [maximumOutstanding, setMaximumOutstanding] = useState('');
  const [draftDueOnOrBefore, setDraftDueOnOrBefore] = useState('');
  const [draftMinimumOutstanding, setDraftMinimumOutstanding] = useState('');
  const [draftMaximumOutstanding, setDraftMaximumOutstanding] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const customersQuery = useQuery({
    queryKey: ['project', 'finance', 'obligation-customers', userId, tenantId],
    queryFn: () => loadCustomerSelectOptions(userId!, tenantId!),
    enabled: Boolean(userId && tenantId && open),
  });
  const query = useQuery({
    queryKey: ['project', 'finance', 'obligations', tenantId, direction],
    queryFn: () => loadFinanceObligations(tenantId!, direction),
    enabled: Boolean(tenantId && hasPermission('finance:obligation:view')),
  });
  const mutation = useMutation({
    mutationFn: ({ requestKey }: { requestKey: string }) =>
      createFinanceObligation(
        tenantId!,
        {
          code,
          description,
          customerId,
          direction,
          documentDate,
          dueDate,
          originalAmount: Number(originalAmount),
        },
        requestKey,
      ),
    onSuccess: async () => {
      setOpen(false);
      toast.success('Đã ghi nhận công nợ.');
      await queryClient.invalidateQueries({
        queryKey: ['project', 'finance', 'obligations', tenantId, direction],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi-VN');
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesKeyword = normalizedKeyword
          ? [row.code, row.description, row.partyNameSnapshot, row.contractName]
              .join(' ')
              .toLocaleLowerCase('vi-VN')
              .includes(normalizedKeyword)
          : true;
        const matchesPartyType =
          partyType === 'all' || row.partyType === partyType;
        const matchesDueDate =
          !dueOnOrBefore ||
          (row.dueDate !== null && row.dueDate <= dueOnOrBefore);
        const matchesMinimumOutstanding =
          !minimumOutstanding ||
          row.outstandingAmount >= Number(minimumOutstanding);
        const matchesMaximumOutstanding =
          !maximumOutstanding ||
          row.outstandingAmount <= Number(maximumOutstanding);
        return (
          matchesKeyword &&
          matchesPartyType &&
          matchesDueDate &&
          matchesMinimumOutstanding &&
          matchesMaximumOutstanding
        );
      }),
    [
      dueOnOrBefore,
      maximumOutstanding,
      minimumOutstanding,
      normalizedKeyword,
      partyType,
      rows,
    ],
  );
  const hasFilters =
    direction !== 'receivable' ||
    Boolean(normalizedKeyword) ||
    partyType !== 'all' ||
    Boolean(dueOnOrBefore) ||
    Boolean(minimumOutstanding) ||
    Boolean(maximumOutstanding);
  const resetFilters = () => {
    setDirection('receivable');
    setKeyword('');
    setPartyType('all');
    setDueOnOrBefore('');
    setMinimumOutstanding('');
    setMaximumOutstanding('');
    setDraftDueOnOrBefore('');
    setDraftMinimumOutstanding('');
    setDraftMaximumOutstanding('');
  };
  const handleFilterDrawerOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftDueOnOrBefore(dueOnOrBefore);
      setDraftMinimumOutstanding(minimumOutstanding);
      setDraftMaximumOutstanding(maximumOutstanding);
    }
    setFilterDrawerOpen(nextOpen);
  };
  const openFilterDrawer = () => handleFilterDrawerOpenChange(true);
  const handleView = useCallback(
    (row: FinanceObligation) => navigate(`/finance/obligations/${row.id}`),
    [navigate],
  );
  const columns = useFinanceObligationColumns({
    onView: handleView,
  });
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { columnPinning: FINANCE_OBLIGATION_COLUMN_PINNING },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:overflow-hidden xl:p-5">
      <PageHeader
        title="Công nợ"
        icon={CircleDollarSign}
        className="shrink-0"
        actions={
          hasPermission('finance:obligation:create') ? (
            <Button
              variant="primary"
              onClick={() => {
                setCode('');
                setDescription('');
                setCustomerId('');
                setDocumentDate(new Date().toISOString().slice(0, 10));
                setDueDate('');
                setOriginalAmount('');
                setOpen(true);
              }}
            >
              <Plus /> Thêm công nợ
            </Button>
          ) : null
        }
      />
      <DataGrid
        table={table}
        recordCount={filteredRows.length}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        tableLayout={{ dense: true }}
        emptyMessage={
          query.isError
            ? getApiErrorMessage(query.error)
            : hasFilters
              ? 'Không tìm thấy công nợ phù hợp'
              : 'Chưa có công nợ đã ghi nhận'
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
                    placeholder="Tìm mã, nội dung hoặc đối tượng..."
                    aria-label="Tìm công nợ"
                    className="ps-9"
                  />
                </div>
                <OptionSelect
                  value={direction}
                  onChange={(value) =>
                    setDirection((value || 'receivable') as typeof direction)
                  }
                  options={[
                    { value: 'receivable', label: 'Phải thu' },
                    { value: 'payable', label: 'Phải trả' },
                  ]}
                  searchable={false}
                  ariaLabel="Lọc theo chiều công nợ"
                  className="w-36 shrink-0"
                />
                <OptionSelect
                  value={partyType === 'all' ? '' : partyType}
                  onChange={(value) =>
                    setPartyType((value || 'all') as typeof partyType)
                  }
                  options={[
                    { value: 'customer', label: 'Khách hàng' },
                    { value: 'employee', label: 'Nhân viên' },
                  ]}
                  searchable={false}
                  placeholder="Đối tượng"
                  ariaLabel="Lọc theo loại đối tượng"
                  className="w-40 shrink-0"
                />
                <DataGridFilterDrawer
                  open={filterDrawerOpen}
                  onOpenChange={handleFilterDrawerOpenChange}
                  title="Lọc công nợ theo đối tượng"
                  trigger={
                    <Button type="button" variant="outline">
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
                          setDueOnOrBefore(draftDueOnOrBefore);
                          setMinimumOutstanding(draftMinimumOutstanding);
                          setMaximumOutstanding(draftMaximumOutstanding);
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
                      <Label variant="secondary">Hạn thanh toán đến</Label>
                      <Input
                        type="date"
                        value={draftDueOnOrBefore}
                        onChange={(event) =>
                          setDraftDueOnOrBefore(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label variant="secondary">Còn nợ từ</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={draftMinimumOutstanding}
                        onChange={(event) =>
                          setDraftMinimumOutstanding(event.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label variant="secondary">Còn nợ đến</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={draftMaximumOutstanding}
                        onChange={(event) =>
                          setDraftMaximumOutstanding(event.target.value)
                        }
                        placeholder="Không giới hạn"
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Thêm công nợ{' '}
              {direction === 'receivable' ? 'phải thu' : 'phải trả'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Mã công nợ
              </label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="CN-2026-001"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Đối tượng
              </label>
              <OptionSelect
                value={customerId}
                onChange={(value) => setCustomerId(value || '')}
                options={(customersQuery.data ?? []).map((item) => ({
                  value: item.id,
                  label: `${item.customerCode} - ${item.name}`,
                }))}
                searchable
                placeholder="Chọn khách hàng"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Nội dung
              </label>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Phí dịch vụ tháng 09/2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Ngày chứng từ
                </label>
                <Input
                  type="date"
                  value={documentDate}
                  onChange={(event) => setDocumentDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Hạn thanh toán
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Số tiền
              </label>
              <Input
                inputMode="decimal"
                value={originalAmount}
                onChange={(event) => setOriginalAmount(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={mutation.isPending}
              onClick={() => {
                if (
                  !code.trim() ||
                  !description.trim() ||
                  !customerId ||
                  !documentDate ||
                  Number(originalAmount) <= 0
                ) {
                  toast.error(
                    'Vui lòng nhập đủ thông tin công nợ và số tiền lớn hơn 0.',
                  );
                  return;
                }
                mutation.mutate({ requestKey: crypto.randomUUID() });
              }}
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
