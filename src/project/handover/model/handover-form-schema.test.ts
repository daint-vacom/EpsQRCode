import { describe, expect, it } from 'vitest';
import { handoverFormSchema } from './handover-form-schema';

const valid = {
  type: 'transfer' as const,
  senderPartyId: '11111111-1111-4111-8111-111111111111',
  recipientPartyId: '22222222-2222-4222-8222-222222222222',
  senderRepresentativeUserId: null,
  recipientRepresentativeUserId: null,
  plannedDate: '2026-10-20',
  dueDate: '',
  note: '',
  items: [
    {
      materialId: '33333333-3333-4333-8333-333333333333',
      condition: 'good' as const,
      note: '',
    },
  ],
  attachmentFileIds: [],
};

describe('handoverFormSchema', () => {
  it('allows a non-loan draft with one individual material', () => {
    expect(handoverFormSchema.safeParse(valid).success).toBe(true);
  });

  it('requires a due date only for loans', () => {
    expect(
      handoverFormSchema.safeParse({ ...valid, type: 'loan' }).success,
    ).toBe(false);
    expect(
      handoverFormSchema.safeParse({
        ...valid,
        type: 'loan',
        dueDate: '2026-11-20',
      }).success,
    ).toBe(true);
    expect(
      handoverFormSchema.safeParse({ ...valid, dueDate: '' }).success,
    ).toBe(true);
  });

  it('rejects identical parties and duplicate materials', () => {
    expect(
      handoverFormSchema.safeParse({
        ...valid,
        recipientPartyId: valid.senderPartyId,
      }).success,
    ).toBe(false);
    expect(
      handoverFormSchema.safeParse({
        ...valid,
        items: [...valid.items, ...valid.items],
      }).success,
    ).toBe(false);
    expect(
      handoverFormSchema.safeParse({
        ...valid,
        items: [{ ...valid.items[0], condition: 'damaged', note: '' }],
      }).success,
    ).toBe(true);
  });
});
