import {
  postFinanceVoucher,
  saveFinanceVoucherDraft,
} from '../../finance/api/finance.api';
import type {
  FinanceCategory,
  FinanceVoucherFormValues,
  FinanceVoucherLineDraft,
} from '../../finance/model/finance';
import type {
  CustomerDebtPaymentFormValues,
  CustomerFinanceObligation,
} from '../model/customer-finance';

export async function recordCustomerDebtPayment(
  tenantId: string,
  customer: { id: string; name: string },
  debt: CustomerFinanceObligation,
  values: CustomerDebtPaymentFormValues,
  category: FinanceCategory,
) {
  const voucherValues: FinanceVoucherFormValues = {
    voucherType: 'receipt',
    voucherDate: values.voucherDate,
    transactionAt: `${values.voucherDate}T12:00`,
    accountId: values.accountId,
    partyType: 'customer',
    customerId: customer.id,
    employeeId: '',
    partyName: customer.name,
    contactName: '',
    address: '',
    description: values.description || `Thu công nợ ${debt.code}`,
    externalReference: values.externalReference,
  };
  const line: FinanceVoucherLineDraft = {
    categoryId: category.id,
    categoryName: category.name,
    description: voucherValues.description,
    amount: String(values.amount),
    handlingType: 'settlement',
    relatedContractId: debt.contractId ?? '',
    advanceScope: '',
    allocations: [],
  };
  let remainingAmount = values.amount;
  for (const component of debt.componentObligations) {
    if (remainingAmount <= 0) break;
    const amount = Math.min(
      remainingAmount,
      Math.max(0, component.outstandingAmount),
    );
    if (amount <= 0) continue;
    line.allocations.push({
      obligationId: component.id,
      amount: String(amount),
    });
    remainingAmount -= amount;
  }
  if (remainingAmount > 0) {
    throw new Error('Số tiền thu vượt quá số còn phải thu của nhóm công nợ.');
  }
  const saveRequestKey = crypto.randomUUID();
  const postRequestKey = crypto.randomUUID();
  const draft = await saveFinanceVoucherDraft(
    tenantId,
    null,
    1,
    voucherValues,
    [line],
    saveRequestKey,
    debt.currencyCode,
  );
  return postFinanceVoucher(tenantId, draft.id, postRequestKey);
}
