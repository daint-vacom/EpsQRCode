import { buildPath, ROUTES } from '@/constants/routes';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  CircleCheck,
  FileText,
  ReceiptText,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { useNumberFormat } from '@/providers/number-format-provider';
import { useTenant } from '@/providers/tenant-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { Progress, ProgressCircle } from '@/components/ui/progress';
import { buildContractPaymentPlanData } from '../../contracts/model/contract-chart';
import { getDashboardPaymentPlanRange } from '../../dashboard/model/dashboard';
import { PaymentPlanChart } from '../../shared/components/payment-plan-chart';
import { loadCustomerOverview } from '../api/customer-overview.api';
import type { Customer } from '../model/customer';
import type {
  CustomerOverviewContract,
  CustomerOverviewData,
  CustomerOverviewSummary,
} from '../model/customer-overview';

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
}: {
  summary: CustomerOverviewSummary;
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
                Đã thanh toán
              </span>
            </div>
          </ProgressCircle>
        </div>
        <div className="min-w-0 flex-1 divide-y divide-border">
          <div className="py-2.5 first:pt-0 last:pb-0">
            <PaymentMetric
              icon={FileText}
              iconTone="info"
              label="Hợp đồng đang hiệu lực"
              value={String(summary.activeContractCount)}
              valueClassName="text-primary"
            />
          </div>
          <div className="py-2.5 first:pt-0 last:pb-0">
            <PaymentMetric
              icon={CircleCheck}
              iconTone="success"
              label="Hợp đồng đã chấm dứt"
              value={String(summary.terminatedContractCount)}
            />
          </div>
          <div className="py-2.5 first:pt-0 last:pb-0">
            <PaymentMetric
              icon={FileText}
              iconTone="info"
              label="Tổng đã phát sinh"
              value={formatCurrency(summary.totalBilled, summary.currencyCode)}
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
          <div className="py-2.5 first:pt-0 last:pb-0">
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
        </div>
      </div>
    </section>
  );
}

function CustomerPaymentStatusCard({ data }: { data: CustomerOverviewData }) {
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
        {data.contracts.length > 0 ? (
          <CustomerPaymentSummary summary={data.summary} />
        ) : (
          <div className="flex min-h-48 items-center justify-center text-center text-sm text-muted-foreground">
            Chưa có dữ liệu thanh toán để hiển thị.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustomerContractBalanceItem({
  contract,
}: {
  contract: CustomerOverviewContract;
}) {
  const { formatCurrency } = useNumberFormat();
  const formattedProgress = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(contract.progressPercent);

  return (
    <div className="flex min-w-0 gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <ReceiptText className="size-3.5" />
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
        <div className="min-w-0 space-y-0">
          <Link
            to={buildPath(ROUTES.PROJECT.CONTRACT_DETAIL, { id: contract.id })}
            className="block min-w-0 truncate font-medium text-foreground hover:text-primary"
          >
            {contract.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {contract.contractCode}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          <div>
            <span className="font-medium text-primary">
              {formatCurrency(contract.paidAmount, contract.currencyCode)} /{' '}
              {formatCurrency(contract.totalAmount, contract.currencyCode)}
            </span>{' '}
            <span>({formattedProgress}%)</span>
          </div>
          <div
            className={
              contract.outstandingAmount > 0
                ? 'text-destructive'
                : 'text-muted-foreground'
            }
          >
            Còn phải thu{' '}
            {formatCurrency(contract.outstandingAmount, contract.currencyCode)}
          </div>
        </div>
        <div className="col-span-full mt-1 min-w-0">
          <Progress
            value={contract.progressPercent}
            aria-label={`${contract.name}: đã thanh toán ${formattedProgress}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={contract.progressPercent}
            className="h-2 w-full bg-muted"
            indicatorClassName="bg-emerald-500"
          />
        </div>
      </div>
    </div>
  );
}

function CustomerDebtByContractCard({ data }: { data: CustomerOverviewData }) {
  return (
    <Card className="min-w-0 overflow-hidden xl:h-full xl:min-h-72">
      <CardHeader>
        <CardHeading>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <ReceiptText className="size-4" />
            </span>
            <CardTitle>Công nợ theo hợp đồng</CardTitle>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent className="min-h-0 grow overflow-y-auto pt-1">
        {data.contracts.length > 0 ? (
          <div className="space-y-4">
            {data.contracts.map((contract) => (
              <CustomerContractBalanceItem
                key={contract.id}
                contract={contract}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center text-center text-sm text-muted-foreground">
            Khách hàng chưa có hợp đồng.
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

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardHeading>
          <CardTitle>Kế hoạch thu tiền</CardTitle>
        </CardHeading>
      </CardHeader>
      <CardContent className="space-y-6 pt-0">
        {data.charges.length > 0 ? (
          <PaymentPlanChart
            data={buildContractPaymentPlanData(data.charges, range)}
            valueFormatter={(value) =>
              formatCompactCurrency(value, currencyCode)
            }
            axisValueFormatter={(value) =>
              formatCompactCurrency(value, currencyCode)
            }
          />
        ) : (
          <div className="flex h-72 items-center justify-center text-center text-sm text-muted-foreground">
            Chưa có dữ liệu kế hoạch thu tiền để hiển thị.
          </div>
        )}
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
  const overviewQuery = useQuery({
    queryKey: ['project', 'customers', 'overview', tenantId, customer.id],
    queryFn: () => loadCustomerOverview(tenantId!, customer.id),
    enabled: Boolean(tenantId),
  });

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
      <CustomerDebtByContractCard data={overviewQuery.data} />
      <div className="xl:col-span-2">
        <CustomerPaymentPlanCard data={overviewQuery.data} />
      </div>
    </div>
  );
}
