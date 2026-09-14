import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CircleDollarSign } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { loadFinanceObligationDetail } from '../api/finance.api';
import { formatFinanceAmount } from '../model/finance';

export function FinanceObligationDetailPage() {
  const { id } = useParams();
  const { tenantId } = useTenant();
  const query = useQuery({
    queryKey: ['project', 'finance', 'obligation', tenantId, id],
    queryFn: () => loadFinanceObligationDetail(tenantId!, id!),
    enabled: Boolean(tenantId && id),
  });
  const obligation = query.data;
  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:p-5">
      <PageHeader
        title={obligation?.code ?? 'Chi tiết công nợ'}
        icon={CircleDollarSign}
      />
      <Button asChild variant="outline" className="w-fit">
        <Link to="/finance/obligations">
          <ArrowLeft className="size-4" /> Quay lại
        </Link>
      </Button>
      {query.isError ? (
        <div className="text-sm text-destructive">
          {getApiErrorMessage(query.error)}
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{obligation?.description ?? 'Đang tải...'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Đối tượng</div>
            <div>{obligation?.partyNameSnapshot || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Chiều</div>
            <div>
              {obligation?.direction === 'receivable' ? 'Phải thu' : 'Phải trả'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Ngày chứng từ</div>
            <div>{obligation?.documentDate || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Hạn thanh toán</div>
            <div>{obligation?.dueDate || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Nghĩa vụ gốc</div>
            <div>{formatFinanceAmount(obligation?.originalAmount ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Đã thanh toán</div>
            <div>{formatFinanceAmount(obligation?.settledAmount ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Còn lại</div>
            <div className="font-semibold">
              {formatFinanceAmount(obligation?.outstandingAmount ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Nguồn</div>
            <div>{obligation?.sourceType || '—'}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
