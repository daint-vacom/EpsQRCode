alter type public.business_type
  add value if not exists 'household';

alter table public.customers
  drop constraint if exists customers_vat_declaration_period_check;

alter table public.customers
  add constraint customers_vat_declaration_period_check
  check (
    vat_declaration_period in (
      'unspecified',
      'monthly',
      'quarterly',
      'yearly'
    )
  );

comment on column public.customers.vat_declaration_period is
  'Kỳ kê khai thuế GTGT: monthly, quarterly hoặc yearly; unspecified chỉ dành cho dữ liệu cũ chưa cập nhật.';

notify pgrst, 'reload schema';
