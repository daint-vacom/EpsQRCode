/**
 * Scaffolded by chart-builder from `src/project/material-safety-inspections/charts/material-safety-inspection-status.chart.fixture.ts`. Run `npm run gen:chart` — do NOT hand-write this file.
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
import type { MaterialSafetyInspectionQueueChartPoint } from '../model/safety-inspection';

export interface MaterialSafetyInspectionStatusChartProps {
  data: MaterialSafetyInspectionQueueChartPoint[];
  countLabel: string;
  isEmpty?: boolean;
  className?: string;
}

export function MaterialSafetyInspectionStatusChart({
  data,
  countLabel,
  isEmpty = false,
  className,
}: MaterialSafetyInspectionStatusChartProps) {
  const chartConfig = {
    value: { label: countLabel, color: 'var(--admin-red-primary)' },
  } satisfies ChartConfig;
  const chartData = isEmpty
    ? [{ name: '', value: 1, fill: 'var(--admin-neutral-400)' }]
    : data;

  return (
    <ChartTooltipStyleProvider style="compact">
      <ChartContainer
        config={chartConfig}
        className={cn('h-48 w-full aspect-auto', className)}
      >
        <PieChart>
          {!isEmpty ? <ChartTooltip content={<ChartTooltipContent />} /> : null}
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            outerRadius={84}
            innerRadius={52}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`${entry.name}-${index}`}
                fill={entry.fill ?? 'var(--color-value)'}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </ChartTooltipStyleProvider>
  );
}
