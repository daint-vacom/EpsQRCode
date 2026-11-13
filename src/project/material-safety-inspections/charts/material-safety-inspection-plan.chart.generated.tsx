/**
 * Scaffolded by chart-builder from `src/project/material-safety-inspections/charts/material-safety-inspection-plan.chart.fixture.ts`. Run `npm run gen:chart` — do NOT hand-write this file.
 * You own this file now — wire data and callbacks to screen logic or override the presentation.
 * To change chart kind, series, or config, edit the spec and re-gen to a scratch path first.
 */
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
import type { MaterialSafetyInspectionPlanChartPoint } from '../model/safety-inspection';

export interface MaterialSafetyInspectionPlanChartProps {
  data: MaterialSafetyInspectionPlanChartPoint[];
  labels: { notInspected: string; inProgress: string; completed: string };
  className?: string;
}

export function MaterialSafetyInspectionPlanChart({
  data,
  labels,
  className,
}: MaterialSafetyInspectionPlanChartProps) {
  const chartConfig = {
    notInspected: {
      label: labels.notInspected,
      color: 'var(--admin-red-primary)',
    },
    inProgress: {
      label: labels.inProgress,
      color: 'var(--admin-amber-primary)',
    },
    completed: {
      label: labels.completed,
      color: 'var(--admin-success-dot)',
    },
  } satisfies ChartConfig;

  return (
    <ChartTooltipStyleProvider style="line">
      <ChartContainer
        config={chartConfig}
        className={cn('h-60 w-full aspect-auto', className)}
      >
        <BarChart
          data={data}
          margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tickLine={false}
            axisLine={false}
            interval={0}
            height={32}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            domain={[0, 'auto']}
            width={88}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="notInspected"
            stackId="inspectionStatus"
            fill="var(--color-notInspected)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="inProgress"
            stackId="inspectionStatus"
            fill="var(--color-inProgress)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="completed"
            stackId="inspectionStatus"
            fill="var(--color-completed)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </ChartTooltipStyleProvider>
  );
}
