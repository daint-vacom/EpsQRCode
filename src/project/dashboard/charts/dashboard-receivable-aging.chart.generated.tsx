/**
 * Scaffolded by chart-builder from `src/project/dashboard/charts/dashboard-receivable-aging.chart.fixture.ts`. Run `npm run gen:chart` — do NOT hand-write this file.
 * You own this file now — wire data and callbacks to screen logic or override the presentation.
 * To change chart kind, series, or config, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartTooltipStyleProvider,
  type ChartConfig,
} from '@/components/ui/chart';
import type { DashboardReceivableAgingChartPoint } from '../model/dashboard';

const chartConfig = {
  amount: { label: 'Giá trị công nợ', color: 'var(--admin-red-primary)' },
} satisfies ChartConfig;

export interface DashboardReceivableAgingChartProps {
  data: DashboardReceivableAgingChartPoint[];
  className?: string;
  valueFormatter?: (value: number, name?: string) => ReactNode;
  axisValueFormatter?: (value: number) => string;
}

export function DashboardReceivableAgingChart({
  data,
  className,
  valueFormatter,
  axisValueFormatter,
}: DashboardReceivableAgingChartProps) {
  return (
    <ChartTooltipStyleProvider style="compact">
      <ChartContainer
        config={chartConfig}
        className={cn('h-72 w-full aspect-auto', className)}
      >
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={axisValueFormatter}
          />
          <ChartTooltip
            content={<ChartTooltipContent valueFormatter={valueFormatter} />}
          />
          <Bar
            dataKey="amount"
            fill="var(--color-amount)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </ChartTooltipStyleProvider>
  );
}
