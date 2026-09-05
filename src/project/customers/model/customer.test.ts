import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_LIST_INITIAL_FILTERS,
  customerFilterFormSchema,
  customerFormSchema,
} from './customer';

describe('customer custom field values', () => {
  it('normalizes undefined dynamic filter values to empty strings', () => {
    const result = customerFilterFormSchema.safeParse({
      ...CUSTOMER_LIST_INITIAL_FILTERS,
      customFields: {
        education: undefined,
        occupation: 'Kế toán',
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customFields).toEqual({
        education: '',
        occupation: 'Kế toán',
      });
    }
  });

  it('keeps customer form custom field values typed as strings', () => {
    const result = customerFormSchema.safeParse({
      customerCode: 'KH-001',
      name: 'Khách hàng A',
      businessType: 'individual',
      businessRegistrationCode: '',
      imageUrl: '',
      countryCode: 'VN',
      regionCode: '',
      regionName: '',
      phone: '',
      email: '',
      addressDetail: '',
      status: 'active',
      note: '',
      customFields: { education: undefined },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customFields.education).toBe('');
    }
  });
});
