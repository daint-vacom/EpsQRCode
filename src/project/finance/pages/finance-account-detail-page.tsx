import { useState, type ReactNode } from 'react';
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
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import {
  deactivateFinanceAccount,
  loadFinanceAccounts,
  updateFinanceAccount,
} from '../api/finance.api';
import { FinanceAccountStatusBadge } from '../components/finance-account-status-badge';
import { FINANCE_ACCOUNT_TYPE_LABELS } from '../model/finance';

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
  const [isActive, setIsActive] = useState(true);
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
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!tenantId || !id) throw new Error('Thiếu thông tin tài khoản.');
      return updateFinanceAccount(tenantId, id, {
        name,
        accountType,
        isActive,
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
    setIsActive(account.isActive);
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
        showBackButton
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
                mode="icon"
                size="icon"
                aria-label={`Xóa tài khoản ${account.name}`}
                title={`Xóa tài khoản ${account.name}`}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
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
      {accountQuery.isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Đang tải thông tin quỹ/tài khoản...
          </CardContent>
        </Card>
      ) : accountQuery.isError ? (
        <ErrorState
          title="Không tải được thông tin quỹ/tài khoản"
          description={getApiErrorMessage(accountQuery.error)}
          onRetry={() => void accountQuery.refetch()}
        />
      ) : !account ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Không tìm thấy quỹ/tài khoản này.
          </CardContent>
        </Card>
      ) : (
        <div className="mx-auto grid w-full max-w-[1440px] gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <Card>
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
                <InfoItem label="Đơn vị tiền tệ" value={account.currencyCode} />
              </div>
            </CardContent>
          </Card>
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
                      />
                    )}
                    triggerContent={() => (
                      <FinanceAccountStatusBadge isActive={isActive} />
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

function formatAmount(value: number) {
  return `${value.toLocaleString('vi-VN')} đ`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN');
}
