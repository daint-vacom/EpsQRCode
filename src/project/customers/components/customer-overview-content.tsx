import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  FileText,
  ReceiptText,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/errors';
import { useNumberFormat } from '@/providers/number-format-provider';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { ProgressCircle } from '@/components/ui/progress';
import { getDashboardPaymentPlanRange } from '../../dashboard/model/dashboard';
import { PaymentPlanCardTitle } from '../../shared/components/payment-plan-card-title';
import { PaymentPlanChart } from '../../shared/components/payment-plan-chart';
import { loadCustomerOverview } from '../api/customer-overview.api';
import type { Customer } from '../model/customer';
import {
  getCustomerDebtSourceLabel,
  groupCustomerFinanceObligations,
  type CustomerFinanceObligation,
} from '../model/customer-finance';
import type {
  CustomerOverviewData,
  CustomerOverviewSummary,
} from '../model/customer-overview';
import { buildCustomerPaymentPlanData } from '../model/customer-overview';

const PAYMENT_METRIC_TONE_CLASSES = {
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'bg-destructive/10 text-destructive',
} as const;

function PaymentMetric({
  icon: Icon,
  iconTone,
  label,
  value,
  valueClassName = 'text-foreground',
}: {
  icon: LucideIcon;
  iconTone: keyof typeof PAYMENT_METRIC_TONE_CLASSES;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${PAYMENT_METRIC_TONE_CLASSES[iconTone]}`}
      >
        <Icon className="size-4" />
      </span>
      <p className="min-w-0 flex-1 truncate text-xs text-foreground">{label}</p>
      <p
        className={`shrink-0 truncate text-sm font-semibold tabular-nums ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}

function CustomerPaymentSummary({
  summary,
  hasData,
  detailsVisible,
  detailsId,
}: {
  summary: CustomerOverviewSummary;
  hasData: boolean;
  detailsVisible: boolean;
  detailsId: string;
}) {
  const { formatCurrency } = useNumberFormat();
  const formattedProgress = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(summary.progressPercent);

  return (
    <section className="min-w-0">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div
          className="flex shrink-0 justify-center lg:justify-start"
          aria-label={`Đã thanh toán ${formattedProgress}%`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.progressPercent}
        >
          <ProgressCircle
            value={summary.progressPercent}
            size={132}
            strokeWidth={10}
            indicatorClassName="text-emerald-500"
            trackClassName="text-muted"
          >
            <div className="flex flex-col items-center text-center">
              <span className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formattedProgress}%
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                {hasData ? 'Đã thanh toán' : 'Chưa có dữ liệu'}
              </span>
            </div>
          </ProgressCircle>
        </div>
        <div className="min-w-0 flex-1">
          <div className="divide-y divide-border">
            <div className="py-2.5 first:pt-0 last:pb-0">
              <PaymentMetric
                icon={FileText}
                iconTone="info"
                label="Tổng đã phát sinh"
                value={formatCurrency(
                  summary.totalBilled,
                  summary.currencyCode,
                )}
              />
            </div>
            <div className="py-2.5 first:pt-0 last:pb-0">
              <PaymentMetric
                icon={CircleCheck}
                iconTone="success"
                label="Đã thanh toán"
                value={formatCurrency(summary.totalPaid, summary.currencyCode)}
              />
            </div>
            <div className="py-2.5 first:pt-0 last:pb-0">
              <PaymentMetric
                icon={WalletCards}
                iconTone="warning"
                label="Còn phải thu"
                value={formatCurrency(
                  summary.totalOutstanding,
                  summary.currencyCode,
                )}
                valueClassName="text-primary"
              />
            </div>
          </div>
          <div
            id={detailsId}
            hidden={!detailsVisible}
            className="divide-y divide-border border-t border-border"
          >
            <div className="py-2.5 first:pt-2.5 last:pb-0">
              <PaymentMetric
                icon={FileText}
                iconTone="info"
                label="Hợp đồng đang hiệu lực"
                value={String(summary.activeContractCount)}
                valueClassName="text-primary"
              />
            </div>
            <div className="py-2.5 first:pt-2.5 last:pb-0">
              <PaymentMetric
                icon={CircleCheck}
                iconTone="success"
                label="Hợp đồng đã chấm dứt"
                value={String(summary.terminatedContractCount)}
              />
            </div>
            <div className="py-2.5 first:pt-2.5 last:pb-0">
              <PaymentMetric
                icon={TriangleAlert}
                iconTone="danger"
                label="Quá hạn"
                value={formatCurrency(
                  summary.overdueOutstanding,
                  summary.currencyCode,
                )}
              />
            </div>
            <div className="py-2.5 first:pt-2.5 last:pb-0">
              <PaymentMetric
                icon={WalletCards}
                iconTone="warning"
                label="Ứng trước chưa phân bổ"
                value={formatCurrency(
                  summary.unappliedAdvance,
                  summary.currencyCode,
                )}
              />
            </div>
            <div className="py-2.5 first:pt-2.5 last:pb-0">
              <PaymentMetric
                icon={ReceiptText}
                iconTone="info"
                label="Tiền thu thực tế"
                value={formatCurrency(
                  summary.cashReceived,
                  summary.currencyCode,
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CustomerPaymentStatusCard({ data }: { data: CustomerOverviewData }) {
  const [detailsVisible, setDetailsVisible] = useState(false);
  const detailsId = useId();
  const hasData = data.contracts.length > 0 || data.obligations.length > 0;
  const summary = hasData
    ? data.summary
    : {
        ...data.summary,
        activeContractCount: 0,
        terminatedContractCount: 0,
        totalBilled: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        overdueOutstanding: 0,
        unappliedAdvance: 0,
        cashReceived: 0,
        cashPaid: 0,
        progressPercent: 0,
      };

  return (
    <Card className="min-w-0 overflow-hidden xl:min-h-72">
      <CardHeader>
        <CardHeading>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <WalletCards className="size-4" />
            </span>
            <CardTitle>Tình hình thanh toán</CardTitle>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent className="pt-1">
        <CustomerPaymentSummary
          summary={summary}
          hasData={hasData}
          detailsVisible={detailsVisible}
          detailsId={detailsId}
        />
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={detailsVisible}
          aria-controls={detailsId}
          onClick={() => setDetailsVisible((visible) => !visible)}
        >
          {detailsVisible ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
          {detailsVisible ? 'Ẩn chi tiết' : 'Hiện chi tiết'}
        </Button>
      </CardFooter>
    </Card>
  );
}

function CustomerDebtItem({ debt }: { debt: CustomerFinanceObligation }) {
  const { formatCurrency } = useNumberFormat();

  return (
    <div className="flex min-w-0 gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <ReceiptText className="size-3.5" />
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
        <div className="min-w-0 space-y-0">
          <p className="truncate font-medium text-foreground">
            {debt.description || debt.code}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {getCustomerDebtSourceLabel(debt.sourceType)}
            {debt.contractName ? ` · ${debt.contractName}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          <div>
            Đã trả {formatCurrency(debt.settledAmount, debt.currencyCode)}
          </div>
          <div
            className={
              debt.outstandingAmount > 0
                ? 'text-destructive'
                : 'text-muted-foreground'
            }
          >
            Còn phải thu{' '}
            {formatCurrency(debt.outstandingAmount, debt.currencyCode)}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerDebtListCard({ data }: { data: CustomerOverviewData }) {
  const debts = groupCustomerFinanceObligations(data.obligations);

  return (
    <Card className="min-w-0 overflow-hidden xl:h-full xl:min-h-72">
      <CardHeader>
        <CardHeading>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <ReceiptText className="size-4" />
            </span>
            <CardTitle>Danh sách công nợ</CardTitle>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent className="min-h-0 grow overflow-y-auto pt-1">
        {debts.length > 0 ? (
          <div className="space-y-4">
            {debts.map((debt) => (
              <CustomerDebtItem key={debt.id} debt={debt} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center text-center text-sm text-muted-foreground">
            Khách hàng chưa có công nợ.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustomerPaymentPlanCard({ data }: { data: CustomerOverviewData }) {
  const { formatCompactCurrency } = useNumberFormat();
  const range = getDashboardPaymentPlanRange();
  const currencyCode = data.summary.currencyCode;
  const paymentPlan = buildCustomerPaymentPlanData(
    data.paymentPlanObligations,
    range,
    data.paymentPlanSources,
  );

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardHeading>
          <PaymentPlanCardTitle />
        </CardHeading>
      </CardHeader>
      <CardContent className="space-y-6 pt-0">
        <PaymentPlanChart
          data={paymentPlan}
          valueFormatter={(value) => formatCompactCurrency(value, currencyCode)}
          axisValueFormatter={(value) =>
            formatCompactCurrency(value, currencyCode)
          }
        />
      </CardContent>
    </Card>
  );
}

function CustomerOverviewLoading() {
  return (
    <div className="grid min-w-0 gap-admin-page-section xl:grid-cols-2">
      {[0, 1, 2].map((item) => (
        <Card key={item} className={item === 2 ? 'xl:col-span-2' : undefined}>
          <CardContent className="h-72 animate-pulse bg-muted/20" />
        </Card>
      ))}
    </div>
  );
}

export function CustomerOverviewContent({ customer }: { customer: Customer }) {
  const { tenantId } = useTenant();
  const { hasPermission } = useUser();
  const canViewFinance =
    hasPermission('finance:obligation:view') ||
    hasPermission('finance:report:view');
  const overviewQuery = useQuery({
    queryKey: ['project', 'customers', 'overview', tenantId, customer.id],
    queryFn: () => loadCustomerOverview(tenantId!, customer.id),
    enabled: Boolean(tenantId && canViewFinance),
  });

  if (!canViewFinance) {
    return (
      <Card className="flex min-h-56 items-center justify-center p-10 text-center">
        <CardDescription>
          Bạn không có quyền xem tình hình công nợ khách hàng.
        </CardDescription>
      </Card>
    );
  }

  if (overviewQuery.isPending) return <CustomerOverviewLoading />;

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <Card className="flex min-h-56 flex-col items-center justify-center gap-3 p-10 text-center">
        <TriangleAlert className="size-7 text-destructive" />
        <div>
          <CardTitle>Không tải được tổng quan tài chính</CardTitle>
          <CardDescription className="mt-1">
            {getApiErrorMessage(overviewQuery.error)}
          </CardDescription>
        </div>
        <Button variant="outline" onClick={() => overviewQuery.refetch()}>
          Thử lại
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-admin-page-section xl:grid-cols-2">
      <CustomerPaymentStatusCard data={overviewQuery.data} />
      <CustomerDebtListCard data={overviewQuery.data} />
      <div className="xl:col-span-2">
        <CustomerPaymentPlanCard data={overviewQuery.data} />
      </div>
    </div>
  );
}
