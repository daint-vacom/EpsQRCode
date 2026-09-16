# Customer advance cannot be allocated to an obligation

> Status: **Fixed and retested** (2026-09-16)

## Summary

After a customer advance is posted successfully, the application showed the available amount but did not expose a user flow to allocate that advance to a later customer obligation.

## Impact

- The customer can pay in advance, but the advance cannot be used to settle an existing debt without creating another receipt.
- The workflow cannot complete the accounting requirement that allocation changes the obligation balance without changing cash again.
- Users may leave valid customer money permanently unapplied or duplicate cash receipts when trying to settle the debt manually.

## Evidence

- Environment: dev application at `http://localhost:5174`, dev database.
- Customer: Trần Ngọc Mai (`DEMO-KH-19`).
- Posted advance voucher: `20260916-000006`, 3,000 VND, external reference `PT-TEST-ADV-260916`.
- Source line: category `Tạm ứng`, handling `Ứng trước`, available amount 3,000 VND.
- Customer has an open contract obligation `contract-charge:f5ed29f5-08a9-4fa3-9348-c2ae4c0bc16a`, 8,000 VND outstanding.
- Customer overview correctly remains at 8,000 VND outstanding after the advance is posted.
- The `/finance/obligations` screen exposes only `Phải thu`; no advance mode or allocation action is available.
- Voucher detail shows the available amount but has no action to choose an obligation and allocate part of the advance.

## Expected behavior

From the advance source, customer debt, or customer finance view, a user with the relevant permission should be able to:

1. Select an available posted advance.
2. Select an open obligation for the same customer, direction, tenant, and currency.
3. Enter an amount not greater than both available advance and outstanding obligation.
4. Create an allocation only.
5. See the advance availability decrease and the obligation outstanding balance decrease by the same amount.
6. See no new voucher and no new account movement.

## Root cause / scope

The database had `finance_allocations` and the finance specification defined advance allocation, but the application had no RPC/API/page action for using an advance after posting. The voucher detail only read and displayed availability.

## Fix implemented

- Added the tenant-scoped RPC `public.allocate_finance_advance(...)` with permission, tenant, posted-status, same-customer, currency, scope, amount and effective-date checks.
- Added the finance API wrapper and a `Dùng ứng trước` action on posted advance lines in voucher detail.
- Added a dialog to select an open receivable obligation and an allocation amount.
- The operation inserts only `finance_allocations`; it does not create a second receipt or account movement.
- Added active allocation data to the voucher detail availability calculation.
- Refetched voucher, obligation and report queries after allocation so the UI reflects the new balance immediately.

## Status

Fixed and verified. The original advance receipt and all additional test data are retained in dev data; no data was deleted or rolled back.

## Validation plan

- Retest partial allocation of 3,000 VND into the 8,000 VND contract obligation: passed; obligation became 5,000 VND outstanding and the advance became 0 VND available.
- Retest a second 1,000 VND advance allocation in the same live session: passed; the voucher detail changed from 1,000 VND available to 0 VND immediately after success, without a manual reload.
- Database verification: the first source line has an active allocation of 3,000 VND; the second source line has an active allocation of 1,000 VND; the target obligation has active allocations totaling 4,000 VND and remains 4,000 VND outstanding. The customer and obligation screens show the same value.
- Remaining negative-path tests (wrong-customer, zero/negative amount, repeated submit and cross-tenant IDs) remain part of the broader verification set; they are not marked passed by this report.

## Retest evidence

- First allocation: voucher `20260916-000006`, 3,000 VND, into obligation `contract-charge:f5ed29f5-08a9-4fa3-9348-c2ae4c0bc16a`; toast confirmed success and a full page reload showed 0 VND available.
- Immediate-refresh regression: voucher `20260916-000007`, 1,000 VND, external reference `PT-TEST-ADV-REFETCH-260916`; after clicking `Phân bổ`, the same page showed success and 0 VND available without reload.
- Account balance was not changed by either allocation; allocations created no new voucher or cash movement.
- Over-allocation negative path: voucher `20260916-000008` had 500 VND available; entering 600 VND was rejected by the RPC and left the dialog/source unchanged. The initial English error was mapped to the Vietnamese message `Số tiền phân bổ vượt quá số ứng trước còn khả dụng.` and retested successfully.
