/**
 * Scaffolded by chart-builder from `src/project/receipts/charts/receipt-allocation.chart.fixture.ts`. Run `npm run gen:chart` — do NOT hand-write this file.
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
import type { MaterialReceiptAllocationChartPoint } from '../model/material-receipt';

const chartConfig = {
  value: { label: 'Vật tư', color: 'var(--admin-blue-primary)' },
} satisfies ChartConfig;

export interface MaterialReceiptAllocationChartProps {
  data: MaterialReceiptAllocationChartPoint[];
  isEmpty?: boolean;
  className?: string;
}

export function MaterialReceiptAllocationChart({
  data,
  isEmpty = false,
  className,
}: MaterialReceiptAllocationChartProps) {
  const chartData = isEmpty
    ? [{ name: '', value: 1, fill: 'var(--admin-chart-empty)' }]
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
