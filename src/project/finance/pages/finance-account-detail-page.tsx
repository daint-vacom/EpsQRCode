import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Landmark } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  loadFinanceAccountLedgerReport,
  loadFinanceAccounts,
} from '../api/finance.api';
import { formatFinanceAmount } from '../model/finance';

export function FinanceAccountDetailPage() {
  const { id } = useParams();
  const { tenantId } = useTenant();
  const accountQuery = useQuery({
    queryKey: ['project', 'finance', 'accounts', tenantId],
    queryFn: () => loadFinanceAccounts(tenantId!),
    enabled: Boolean(tenantId),
  });
  const account = accountQuery.data?.find((item) => item.id === id);
  const from = account?.openingDate ?? new Date().toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const ledgerQuery = useQuery({
    queryKey: ['project', 'finance', 'account-ledger', tenantId, id, from, to],
    queryFn: () => loadFinanceAccountLedgerReport(tenantId!, id!, from, to),
    enabled: Boolean(tenantId && id && account),
  });
  const movements = useMemo(() => ledgerQuery.data ?? [], [ledgerQuery.data]);
  const balance =
    (account?.openingBalance ?? 0) +
    movements.reduce(
      (sum, row) => sum + (row.direction === 'in' ? row.amount : -row.amount),
      0,
    );
  const error = accountQuery.isError
    ? getApiErrorMessage(accountQuery.error)
    : ledgerQuery.isError
      ? getApiErrorMessage(ledgerQuery.error)
      : undefined;
  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:p-5">
      <PageHeader
        title={account?.name ?? 'Chi tiết tài khoản'}
        icon={Landmark}
      />
      <Button asChild variant="outline" className="w-fit">
        <Link to="/finance/accounts">
          <ArrowLeft className="size-4" /> Quay lại
        </Link>
      </Button>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      <Card>
        <CardHeader>
          <CardTitle>
            {account ? `${account.code} - ${account.name}` : 'Đang tải...'}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Loại</div>
            <div>
              {account?.accountType === 'bank' ? 'Ngân hàng' : 'Tiền mặt'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Số dư đầu kỳ</div>
            <div>{formatFinanceAmount(account?.openingBalance ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Số dư hiện tại</div>
            <div className="font-semibold">{formatFinanceAmount(balance)}</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Biến động sổ tài khoản</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Ngày</th>
                  <th className="p-2">Số phiếu</th>
                  <th className="p-2">Chiều</th>
                  <th className="p-2 text-right">Số tiền</th>
                  <th className="p-2">Diễn giải</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((row) => (
                  <tr className="border-b" key={row.movementId}>
                    <td className="p-2">{row.effectiveDate}</td>
                    <td className="p-2">{row.voucherNo ?? '—'}</td>
                    <td className="p-2">
                      {row.direction === 'in' ? 'Thu' : 'Chi'}
                    </td>
                    <td className="p-2 text-right">
                      {formatFinanceAmount(row.amount)}
                    </td>
                    <td className="p-2">{row.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!ledgerQuery.isLoading && movements.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Chưa có biến động.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
