const spec = {
  entity: 'MaterialDashboardUnitPoint',
  modelImport: '../model/material-dashboard',
  componentName: 'MaterialDashboardEpsMaterialsChart',
  chartKind: 'bar',
  xField: 'unitName',
  series: [
    {
      key: 'checkedCount',
      label: 'Đã kiểm tra',
      color: 'var(--color-success-accent,var(--color-green-600))',
      stackId: 'materials',
    },
    {
      key: 'needsInspectionCount',
      label: 'Cần kiểm tra',
      color: 'var(--color-warning-accent,var(--color-yellow-600))',
      stackId: 'materials',
    },
  ],
  tooltipStyle: 'compact',
  heightClassName: 'h-72 w-full aspect-auto',
  showGrid: true,
};

export default spec;
