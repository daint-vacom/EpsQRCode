const spec = {
  entity: 'MaterialDashboardTrendPoint',
  modelImport: '../model/material-dashboard',
  componentName: 'MaterialDashboardReceiptTrendChart',
  chartKind: 'bar',
  xField: 'label',
  series: [
    {
      key: 'count',
      label: 'Vật tư nhập',
      color: 'var(--admin-blue-primary)',
    },
  ],
  tooltipStyle: 'compact',
  heightClassName: 'h-64 w-full aspect-auto',
  showGrid: true,
};

export default spec;
