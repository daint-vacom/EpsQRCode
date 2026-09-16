import { describe, expect, it } from 'vitest';
import {
  financeVoucherDefaultValues,
  financeVoucherFormSchema,
  formatFinanceAmount,
  getFinanceVoucherLineAvailableAmount,
  mapFinanceVoucherToFormValues,
  type FinanceVoucherDetail,
} from './finance';

describe('finance model', () => {
  it('keeps voucher defaults valid for a new draft', () => {
    expect(
      financeVoucherFormSchema.safeParse({
        ...financeVoucherDefaultValues,
        accountId: '11111111-1111-4111-8111-111111111111',
        partyName: 'Đối tượng mẫu',
      }).success,
    ).toBe(true);
    expect(financeVoucherDefaultValues.voucherType).toBe('receipt');
    expect(financeVoucherDefaultValues.partyType).toBe('customer');
  });

  it('formats VND amounts with Vietnamese separators', () => {
    expect(formatFinanceAmount(1234567.5)).toBe('1.234.568 ₫');
    expect(formatFinanceAmount(null)).toBe('0 ₫');
  });

  it('maps API voucher fields into form values', () => {
    const values = mapFinanceVoucherToFormValues({
      voucherType: 'payment',
      voucherDate: '2026-09-13',
      transactionAt: '2026-09-13T10:30:00.000Z',
      accountId: 'account-1',
      partyType: 'other',
      customerId: null,
      employeeId: null,
      partyNameSnapshot: 'Nhà cung cấp A',
      contactName: 'Nguyễn Văn A',
      address: 'Hà Nội',
      description: 'Thanh toán dịch vụ',
      externalReference: 'HD-001',
    } as FinanceVoucherDetail);

    expect(values).toMatchObject({
      voucherType: 'payment',
      accountId: 'account-1',
      partyName: 'Nhà cung cấp A',
    });
  });

  it('calculates remaining voucher-line availability after allocations and refunds', () => {
    expect(getFinanceVoucherLineAvailableAmount(6000, 4000, 0)).toBe(2000);
    expect(getFinanceVoucherLineAvailableAmount(6000, 6000, 0)).toBe(0);
    expect(getFinanceVoucherLineAvailableAmount(6000, 7000, 0)).toBe(0);
  });
});
