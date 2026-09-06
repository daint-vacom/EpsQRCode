import {
  MessageCircleOff,
  Minus,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserRoundX,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  CustomerPreviousMonthStats,
  CustomerStats,
} from '../api/customers.api';
import type { CustomerStatus } from '../model/customer';

type CustomerStatTone = 'blue' | 'green' | 'red' | 'slate';

const toneClasses: Record<CustomerStatTone, string> = {
  blue: 'bg-admin-blue-bg text-admin-blue-primary',
  green: 'bg-admin-success-bg text-admin-success-text',
  red: 'bg-admin-red-bg text-admin-red-dark',
  slate: 'bg-muted text-muted-foreground',
};

const toneLabelClasses: Record<CustomerStatTone, string> = {
  blue: 'text-admin-blue-primary',
  green: 'text-admin-success-text',
  red: 'text-admin-red-dark',
  slate: 'text-admin-neutral-800',
};

const toneIndicatorClasses: Record<CustomerStatTone, string> = {
  blue: 'before:bg-admin-blue-primary',
  green: 'before:bg-admin-success-text',
  red: 'before:bg-admin-red-primary',
  slate: 'before:bg-muted-foreground',
};

interface CustomerStatCardConfig {
  key: keyof CustomerStats;
  label: string;
  icon: LucideIcon;
  tone: CustomerStatTone;
  filterValue: CustomerStatus | null;
  increaseIsPositive: boolean;
}

type CustomerStatTrend = 'up' | 'down' | 'flat';

interface CustomerStatChange {
  trend: CustomerStatTrend;
  label: string;
}

const trendIcon: Record<CustomerStatTrend, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const positiveTrendClasses = 'bg-admin-success-bg text-admin-success-text';
const negativeTrendClasses = 'bg-admin-red-bg text-admin-red-dark';
const neutralTrendClasses = 'bg-muted text-muted-foreground';

function getTrendClasses(
  trend: CustomerStatTrend,
  increaseIsPositive: boolean,
): string {
  if (trend === 'flat') return neutralTrendClasses;

  const isPositive = trend === 'up' ? increaseIsPositive : !increaseIsPositive;
  return isPositive ? positiveTrendClasses : negativeTrendClasses;
}

function getStatChange(
  current: number,
  previous: number | undefined,
): CustomerStatChange | null {
  if (previous === undefined || !Number.isFinite(previous)) return null;

  const delta = current - previous;
  const trend: CustomerStatTrend =
    delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  if (previous === 0) {
    return { trend, label: formatNumber(Math.abs(delta)) };
  }

  return {
    trend,
    label: formatPercent(Math.abs(delta / previous)),
  };
}

const customerStatCards: readonly CustomerStatCardConfig[] = [
  {
    key: 'total',
    label: 'Tổng số khách hàng',
    icon: Users,
    tone: 'blue',
    filterValue: null,
    increaseIsPositive: true,
  },
  {
    key: 'active',
    label: 'Đang hoạt động',
    icon: UserCheck,
    tone: 'green',
    filterValue: 'active',
    increaseIsPositive: true,
  },
  {
    key: 'inactive',
    label: 'Ngừng hoạt động',
    icon: UserRoundX,
    tone: 'red',
    filterValue: 'inactive',
    increaseIsPositive: false,
  },
  {
    key: 'withoutContact',
    label: 'Chưa liên hệ',
    icon: MessageCircleOff,
    tone: 'slate',
    filterValue: 'uncontacted',
    increaseIsPositive: true,
  },
];

export function CustomerStatsCards({
  stats,
  previousMonthStats,
  isLoading = false,
  activeFilters = [],
  onFilterChange,
}: {
  stats?: CustomerStats;
  previousMonthStats?: CustomerPreviousMonthStats | null;
  isLoading?: boolean;
  activeFilters?: readonly CustomerStatus[];
  onFilterChange: (filter: CustomerStatus | null) => void;
}) {
  const hasStatusFilter = activeFilters.length > 0;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {customerStatCards.map(
        ({ key, label, icon: Icon, tone, filterValue, increaseIsPositive }) => {
          const isActive =
            filterValue === null
              ? activeFilters.length === 0
              : activeFilters.length === 1 && activeFilters[0] === filterValue;
          const isCardInactive = hasStatusFilter && !isActive;
          const description =
            filterValue === null
              ? 'So với tháng trước'
              : `${
                  stats && stats.total > 0
                    ? formatPercent(stats[key] / stats.total)
                    : '—%'
                } tổng khách hàng`;

          return (
            <Card
              key={key}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={`Lọc khách hàng: ${label}`}
              className={cn(
                'group relative overflow-visible border-0 bg-transparent shadow-none transition-transform duration-300 ease-out before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[inherit] before:transition-colors before:duration-300 before:ease-out before:content-[""] hover:-translate-y-1.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isCardInactive
                  ? 'before:bg-muted-foreground/30'
                  : toneIndicatorClasses[tone],
                isActive ? 'ring-1 ring-primary/15' : null,
              )}
              onClick={() => {
                if (!isLoading) onFilterChange(filterValue);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                if (!isLoading) onFilterChange(filterValue);
              }}
            >
              <CardContent
                className={cn(
                  'relative z-10 mt-1 flex min-h-28 items-center gap-3 rounded-[inherit] border border-border bg-card p-4 shadow-xs transition-[box-shadow,opacity] duration-300 ease-out group-hover:shadow-md',
                  isCardInactive ? 'opacity-70' : 'opacity-100',
                )}
              >
                <span
                  className={cn(
                    'inline-flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ease-out',
                    isCardInactive
                      ? 'bg-muted text-muted-foreground'
                      : toneClasses[tone],
                  )}
                >
                  <Icon
                    className={cn(
                      'size-6 transition-colors duration-300 ease-out',
                      isCardInactive ? 'text-muted-foreground' : null,
                    )}
                    aria-hidden="true"
                  />
                </span>
                <div className="min-w-0">
                  <CardDescription
                    className={cn(
                      'truncate font-semibold',
                      isCardInactive
                        ? 'text-muted-foreground'
                        : toneLabelClasses[tone],
                    )}
                  >
                    {label}
                  </CardDescription>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-7 w-24" />
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      <CardTitle className="text-2xl tabular-nums">
                        {stats ? formatNumber(stats[key]) : '—'}
                      </CardTitle>
                      {stats && previousMonthStats
                        ? (() => {
                            const change = getStatChange(
                              stats[key],
                              previousMonthStats.stats[key],
                            );
                            if (!change) return null;
                            const TrendIcon = trendIcon[change.trend];

                            return (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4',
                                  getTrendClasses(
                                    change.trend,
                                    increaseIsPositive,
                                  ),
                                )}
                                aria-label={`${change.trend === 'up' ? 'Tăng' : change.trend === 'down' ? 'Giảm' : 'Không đổi'} ${change.label} so với tháng trước`}
                              >
                                <TrendIcon
                                  className="size-3"
                                  aria-hidden="true"
                                />
                                {change.label}
                              </span>
                            );
                          })()
                        : null}
                    </div>
                  )}
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        },
      )}
    </div>
  );
}
