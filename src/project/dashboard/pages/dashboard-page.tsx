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
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import {
  PageStatePreviewSelect,
  type PageStatePreview,
} from '@/components/ui/page-state-preview-select';
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

const PAGE_STATE_PREVIEW_ERROR = new Error(
  'Đây là trạng thái lỗi xem trước để kiểm tra giao diện.',
);

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
  error,
  onRetry,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: MetricTone;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {error ? (
            <div className="mt-2 flex min-w-0 items-center gap-1">
              <p
                className="truncate text-xs text-destructive"
                title={getApiErrorMessage(error)}
              >
                {getApiErrorMessage(error)}
              </p>
              {onRetry ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  onClick={onRetry}
                >
                  Thử lại
                </Button>
              ) : null}
            </div>
          ) : isLoading ? (
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

function DashboardLoadingState({
  range,
}: {
  range: DashboardPaymentPlanRange;
}) {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-label="Đang tải dữ liệu tổng quan"
      aria-busy="true"
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard
            label="Khách hàng"
            value=""
            icon={Users}
            tone="blue"
            isLoading
          />
          <MetricCard
            label="Nhân viên"
            value=""
            icon={UserRound}
            tone="success"
            isLoading
          />
          <MetricCard
            label="Hợp đồng hiệu lực"
            value=""
            icon={FileText}
            tone="success"
            isLoading
          />
          <MetricCard
            label="Sắp hết hạn"
            value=""
            icon={CalendarClock}
            tone="amber"
            isLoading
          />
        </div>
        <DashboardCard title="Công nợ phải thu" className="h-full">
          <CardContent className="divide-y divide-border p-0">
            <DashboardDebtRow
              label="Còn phải thu"
              value=""
              icon={WalletCards}
              tone="blue"
              isLoading
            />
            <DashboardDebtRow
              label="Công nợ quá hạn"
              value=""
              icon={AlertTriangle}
              tone="red"
              isLoading
            />
          </CardContent>
        </DashboardCard>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.95fr)] xl:items-start">
        <DashboardCard title="Kế hoạch thu tiền">
          <CardContent className="pt-4">
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </DashboardCard>
        <DashboardCard
          title="Hợp đồng cần phải thu"
          className="h-full min-w-0 overflow-hidden"
          headerAction={
            <span className="shrink-0 text-sm font-semibold text-primary">
              {formatDashboardPaymentPlanRange(range)}
            </span>
          }
        >
          <ListSkeleton />
        </DashboardCard>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <DashboardCard title="Tuổi nợ phải thu">
          <CardContent className="pt-4">
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </DashboardCard>
        <DashboardCard title="Trạng thái hợp đồng">
          <CardContent className="pt-4">
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </DashboardCard>
      </div>
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
        <ErrorState
          title="Không tải được hợp đồng cần phải thu"
          description={getApiErrorMessage(error)}
          onRetry={onRetry}
          className="min-h-72"
        />
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
  const [pageStatePreview, setPageStatePreview] =
    useState<PageStatePreview>('idle');
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

  const isRefreshing =
    tenantQuery.isPending ||
    tenantQuery.isPermissionsPending ||
    dashboardQuery.isFetching ||
    paymentPlanQuery.isFetching ||
    paymentPlanContractsQuery.isFetching ||
    customerStatsQuery.isFetching ||
    employeeStatsQuery.isFetching;

  const refresh = () => {
    if (tenantQuery.isError) {
      void tenantQuery.refetch();
      return;
    }
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
        <>
          <PageStatePreviewSelect
            value={pageStatePreview}
            onChange={setPageStatePreview}
          />
          {tenantQuery.isPending || tenantQuery.isPermissionsPending ? null : (
            <Button
              variant="outline"
              size="md"
              onClick={refresh}
              disabled={isRefreshing || pageStatePreview !== 'idle'}
              aria-label="Làm mới dữ liệu tổng quan"
            >
              <RefreshCw
                className={isRefreshing ? 'animate-spin' : undefined}
              />
              Làm mới
            </Button>
          )}
        </>
      }
    />
  );

  if (pageStatePreview === 'loading') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-auto p-4 lg:p-5">
        {pageHeader}
        <DashboardLoadingState range={paymentPlanContractsRange} />
      </div>
    );
  }

  if (
    pageStatePreview !== 'error' &&
    !tenantQuery.isError &&
    (tenantQuery.isPending || tenantQuery.isPermissionsPending)
  ) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-auto p-4 lg:p-5">
        {pageHeader}
        <DashboardLoadingState range={paymentPlanContractsRange} />
      </div>
    );
  }

  const tenantError = tenantQuery.isError ? tenantQuery.error : undefined;
  const previewError =
    pageStatePreview === 'error' ? PAGE_STATE_PREVIEW_ERROR : undefined;
  const retryQuery = (refetch: () => Promise<unknown>) => {
    if (pageStatePreview === 'error') {
      setPageStatePreview('idle');
    }
    return tenantError ? tenantQuery.refetch() : refetch();
  };
  const customerStatsError =
    previewError ??
    tenantError ??
    (canViewCustomers && customerStatsQuery.isError
      ? customerStatsQuery.error
      : undefined);
  const employeeStatsError =
    previewError ??
    tenantError ??
    (canViewEmployees && employeeStatsQuery.isError
      ? employeeStatsQuery.error
      : undefined);
  const dashboardError =
    previewError ??
    tenantError ??
    (canViewContracts && dashboardQuery.isError
      ? dashboardQuery.error
      : undefined);
  const paymentPlanError =
    previewError ??
    tenantError ??
    (canViewContracts && paymentPlanQuery.isError
      ? paymentPlanQuery.error
      : undefined);
  const paymentPlanContractsError =
    previewError ??
    tenantError ??
    (canViewContracts && paymentPlanContractsQuery.isError
      ? paymentPlanContractsQuery.error
      : undefined);
  const isDashboardLoading =
    pageStatePreview !== 'error' &&
    !tenantError &&
    canViewContracts &&
    dashboardQuery.isPending;
  const isPaymentPlanLoading =
    pageStatePreview !== 'error' &&
    !tenantError &&
    canViewContracts &&
    paymentPlanQuery.isPending;

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
            error={customerStatsError}
            onRetry={() => void retryQuery(() => customerStatsQuery.refetch())}
          />
          <MetricCard
            label="Nhân viên"
            value={displayNumber(employeeStats?.total)}
            icon={UserRound}
            tone="success"
            isLoading={canViewEmployees && employeeStatsQuery.isPending}
            error={employeeStatsError}
            onRetry={() => void retryQuery(() => employeeStatsQuery.refetch())}
          />
          <MetricCard
            label="Hợp đồng hiệu lực"
            value={displayNumber(statistics?.contracts.active)}
            icon={FileText}
            tone="success"
            isLoading={isDashboardLoading}
            error={dashboardError}
            onRetry={() => void retryQuery(() => dashboardQuery.refetch())}
          />
          <MetricCard
            label="Sắp hết hạn"
            value={displayNumber(statistics?.contracts.expiring)}
            icon={CalendarClock}
            tone="amber"
            isLoading={isDashboardLoading}
            error={dashboardError}
            onRetry={() => void retryQuery(() => dashboardQuery.refetch())}
          />
        </div>
        <DashboardCard title="Công nợ phải thu" className="h-full">
          {dashboardError ? (
            <ErrorState
              title="Không tải được số liệu công nợ"
              description={getApiErrorMessage(dashboardError)}
              onRetry={() => void retryQuery(() => dashboardQuery.refetch())}
            />
          ) : (
            <CardContent className="divide-y divide-border p-0">
              <DashboardDebtRow
                label="Còn phải thu"
                value={displayCurrency(
                  statistics?.receivables.totalOutstanding,
                )}
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
          )}
        </DashboardCard>
      </div>

      {!canViewContracts && !tenantError ? (
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
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.95fr)] xl:items-start">
            <DashboardCard title="Kế hoạch thu tiền">
              {isPaymentPlanLoading ? (
                <div className="p-5">
                  <Skeleton className="h-72 w-full" />
                </div>
              ) : paymentPlanError ? (
                <ErrorState
                  title="Không tải được kế hoạch thu tiền"
                  description={getApiErrorMessage(paymentPlanError)}
                  onRetry={() =>
                    void retryQuery(() => paymentPlanQuery.refetch())
                  }
                  className="min-h-72"
                />
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
              isLoading={
                pageStatePreview !== 'error' &&
                !tenantError &&
                paymentPlanContractsQuery.isPending
              }
              isError={Boolean(paymentPlanContractsError)}
              error={paymentPlanContractsError}
              onRetry={() =>
                void retryQuery(() => paymentPlanContractsQuery.refetch())
              }
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
            <DashboardCard title="Tuổi nợ phải thu">
              {dashboardError ? (
                <ErrorState
                  title="Không tải được dữ liệu tuổi nợ"
                  description={getApiErrorMessage(dashboardError)}
                  onRetry={() =>
                    void retryQuery(() => dashboardQuery.refetch())
                  }
                  className="min-h-72"
                />
              ) : isDashboardLoading ? (
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
              {dashboardError ? (
                <ErrorState
                  title="Không tải được trạng thái hợp đồng"
                  description={getApiErrorMessage(dashboardError)}
                  onRetry={() =>
                    void retryQuery(() => dashboardQuery.refetch())
                  }
                  className="min-h-72"
                />
              ) : isDashboardLoading ? (
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
