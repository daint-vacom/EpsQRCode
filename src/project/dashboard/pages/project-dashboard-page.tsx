import { useMemo, type ReactNode } from 'react';
import { MaterialDashboardEpsMaterialsChart } from '@/project/dashboard/charts/eps-materials.chart.generated';
import { MaterialDashboardHandoverTrendChart } from '@/project/dashboard/charts/handover-trend.chart.generated';
import { MaterialDashboardInspectionStatusChart } from '@/project/dashboard/charts/inspection-status.chart.generated';
import { MaterialDashboardReceiptTrendChart } from '@/project/dashboard/charts/receipt-trend.chart.generated';
import { useMaterialDashboardSummaryQuery } from '@/project/dashboard/hooks/use-material-dashboard';
import type {
  MaterialDashboardInspectionPoint,
  MaterialDashboardTrendPoint,
} from '@/project/dashboard/model/material-dashboard';
import { HANDOVER_PERMISSION_CODES } from '@/project/handover/model/handover-permissions';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { MATERIAL_RECEIPT_PERMISSION_CODES } from '@/project/receipts/model/material-receipt';
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea } from '@/components/ui/scroll-area';

const INSPECTION_COLORS = {
  passed: 'var(--color-success-accent,var(--color-green-600))',
  failed: 'var(--color-destructive-accent,var(--color-red-600))',
  inProgress: 'var(--color-warning-accent,var(--color-yellow-600))',
} as const;

function getCurrentVietnamMonth(): {
  key: string;
  year: number;
  month: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);

  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    year,
    month,
  };
}

function formatMonthLabel(month: string) {
  const [year, numericMonth] = month.split('-');
  return `${numericMonth}/${year}`;
}

