const spec = {
  entity: 'MaterialReceiptAllocationChartPoint',
  modelImport: '../model/material-receipt',
  componentName: 'MaterialReceiptAllocationChart',
  chartKind: 'donut',
  nameField: 'name',
  valueField: 'value',
  series: [
    {
      key: 'value',
      label: 'Vật tư',
      color: 'var(--admin-blue-primary)',
    },
  ],
  tooltipStyle: 'compact',
  heightClassName: 'h-48 w-full aspect-auto',
  showGrid: false,
};

export default spec;
