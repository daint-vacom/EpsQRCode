/**
 * Scaffolded by chart-builder from `src/project/dashboard/charts/receipt-trend.chart.fixture.ts`. Run `npm run gen:chart` — do NOT hand-write this file.
 * You own this file now — wire data and callbacks to screen logic or override the presentation.
 * To change chart kind, series, or config, edit the spec and re-gen to a scratch path first.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartTooltipStyleProvider,
  type ChartConfig,
} from '@/components/ui/chart';
import type { MaterialDashboardTrendPoint } from '../model/material-dashboard';

const chartConfig = {
  count: { label: 'Vật tư nhập', color: 'var(--admin-blue-primary)' },
} satisfies ChartConfig;

export interface MaterialDashboardReceiptTrendChartProps {
  data: MaterialDashboardTrendPoint[];
  className?: string;
}

export function MaterialDashboardReceiptTrendChart({
  data,
  className,
}: MaterialDashboardReceiptTrendChartProps) {
  return (
    <ChartTooltipStyleProvider style="compact">
      <ChartContainer
        config={chartConfig}
        className={cn('h-64 w-full aspect-auto', className)}
      >
        <BarChart
          data={data}
          margin={{ top: 16, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={36}
            allowDecimals={false}
            tickCount={5}
            domain={[0, (dataMax) => Math.max(dataMax, 1)]}
            tickFormatter={(value) => Number(value).toLocaleString('vi-VN')}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="count"
              position="top"
              fill="var(--foreground)"
              fontSize={11}
              formatter={(value) =>
                Number(value) > 0 ? Number(value).toLocaleString('vi-VN') : ''
              }
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartTooltipStyleProvider>
  );
}