function MetricCard({
  title,
  value,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: number;
  icon: typeof Boxes;
  iconClassName: string;
}) {
  const intl = useIntl();

  return (
    <Card>
      <CardContent className="flex min-w-0 items-center gap-3 p-4 lg:gap-4 lg:p-5">
        <span
          aria-hidden="true"
          className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground lg:text-3xl">
            {intl.formatNumber(value)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof BarChart3;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="items-start">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">{title}</h2>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 pt-0">{children}</CardContent>
    </Card>
  );
}

export function ProjectDashboardPage() {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const currentMonth = useMemo(getCurrentVietnamMonth, []);
  const canViewMaterials = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canViewReceipts = hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.view);
  const canViewHandovers = hasPermission(HANDOVER_PERMISSION_CODES.view);
  const query = useMaterialDashboardSummaryQuery(
    `${currentMonth.key}-01`,
    !isPermissionsPending && canViewMaterials,
  );
  const summary = query.data;
  const receiptTrend = useMemo<MaterialDashboardTrendPoint[]>(
    () =>
      (summary?.monthlyReceipts ?? []).map((point) => ({
        ...point,
        label: formatMonthLabel(point.month),
      })),
    [summary?.monthlyReceipts],
  );
  const handoverTrend = useMemo<MaterialDashboardTrendPoint[]>(
    () =>
      (summary?.monthlyHandovers ?? []).map((point) => ({
        ...point,
        label: formatMonthLabel(point.month),
      })),
    [summary?.monthlyHandovers],
  );
  const inspectionResults = summary?.inspectionResults;
  const inspectionPoints = useMemo<MaterialDashboardInspectionPoint[]>(
    () =>
      inspectionResults
        ? [
            {
              name: intl.formatMessage({
                id: 'project.dashboard.charts.inspection.passed',
              }),
              value: inspectionResults.passed,
              fill: INSPECTION_COLORS.passed,
            },
            {
              name: intl.formatMessage({
                id: 'project.dashboard.charts.inspection.failed',
              }),
              value: inspectionResults.failed,
              fill: INSPECTION_COLORS.failed,
            },
            {
              name: intl.formatMessage({
                id: 'project.dashboard.charts.inspection.inProgress',
              }),
              value: inspectionResults.inProgress,
              fill: INSPECTION_COLORS.inProgress,
            },
          ]
        : [],
    [inspectionResults, intl],
  );
  const inspectionTotal = inspectionPoints.reduce(
    (sum, point) => sum + point.value,
    0,
  );
  const epsMaterials = summary?.materialsByEpsUnit ?? [];
  const epsChartHeight = Math.max(288, epsMaterials.length * 38 + 28);

  return (
    <div className="flex min-h-full flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'project.dashboard.title' })}
        icon={Boxes}
      />

      {isPermissionsPending || (canViewMaterials && query.isPending) ? (
        <PageLoading
          label={intl.formatMessage({ id: 'common.state.loading' })}
        />
      ) : !canViewMaterials ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.authorizationTitle',
          })}
          description={intl.formatMessage({
            id: 'project.materials.errors.authorization',
          })}
        />
      ) : query.isError ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.dashboard.errors.loadTitle',
          })}
          description={getApiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : summary ? (
        <div className="space-y-admin-page-section pb-1">
          <section
            aria-label={intl.formatMessage({ id: 'project.dashboard.title' })}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <MetricCard
              title={intl.formatMessage({
                id: 'project.dashboard.metrics.total',
              })}
              value={summary.totalMaterials}
              icon={Boxes}
              iconClassName="bg-primary/10 text-primary"
            />
            <MetricCard
              title={intl.formatMessage({
                id: 'project.dashboard.metrics.available',
              })}
              value={summary.availableMaterials}
              icon={ShieldCheck}
              iconClassName="bg-admin-success-bg text-admin-success-text"
            />
            <MetricCard
              title={intl.formatMessage({
                id: 'project.dashboard.metrics.loaned',
              })}
              value={summary.loanedMaterials}
              icon={ArrowLeftRight}
              iconClassName="bg-primary/10 text-primary"
            />
            <MetricCard
              title={intl.formatMessage({
                id: 'project.dashboard.metrics.needsInspection',
              })}
              value={summary.materialsToInspect}
              icon={TriangleAlert}
              iconClassName="bg-[var(--color-warning-soft,var(--color-yellow-100))] text-[var(--color-warning-accent,var(--color-yellow-700))]"
            />
          </section>

          {canViewReceipts || canViewHandovers ? (
            <section
              aria-label={intl.formatMessage({
                id: 'project.dashboard.charts.monthly.sectionLabel',
              })}
              className="grid gap-admin-page-section xl:grid-cols-2"
            >
              {canViewReceipts ? (
                <ChartCard
                  title={intl.formatMessage({
                    id: 'project.dashboard.charts.receipts.title',
                  })}
                  icon={BarChart3}
                >
                  <MaterialDashboardReceiptTrendChart data={receiptTrend} />
                </ChartCard>
              ) : null}
              {canViewHandovers ? (
                <ChartCard
                  title={intl.formatMessage({
                    id: 'project.dashboard.charts.handovers.title',
                  })}
                  icon={BarChart3}
                >
                  <MaterialDashboardHandoverTrendChart data={handoverTrend} />
                </ChartCard>
              ) : null}
            </section>
          ) : null}

          <section className="grid items-stretch gap-admin-page-section xl:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
            <ChartCard
              title={intl.formatMessage({
                id: 'project.dashboard.charts.eps.title',
              })}
              icon={BarChart3}
            >
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="size-2.5 rounded-sm bg-[var(--color-success-accent,var(--color-green-600))]" />
                  {intl.formatMessage({
                    id: 'project.dashboard.charts.eps.checked',
                  })}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2.5 rounded-sm bg-[var(--color-warning-accent,var(--color-yellow-600))]" />
                  {intl.formatMessage({
                    id: 'project.dashboard.charts.eps.needsInspection',
                  })}
                </span>
              </div>
              {epsMaterials.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title={intl.formatMessage({
                    id: 'project.dashboard.charts.eps.empty',
                  })}
                  className="min-h-[18rem]"
                />
              ) : (
                <ScrollArea className="max-h-[560px]">
                  <MaterialDashboardEpsMaterialsChart
                    data={epsMaterials}
                    height={epsChartHeight}
                    className="w-full"
                  />
                </ScrollArea>
              )}
            </ChartCard>

            <ChartCard
              title={intl.formatMessage(
                {
                  id: 'project.dashboard.charts.inspection.title',
                },
                {
                  month: currentMonth.month,
                  year: currentMonth.year,
                },
              )}
              icon={ClipboardCheck}
            >
              {inspectionTotal === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title={intl.formatMessage({
                    id: 'project.dashboard.charts.inspection.empty',
                  })}
                  className="min-h-[18rem]"
                />
              ) : (
                <div className="flex min-w-0 flex-col items-center gap-3 sm:flex-row sm:items-center">
                  <div className="relative h-56 w-56 shrink-0">
                    <MaterialDashboardInspectionStatusChart
                      data={inspectionPoints}
                      className="h-56 w-full aspect-auto"
                    />
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-semibold tabular-nums text-foreground">
                        {intl.formatNumber(inspectionTotal)}
                      </span>
                      <span className="max-w-24 text-xs text-muted-foreground">
                        {intl.formatMessage({
                          id: 'project.dashboard.charts.inspection.totalLabel',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    {inspectionPoints.map((point) => (
                      <div
                        key={point.name}
                        className="flex items-start justify-between gap-2 text-sm"
                      >
                        <span className="flex min-w-0 items-start gap-2 text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="mt-1 size-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: point.fill }}
                          />
                          <span className="min-w-0">{point.name}</span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-foreground">
                          {intl.formatNumber(point.value)}{' '}
                          <span className="font-normal text-muted-foreground">
                            (
                            {intl.formatNumber(point.value / inspectionTotal, {
                              style: 'percent',
                              maximumFractionDigits: 1,
                            })}
                            )
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>
          </section>
        </div>
      ) : null}
    </div>
  );
}
