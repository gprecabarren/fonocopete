alter table public.delivery_zones
  add column if not exists match_terms text[] not null default '{}',
  add column if not exists sort_order integer not null default 0;

delete from public.delivery_zones
where name in ('Zona cercana', 'Zona media', 'Zona extendida');

insert into public.delivery_zones (id, name, price, eta, description, match_terms, sort_order, active)
values
  ('11111111-1111-4111-8111-111111111111', 'San Pedro de la Paz', 1990, '25-45 min', 'Cobertura inicial para San Pedro de la Paz.', array['san pedro de la paz', 'san pedro'], 1, true),
  ('22222222-2222-4222-8222-222222222222', 'Talcahuano', 2990, '35-60 min', 'Cobertura inicial para Talcahuano.', array['talcahuano'], 2, true),
  ('33333333-3333-4333-8333-333333333333', 'Coronel', 4490, '45-75 min', 'Cobertura inicial para Coronel.', array['coronel'], 3, true)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  eta = excluded.eta,
  description = excluded.description,
  match_terms = excluded.match_terms,
  sort_order = excluded.sort_order;

update public.site_settings
set value = value || '{
  "deliveryEnabled": true,
  "whatsappNumber": "56989351855",
  "contactEmail": "fonocopetepenquista@gmail.com",
  "instagramUrl": "https://www.instagram.com/fonocopeteconcepcion.maverik/",
  "facebookUrl": "https://www.instagram.com/fonocopeteconcepcion.maverik/"
}'::jsonb,
updated_at = now()
where key = 'main';
