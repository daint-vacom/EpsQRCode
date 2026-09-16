# Posted debt-payment voucher shows allocated amount as available

## Summary

After a customer-debt receipt is posted and fully allocated to an obligation, the voucher detail page shows the full line amount as `Còn khả dụng` instead of zero.

## Impact

- Users may believe that money already used to settle debt is still available for another allocation.
- The voucher detail contradicts the customer debt balance and can lead to double-allocation decisions.
- Core posted amount, obligation balance, and account balance were correct in the live run; the defect was in the voucher-detail read model.

## Evidence

- Environment: dev application at `http://localhost:5174`, dev database.
- Customer: Trần Ngọc Mai (`DEMO-KH-19`).
- Obligation: `CN-TEST-001-260916`, original amount 10,000 VND.
- Voucher: `20260916-000005`, receipt amount 6,000 VND.
- The customer debt tab showed original 10,000 VND, paid 10,000 VND, outstanding 0 VND after the second payment.
- The account balance increased by 4,000 VND after the first payment, from 121,000 to 125,000 VND; the second payment was subsequently posted.
- Voucher detail showed the settlement line as 6,000 VND with `Còn khả dụng: 6.000 ₫`.

## Root Cause

Confirmed in `src/project/finance/api/finance.api.ts`:

- `loadFinanceVoucherDetail()` queried `finance_voucher_line_allocation_drafts` only.
- `post_finance_voucher` copies draft allocations to `finance_allocations` and then deletes the draft rows.
- Consequently, a posted voucher returned no allocations from the detail loader, and `availableAmount` was always set to the full line amount.

## Recommended Fix

Use compatibility-preserving hardening:

1. Read both posted allocations and draft allocations for the voucher lines.
2. Use the combined allocation rows for `allocatedAmount` and the allocation detail list.
3. Calculate `availableAmount` as `max(0, line amount - allocated amount - refunded amount)`.
4. Add a pure model regression test for partial, full, and over-allocation inputs.

## Work Done

- Reproduced through the live customer debt payment flow.
- Compared the customer debt tab, account balance/detail, voucher list, and voucher detail.
- Inspected `loadFinanceVoucherDetail()` and the finance-core posting function.
- No test data was deleted or rolled back.

## Result

Fixed and verified in the dev UI on 2026-09-16. Voucher `20260916-000005` now shows `Còn khả dụng: 0 VND`, matching the fully allocated 6,000 VND settlement line. No posted financial data was changed.

## Validation Plan

- Focused finance model test: passed, 4/4 tests.
- TypeScript: passed.
- Focused import lint: passed for all changed TypeScript files.
- Dev UI retest: passed; voucher `20260916-000005` shows `Còn khả dụng: 0 VND`.
- The pure model regression covers partial allocation, full allocation, and over-allocation clamping to zero.
- CN-02 and CN-04 may continue after this regression verification.

## Notes

The fix does not change posted financial data or the database schema. It corrects the detail read path to use the authoritative posted allocation table while retaining draft visibility for editable vouchers.
