import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Landmark, Plus, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import { Card, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { createFinanceAccount, loadFinanceAccounts } from '../api/finance.api';
import { FinanceAccountStatusBadge } from '../components/finance-account-status-badge';
import {
  FINANCE_ACCOUNT_COLUMN_PINNING,
  useFinanceAccountColumns,
} from '../table/finance-account.columns.generated';

export function FinanceAccountsPage() {
  const { tenantId } = useTenant();
  const { hasPermission } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<'cash' | 'bank'>('cash');
  const [isActive, setIsActive] = useState(true);
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [keyword, setKeyword] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<
    'all' | 'cash' | 'bank'
  >('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const canManage = hasPermission('finance:account:manage');
  const query = useQuery({
    queryKey: ['project', 'finance', 'accounts', tenantId],
    queryFn: () => loadFinanceAccounts(tenantId!),
    enabled: Boolean(tenantId && hasPermission('finance:account:view')),
  });
  const mutation = useMutation({
    mutationFn: () =>
      createFinanceAccount(tenantId!, {
        code,
        name,
        accountType,
        bankName,
        bankAccountNumber,
        bankAccountHolder,
        isActive,
      }),
    onSuccess: async () => {
      setOpen(false);
      toast.success('Đã tạo tài khoản.');
      await queryClient.invalidateQueries({
        queryKey: ['project', 'finance', 'accounts', tenantId],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi-VN');
    return rows.filter((row) => {
      const matchesKeyword = normalizedKeyword
        ? [row.code, row.name, row.bankAccountNumber]
            .join(' ')
            .toLocaleLowerCase('vi-VN')
            .includes(normalizedKeyword)
        : true;
      const matchesType =
        accountTypeFilter === 'all' || row.accountType === accountTypeFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? row.isActive : !row.isActive);
      return matchesKeyword && matchesType && matchesStatus;
    });
  }, [accountTypeFilter, keyword, rows, statusFilter]);
  const columns = useFinanceAccountColumns({
    onView: (row) => navigate(`/finance/accounts/${row.id}`),
  });
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { columnPinning: FINANCE_ACCOUNT_COLUMN_PINNING },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });
  const totals = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.balance, 0),
    [filteredRows],
  );
  const hasFilters =
    Boolean(keyword.trim()) ||
    accountTypeFilter !== 'all' ||
    statusFilter !== 'all';
  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:overflow-hidden xl:p-5">
      <PageHeader
        title="Quỹ & Tài khoản"
        icon={Landmark}
        className="shrink-0"
        actions={
          canManage ? (
            <ShortcutTooltip label="Thêm tài khoản" shortcut="Alt + N">
              <Button
                variant="primary"
                data-shortcut-action="create"
                onClick={() => {
                  setCode('');
                  setName('');
                  setAccountType('cash');
                  setIsActive(true);
                  setBankName('');
                  setBankAccountNumber('');
                  setBankAccountHolder('');
                  setOpen(true);
                }}
              >
                <Plus className="size-4" />
                Thêm tài khoản
              </Button>
            </ShortcutTooltip>
          ) : null
        }
      />
      <DataGrid
        table={table}
        recordCount={filteredRows.length}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        tableLayout={{ dense: true, columnsVisibility: false }}
        emptyMessage={
          query.isError
            ? getApiErrorMessage(query.error)
            : hasFilters
              ? 'Không tìm thấy quỹ/tài khoản phù hợp'
              : 'Chưa có quỹ/tài khoản'
        }
      >
        <Card className="min-h-0 flex-1 overflow-hidden">
          <DataGridHeader
            title={
              <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-normal text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Danh sách tài khoản
                </span>
                <span>
                  Tổng số dư VND:{' '}
                  <span className="font-semibold text-foreground">
                    {totals.toLocaleString('vi-VN')} đ
                  </span>
                </span>
              </span>
            }
            toolbar={
              <>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="Tìm theo mã hoặc tên tài khoản"
                    aria-label="Tìm theo mã hoặc tên tài khoản"
                    className="ps-8"
                  />
                </div>
                <OptionSelect
                  value={accountTypeFilter}
                  onChange={(value) =>
                    setAccountTypeFilter(
                      (value || 'all') as typeof accountTypeFilter,
                    )
                  }
                  options={[
                    { value: 'all', label: 'Tất cả loại' },
                    { value: 'cash', label: 'Tiền mặt' },
                    { value: 'bank', label: 'Ngân hàng' },
                  ]}
                  searchable={false}
                  ariaLabel="Lọc theo loại tài khoản"
                  className="w-36"
                />
                <OptionSelect
                  value={statusFilter}
                  onChange={(value) =>
                    setStatusFilter((value || 'all') as typeof statusFilter)
                  }
                  options={[
                    { value: 'all', label: 'Mọi trạng thái' },
                    { value: 'active', label: 'Đang hoạt động' },
                    { value: 'inactive', label: 'Ngừng hoạt động' },
                  ]}
                  searchable={false}
                  ariaLabel="Lọc theo trạng thái tài khoản"
                  renderOption={(option) =>
                    option.value === 'all' ? (
                      option.label
                    ) : (
                      <FinanceAccountStatusBadge
                        isActive={option.value === 'active'}
                        size="sm"
                      />
                    )
                  }
                  triggerContent={(option) =>
                    option?.value === 'active' ||
                    option?.value === 'inactive' ? (
                      <FinanceAccountStatusBadge
                        isActive={option.value === 'active'}
                        size="sm"
                      />
                    ) : (
                      (option?.label ?? 'Mọi trạng thái')
                    )
                  }
                  className="w-40"
                />
                <Button
                  type="button"
                  variant="outline"
                  mode="icon"
                  aria-label="Làm mới"
                  title="Làm mới"
                  onClick={() => void query.refetch()}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </>
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
            <DialogTitle>Thêm quỹ / tài khoản</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Mã tài khoản
              </label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Tên tài khoản
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Loại tài khoản
              </label>
              <OptionSelect
                value={accountType}
                onChange={(value) =>
                  setAccountType((value || 'cash') as typeof accountType)
                }
                options={[
                  { value: 'cash', label: 'Tiền mặt' },
                  { value: 'bank', label: 'Ngân hàng' },
                ]}
                searchable={false}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Trạng thái
              </label>
              <OptionSelect
                value={String(isActive)}
                onChange={(value) => setIsActive(value !== 'false')}
                options={[
                  { value: 'true', label: 'Đang hoạt động' },
                  { value: 'false', label: 'Ngừng hoạt động' },
                ]}
                searchable={false}
                renderOption={(option) => (
                  <FinanceAccountStatusBadge
                    isActive={option.value === 'true'}
                    size="sm"
                  />
                )}
                triggerContent={() => (
                  <FinanceAccountStatusBadge isActive={isActive} size="sm" />
                )}
              />
            </div>
            {accountType === 'bank' ? (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Tên ngân hàng
                  </label>
                  <Input
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Số tài khoản
                  </label>
                  <Input
                    value={bankAccountNumber}
                    onChange={(event) =>
                      setBankAccountNumber(event.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Chủ tài khoản
                  </label>
                  <Input
                    value={bankAccountHolder}
                    onChange={(event) =>
                      setBankAccountHolder(event.target.value)
                    }
                  />
                </div>
              </>
            ) : null}
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
                if (!code.trim() || !name.trim()) {
                  toast.error('Vui lòng nhập mã và tên tài khoản.');
                  return;
                }
                mutation.mutate();
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
