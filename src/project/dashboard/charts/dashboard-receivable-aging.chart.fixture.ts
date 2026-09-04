const spec = {
  entity: 'DashboardReceivableAgingChartPoint',
  modelImport: '../model/dashboard',
  componentName: 'DashboardReceivableAgingChart',
  chartKind: 'bar',
  xField: 'label',
  series: [
    {
      key: 'amount',
      label: 'Giá trị công nợ',
      color: 'var(--admin-red-primary)',
    },
  ],
  includeLegend: false,
  tooltipStyle: 'compact',
  heightClassName: 'h-72 w-full aspect-auto',
};

export default spec;
