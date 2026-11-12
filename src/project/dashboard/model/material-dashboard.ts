export interface MaterialDashboardMetric {
  totalMaterials: number;
  availableMaterials: number;
  loanedMaterials: number;
  materialsToInspect: number;
}

export interface MaterialDashboardTrendPoint {
  month: string;
  label: string;
  count: number;
}

export interface MaterialDashboardUnitPoint {
  unitId: string;
  unitName: string;
  checkedCount: number;
  needsInspectionCount: number;
  total: number;
}

export interface MaterialDashboardInspectionResults {
  passed: number;
  failed: number;
  inProgress: number;
}

export interface MaterialDashboardInspectionPoint {
  name: string;
  value: number;
  fill: string;
}

export interface MaterialDashboardSummary extends MaterialDashboardMetric {
  monthlyReceipts: Omit<MaterialDashboardTrendPoint, 'label'>[];
  monthlyHandovers: Omit<MaterialDashboardTrendPoint, 'label'>[];
  inspectionResults: MaterialDashboardInspectionResults;
  materialsByEpsUnit: MaterialDashboardUnitPoint[];
}
