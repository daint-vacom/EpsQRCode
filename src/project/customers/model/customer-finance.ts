import { z } from 'zod';
import type { FinanceObligation } from '../../finance/model/finance';

export interface CustomerFinanceObligation extends FinanceObligation {
  groupKey: string;
  componentObligations: FinanceObligation[];
}

export function isCustomerFinanceObligationActual(
  obligation: FinanceObligation,
  asOfDate: string,
) {
  if (obligation.direction !== 'receivable' || obligation.status !== 'posted') {
    return false;
  }

  // Contract charges are schedule-driven: they become actual receivables only
  // when their due date arrives. A manually recorded debt is already an
  // incurred receivable; its due date only determines current/overdue status.
  return (
    obligation.sourceType !== 'contract' ||
    Boolean(obligation.dueDate && obligation.dueDate <= asOfDate)
  );
}

function obligationGroupKey(obligation: FinanceObligation) {
  if (obligation.sourceType !== 'contract' || !obligation.contractId) {
    return `obligation:${obligation.id}`;
  }

  return [
    'contract',
    obligation.contractId,
    obligation.documentDate,
    obligation.dueDate ?? '',
    obligation.currencyCode,
    obligation.direction,
  ].join('|');
}

export function groupCustomerFinanceObligations(
  obligations: FinanceObligation[],
): CustomerFinanceObligation[] {
  const groups = new Map<string, FinanceObligation[]>();

  for (const obligation of obligations) {
    const key = obligationGroupKey(obligation);
    const group = groups.get(key);
    if (group) group.push(obligation);
    else groups.set(key, [obligation]);
  }

  return [...groups.entries()]
    .map(([groupKey, components]) => {
      const first = components[0];
      const componentCount = components.length;
      const originalAmount = components.reduce(
        (total, item) => total + Math.max(0, item.originalAmount),
        0,
      );
      const adjustmentAmount = components.reduce(
        (total, item) => total + item.adjustmentAmount,
        0,
      );
      const obligationAmount = components.reduce(
        (total, item) => total + Math.max(0, item.obligationAmount),
        0,
      );
      const settledAmount = components.reduce(
        (total, item) =>
          total +
          Math.max(0, Math.min(item.obligationAmount, item.settledAmount)),
        0,
      );
      const outstandingAmount = components.reduce(
        (total, item) => total + Math.max(0, item.outstandingAmount),
        0,
      );

      return {
        ...first,
        code:
          componentCount > 1
            ? `${first.code} (+${componentCount - 1} khoản)`
            : first.code,
        description:
          componentCount > 1
            ? `${first.description} (${componentCount} khoản cùng kỳ)`
            : first.description,
        originalAmount,
        adjustmentAmount,
        obligationAmount,
        settledAmount,
        outstandingAmount,
        groupKey,
        componentObligations: [...components].sort(
          (left, right) =>
            (left.dueDate ?? left.documentDate).localeCompare(
              right.dueDate ?? right.documentDate,
            ) || left.id.localeCompare(right.id),
        ),
      } satisfies CustomerFinanceObligation;
    })
    .sort(
      (left, right) =>
        right.outstandingAmount - left.outstandingAmount ||
        (left.dueDate ?? '').localeCompare(right.dueDate ?? '') ||
        left.code.localeCompare(right.code),
    );
}

export const customerDebtFormSchema = z.object({
  code: z.string().trim().min(1, 'Vui lòng nhập mã công nợ.'),
  description: z.string().trim().min(1, 'Vui lòng nhập diễn giải.'),
  documentDate: z.string().min(1, 'Vui lòng chọn ngày ghi nhận.'),
  dueDate: z.string(),
  originalAmount: z.coerce.number().positive('Số tiền phải lớn hơn 0.'),
});

export type CustomerDebtFormValues = z.infer<typeof customerDebtFormSchema>;

export const customerDebtDefaultValues: CustomerDebtFormValues = {
  code: '',
  description: '',
  documentDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  originalAmount: 0,
};

export const customerDebtPaymentFormSchema = z.object({
  amount: z.coerce.number().positive('Số tiền phải lớn hơn 0.'),
  voucherDate: z.string().min(1, 'Vui lòng chọn ngày thu.'),
  accountId: z.string().min(1, 'Vui lòng chọn quỹ/tài khoản.'),
  externalReference: z.string().trim().max(120, 'Mã giao dịch quá dài.'),
  description: z.string().trim().max(500, 'Diễn giải quá dài.'),
});

export type CustomerDebtPaymentFormValues = z.infer<
  typeof customerDebtPaymentFormSchema
>;

export const customerDebtPaymentDefaultValues: CustomerDebtPaymentFormValues = {
  amount: 0,
  voucherDate: new Date().toISOString().slice(0, 10),
  accountId: '',
  externalReference: '',
  description: '',
};

export function getCustomerDebtSourceLabel(
  sourceType: CustomerFinanceObligation['sourceType'],
) {
  switch (sourceType) {
    case 'contract':
      return 'Hợp đồng';
    case 'opening_balance':
      return 'Đầu kỳ';
    case 'manual':
      return 'Tự do';
    case 'commission':
      return 'Hoa hồng';
  }
}
