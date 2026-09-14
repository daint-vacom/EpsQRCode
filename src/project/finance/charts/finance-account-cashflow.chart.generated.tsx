/**
 * Scaffolded by chart-builder from `src/project/finance/charts/finance-account-cashflow.chart.fixture.ts`. Run `npm run gen:chart` — do NOT hand-write this file.
 * You own this file now — wire data and callbacks to screen logic or override the presentation.
 * To change chart kind, series, or config, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts';
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
import type { FinanceAccountTrendPoint } from '../model/finance-analytics';

const chartConfig = {
  receipt: { label: 'Thu', color: 'var(--admin-success-dot)' },
  payment: { label: 'Chi', color: 'var(--admin-red-primary)' },
  balance: { label: 'Số dư', color: 'var(--admin-blue-primary)' },
} satisfies ChartConfig;

export interface FinanceAccountCashflowChartProps {
  data: FinanceAccountTrendPoint[];
  className?: string;
  valueFormatter?: (value: number, name?: string) => ReactNode;
  axisValueFormatter?: (value: number) => string;
}

export function FinanceAccountCashflowChart({
  data,
  className,
  valueFormatter,
  axisValueFormatter,
}: FinanceAccountCashflowChartProps) {
  return (
    <ChartTooltipStyleProvider style="line">
      <ChartContainer
        config={chartConfig}
        className={cn('h-80 w-full aspect-auto', className)}
      >
        <ComposedChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="periodLabel"
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-22}
            textAnchor="end"
            height={58}
            tickMargin={8}
          />
          <YAxis
            yAxisId="cashflow"
            tickLine={false}
            axisLine={false}
            width={72}
            tickFormatter={axisValueFormatter}
          />
          <YAxis
            yAxisId="balance"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={72}
            tickFormatter={axisValueFormatter}
          />
          <ChartTooltip
            content={<ChartTooltipContent valueFormatter={valueFormatter} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="receipt"
            yAxisId="cashflow"
            fill="var(--color-receipt)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="payment"
            yAxisId="cashflow"
            fill="var(--color-payment)"
            radius={[4, 4, 0, 0]}
          />
          <Line
            dataKey="balance"
            yAxisId="balance"
            type="monotone"
            stroke="var(--color-balance)"
            strokeWidth={2}
          />
        </ComposedChart>
      </ChartContainer>
    </ChartTooltipStyleProvider>
  );
}
