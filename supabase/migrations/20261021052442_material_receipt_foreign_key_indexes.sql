create index material_receipt_history_actor_idx
  on public.material_receipt_history(actor_user_id);
create index material_receipt_items_line_idx
  on public.material_receipt_items(line_id);
create index material_receipt_items_voided_by_idx
  on public.material_receipt_items(voided_by);
create index material_receipt_lines_model_idx
  on public.material_receipt_lines(model_id);
create index material_receipts_created_by_idx
  on public.material_receipts(created_by);
create index material_receipts_confirmed_by_idx
  on public.material_receipts(confirmed_by);
create index material_receipts_completed_by_idx
  on public.material_receipts(completed_by);
