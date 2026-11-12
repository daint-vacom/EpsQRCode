import { useIntl } from 'react-intl';
import type { TooltipProps } from 'recharts';
import type { MaterialDashboardUnitPoint } from '../model/material-dashboard';

const EPS_MATERIALS_COLORS = {
  checked: 'var(--color-success-accent,var(--color-green-600))',
  needsInspection: 'var(--color-warning-accent,var(--color-yellow-600))',
} as const;

export function EpsMaterialsTooltip({
  active,
  payload,
  label,
}: Pick<TooltipProps<number, string>, 'active' | 'payload' | 'label'>) {
  const intl = useIntl();
  const point = payload?.[0]?.payload as MaterialDashboardUnitPoint | undefined;

  if (!active || !point) return null;

  const entries = [
    {
      label: intl.formatMessage({
        id: 'project.dashboard.charts.eps.checked',
      }),
      value: point.checkedCount,
      color: EPS_MATERIALS_COLORS.checked,
    },
    {
      label: intl.formatMessage({
        id: 'project.dashboard.charts.eps.needsInspection',
      }),
      value: point.needsInspectionCount,
      color: EPS_MATERIALS_COLORS.needsInspection,
    },
  ];

  return (
    <div className="grid min-w-[12rem] gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-xs shadow-xl">
      <p className="font-medium text-foreground">{label ?? point.unitName}</p>
      <div className="grid gap-1.5">
        {entries.map((entry) => (
          <div key={entry.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="min-w-0 flex-1 text-foreground">
              {entry.label}
            </span>
            <span className="shrink-0 font-mono font-medium tabular-nums text-foreground">
              {intl.formatNumber(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
