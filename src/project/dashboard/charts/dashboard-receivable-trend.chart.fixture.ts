const spec = {
  entity: 'DashboardMonthlyReceivable',
  modelImport: '../model/dashboard',
  componentName: 'DashboardReceivableTrendChart',
  chartKind: 'bar',
  xField: 'monthLabel',
  series: [
    {
      key: 'paidAmount',
      label: 'Đã thu',
      color: 'var(--admin-success-dot)',
      stackId: 'receivable',
    },
    {
      key: 'currentOutstanding',
      label: 'Còn phải thu',
      color: 'var(--admin-amber-primary)',
      stackId: 'receivable',
    },
    {
      key: 'overdueOutstanding',
      label: 'Quá hạn',
      color: 'var(--admin-red-primary)',
      stackId: 'receivable',
    },
    {
      key: 'futureOutstanding',
      label: 'Chưa đến hạn',
      color: 'var(--admin-neutral-100)',
      stackId: 'receivable',
    },
  ],
  includeLegend: true,
  interactive: true,
  tooltipStyle: 'line',
  heightClassName: 'h-72 w-full aspect-auto',
};

export default spec;
