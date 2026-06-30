alter table public.products
  add column if not exists secondary_category_id text references public.categories(id);

alter table public.orders
  add column if not exists discount integer not null default 0 check (discount >= 0),
  add column if not exists coupon_code text;

update public.site_settings
set value = value || '{"coupons":[]}'::jsonb
where key = 'main'
  and not (value ? 'coupons');
