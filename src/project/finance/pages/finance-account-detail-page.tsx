import { ROUTES } from '@/constants/routes';
import { useQuery } from '@tanstack/react-query';
import { Landmark, LineChart } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { loadFinanceAccounts } from '../api/finance.api';

export function FinanceAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const accountQuery = useQuery({
    queryKey: ['project', 'finance', 'accounts', tenantId],
    queryFn: () => loadFinanceAccounts(tenantId!),
    enabled: Boolean(tenantId),
  });
  const account = accountQuery.data?.find((item) => item.id === id);

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:p-5">
      <PageHeader
        title={account?.name ?? 'Chi tiết tài khoản'}
        icon={Landmark}
        onBack={() => navigate(ROUTES.PROJECT.FINANCE_ACCOUNTS)}
        titleAside={
          account ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{account.code}</span>
              <span aria-hidden="true">·</span>
              <span>
                {account.accountType === 'bank' ? 'Ngân hàng' : 'Tiền mặt'}
              </span>
              <Badge
                variant={account.isActive ? 'success' : 'secondary'}
                appearance="light"
                size="sm"
              >
                {account.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
              </Badge>
            </div>
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
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin quỹ / tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <InfoItem label="Mã tài khoản" value={account.code} mono />
              <InfoItem
                label="Loại"
                value={
                  account.accountType === 'bank' ? 'Ngân hàng' : 'Tiền mặt'
                }
              />
              <InfoItem
                label="Số dư đầu kỳ"
                value={account.openingBalance.toLocaleString('vi-VN') + ' đ'}
              />
              <InfoItem
                label="Số dư hiện tại"
                value={account.balance.toLocaleString('vi-VN') + ' đ'}
                emphasize
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-start justify-between gap-4 py-5 sm:flex-row sm:items-center">
              <div>
                <div className="font-medium">Theo dõi biến động thu chi</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Xem biểu đồ, thống kê và lịch sử giao dịch theo khoảng thời
                  gian.
                </div>
              </div>
              <Button asChild variant="primary">
                <Link
                  to={`${ROUTES.PROJECT.FINANCE_ACCOUNT_REPORT}?accountId=${id ?? ''}`}
                >
                  <LineChart className="size-4" /> Xem báo cáo
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function InfoItem({
  label,
  value,
  mono = false,
  emphasize = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-sm font-semibold ${mono ? 'font-mono' : ''} ${
          emphasize ? 'text-primary' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}
