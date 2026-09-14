const spec = {
  entity: 'FinanceAccountTrendPoint',
  modelImport: '../model/finance-analytics',
  componentName: 'FinanceAccountCashflowChart',
  chartKind: 'composed',
  xField: 'periodLabel',
  series: [
    {
      key: 'receipt',
      label: 'Thu',
      color: 'var(--admin-success-dot)',
      role: 'bar',
    },
    {
      key: 'payment',
      label: 'Chi',
      color: 'var(--admin-red-primary)',
      role: 'bar',
    },
    {
      key: 'balance',
      label: 'Số dư',
      color: 'var(--admin-blue-primary)',
      role: 'line',
    },
  ],
  includeLegend: true,
  tooltipStyle: 'line',
  heightClassName: 'h-80 w-full aspect-auto',
};

export default spec;
