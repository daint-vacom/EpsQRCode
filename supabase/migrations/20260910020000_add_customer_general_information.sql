alter table public.customers
  add column if not exists district_name text not null default '',
  add column if not exists ward_name text not null default '',
  add column if not exists street_address text not null default '',
  add column if not exists contact_name text not null default '',
  add column if not exists contact_title text not null default '',
  add column if not exists established_date date,
  add column if not exists vat_declaration_period text not null default 'unspecified',
  add column if not exists relationship_status text not null default 'unspecified';

alter table public.customers
  drop constraint if exists customers_vat_declaration_period_check,
  drop constraint if exists customers_relationship_status_check;

alter table public.customers
  add constraint customers_vat_declaration_period_check
  check (vat_declaration_period in ('unspecified', 'monthly', 'quarterly')),
  add constraint customers_relationship_status_check
  check (
    relationship_status in (
      'unspecified',
      'prospect',
      'contract_pending',
      'serving',
      'paused',
      'ended'
    )
  );

comment on column public.customers.district_name is
  'Tên quận/huyện trong địa chỉ khách hàng.';
comment on column public.customers.ward_name is
  'Tên phường/xã trong địa chỉ khách hàng.';
comment on column public.customers.street_address is
  'Số nhà và tên đường của khách hàng.';
comment on column public.customers.contact_name is
  'Họ tên người liên hệ chính của khách hàng.';
comment on column public.customers.contact_title is
  'Chức danh người liên hệ chính của khách hàng.';
comment on column public.customers.established_date is
  'Ngày thành lập của khách hàng/doanh nghiệp.';
comment on column public.customers.vat_declaration_period is
  'Kỳ kê khai thuế GTGT: unspecified, monthly hoặc quarterly.';
comment on column public.customers.relationship_status is
  'Trạng thái quan hệ nghiệp vụ giữa Vacom và khách hàng.';

notify pgrst, 'reload schema';
