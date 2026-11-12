/**
 * Scaffolded by chart-builder from `src/project/dashboard/charts/eps-materials.chart.fixture.ts`. Run `npm run gen:chart` — do NOT hand-write this file.
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
  ChartTooltipStyleProvider,
  type ChartConfig,
} from '@/components/ui/chart';
import type { MaterialDashboardUnitPoint } from '../model/material-dashboard';
import { EpsMaterialsTooltip } from './eps-materials-tooltip';

const chartConfig = {
  checkedCount: {
    label: 'Đã kiểm tra',
    color: 'var(--color-success-accent,var(--color-green-600))',
  },
  needsInspectionCount: {
    label: 'Cần kiểm tra',
    color: 'var(--color-warning-accent,var(--color-yellow-600))',
  },
} satisfies ChartConfig;

export interface MaterialDashboardEpsMaterialsChartProps {
  data: MaterialDashboardUnitPoint[];
  height: number;
  className?: string;
}

export function MaterialDashboardEpsMaterialsChart({
  data,
  height,
  className,
}: MaterialDashboardEpsMaterialsChartProps) {
  return (
    <ChartTooltipStyleProvider style="compact">
      <ChartContainer
        config={chartConfig}
        className={cn('h-72 w-full aspect-auto', className)}
        style={{ height }}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 36, bottom: 4, left: 0 }}
          barCategoryGap={8}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickCount={5}
            allowDecimals={false}
            tickFormatter={(value) => Number(value).toLocaleString('vi-VN')}
          />
          <YAxis
            type="category"
            dataKey="unitName"
            tickLine={false}
            axisLine={false}
            width={136}
          />
          <ChartTooltip content={<EpsMaterialsTooltip />} />
          <Bar
            dataKey="checkedCount"
            stackId="materials"
            fill="var(--color-checkedCount)"
            radius={[4, 0, 0, 4]}
            maxBarSize={22}
          />
          <Bar
            dataKey="needsInspectionCount"
            stackId="materials"
            fill="var(--color-needsInspectionCount)"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
          >
            <LabelList
              dataKey="total"
              position="right"
              fill="var(--foreground)"
              fontSize={11}
              formatter={(value) => Number(value).toLocaleString('vi-VN')}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartTooltipStyleProvider>
  );
}
