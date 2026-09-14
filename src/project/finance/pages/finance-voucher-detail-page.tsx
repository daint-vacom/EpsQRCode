import { ROUTES } from '@/constants/routes';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { loadFinanceVoucherDetail } from '../api/finance.api';
import {
  FINANCE_HANDLING_TYPE_LABELS,
  FINANCE_VOUCHER_STATUS_LABELS,
  FINANCE_VOUCHER_TYPE_LABELS,
  formatFinanceAmount,
} from '../model/finance';

export function FinanceVoucherDetailPage() {
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['project', 'finance', 'voucher', tenantId, id],
    queryFn: () => loadFinanceVoucherDetail(tenantId!, id!),
    enabled: Boolean(tenantId && id),
  });
  if (query.isLoading)
    return (
      <div className="p-5 text-sm text-muted-foreground">Đang tải phiếu...</div>
    );
  if (query.isError || !query.data)
    return (
      <div className="p-5">
        <Card>
          <CardContent className="p-8 text-center text-sm text-destructive">
            {getApiErrorMessage(query.error)}
          </CardContent>
        </Card>
      </div>
    );
  const voucher = query.data;
  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:p-5">
      <PageHeader
        title={voucher.voucherNo ?? 'Chi tiết phiếu'}
        icon={FileText}
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {voucher.voucherNo ?? 'Phiếu nháp'}{' '}
                <Badge
                  variant={
                    voucher.voucherType === 'receipt'
                      ? 'success'
                      : 'destructive'
                  }
                >
                  {FINANCE_VOUCHER_TYPE_LABELS[voucher.voucherType]}
                </Badge>
                <Badge variant="outline">
                  {FINANCE_VOUCHER_STATUS_LABELS[voucher.status]}
                </Badge>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {voucher.partyNameSnapshot} · {voucher.voucherDate} ·{' '}
                {voucher.accountName}
              </p>
            </div>
            {voucher.status === 'draft' ? (
              <Button asChild variant="outline">
                <Link
                  to={`${ROUTES.PROJECT.FINANCE_VOUCHERS}/${voucher.id}/edit`}
                >
                  Chỉnh sửa nháp
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Tổng tiền</p>
              <p className="text-lg font-bold text-primary">
                {formatFinanceAmount(voucher.totalAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nội dung</p>
              <p className="text-sm">{voucher.description || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mã giao dịch</p>
              <p className="text-sm">{voucher.externalReference || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Đối tượng</p>
              <p className="text-sm">{voucher.partyNameSnapshot}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Chi tiết khoản mục</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-3">#</th>
                    <th className="p-3">Khoản mục</th>
                    <th className="p-3">Diễn giải</th>
                    <th className="p-3">Cách xử lý</th>
                    <th className="p-3 text-right">Số tiền</th>
                    <th className="p-3 text-right">Còn khả dụng</th>
                  </tr>
                </thead>
                <tbody>
                  {voucher.lines.map((line) => (
                    <tr key={line.id} className="border-b">
                      <td className="p-3">{line.lineNo}</td>
                      <td className="p-3 font-medium">
                        {line.categoryNameSnapshot}
                      </td>
                      <td className="p-3">{line.description || '—'}</td>
                      <td className="p-3">
                        {FINANCE_HANDLING_TYPE_LABELS[line.handlingType]}
                      </td>
                      <td className="p-3 text-right">
                        {formatFinanceAmount(line.amount)}
                      </td>
                      <td className="p-3 text-right">
                        {formatFinanceAmount(line.availableAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <div>
          <Button
            variant="outline"
            onClick={() => navigate(ROUTES.PROJECT.FINANCE_VOUCHERS)}
          >
            <ArrowLeft className="size-4" /> Quay lại sổ thu chi
          </Button>
        </div>
      </div>
    </div>
  );
}
