import { useState, type ReactNode } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  LayoutDashboard,
  RefreshCw,
  TriangleAlert,
  UserRound,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { formatDate } from '@/lib/date';
import { getApiErrorMessage } from '@/lib/errors';
import {
  formatCompactCurrency,
  formatCurrencyVND,
  formatNumber,
} from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
} from '../../contracts/model/contract';
import { PaymentPlanChart } from '../../shared/components/payment-plan-chart';
import { DashboardContractStatusChart } from '../charts/dashboard-contract-status.chart.generated';
import { DashboardReceivableAgingChart } from '../charts/dashboard-receivable-aging.chart.generated';
import { useDashboard } from '../hooks/use-dashboard';
import {
  formatDashboardPaymentPlanRange,
  getDashboardPaymentPlanMonthRange,
  getDashboardPaymentPlanRange,
  type DashboardContractStatusChartPoint,
  type DashboardPaymentPlanContract,
  type DashboardPaymentPlanRange,
  type DashboardReceivableAgingBucket,
} from '../model/dashboard';

const STATUS_CHART_COLORS: Record<ContractStatus, string> = {
  active: 'var(--admin-success-dot)',
  draft: 'var(--muted-foreground)',
  suspended: 'var(--admin-amber-primary)',
  expired: 'var(--admin-red-primary)',
  terminated: 'var(--muted-foreground)',
};

const AGING_LABELS: Record<DashboardReceivableAgingBucket, string> = {
  not_due: 'Chưa tới hạn',
  due_today: 'Đến hạn hôm nay',
  overdue_1_30: 'Quá hạn 1–30 ngày',
  overdue_31_60: 'Quá hạn 31–60 ngày',
  overdue_over_60: 'Quá hạn trên 60 ngày',
};

const METRIC_TONE_CLASSES = {
  blue: 'bg-admin-blue-bg text-admin-blue-primary',
  success: 'bg-admin-success-bg text-admin-success-text',
  amber: 'bg-admin-amber-bg text-admin-amber-dark',
  red: 'bg-admin-red-bg text-admin-red-primary',
} as const;

type MetricTone = keyof typeof METRIC_TONE_CLASSES;

function displayNumber(value: number | null | undefined): string {
  return value == null ? '—' : formatNumber(value);
}

function displayCurrency(value: number | null | undefined): string {
  return value == null ? '—' : formatCurrencyVND(value);
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  isLoading,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: MetricTone;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground tabular-nums">
              {value}
            </p>
          )}
        </div>
        <span
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${METRIC_TONE_CLASSES[tone]}`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

function DashboardDebtRow({
  label,
  value,
  icon: Icon,
  tone,
  isLoading,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: MetricTone;
  isLoading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${METRIC_TONE_CLASSES[tone]}`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <p className="truncate text-sm text-foreground">{label}</p>
      </div>
      {isLoading ? (
        <Skeleton className="h-5 w-28 shrink-0" />
      ) : (
        <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
          {value}
        </span>
      )}
    </div>
  );
}

function DashboardCard({
  title,
  children,
  className,
  headerAction,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}) {
  return (
    <Card className={className} sectionBorders="default">
      <CardHeader>
        <CardHeading>
          <CardTitle>{title}</CardTitle>
        </CardHeading>
        {headerAction}
      </CardHeader>
      {children}
    </Card>
  );
}

function EmptyDashboardState({ message }: { message: string }) {
  return (
    <div className="flex h-72 items-center justify-center px-5 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function DashboardListEmpty({ message }: { message: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center px-5 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function DashboardPaymentPlanContractsCard({
  range,
  contracts,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  range: DashboardPaymentPlanRange;
  contracts: DashboardPaymentPlanContract[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <DashboardCard
      title="Hợp đồng cần phải thu"
      className="h-full min-w-0 overflow-hidden"
      headerAction={
        <span className="shrink-0 text-sm font-semibold text-primary">
          {formatDashboardPaymentPlanRange(range)}
        </span>
      }
    >
      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-5 text-center">
          <TriangleAlert className="size-7 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {getApiErrorMessage(error)}
          </p>
          <Button variant="outline" onClick={onRetry}>
            Thử lại
          </Button>
        </div>
      ) : contracts.length ? (
        <CardContent className="max-h-72 overflow-auto divide-y divide-border p-0">
          {contracts.map((item) => (
            <Link
              key={`${item.contractId}-${item.dueDate}`}
              to={buildPath(ROUTES.PROJECT.CONTRACT_DETAIL, {
                id: item.contractId,
              })}
              className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-hidden"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.contractCode} · {item.contractName}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {item.customerName} · Hạn {formatDate(item.dueDate)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                {displayCurrency(item.outstandingAmount)}
              </span>
            </Link>
          ))}
        </CardContent>
      ) : (
        <DashboardListEmpty message="Không có hợp đồng cần phải thu trong khoảng thời gian này." />
      )}
    </DashboardCard>
  );
}

