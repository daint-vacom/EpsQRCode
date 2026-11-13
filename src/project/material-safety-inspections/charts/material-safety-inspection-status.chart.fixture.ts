const spec = {
  entity: 'MaterialSafetyInspectionQueueChartPoint',
  modelImport: '../model/safety-inspection',
  componentName: 'MaterialSafetyInspectionStatusChart',
  chartKind: 'donut',
  nameField: 'name',
  valueField: 'value',
  series: [
    {
      key: 'value',
      label: 'Số vật tư',
      color: 'var(--admin-red-primary)',
    },
  ],
  tooltipStyle: 'compact',
  heightClassName: 'h-48 w-full aspect-auto',
  showGrid: false,
};

export default spec;
