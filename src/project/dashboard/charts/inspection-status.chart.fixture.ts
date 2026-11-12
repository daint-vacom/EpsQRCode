const spec = {
  entity: 'MaterialDashboardInspectionPoint',
  modelImport: '../model/material-dashboard',
  componentName: 'MaterialDashboardInspectionStatusChart',
  chartKind: 'donut',
  nameField: 'name',
  valueField: 'value',
  series: [
    {
      key: 'value',
      label: 'Lượt kiểm tra',
      color: 'var(--admin-blue-primary)',
    },
  ],
  tooltipStyle: 'compact',
  heightClassName: 'h-56 w-full aspect-auto',
  showGrid: false,
};

export default spec;