export function DashboardPage() {
  const [selectedPaymentPlanMonthStart, setSelectedPaymentPlanMonthStart] =
    useState<string | null>(null);
  const paymentPlanContractsRange = selectedPaymentPlanMonthStart
    ? getDashboardPaymentPlanMonthRange(selectedPaymentPlanMonthStart)
    : getDashboardPaymentPlanRange();
  const {
    tenantQuery,
    dashboardQuery,
    paymentPlanQuery,
    paymentPlanContractsQuery,
    customerStatsQuery,
    employeeStatsQuery,
    canViewContracts,
    canViewCustomers,
    canViewEmployees,
    statistics,
    paymentPlan,
    paymentPlanContracts,
    customerStats,
    employeeStats,
  } = useDashboard(paymentPlanContractsRange);

  const selectedPaymentPlanMonth = paymentPlan?.find(
    (item) => item.monthStart === selectedPaymentPlanMonthStart,
  );

  const isDashboardLoading = canViewContracts && dashboardQuery.isPending;
  const isPaymentPlanLoading = canViewContracts && paymentPlanQuery.isPending;
  const isRefreshing =
    dashboardQuery.isFetching ||
    paymentPlanQuery.isFetching ||
    paymentPlanContractsQuery.isFetching ||
    customerStatsQuery.isFetching ||
    employeeStatsQuery.isFetching;

  const refresh = () => {
    void Promise.all([
      canViewContracts ? dashboardQuery.refetch() : Promise.resolve(),
      canViewContracts ? paymentPlanQuery.refetch() : Promise.resolve(),
      canViewContracts
        ? paymentPlanContractsQuery.refetch()
        : Promise.resolve(),
      canViewCustomers ? customerStatsQuery.refetch() : Promise.resolve(),
      canViewEmployees ? employeeStatsQuery.refetch() : Promise.resolve(),
    ]);
  };

  const statusChartData: DashboardContractStatusChartPoint[] = (
    statistics?.contracts.statusBreakdown ?? []
  )
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: CONTRACT_STATUS_LABELS[item.status],
      value: item.count,
      fill: STATUS_CHART_COLORS[item.status],
    }));

  const agingChartData = (statistics?.aging ?? []).map((item) => ({
    label: AGING_LABELS[item.bucket],
    amount: item.amount,
    count: item.count,
  }));

  const pageHeader = (
    <PageHeader
      title="Tổng quan"
      icon={LayoutDashboard}
      actions={
        <Button
          variant="outline"
          size="md"
          onClick={refresh}
          disabled={isRefreshing}
          aria-label="Làm mới dữ liệu tổng quan"
        >
          <RefreshCw className={isRefreshing ? 'animate-spin' : undefined} />
          Làm mới
        </Button>
      }
    />
  );

  if (tenantQuery.isError) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-auto p-4 lg:p-5">
        {pageHeader}
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TriangleAlert className="size-8 text-destructive" />
          <div>
            <CardTitle>Không xác định được tổ chức hiện tại</CardTitle>
            <CardDescription className="mt-1">
              {getApiErrorMessage(tenantQuery.error)}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => void tenantQuery.refetch()}>
            Thử lại
          </Button>
        </Card>
      </div>
    );
  }

  const hasDashboardError = canViewContracts && dashboardQuery.isError;

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-auto p-4 lg:p-5">
      {pageHeader}

      <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard
            label="Khách hàng"
            value={displayNumber(customerStats?.total)}
            icon={Users}
            tone="blue"
            isLoading={canViewCustomers && customerStatsQuery.isPending}
          />
          <MetricCard
            label="Nhân viên"
            value={displayNumber(employeeStats?.total)}
            icon={UserRound}
            tone="success"
            isLoading={canViewEmployees && employeeStatsQuery.isPending}
          />
          <MetricCard
            label="Hợp đồng hiệu lực"
            value={displayNumber(statistics?.contracts.active)}
            icon={FileText}
            tone="success"
            isLoading={isDashboardLoading}
          />
          <MetricCard
            label="Sắp hết hạn"
            value={displayNumber(statistics?.contracts.expiring)}
            icon={CalendarClock}
            tone="amber"
            isLoading={isDashboardLoading}
          />
        </div>
        <DashboardCard title="Công nợ phải thu" className="h-full">
          <CardContent className="divide-y divide-border p-0">
            <DashboardDebtRow
              label="Còn phải thu"
              value={displayCurrency(statistics?.receivables.totalOutstanding)}
              icon={WalletCards}
              tone="blue"
              isLoading={isDashboardLoading}
            />
            <DashboardDebtRow
              label="Công nợ quá hạn"
              value={displayCurrency(
                statistics?.receivables.overdueOutstanding,
              )}
              icon={AlertTriangle}
              tone="red"
              isLoading={isDashboardLoading}
            />
          </CardContent>
        </DashboardCard>
      </div>

      {!canViewContracts ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TriangleAlert className="size-8 text-muted-foreground" />
          <div>
            <CardTitle>Chưa có quyền xem dữ liệu hợp đồng</CardTitle>
            <CardDescription className="mt-1">
              Liên hệ quản trị viên để được cấp quyền contracts:view và xem phần
              công nợ trên trang tổng quan.
            </CardDescription>
          </div>
        </Card>
      ) : hasDashboardError ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TriangleAlert className="size-8 text-destructive" />
          <div>
            <CardTitle>Không tải được dữ liệu tổng quan</CardTitle>
            <CardDescription className="mt-1">
              {getApiErrorMessage(dashboardQuery.error)}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => void dashboardQuery.refetch()}
          >
            Thử lại
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.95fr)] xl:items-start">
            <DashboardCard title="Kế hoạch thu tiền">
              {isPaymentPlanLoading ? (
                <div className="p-5">
                  <Skeleton className="h-72 w-full" />
                </div>
              ) : paymentPlanQuery.isError ? (
                <div className="flex h-72 flex-col items-center justify-center gap-3 px-5 text-center">
                  <TriangleAlert className="size-7 text-destructive" />
                  <p className="text-sm text-muted-foreground">
                    {getApiErrorMessage(paymentPlanQuery.error)}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => void paymentPlanQuery.refetch()}
                  >
                    Thử lại
                  </Button>
                </div>
              ) : paymentPlan?.length ? (
                <CardContent className="pt-4">
                  <PaymentPlanChart
                    data={paymentPlan}
                    valueFormatter={(value) => formatCurrencyVND(value)}
                    axisValueFormatter={(value) =>
                      formatCompactCurrency(value, 'VND')
                    }
                    selectedMonthLabel={selectedPaymentPlanMonth?.monthLabel}
                    onItemClick={(item) =>
                      setSelectedPaymentPlanMonthStart((current) =>
                        current === item.monthStart ? null : item.monthStart,
                      )
                    }
                  />
                </CardContent>
              ) : (
                <EmptyDashboardState message="Chưa có dữ liệu phải thu trong khoảng thời gian này." />
              )}
            </DashboardCard>
            <DashboardPaymentPlanContractsCard
              range={paymentPlanContractsRange}
              contracts={paymentPlanContracts ?? []}
              isLoading={paymentPlanContractsQuery.isPending}
              isError={paymentPlanContractsQuery.isError}
              error={paymentPlanContractsQuery.error}
              onRetry={() => void paymentPlanContractsQuery.refetch()}
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
            <DashboardCard title="Tuổi nợ phải thu">
              {isDashboardLoading ? (
                <div className="p-5">
                  <Skeleton className="h-72 w-full" />
                </div>
              ) : agingChartData.some((item) => item.amount > 0) ? (
                <CardContent className="pt-4">
                  <DashboardReceivableAgingChart
                    data={agingChartData}
                    valueFormatter={(value, name) =>
                      name === 'amount'
                        ? formatCurrencyVND(value)
                        : displayNumber(value)
                    }
                    axisValueFormatter={(value) =>
                      formatCompactCurrency(value, 'VND')
                    }
                  />
                </CardContent>
              ) : (
                <EmptyDashboardState message="Hiện không có khoản công nợ chưa thu đủ." />
              )}
            </DashboardCard>

            <DashboardCard title="Trạng thái hợp đồng">
              {isDashboardLoading ? (
                <div className="p-5">
                  <Skeleton className="h-72 w-full" />
                </div>
              ) : statusChartData.length ? (
                <CardContent className="pt-4">
                  <DashboardContractStatusChart
                    data={statusChartData}
                    valueFormatter={(value) => formatNumber(value)}
                  />
                </CardContent>
              ) : (
                <EmptyDashboardState message="Chưa có hợp đồng để phân loại." />
              )}
            </DashboardCard>
          </div>
        </>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  );
}
