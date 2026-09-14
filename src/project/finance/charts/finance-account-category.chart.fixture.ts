const spec = {
  entity: 'FinanceAccountCategoryPoint',
  modelImport: '../model/finance-analytics',
  componentName: 'FinanceAccountCategoryChart',
  chartKind: 'donut',
  nameField: 'name',
  valueField: 'value',
  series: [
    {
      key: 'value',
      label: 'Giá trị',
      color: 'var(--admin-blue-primary)',
    },
  ],
  includeLegend: false,
  tooltipStyle: 'compact',
  heightClassName: 'h-64 w-full aspect-auto',
};

export default spec;
