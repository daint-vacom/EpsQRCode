import { format, startOfMonth } from 'date-fns';
import {
  CalendarClock,
  CalendarX2,
  FileCheck2,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Area, AreaChart, XAxis, YAxis } from 'recharts';
import { formatCurrencyVND, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartTooltipStyleProvider,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DashboardMonthlyReceivable } from '../../dashboard/model/dashboard';
import type { ContractStatus, ContractStatusStats } from '../model/contract';

type ContractStatTone = 'blue' | 'amber' | 'red';

const toneClasses: Record<ContractStatTone, string> = {
  blue: 'bg-admin-blue-bg text-admin-blue-primary',
  amber: 'bg-admin-amber-bg text-admin-amber-dark',
  red: 'bg-admin-red-bg text-admin-red-dark',
};

const valueToneClasses: Record<ContractStatTone, string> = {
  blue: 'text-admin-blue-primary',
  amber: 'text-admin-amber-dark',
  red: 'text-admin-red-dark',
};

const trendChartConfig = {
  totalAmount: {
    label: 'Kế hoạch thu',
    color: 'var(--admin-blue-primary)',
  },
} satisfies ChartConfig;

interface ContractStatusCardConfig {
  key: 'active' | 'expiring' | 'expired';
  label: string;
  icon: LucideIcon;
  tone: ContractStatTone;
  filterValue: ContractStatus | null;
  canFilter: boolean;
}

const statusCards: readonly ContractStatusCardConfig[] = [
  {
    key: 'active',
    label: 'Đang hiệu lực',
    icon: FileCheck2,
    tone: 'blue',
    filterValue: 'active',
    canFilter: true,
  },
  {
    key: 'expiring',
    label: 'Sắp hết hạn',
    icon: CalendarClock,
    tone: 'amber',
    filterValue: null,
    canFilter: true,
  },
  {
    key: 'expired',
    label: 'Đã hết hạn',
    icon: CalendarX2,
    tone: 'red',
    filterValue: 'expired',
    canFilter: true,
  },
];

function getPaymentPlanTotal(item: DashboardMonthlyReceivable): number {
  return (
    item.paidAmount +
    item.currentOutstanding +
    item.overdueOutstanding +
    item.futureOutstanding
  );
}

function getOutstandingTotal(item: DashboardMonthlyReceivable): number {
  return (
    item.currentOutstanding + item.overdueOutstanding + item.futureOutstanding
  );
}

function Sparkline({
  data,
  className,
  currentMonthStart,
}: {
  data: DashboardMonthlyReceivable[];
  className?: string;
  currentMonthStart: string;
}) {
  if (data.length < 2) return null;

  const currentMonthIndex = data.findIndex(
    (item) => item.monthStart === currentMonthStart,
  );
  const currentStopPercent =
    currentMonthIndex > 0 ? (currentMonthIndex / (data.length - 1)) * 100 : 100;
  const chartData = data.map((item) => ({
    ...item,
    totalAmount: getPaymentPlanTotal(item),
  }));

  return (
    <ChartTooltipStyleProvider style="line">
      <ChartContainer
        config={trendChartConfig}
        className={cn('h-12 w-full shrink-0', className)}
      >
        <AreaChart
          data={chartData}
          margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient
              id="contractTrendAreaGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop
                offset="0%"
                stopColor="var(--admin-blue-primary)"
                stopOpacity={0.2}
              />
              <stop
                offset={`${currentStopPercent}%`}
                stopColor="var(--admin-blue-primary)"
                stopOpacity={0.2}
              />
              <stop
                offset={`${currentStopPercent + 0.01}%`}
                stopColor="var(--admin-neutral-400)"
                stopOpacity={0.14}
              />
              <stop
                offset="100%"
                stopColor="var(--admin-neutral-400)"
                stopOpacity={0.14}
              />
            </linearGradient>
            <linearGradient
              id="contractTrendStrokeGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor="var(--admin-blue-primary)" />
              <stop
                offset={`${currentStopPercent}%`}
                stopColor="var(--admin-blue-primary)"
              />
              <stop
                offset={`${currentStopPercent + 0.01}%`}
                stopColor="var(--admin-neutral-400)"
              />
              <stop offset="100%" stopColor="var(--admin-neutral-400)" />
            </linearGradient>
          </defs>
          <XAxis dataKey="monthLabel" hide height={0} />
          <YAxis hide width={0} domain={['dataMin', 'dataMax']} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="line"
                valueFormatter={(value) => formatCurrencyVND(value)}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="totalAmount"
            stroke="url(#contractTrendStrokeGradient)"
            fill="url(#contractTrendAreaGradient)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ChartContainer>
    </ChartTooltipStyleProvider>
  );
}

