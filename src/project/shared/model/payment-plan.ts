export interface PaymentPlanChartPoint {
  monthStart: string;
  monthLabel: string;
  paidAmount: number;
  currentOutstanding: number;
  overdueOutstanding: number;
  futureOutstanding: number;
}

export interface PaymentPlanDateRange {
  from: string;
  to: string;
}
