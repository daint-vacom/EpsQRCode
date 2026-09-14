import {
  endOfMonth,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
  subYears,
} from 'date-fns';

type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type QuarterNumber = 1 | 2 | 3 | 4;

export type ReportPeriodKey =
  | 'current-month'
  | 'previous-month'
  | `month-${MonthNumber}`
  | `quarter-${QuarterNumber}`
  | 'current-year'
  | 'previous-year';

export interface ReportPeriodOption {
  key: ReportPeriodKey;
  label: string;
  group: string;
}

export interface ReportPeriodRange {
  key: ReportPeriodKey;
  label: string;
  from: string;
  to: string;
}

export const REPORT_PERIOD_OPTIONS: ReadonlyArray<ReportPeriodOption> = [
  { key: 'current-month', label: 'Tháng hiện tại', group: 'Theo tháng' },
  { key: 'previous-month', label: 'Tháng trước', group: 'Theo tháng' },
  ...Array.from({ length: 12 }, (_, index) => {
    const month = (index + 1) as MonthNumber;
    return {
      key: `month-${month}` as const,
      label: `Tháng ${month}`,
      group: 'Theo tháng',
    };
  }),
  ...Array.from({ length: 4 }, (_, index) => {
    const quarter = (index + 1) as QuarterNumber;
    return {
      key: `quarter-${quarter}` as const,
      label: `Quý ${['I', 'II', 'III', 'IV'][index]}`,
      group: 'Theo quý',
    };
  }),
  { key: 'current-year', label: 'Cả năm', group: 'Theo năm' },
  { key: 'previous-year', label: 'Năm trước', group: 'Theo năm' },
];

const REPORT_PERIOD_LABELS = new Map(
  REPORT_PERIOD_OPTIONS.map((option) => [option.key, option.label]),
);

export function parseReportIsoDate(
  value: string | Date | null | undefined,
): Date | undefined {
  const parsed =
    value instanceof Date ? new Date(value) : parseISO(value ?? '');
  return isValid(parsed) ? parsed : undefined;
}

function formatReportIsoDate(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

function getMonthNumber(key: ReportPeriodKey): MonthNumber | undefined {
  if (!key.startsWith('month-')) return undefined;
  const month = Number(key.slice('month-'.length));
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? (month as MonthNumber)
    : undefined;
}

function getQuarterNumber(key: ReportPeriodKey): QuarterNumber | undefined {
  if (!key.startsWith('quarter-')) return undefined;
  const quarter = Number(key.slice('quarter-'.length));
  return Number.isInteger(quarter) && quarter >= 1 && quarter <= 4
    ? (quarter as QuarterNumber)
    : undefined;
}

function getMonthRange(value: Date): { from: Date; to: Date } {
  return { from: startOfMonth(value), to: endOfMonth(value) };
}

function getQuarterRange(value: Date, quarter: QuarterNumber) {
  const firstMonthOfQuarter = (quarter - 1) * 3;
  const firstMonth = new Date(value.getFullYear(), firstMonthOfQuarter, 1);
  const lastMonth = new Date(value.getFullYear(), firstMonthOfQuarter + 2, 1);
  return { from: startOfMonth(firstMonth), to: endOfMonth(lastMonth) };
}

export function getReportPeriodLabel(key: ReportPeriodKey): string {
  return REPORT_PERIOD_LABELS.get(key) ?? 'Khoảng thời gian';
}

export function resolveReportPeriod(
  key: ReportPeriodKey,
  referenceDate: string | Date = new Date(),
): ReportPeriodRange {
  const reference = parseReportIsoDate(referenceDate) ?? new Date();
  const month = getMonthNumber(key);
  const quarter = getQuarterNumber(key);
  let range: { from: Date; to: Date };

  if (key === 'current-month') {
    range = getMonthRange(reference);
  } else if (key === 'previous-month') {
    range = getMonthRange(subMonths(reference, 1));
  } else if (month) {
    range = getMonthRange(new Date(reference.getFullYear(), month - 1, 1));
  } else if (quarter) {
    range = getQuarterRange(reference, quarter);
  } else if (key === 'current-year') {
    range = { from: startOfYear(reference), to: endOfYear(reference) };
  } else if (key === 'previous-year') {
    const previousYear = subYears(reference, 1);
    range = { from: startOfYear(previousYear), to: endOfYear(previousYear) };
  } else {
    throw new Error(`Khoảng thời gian không hợp lệ: ${key}`);
  }

  return {
    key,
    label: getReportPeriodLabel(key),
    from: formatReportIsoDate(range.from),
    to: formatReportIsoDate(range.to),
  };
}
