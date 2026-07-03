alter table public.orders
  add column if not exists price_adjustment_active boolean not null default false,
  add column if not exists price_adjustment_percent integer not null default 0 check (price_adjustment_percent >= 0 and price_adjustment_percent <= 300);

update public.site_settings
set value = value || jsonb_build_object(
  'productPriceAdjustment',
  coalesce(
    value->'productPriceAdjustment',
    '{
      "enabled": false,
      "percentage": 0,
      "scheduleEnabled": false,
      "startDate": "",
      "endDate": "",
      "startTime": "00:00",
      "endTime": "23:59"
    }'::jsonb
  )
)
where key = 'main';
