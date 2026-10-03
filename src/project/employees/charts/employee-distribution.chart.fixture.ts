const spec = {
  entity: 'EmployeeDistributionChartPoint',
  modelImport: '../model/employee-responsibility',
  componentName: 'EmployeeDistributionChart',
  chartKind: 'donut',
  nameField: 'name',
  valueField: 'value',
  series: [
    {
      key: 'value',
      label: 'Số lượng',
      color: 'var(--admin-blue-primary)',
    },
  ],
  includeLegend: false,
  tooltipStyle: 'compact',
  heightClassName: 'h-48 w-full aspect-auto',
  showGrid: false,
};

export default spec;
