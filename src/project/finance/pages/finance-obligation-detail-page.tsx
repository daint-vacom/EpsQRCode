import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleDollarSign } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
  createFinanceObligationAdjustment,
  loadFinanceObligationDetail,
} from '../api/finance.api';
import { formatFinanceAmount } from '../model/finance';

export function FinanceObligationDetailPage() {
  const { id } = useParams();
  const { tenantId } = useTenant();
  const { hasPermission } = useUser();
  const queryClient = useQueryClient();
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [amountDelta, setAmountDelta] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState('');
  const query = useQuery({
    queryKey: ['project', 'finance', 'obligation', tenantId, id],
    queryFn: () => loadFinanceObligationDetail(tenantId!, id!),
    enabled: Boolean(tenantId && id),
  });
  const obligation = query.data;
  const adjustmentMutation = useMutation({
    mutationFn: () =>
      createFinanceObligationAdjustment(tenantId!, {
        obligationId: id!,
        amountDelta: Number(amountDelta),
        effectiveDate,
        reason,
        requestKey: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      toast.success('Đã ghi nhận điều chỉnh công nợ.');
      setAdjustmentOpen(false);
      setAmountDelta('');
      setReason('');
      await queryClient.invalidateQueries({
        queryKey: ['project', 'finance', 'obligation', tenantId, id],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={obligation?.code ?? 'Chi tiết công nợ'}
          icon={CircleDollarSign}
        />
        {obligation?.status === 'posted' &&
        hasPermission('finance:obligation:create') ? (
          <Button variant="outline" onClick={() => setAdjustmentOpen(true)}>
            Điều chỉnh công nợ
          </Button>
        ) : null}
      </div>
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
            <div className="text-xs text-muted-foreground">Điều chỉnh</div>
            <div>{formatFinanceAmount(obligation?.adjustmentAmount ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Nghĩa vụ sau điều chỉnh
            </div>
            <div>{formatFinanceAmount(obligation?.obligationAmount ?? 0)}</div>
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
      <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Điều chỉnh công nợ</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Giá trị điều chỉnh
              </label>
              <Input
                type="number"
                value={amountDelta}
                onChange={(event) => setAmountDelta(event.target.value)}
                placeholder="Dương để tăng, âm để giảm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Ngày hiệu lực
              </label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Lý do</label>
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Nêu căn cứ điều chỉnh"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdjustmentOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              loading={adjustmentMutation.isPending}
              disabled={
                !amountDelta ||
                Number(amountDelta) === 0 ||
                !effectiveDate ||
                !reason.trim()
              }
              onClick={() => adjustmentMutation.mutate()}
            >
              Ghi nhận điều chỉnh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
