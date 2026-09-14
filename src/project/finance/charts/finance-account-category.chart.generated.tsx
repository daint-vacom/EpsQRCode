/**
 * Scaffolded by chart-builder from `src/project/finance/charts/finance-account-category.chart.fixture.ts`. Run `npm run gen:chart` — do NOT hand-write this file.
 * You own this file now — wire data and callbacks to screen logic or override the presentation.
 * To change chart kind, series, or config, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import { Cell, Pie, PieChart } from 'recharts';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartTooltipStyleProvider,
  type ChartConfig,
} from '@/components/ui/chart';
import type { FinanceAccountCategoryPoint } from '../model/finance-analytics';

const chartConfig = {
  value: { label: 'Giá trị', color: 'var(--admin-blue-primary)' },
} satisfies ChartConfig;

export interface FinanceAccountCategoryChartProps {
  data: FinanceAccountCategoryPoint[];
  className?: string;
  valueFormatter?: (value: number, name?: string) => ReactNode;
  centerLabel?: ReactNode;
  centerCaption?: ReactNode;
}

export function FinanceAccountCategoryChart({
  data,
  className,
  valueFormatter,
  centerLabel,
  centerCaption,
}: FinanceAccountCategoryChartProps) {
  return (
    <ChartTooltipStyleProvider style="compact">
      <div className="relative">
        <ChartContainer
          config={chartConfig}
          className={cn('h-64 w-full aspect-auto', className)}
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent valueFormatter={valueFormatter} />}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius={84}
              innerRadius={52}
            >
              {data.map((entry, _index) => (
                <Cell
                  key={entry.name}
                  fill={entry.fill ?? 'var(--color-value)'}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        {centerLabel !== undefined || centerCaption !== undefined ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
            <div>
              <div className="text-xl font-semibold tabular-nums text-foreground">
                {centerLabel}
              </div>
              <div className="text-xs text-muted-foreground">
                {centerCaption}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ChartTooltipStyleProvider>
  );
}
