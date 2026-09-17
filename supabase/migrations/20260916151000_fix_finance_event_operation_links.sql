-- Operation IDs are audit references, not ownership constraints. The event
-- row and operation row are written in one transaction, but the event must be
-- insertable before the operation result is recorded.

alter table public.finance_obligation_adjustments
  drop constraint if exists finance_obligation_adjustments_operation_id_fkey;
alter table public.finance_allocation_reversals
  drop constraint if exists finance_allocation_reversals_operation_id_fkey;
alter table public.finance_refund_links
  drop constraint if exists finance_refund_links_operation_id_fkey;
alter table public.finance_voucher_reversals
  drop constraint if exists finance_voucher_reversals_operation_id_fkey;
alter table public.finance_bank_reconciliation_matches
  drop constraint if exists finance_bank_reconciliation_matches_operation_id_fkey;
