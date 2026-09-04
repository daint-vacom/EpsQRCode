/**
 * Scaffolded by chart-builder from `src/project/dashboard/charts/dashboard-receivable-trend.chart.fixture.ts`. Run `npm run gen:chart` — do NOT hand-write this file.
 * You own this file now — wire data and callbacks to screen logic or override the presentation.
 * To change chart kind, series, or config, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  ChartTooltipStyleProvider,
  type ChartConfig,
} from '@/components/ui/chart';
import type { DashboardMonthlyReceivable } from '../model/dashboard';

const chartConfig = {
  paidAmount: { label: 'Đã thu', color: 'var(--admin-success-dot)' },
  currentOutstanding: {
    label: 'Còn phải thu',
    color: 'var(--admin-amber-primary)',
  },
  overdueOutstanding: { label: 'Quá hạn', color: 'var(--admin-red-primary)' },
  futureOutstanding: {
    label: 'Chưa đến hạn',
    color: 'var(--admin-neutral-100)',
  },
} satisfies ChartConfig;

export interface DashboardReceivableTrendChartProps {
  data: DashboardMonthlyReceivable[];
  className?: string;
  valueFormatter?: (value: number, name?: string) => ReactNode;
  axisValueFormatter?: (value: number) => string;
  selectedMonthLabel?: string;
  onItemClick?: (item: DashboardMonthlyReceivable, index: number) => void;
}

export function DashboardReceivableTrendChart({
  data,
  className,
  valueFormatter,
  axisValueFormatter,
  selectedMonthLabel,
  onItemClick,
}: DashboardReceivableTrendChartProps) {
  return (
    <ChartTooltipStyleProvider style="line">
      <ChartContainer
        config={chartConfig}
        className={cn('h-72 w-full aspect-auto', className)}
      >
        <BarChart
          data={data}
          onClick={(state) => {
            const index = state.activeTooltipIndex;
            const item = index == null || index < 0 ? undefined : data[index];

            if (!item || index == null) {
              return;
            }

            onItemClick?.(item, index);
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tickLine={false}
            axisLine={false}
            interval={0}
            height={58}
            tickMargin={8}
            tick={({ x, y, payload }) => {
              const label = String(payload?.value ?? '');
              const isSelected = label === selectedMonthLabel;

              return (
                <text
                  x={x}
                  y={y}
                  dy={16}
                  textAnchor="end"
                  transform={`rotate(-22 ${x ?? 0} ${y ?? 0})`}
                  style={{
                    fill: isSelected
                      ? 'var(--primary)'
                      : 'var(--muted-foreground)',
                  }}
                  fontSize={12}
                  fontWeight={isSelected ? 700 : 400}
                >
                  {label}
                </text>
              );
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={88}
            tickFormatter={axisValueFormatter}
          />
          <ChartTooltip
            content={<ChartTooltipContent valueFormatter={valueFormatter} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="paidAmount"
            stackId="receivable"
            fill="var(--color-paidAmount)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="currentOutstanding"
            stackId="receivable"
            fill="var(--color-currentOutstanding)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="overdueOutstanding"
            stackId="receivable"
            fill="var(--color-overdueOutstanding)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="futureOutstanding"
            stackId="receivable"
            fill="var(--color-futureOutstanding)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </ChartTooltipStyleProvider>
  );
}