function getTrend(
  current: number | undefined,
  previous: number | undefined,
): { label: string; isUp: boolean } | null {
  if (current === undefined || previous === undefined || previous === 0) {
    return null;
  }

  return {
    label: formatPercent(Math.abs((current - previous) / previous)),
    isUp: current >= previous,
  };
}

function getMonthPlan(
  paymentPlan: DashboardMonthlyReceivable[] | undefined,
  monthStart: string,
) {
  return paymentPlan?.find((item) => item.monthStart === monthStart);
}

function StatusSummaryRow({
  config,
  stats,
  total,
  isActive,
  isInactive,
  isLoading,
  onFilterChange,
  onExpiringFilterChange,
}: {
  config: ContractStatusCardConfig;
  stats?: ContractStatusStats;
  total: number;
  isActive: boolean;
  isInactive: boolean;
  isLoading: boolean;
  onFilterChange: (status: ContractStatus | null) => void;
  onExpiringFilterChange: () => void;
}) {
  const Icon = config.icon;
  const value = stats?.[config.key];
  const percentage =
    value !== undefined && total > 0 ? formatPercent(value / total) : '—%';
  const canFilter = config.canFilter;

  const rowContent = (
    <>
      <span
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300',
          isInactive
            ? 'bg-muted text-muted-foreground'
            : toneClasses[config.tone],
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span
          className={cn(
            'block truncate text-sm font-medium text-foreground',
            isInactive ? 'text-muted-foreground' : null,
          )}
        >
          {config.label}
        </span>
      </span>
      {isLoading ? (
        <Skeleton className="h-5 w-12 shrink-0" />
      ) : (
        <span className="shrink-0 tabular-nums">
          <span
            className={cn(
              'text-base font-semibold',
              isInactive
                ? 'text-muted-foreground'
                : valueToneClasses[config.tone],
            )}
          >
            {value === undefined ? '—' : formatNumber(value)}
          </span>
          {value !== undefined && total > 0 ? (
            <span
              className={cn(
                'ms-1 text-xs font-normal text-foreground',
                isInactive ? 'text-muted-foreground' : null,
              )}
            >
              ({percentage})
            </span>
          ) : null}
        </span>
      )}
    </>
  );

  if (!canFilter) {
    return (
      <div className="flex items-center gap-3 px-4 py-2">{rowContent}</div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={isActive}
      aria-label={`Lọc hợp đồng: ${config.label}`}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2 text-start transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        isActive ? 'bg-primary/5' : null,
        isInactive ? 'opacity-70' : null,
      )}
      onClick={() => {
        if (config.key === 'expiring') {
          onExpiringFilterChange();
          return;
        }
        onFilterChange(config.filterValue);
      }}
    >
      {rowContent}
    </button>
  );
}

