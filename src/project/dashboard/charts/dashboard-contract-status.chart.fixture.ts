const spec = {
  entity: 'DashboardContractStatusChartPoint',
  modelImport: '../model/dashboard',
  componentName: 'DashboardContractStatusChart',
  chartKind: 'donut',
  nameField: 'name',
  valueField: 'value',
  series: [
    {
      key: 'value',
      label: 'Số hợp đồng',
      color: 'var(--admin-blue-primary)',
    },
  ],
  includeLegend: true,
  tooltipStyle: 'compact',
  heightClassName: 'h-72 w-full aspect-auto',
  showGrid: false,
};

export default spec;
