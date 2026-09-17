-- Keep voucher-line semantics aligned with the voucher/category contract.

create or replace function public.finance_voucher_line_direction_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_voucher record;
  v_category_direction public.finance_category_direction;
begin
  select voucher_type, status
    into v_voucher
    from public.finance_vouchers
   where id = new.voucher_id
     and tenant_id = new.tenant_id;
  if not found then
    raise exception 'Voucher line voucher tenant mismatch' using errcode = '23514';
  end if;

  select category.direction
    into v_category_direction
    from public.finance_categories category
   where category.id = new.category_id
     and category.tenant_id = new.tenant_id;
  if not found then
    raise exception 'Voucher line category tenant mismatch' using errcode = '23514';
  end if;

  if v_voucher.voucher_type = 'receipt'
     and v_category_direction = 'payment'
  then
    raise exception 'Khoản mục chi không được dùng cho phiếu thu' using errcode = '23514';
  end if;
  if v_voucher.voucher_type = 'payment'
     and v_category_direction = 'receipt'
  then
    raise exception 'Khoản mục thu không được dùng cho phiếu chi' using errcode = '23514';
  end if;

  if new.handling_type = 'refund' and v_voucher.status <> 'posted' then
    raise exception 'Refund lines must be created through the refund operation'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_voucher_line_direction_guard on public.finance_voucher_lines;
create trigger finance_voucher_line_direction_guard
before insert or update on public.finance_voucher_lines
for each row execute function public.finance_voucher_line_direction_guard();

revoke execute on function public.finance_voucher_line_direction_guard()
  from public, anon, authenticated;
