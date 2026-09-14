import { useMemo, useState, type ReactNode } from 'react';
import { ROUTES } from '@/constants/routes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, LineChart, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import {
  deactivateFinanceAccount,
  loadFinanceAccountLedgerReport,
  loadFinanceAccounts,
  updateFinanceAccount,
} from '../api/finance.api';
import { FinanceAccountStatusBadge } from '../components/finance-account-status-badge';
import {
  FINANCE_ACCOUNT_TYPE_LABELS,
  formatFinanceAmount,
  type FinanceAccountActivity,
} from '../model/finance';
import { withFinanceRunningBalances } from '../model/finance-analytics';

const TODAY = new Date().toISOString().slice(0, 10);

export function FinanceAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useTenant();
  const { hasPermission } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<'cash' | 'bank'>('cash');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const canManage = hasPermission('finance:account:manage');
  const accountQuery = useQuery({
    queryKey: ['project', 'finance', 'accounts', tenantId],
    queryFn: () => loadFinanceAccounts(tenantId!),
    enabled: Boolean(tenantId),
  });
  const account = accountQuery.data?.find((item) => item.id === id);
  const ledgerQuery = useQuery({
    queryKey: [
      'project',
      'finance',
      'account-ledger-preview',
      tenantId,
      id,
      account?.openingDate,
      TODAY,
    ],
    queryFn: () =>
      loadFinanceAccountLedgerReport(
        tenantId!,
        id!,
        account!.openingDate,
        TODAY,
      ),
    enabled: Boolean(tenantId && id && account),
  });
  const recentActivities = useMemo(
    () =>
      account
        ? withFinanceRunningBalances(
            account.openingBalance,
            ledgerQuery.data ?? [],
          )
            .slice(-5)
            .reverse()
        : [],
    [account, ledgerQuery.data],
  );
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!tenantId || !id) throw new Error('Thiếu thông tin tài khoản.');
      return updateFinanceAccount(tenantId, id, {
        name,
        accountType,
        bankName,
        bankAccountNumber,
        bankAccountHolder,
      });
    },
    onSuccess: async () => {
      setEditOpen(false);
      toast.success('Đã cập nhật tài khoản.');
      await queryClient.invalidateQueries({
        queryKey: ['project', 'finance', 'accounts', tenantId],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!tenantId || !id) throw new Error('Thiếu thông tin tài khoản.');
      return deactivateFinanceAccount(tenantId, id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['project', 'finance', 'accounts', tenantId],
      });
      toast.success('Đã ngừng hoạt động tài khoản.');
      navigate(ROUTES.PROJECT.FINANCE_ACCOUNTS, { replace: true });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function openEdit() {
    if (!account) return;
    setName(account.name);
    setAccountType(account.accountType);
    setBankName(account.bankName);
    setBankAccountNumber(account.bankAccountNumber);
    setBankAccountHolder(account.bankAccountHolder);
    setEditOpen(true);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:p-5">
      <PageHeader
        title={account?.name ?? 'Chi tiết tài khoản'}
        icon={Landmark}
        onBack={() => navigate(ROUTES.PROJECT.FINANCE_ACCOUNTS)}
        actions={
          account && canManage ? (
            <>
              <Button type="button" variant="outline" onClick={openEdit}>
                <Pencil className="size-4" />
                Chỉnh sửa
              </Button>
              <Button
                type="button"
                variant="destructive"
                appearance="outline"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Xóa tài khoản
              </Button>
              <Button asChild variant="primary">
                <Link
                  to={`${ROUTES.PROJECT.FINANCE_ACCOUNT_REPORT}?accountId=${id ?? ''}`}
                >
                  <LineChart className="size-4" />
                  Xem báo cáo
                </Link>
              </Button>
            </>
          ) : account ? (
            <Button asChild variant="primary">
              <Link
                to={`${ROUTES.PROJECT.FINANCE_ACCOUNT_REPORT}?accountId=${id ?? ''}`}
              >
                <LineChart className="size-4" />
                Xem báo cáo
              </Link>
            </Button>
          ) : null
        }
      />
      {accountQuery.isError ? (
        <div className="text-sm text-destructive">
          {getApiErrorMessage(accountQuery.error)}
        </div>
      ) : null}
      {accountQuery.isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Đang tải thông tin quỹ/tài khoản...
          </CardContent>
        </Card>
      ) : !account ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Không tìm thấy quỹ/tài khoản này.
          </CardContent>
        </Card>
      ) : (
        <div className="mx-auto grid w-full max-w-[1200px] gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Thông tin quỹ / tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <InfoItem
                label="Mã tài khoản"
                value={account.code}
                mono
                layout="row"
              />
              <InfoItem
                label="Tên tài khoản"
                value={account.name}
                layout="row"
              />
              <InfoItem
                label="Loại"
                value={FINANCE_ACCOUNT_TYPE_LABELS[account.accountType]}
                layout="row"
              />
              <InfoItem
                label="Đơn vị tiền tệ"
                value={account.currencyCode}
                layout="row"
              />
              <InfoItem
                label="Ngày tạo"
                value={formatDate(account.openingDate)}
                layout="row"
              />
              <InfoItem
                label="Trạng thái"
                value={
                  <FinanceAccountStatusBadge isActive={account.isActive} />
                }
                layout="row"
              />
              {account.accountType === 'bank' ? (
                <>
                  <InfoItem
                    label="Ngân hàng"
                    value={account.bankName || '—'}
                    layout="row"
                  />
                  <InfoItem
                    label="Số tài khoản"
                    value={account.bankAccountNumber || '—'}
                    mono
                    layout="row"
                  />
                  <InfoItem
                    label="Chủ tài khoản"
                    value={account.bankAccountHolder || '—'}
                    layout="row"
                  />
                </>
              ) : null}
            </CardContent>
          </Card>
          <div className="flex h-full flex-col gap-4">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle>Số dư hiện tại</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-primary">
                  {formatAmount(account.balance)}
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4">
                  <InfoItem
                    label="Số dư đầu kỳ"
                    value={formatAmount(account.openingBalance)}
                  />
                  <InfoItem
                    label="Đơn vị tiền tệ"
                    value={account.currencyCode}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="min-w-0 flex-1 overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle>Biến động gần đây</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link
                    to={`${ROUTES.PROJECT.FINANCE_ACCOUNT_REPORT}?accountId=${id ?? ''}`}
                  >
                    Xem tất cả
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {ledgerQuery.isLoading ? (
                  <div className="p-5 text-sm text-muted-foreground">
                    Đang tải giao dịch gần đây...
                  </div>
                ) : ledgerQuery.isError ? (
                  <div className="p-5 text-sm text-destructive">
                    {getApiErrorMessage(ledgerQuery.error)}
                  </div>
                ) : recentActivities.length > 0 ? (
                  <RecentActivityTable rows={recentActivities} />
                ) : (
                  <div className="p-5 text-sm text-muted-foreground">
                    Chưa có giao dịch nào được ghi nhận.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {account ? (
        <>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Chỉnh sửa tài khoản</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Mã tài khoản
                  </label>
                  <Input value={account.code} disabled />
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
                  onClick={() => setEditOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={updateMutation.isPending}
                  onClick={() => {
                    if (!name.trim()) {
                      toast.error('Vui lòng nhập tên tài khoản.');
                      return;
                    }
                    updateMutation.mutate();
                  }}
                >
                  Lưu thay đổi
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Xóa tài khoản?"
            description={`Bạn có chắc muốn xóa tài khoản "${account.name}"? Tài khoản sẽ được ngừng hoạt động để bảo toàn lịch sử giao dịch.`}
            confirmLabel="Xóa tài khoản"
            confirmVariant="destructive"
            isConfirming={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate()}
          />
        </>
      ) : null}
    </div>
  );
}

function InfoItem({
  label,
  value,
  mono = false,
  layout = 'stacked',
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  layout?: 'stacked' | 'row';
}) {
  return (
    <div
      className={
        layout === 'row'
          ? 'flex items-start justify-between gap-4 border-b border-border/70 py-3.5 first:pt-0 last:border-b-0 last:pb-0'
          : ''
      }
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-sm font-semibold ${
          layout === 'row' ? 'text-right' : 'mt-1'
        } ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

function RecentActivityTable({ rows }: { rows: FinanceAccountActivity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] table-fixed text-sm">
        <colgroup>
          <col className="w-[82px]" />
          <col />
          <col className="w-[88px]" />
          <col className="w-[88px]" />
          <col className="w-[96px]" />
        </colgroup>
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-5 py-3 text-left font-medium">Ngày</th>
            <th className="px-3 py-3 text-left font-medium">Diễn giải</th>
            <th className="px-3 py-3 text-right font-medium">Thu</th>
            <th className="px-3 py-3 text-right font-medium">Chi</th>
            <th className="px-5 py-3 text-right font-medium">Số dư</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.movementId} className="border-t border-border/70">
              <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
                {formatDate(row.effectiveDate)}
              </td>
              <td className="max-w-[220px] px-3 py-3">
                <div className="truncate font-medium">
                  {row.description || row.voucherNo || 'Biến động tài khoản'}
                </div>
                {row.partyName ? (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {row.partyName}
                  </div>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-admin-success-text">
                {row.direction === 'in' ? formatFinanceAmount(row.amount) : '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-admin-red-dark">
                {row.direction === 'out'
                  ? formatFinanceAmount(row.amount)
                  : '—'}
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
                {formatFinanceAmount(row.runningBalance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAmount(value: number) {
  return `${value.toLocaleString('vi-VN')} đ`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN');
}
