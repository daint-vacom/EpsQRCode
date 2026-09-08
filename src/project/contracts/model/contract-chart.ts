import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import type {
  PaymentPlanChartPoint,
  PaymentPlanDateRange,
} from '../../shared/model/payment-plan';
import type { ContractVersionLine } from './contract';
import type { ContractChargeBalance } from './receivable';

export interface ContractPaymentPeriodChartPoint {
  periodLabel: string;
  paidAmount: number;
  currentOutstanding: number;
  overdueOutstanding: number;
  futureOutstanding: number;
}

export interface ContractFeeReceivableChartPoint {
  feeName: string;
  paidAmount: number;
  outstandingAmount: number;
}

export interface ContractFeePaymentProgressPoint {
  feeName: string;
  paidAmount: number;
  totalAmount: number;
}

function clampPaidAmount(charge: ContractChargeBalance) {
  return Math.max(0, Math.min(charge.amount, charge.paidAmount));
}

function normalizeFeeName(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function getTodayIso() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatPeriodDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(`${value}T00:00:00`));
}

export function buildContractPaymentPlanData(
  charges: ContractChargeBalance[],
  range: PaymentPlanDateRange,
): PaymentPlanChartPoint[] {
  const todayIso = new Date().toISOString().slice(0, 10);
  const fromMonth = startOfMonth(parseISO(range.from));
  const toMonth = startOfMonth(parseISO(range.to));
  const months = new Map<string, PaymentPlanChartPoint>();

  for (let month = fromMonth; month <= toMonth; month = addMonths(month, 1)) {
    const monthStart = format(month, 'yyyy-MM-dd');
    months.set(monthStart, {
      monthStart,
      monthLabel: format(month, 'MM/yyyy'),
      paidAmount: 0,
      currentOutstanding: 0,
      overdueOutstanding: 0,
      futureOutstanding: 0,
    });
  }

  charges
    .filter(
      (charge) =>
        charge.direction === 'receivable' &&
        charge.status !== 'voided' &&
        charge.dueDate >= range.from &&
        charge.dueDate <= range.to,
    )
    .forEach((charge) => {
      const monthStart = `${charge.dueDate.slice(0, 7)}-01`;
      const current = months.get(monthStart);
      if (!current) return;

      const outstandingAmount = Math.max(0, charge.outstandingAmount);
      current.paidAmount += clampPaidAmount(charge);
      if (charge.dueDate > todayIso) {
        current.futureOutstanding += outstandingAmount;
      } else if (charge.dueDate < todayIso) {
        current.overdueOutstanding += outstandingAmount;
      } else {
        current.currentOutstanding += outstandingAmount;
      }
    });

  return [...months.values()];
}

export function buildContractPaymentPeriodChartData(
  charges: ContractChargeBalance[],
  limit = 12,
): ContractPaymentPeriodChartPoint[] {
  const todayIso = getTodayIso();
  const periods = new Map<
    string,
    ContractPaymentPeriodChartPoint & {
      periodStart: string;
      periodEnd: string;
    }
  >();

  charges
    .filter(
      (charge) =>
        charge.direction === 'receivable' && charge.status !== 'voided',
    )
    .forEach((charge) => {
      const key = [charge.periodStart, charge.periodEnd].join('|');
      const current = periods.get(key) ?? {
        periodLabel: '',
        periodStart: charge.periodStart,
        periodEnd: charge.periodEnd,
        paidAmount: 0,
        currentOutstanding: 0,
        overdueOutstanding: 0,
        futureOutstanding: 0,
      };
      const outstandingAmount = Math.max(0, charge.outstandingAmount);

      current.paidAmount += clampPaidAmount(charge);
      if (charge.dueDate > todayIso) {
        current.futureOutstanding += outstandingAmount;
      } else {
        if (charge.dueDate < todayIso) {
          current.overdueOutstanding += outstandingAmount;
        } else {
          current.currentOutstanding += outstandingAmount;
        }
      }
      periods.set(key, current);
    });

  return [...periods.values()]
    .sort(
      (a, b) =>
        a.periodStart.localeCompare(b.periodStart) ||
        a.periodEnd.localeCompare(b.periodEnd),
    )
    .slice(-limit)
    .map(({ periodStart, periodEnd, ...point }) => ({
      ...point,
      periodLabel:
        periodStart === periodEnd
          ? formatPeriodDate(periodStart)
          : `${formatPeriodDate(periodStart)} – ${formatPeriodDate(periodEnd)}`,
    }));
}

export function buildContractFeeReceivableChartData(
  charges: ContractChargeBalance[],
  lines: ContractVersionLine[],
  limit = 8,
): ContractFeeReceivableChartPoint[] {
  const todayIso = getTodayIso();
  const lineNameById = new Map(lines.map((line) => [line.id, line.name]));
  const fees = new Map<string, ContractFeeReceivableChartPoint>();

  charges
    .filter(
      (charge) =>
        charge.direction === 'receivable' && charge.status !== 'voided',
    )
    .forEach((charge) => {
      const feeName =
        lineNameById.get(charge.contractVersionLineId) ?? 'Khoản phí';
      const current = fees.get(charge.contractVersionLineId) ?? {
        feeName,
        paidAmount: 0,
        outstandingAmount: 0,
      };

      current.paidAmount += clampPaidAmount(charge);
      if (charge.dueDate <= todayIso) {
        current.outstandingAmount += Math.max(0, charge.outstandingAmount);
      }
      fees.set(charge.contractVersionLineId, current);
    });

  return [...fees.values()]
    .sort(
      (a, b) =>
        b.outstandingAmount - a.outstandingAmount ||
        b.paidAmount - a.paidAmount ||
        a.feeName.localeCompare(b.feeName),
    )
    .slice(0, limit);
}

export function buildContractFeePaymentProgressData(
  charges: ContractChargeBalance[],
  lines: ContractVersionLine[],
  limit = 8,
): ContractFeePaymentProgressPoint[] {
  const lineNameById = new Map(lines.map((line) => [line.id, line.name]));
  const fees = new Map<string, ContractFeePaymentProgressPoint>();

  charges
    .filter(
      (charge) =>
        charge.direction === 'receivable' && charge.status !== 'voided',
    )
    .forEach((charge) => {
      const feeName =
        lineNameById.get(charge.contractVersionLineId) ?? 'Khoản phí';
      const current = fees.get(normalizeFeeName(feeName)) ?? {
        feeName,
        paidAmount: 0,
        totalAmount: 0,
      };

      current.totalAmount += Math.max(0, charge.amount);
      current.paidAmount += clampPaidAmount(charge);
      fees.set(normalizeFeeName(feeName), current);
    });

  return [...fees.values()]
    .sort(
      (a, b) =>
        b.totalAmount - a.totalAmount ||
        b.paidAmount - a.paidAmount ||
        a.feeName.localeCompare(b.feeName),
    )
    .slice(0, limit);
}
