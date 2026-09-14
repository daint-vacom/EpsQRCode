import { describe, expect, it } from 'vitest';
import {
  parseReportIsoDate,
  REPORT_PERIOD_OPTIONS,
  resolveReportPeriod,
} from './report-period';

const referenceDate = '2026-09-14';

describe('report period model', () => {
  it('exposes the requested preset options', () => {
    expect(REPORT_PERIOD_OPTIONS).toHaveLength(20);
    expect(REPORT_PERIOD_OPTIONS.map((option) => option.label)).toEqual([
      'Tháng hiện tại',
      'Tháng trước',
      ...Array.from({ length: 12 }, (_, index) => `Tháng ${index + 1}`),
      'Quý I',
      'Quý II',
      'Quý III',
      'Quý IV',
      'Cả năm',
      'Năm trước',
    ]);
  });

  it('resolves month presets to complete calendar ranges', () => {
    expect(resolveReportPeriod('current-month', referenceDate)).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(resolveReportPeriod('previous-month', referenceDate)).toMatchObject({
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(resolveReportPeriod('month-2', referenceDate)).toMatchObject({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('resolves quarter and year presets', () => {
    expect(resolveReportPeriod('quarter-4', referenceDate)).toMatchObject({
      from: '2026-10-01',
      to: '2026-12-31',
    });
    expect(resolveReportPeriod('current-year', referenceDate)).toMatchObject({
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(resolveReportPeriod('previous-year', referenceDate)).toMatchObject({
      from: '2025-01-01',
      to: '2025-12-31',
    });
  });

  it('parses valid dates and rejects invalid values', () => {
    expect(parseReportIsoDate('2026-09-14')).toBeInstanceOf(Date);
    expect(parseReportIsoDate('not-a-date')).toBeUndefined();
  });
});
