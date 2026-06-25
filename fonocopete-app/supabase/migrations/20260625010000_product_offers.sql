alter table public.products
  add column if not exists original_price integer check (original_price is null or original_price >= 0),
  add column if not exists beer_format text check (beer_format is null or beer_format in ('latas', 'botellas'));

update public.products
set beer_format = case
  when lower(name) like '%lata%' then 'latas'
  else 'botellas'
end
where category_id = 'cervezas' and beer_format is null;
