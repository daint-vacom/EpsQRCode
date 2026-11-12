const spec = {
  entity: 'MaterialDashboardTrendPoint',
  modelImport: '../model/material-dashboard',
  componentName: 'MaterialDashboardHandoverTrendChart',
  chartKind: 'bar',
  xField: 'label',
  series: [
    {
      key: 'count',
      label: 'Lượt bàn giao',
      color: 'var(--color-success-accent,var(--color-green-600))',
    },
  ],
  tooltipStyle: 'compact',
  heightClassName: 'h-64 w-full aspect-auto',
  showGrid: true,
};

export default spec;
