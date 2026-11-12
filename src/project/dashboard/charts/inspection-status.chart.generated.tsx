/**
 * Scaffolded by chart-builder from `src/project/dashboard/charts/inspection-status.chart.fixture.ts`. Run `npm run gen:chart` — do NOT hand-write this file.
 * You own this file now — wire data and callbacks to screen logic or override the presentation.
 * To change chart kind, series, or config, edit the spec and re-gen to a scratch path first.
 */
import { Cell, Pie, PieChart } from 'recharts';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartTooltipStyleProvider,
  type ChartConfig,
} from '@/components/ui/chart';
import type { MaterialDashboardInspectionPoint } from '../model/material-dashboard';

const chartConfig = {
  value: { label: 'Lượt kiểm tra', color: 'var(--admin-blue-primary)' },
} satisfies ChartConfig;

export interface MaterialDashboardInspectionStatusChartProps {
  data: MaterialDashboardInspectionPoint[];
  className?: string;
}

export function MaterialDashboardInspectionStatusChart({
  data,
  className,
}: MaterialDashboardInspectionStatusChartProps) {
  return (
    <ChartTooltipStyleProvider style="compact">
      <ChartContainer
        config={chartConfig}
        className={cn('h-56 w-full aspect-auto', className)}
      >
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent />} />
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
