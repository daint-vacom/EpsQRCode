const spec = {
  entity: 'MaterialSafetyInspectionPlanChartPoint',
  modelImport: '../model/safety-inspection',
  componentName: 'MaterialSafetyInspectionPlanChart',
  chartKind: 'bar',
  xField: 'monthLabel',
  series: [
    {
      key: 'notInspected',
      label: 'Chưa kiểm tra',
      color: 'var(--admin-red-primary)',
      stackId: 'inspectionStatus',
    },
    {
      key: 'inProgress',
      label: 'Đang kiểm tra',
      color: 'var(--admin-amber-primary)',
      stackId: 'inspectionStatus',
    },
    {
      key: 'completed',
      label: 'Đã kiểm tra',
      color: 'var(--admin-success-dot)',
      stackId: 'inspectionStatus',
    },
  ],
  includeLegend: true,
  tooltipStyle: 'line',
  heightClassName: 'h-60 w-full aspect-auto',
  showGrid: true,
};

export default spec;
