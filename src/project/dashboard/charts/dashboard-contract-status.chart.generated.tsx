/**
 * Scaffolded by chart-builder from `src/project/dashboard/charts/dashboard-contract-status.chart.fixture.ts`. Run `npm run gen:chart` — do NOT hand-write this file.
 * You own this file now — wire data and callbacks to screen logic or override the presentation.
 * To change chart kind, series, or config, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import { Cell, Pie, PieChart } from 'recharts';
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
import type { DashboardContractStatusChartPoint } from '../model/dashboard';

const chartConfig = {
  value: { label: 'Số hợp đồng', color: 'var(--admin-blue-primary)' },
} satisfies ChartConfig;

export interface DashboardContractStatusChartProps {
  data: DashboardContractStatusChartPoint[];
  className?: string;
  valueFormatter?: (value: number, name?: string) => ReactNode;
}

export function DashboardContractStatusChart({
  data,
  className,
  valueFormatter,
}: DashboardContractStatusChartProps) {
  return (
    <ChartTooltipStyleProvider style="compact">
      <ChartContainer
        config={chartConfig}
        className={cn('h-72 w-full aspect-auto', className)}
      >
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent valueFormatter={valueFormatter} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={84}
            innerRadius={52}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.fill ?? 'var(--color-value)'}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </ChartTooltipStyleProvider>
  );
}