export function ContractStatsCards({
  stats,
  paymentPlan,
  isLoading = false,
  activeStatusFilters = [],
  isExpiringFilterActive = false,
  onStatusFilterChange,
  onExpiringFilterChange,
}: {
  stats?: ContractStatusStats;
  paymentPlan?: DashboardMonthlyReceivable[];
  isLoading?: boolean;
  activeStatusFilters?: readonly ContractStatus[];
  isExpiringFilterActive?: boolean;
  onStatusFilterChange: (status: ContractStatus | null) => void;
  onExpiringFilterChange: () => void;
}) {
  const currentMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const currentMonth = getMonthPlan(paymentPlan, currentMonthStart);
  const currentPlanAmount = currentMonth
    ? getPaymentPlanTotal(currentMonth)
    : undefined;
  const currentPaidAmount = currentMonth?.paidAmount;
  const currentOutstandingAmount = currentMonth
    ? getOutstandingTotal(currentMonth)
    : undefined;
  const progressPercent =
    currentPlanAmount &&
    currentPlanAmount > 0 &&
    currentPaidAmount !== undefined
      ? Math.min(
          100,
          Math.max(0, (currentPaidAmount / currentPlanAmount) * 100),
        )
      : 0;
  const currentPaymentPlanIndex =
    paymentPlan?.findIndex((item) => item.monthStart === currentMonthStart) ??
    -1;
  const trendData =
    currentPaymentPlanIndex >= 0
      ? (paymentPlan ?? []).slice(
          Math.max(0, currentPaymentPlanIndex - 3),
          currentPaymentPlanIndex + 3,
        )
      : [];
  const currentTrendIndex = trendData.findIndex(
    (item) => item.monthStart === currentMonthStart,
  );
  const trendCurrentMonth =
    currentTrendIndex >= 0 ? trendData[currentTrendIndex] : undefined;
  const trendPreviousMonth =
    currentTrendIndex > 0 ? trendData[currentTrendIndex - 1] : undefined;
  const trend = getTrend(
    trendCurrentMonth ? getPaymentPlanTotal(trendCurrentMonth) : undefined,
    trendPreviousMonth ? getPaymentPlanTotal(trendPreviousMonth) : undefined,
  );
  const hasStatusFilter = activeStatusFilters.length > 0;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(18rem,0.9fr)]">
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={!hasStatusFilter}
        aria-label="Xóa bộ lọc trạng thái hợp đồng"
        className={cn(
          'group relative cursor-pointer overflow-hidden border-0 bg-admin-neutral-800 text-white shadow-xs transition-transform duration-300 ease-out hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
        onClick={() => onStatusFilterChange(null)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onStatusFilterChange(null);
        }}
      >
        <CardContent className="flex flex-col justify-between gap-1.5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white/90">
                Kế hoạch thu tháng này
              </p>
              {isLoading ? (
                <Skeleton className="mt-2 h-7 w-48 bg-white/20" />
              ) : (
                <p className="mt-0.5 truncate text-xl font-semibold tracking-tight tabular-nums text-white">
                  {currentPlanAmount === undefined
                    ? '—'
                    : formatCurrencyVND(currentPlanAmount)}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-md border border-white/20 px-2 py-1 text-[11px] text-white/80">
              Tháng này
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[11px] text-white/75">
            <div className="min-w-0">
              <p>Đã thu</p>
              <p className="mt-0.5 truncate font-semibold tabular-nums text-admin-blue-light">
                {currentPaidAmount === undefined
                  ? '—'
                  : formatCurrencyVND(currentPaidAmount)}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p>Còn lại</p>
              <p className="mt-0.5 truncate font-semibold tabular-nums text-white">
                {currentOutstandingAmount === undefined
                  ? '—'
                  : formatCurrencyVND(currentOutstandingAmount)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-admin-blue-light transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/80">
              {currentPlanAmount === undefined
                ? '—'
                : `${formatPercent(progressPercent / 100)} đã thu`}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader sectionBorders="default" className="px-3.5 py-2.5">
          <CardHeading>
            <CardTitle>Xu hướng kế hoạch thu</CardTitle>
            <CardDescription>6 tháng gần nhất</CardDescription>
          </CardHeading>
          {trend ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className={cn(
                    'inline-flex shrink-0 cursor-help items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold tabular-nums outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    trend.isUp
                      ? 'bg-admin-success-bg text-admin-success-text'
                      : 'bg-admin-red-bg text-admin-red-primary',
                  )}
                  aria-label="So với tháng trước"
                >
                  {trend.isUp ? (
                    <TrendingUp className="size-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="size-3.5" aria-hidden="true" />
                  )}
                  {trend.label}
                </span>
              </TooltipTrigger>
              <TooltipContent variant="light">
                So với tháng trước
              </TooltipContent>
            </Tooltip>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col justify-between gap-2.5 px-3.5 py-3">
          {isLoading ? (
            <Skeleton className="h-14 w-full" />
          ) : trendData.length < 2 ? (
            <div className="flex h-14 items-center text-sm text-muted-foreground">
              Chưa có đủ dữ liệu để hiển thị xu hướng.
            </div>
          ) : (
            <Sparkline
              data={trendData}
              currentMonthStart={currentMonthStart}
              className="h-12 w-full"
            />
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="divide-y divide-border p-0">
          {statusCards.map((config) => {
            const isActive =
              config.key === 'expiring'
                ? isExpiringFilterActive
                : !isExpiringFilterActive &&
                  config.filterValue !== null &&
                  activeStatusFilters.length === 1 &&
                  activeStatusFilters[0] === config.filterValue;
            const isInactive = hasStatusFilter && !isActive;

            return (
              <StatusSummaryRow
                key={config.key}
                config={config}
                stats={stats}
                total={stats?.total ?? 0}
                isActive={isActive}
                isInactive={isInactive}
                isLoading={isLoading}
                onFilterChange={onStatusFilterChange}
                onExpiringFilterChange={onExpiringFilterChange}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
