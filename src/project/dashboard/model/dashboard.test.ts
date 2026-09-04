import { describe, expect, it } from 'vitest';
import { getDashboardPaymentPlanRange } from './dashboard';

describe('getDashboardPaymentPlanRange', () => {
  it('uses six previous months and five following months around the current month', () => {
    expect(getDashboardPaymentPlanRange(new Date(2026, 5, 17))).toEqual({
      from: '2025-12-01',
      to: '2026-11-30',
    });
  });

  it('keeps the twelve-month window across a year boundary', () => {
    expect(getDashboardPaymentPlanRange(new Date(2026, 0, 4))).toEqual({
      from: '2025-07-01',
      to: '2026-06-30',
    });
  });
});
