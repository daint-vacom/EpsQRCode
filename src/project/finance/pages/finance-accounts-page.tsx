import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Landmark, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
import { createFinanceAccount, loadFinanceAccounts } from '../api/finance.api';
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
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
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
  const columns = useFinanceAccountColumns({
    onView: (row) => navigate(`/finance/accounts/${row.id}`),
  });
  const table = useReactTable({
    data: rows,
    columns,
    state: { columnPinning: FINANCE_ACCOUNT_COLUMN_PINNING },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });
  const totals = useMemo(
    () => rows.reduce((sum, row) => sum + row.balance, 0),
    [rows],
  );
  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:overflow-hidden xl:p-5">
      <PageHeader
        title="Quỹ & Tài khoản"
        icon={Landmark}
        className="shrink-0"
      />
      <DataGrid
        table={table}
        recordCount={rows.length}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        emptyMessage={
          query.isError
            ? getApiErrorMessage(query.error)
            : 'Chưa có quỹ/tài khoản'
        }
      >
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader>
            <CardTitle>
              Danh sách tài khoản{' '}
              <span className="ms-2 text-sm font-normal text-muted-foreground">
                Tổng số dư VND: {totals.toLocaleString('vi-VN')} đ
              </span>
            </CardTitle>
            <CardToolbar>
              {canManage ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setCode('');
                    setName('');
                    setAccountType('cash');
                    setBankName('');
                    setBankAccountNumber('');
                    setBankAccountHolder('');
                    setOpen(true);
                  }}
                >
                  <Plus className="size-4" /> Thêm tài khoản
                </Button>
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
                placeholder="TM-01"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Tên tài khoản
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Quỹ tiền mặt"
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
