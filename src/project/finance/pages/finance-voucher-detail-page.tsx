import { useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Link2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Badge } from '@/components/ui/badge';
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
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import {
  allocateFinanceAdvance,
  loadFinanceObligations,
  loadFinanceVoucherDetail,
} from '../api/finance.api';
import {
  FINANCE_HANDLING_TYPE_LABELS,
  FINANCE_VOUCHER_STATUS_LABELS,
  FINANCE_VOUCHER_TYPE_LABELS,
  formatFinanceAmount,
} from '../model/finance';

export function FinanceVoucherDetailPage() {
  const { tenantId } = useTenant();
  const { hasPermission } = useUser();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [allocationSourceLineId, setAllocationSourceLineId] = useState('');
  const [allocationObligationId, setAllocationObligationId] = useState('');
  const [allocationAmount, setAllocationAmount] = useState('');
  const query = useQuery({
    queryKey: ['project', 'finance', 'voucher', tenantId, id],
    queryFn: () => loadFinanceVoucherDetail(tenantId!, id!),
    enabled: Boolean(tenantId && id),
  });
  const voucher = query.data;
  const obligationsQuery = useQuery({
    queryKey: [
      'project',
      'finance',
      'obligations',
      tenantId,
      'receivable',
      voucher?.customerId,
    ],
    queryFn: () =>
      loadFinanceObligations(tenantId!, 'receivable', voucher!.customerId!),
    enabled: Boolean(
      tenantId && voucher?.customerId && voucher.status === 'posted',
    ),
  });
  const allocationMutation = useMutation({
    mutationFn: ({ requestKey }: { requestKey: string }) =>
      allocateFinanceAdvance(tenantId!, {
        voucherLineId: allocationSourceLineId,
        obligationId: allocationObligationId,
        amount: Number(allocationAmount),
        effectiveDate: voucher!.voucherDate,
        requestKey,
      }),
    onSuccess: async () => {
      toast.success('Đã phân bổ tiền ứng trước vào công nợ.');
      setAllocationSourceLineId('');
      setAllocationObligationId('');
      setAllocationAmount('');
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: ['project', 'finance', 'voucher', tenantId, id],
          type: 'active',
        }),
        queryClient.refetchQueries({
          queryKey: ['project', 'finance', 'obligations', tenantId],
          type: 'active',
        }),
        queryClient.refetchQueries({
          queryKey: ['project', 'finance', 'report'],
          type: 'active',
        }),
      ]);
    },
    onError: (error) => {
      const message = getApiErrorMessage(error);
      toast.error(
        message.includes('Allocation exceeds the available advance amount')
          ? 'Số tiền phân bổ vượt quá số ứng trước còn khả dụng.'
          : message,
      );
    },
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
  const allocationSourceLine = voucher.lines.find(
    (line) => line.id === allocationSourceLineId,
  );
  const openAdvanceAllocation = (lineId: string, availableAmount: number) => {
    setAllocationSourceLineId(lineId);
    setAllocationObligationId('');
    setAllocationAmount(String(availableAmount));
  };
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
                    <th className="p-3 text-right">Thao tác</th>
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
                      <td className="p-3 text-right">
                        {voucher.status === 'posted' &&
                        line.handlingType === 'advance' &&
                        line.availableAmount > 0 &&
                        hasPermission('finance:voucher:post') ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              openAdvanceAllocation(
                                line.id,
                                line.availableAmount,
                              )
                            }
                          >
                            <Link2 className="size-4" /> Dùng ứng trước
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Dialog
          open={Boolean(allocationSourceLineId)}
          onOpenChange={(open) => {
            if (!open && !allocationMutation.isPending) {
              setAllocationSourceLineId('');
              setAllocationObligationId('');
              setAllocationAmount('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dùng tiền ứng trước</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <p className="text-sm text-muted-foreground">
                Nguồn ứng trước còn khả dụng:{' '}
                <span className="font-semibold text-foreground">
                  {formatFinanceAmount(
                    allocationSourceLine?.availableAmount ?? 0,
                  )}
                </span>
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Công nợ đích
                </label>
                <OptionSelect
                  value={allocationObligationId}
                  onChange={(value) => setAllocationObligationId(value || '')}
                  options={
                    obligationsQuery.data
                      ?.filter(
                        (item) =>
                          item.outstandingAmount > 0 &&
                          (allocationSourceLine?.advanceScope !== 'contract' ||
                            item.contractId ===
                              allocationSourceLine.relatedContractId),
                      )
                      .map((item) => ({
                        value: item.id,
                        label: `${item.code} - ${item.description} (${formatFinanceAmount(item.outstandingAmount)})`,
                      })) ?? []
                  }
                  searchable
                  placeholder={
                    obligationsQuery.isLoading
                      ? 'Đang tải công nợ...'
                      : 'Chọn công nợ'
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Số tiền phân bổ
                </label>
                <Input
                  type="number"
                  min="0"
                  value={allocationAmount}
                  onChange={(event) => setAllocationAmount(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAllocationSourceLineId('')}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={allocationMutation.isPending}
                disabled={
                  !allocationObligationId || Number(allocationAmount) <= 0
                }
                onClick={() =>
                  allocationMutation.mutate({ requestKey: crypto.randomUUID() })
                }
              >
                Phân bổ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
