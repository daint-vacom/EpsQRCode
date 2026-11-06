import type { Material } from './material';

export interface MaterialQrTrackingMetric {
  materialId: string;
  scanCount: number;
  lastPrintedAt: string | null;
}

export type MaterialQrTrackingRow = Material & MaterialQrTrackingMetric;
