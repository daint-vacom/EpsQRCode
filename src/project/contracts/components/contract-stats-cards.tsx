import { format, startOfMonth } from 'date-fns';
import {
  CalendarClock,
  CalendarX2,
  FileCheck2,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { formatCurrencyVND, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardMonthlyReceivable } from '../../dashboard/model/dashboard';
import type { ContractStatus, ContractStatusStats } from '../model/contract';

type ContractStatTone = 'blue' | 'amber' | 'red';

const toneClasses: Record<ContractStatTone, string> = {
  blue: 'bg-admin-blue-bg text-admin-blue-primary',
  amber: 'bg-admin-amber-bg text-admin-amber-dark',
  red: 'bg-admin-red-bg text-admin-red-dark',
};

const statusIndicatorClasses: Record<ContractStatTone, string> = {
  blue: 'bg-admin-blue-primary',
  amber: 'bg-admin-amber-primary',
  red: 'bg-admin-red-primary',
};

interface ContractStatusCardConfig {
  key: 'active' | 'expiring' | 'expired';
  label: string;
  icon: LucideIcon;
  tone: ContractStatTone;
  filterValue: ContractStatus | null;
}

const statusCards: readonly ContractStatusCardConfig[] = [
  {
    key: 'active',
    label: 'Đang hiệu lực',
    icon: FileCheck2,
    tone: 'blue',
    filterValue: 'active',
  },
  {
    key: 'expiring',
    label: 'Sắp hết hạn',
    icon: CalendarClock,
    tone: 'amber',
    filterValue: null,
  },
  {
    key: 'expired',
    label: 'Đã hết hạn',
    icon: CalendarX2,
    tone: 'red',
    filterValue: 'expired',
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

function Sparkline({ data }: { data: DashboardMonthlyReceivable[] }) {
  if (data.length < 2) return null;

  const values = data.map(getPaymentPlanTotal);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - ((value - min) / range) * 22;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 32"
      className="h-8 w-28 shrink-0 overflow-visible text-admin-blue-light"
      role="img"
      aria-label="Xu hướng kế hoạch thu sáu tháng gần nhất"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      {values.length > 0 ? (
        <circle
          cx="100"
          cy={28 - ((values[values.length - 1] - min) / range) * 22}
          r="2.5"
          fill="currentColor"
        />
      ) : null}
    </svg>
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

function StatusCard({
  config,
  stats,
  total,
  isActive,
  isInactive,
  isLoading,
  onFilterChange,
}: {
  config: ContractStatusCardConfig;
  stats?: ContractStatusStats;
  total: number;
  isActive: boolean;
  isInactive: boolean;
  isLoading: boolean;
  onFilterChange: (status: ContractStatus | null) => void;
}) {
  const Icon = config.icon;
  const value = stats?.[config.key];
  const percentage =
    value !== undefined && total > 0 ? formatPercent(value / total) : '—%';
  const canFilter = config.filterValue !== null;

  return (
    <Card
      role={canFilter ? 'button' : undefined}
      tabIndex={canFilter ? 0 : undefined}
      aria-pressed={canFilter ? isActive : undefined}
      aria-label={canFilter ? `Lọc hợp đồng: ${config.label}` : undefined}
      className={cn(
        'group relative min-h-36 overflow-hidden border-0 bg-transparent shadow-none transition-transform duration-300 ease-out before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[inherit] before:transition-colors before:duration-300 before:ease-out before:content-[""]',
        canFilter
          ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg'
          : null,
        isInactive ? 'before:bg-muted-foreground/25' : null,
        isInactive ? 'opacity-70' : null,
        !isInactive ? 'before:bg-background' : null,
        isActive ? 'ring-1 ring-primary/15' : null,
      )}
      onClick={canFilter ? () => onFilterChange(config.filterValue) : undefined}
      onKeyDown={
        canFilter
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onFilterChange(config.filterValue);
            }
          : undefined
      }
    >
      <CardContent className="relative z-10 flex min-h-36 flex-col justify-between rounded-[inherit] border border-border bg-card p-3.5 shadow-xs transition-[box-shadow,opacity] duration-300 ease-out group-hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <CardDescription
            className={cn(
              'truncate font-semibold text-foreground',
              isInactive ? 'text-muted-foreground' : null,
            )}
          >
            {config.label}
          </CardDescription>
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
        </div>
        {isLoading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <p
            className={cn(
              'text-2xl font-semibold tracking-tight tabular-nums',
              isInactive ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {value === undefined ? '—' : formatNumber(value)}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-muted-foreground">
            {percentage} tổng số hợp đồng
          </span>
          <span
            className={cn(
              'h-1.5 w-10 shrink-0 rounded-full transition-colors duration-300',
              isInactive
                ? 'bg-muted-foreground/30'
                : statusIndicatorClasses[config.tone],
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function ContractStatsCards({
  stats,
  paymentPlan,
  isLoading = false,
  activeStatusFilters = [],
  onStatusFilterChange,
}: {
  stats?: ContractStatusStats;
  paymentPlan?: DashboardMonthlyReceivable[];
  isLoading?: boolean;
  activeStatusFilters?: readonly ContractStatus[];
  onStatusFilterChange: (status: ContractStatus | null) => void;
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
  const trendData = (paymentPlan ?? [])
    .filter((item) => item.monthStart <= currentMonthStart)
    .slice(-6);
  const previousMonth = trendData.at(-2);
  const trend = getTrend(
    currentMonth ? getPaymentPlanTotal(currentMonth) : undefined,
    previousMonth ? getPaymentPlanTotal(previousMonth) : undefined,
  );
  const hasStatusFilter = activeStatusFilters.length > 0;
  const isPlanInactive = hasStatusFilter;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.45fr)_repeat(3,minmax(0,1fr))]">
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={!hasStatusFilter}
        aria-label="Xóa bộ lọc trạng thái hợp đồng"
        className={cn(
          'group relative min-h-36 cursor-pointer overflow-hidden border-0 bg-admin-neutral-800 text-white shadow-xs transition-transform duration-300 ease-out hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isPlanInactive ? 'opacity-70' : 'opacity-100',
        )}
        onClick={() => onStatusFilterChange(null)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onStatusFilterChange(null);
        }}
      >
        <CardContent className="flex min-h-36 flex-col justify-between gap-2 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white/90">
                Kế hoạch thu tháng này
              </p>
              {isLoading ? (
                <Skeleton className="mt-2 h-7 w-48 bg-white/20" />
              ) : (
                <p className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums text-white">
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
            <Sparkline data={trendData} />
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-white/55">
            <span>So với tháng trước</span>
            {trend ? (
              <span className="inline-flex items-center gap-1 text-admin-blue-light">
                {trend.isUp ? (
                  <TrendingUp className="size-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-3" aria-hidden="true" />
                )}
                {trend.label}
              </span>
            ) : (
              <span>Chưa có dữ liệu</span>
            )}
          </div>
        </CardContent>
      </Card>

      {statusCards.map((config) => {
        const isActive =
          config.filterValue !== null &&
          activeStatusFilters.length === 1 &&
          activeStatusFilters[0] === config.filterValue;
        const isInactive = hasStatusFilter && !isActive;

        return (
          <StatusCard
            key={config.key}
            config={config}
            stats={stats}
            total={stats?.total ?? 0}
            isActive={isActive}
            isInactive={isInactive}
            isLoading={isLoading}
            onFilterChange={onStatusFilterChange}
          />
        );
      })}
    </div>
  );
}
