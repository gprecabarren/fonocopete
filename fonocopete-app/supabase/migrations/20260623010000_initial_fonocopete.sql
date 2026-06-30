create table if not exists public.categories (
  id text primary key,
  label text not null,
  sort_order integer not null default 0
);

create table if not exists public.products (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  category_id text not null references public.categories(id),
  price integer not null check (price >= 0),
  image_url text,
  volume text,
  description text,
  stock text not null default 'available' check (stock in ('available', 'low', 'sold_out', 'hidden')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null check (price >= 0),
  eta text not null,
  description text,
  polygon jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  address text not null,
  manual_address boolean not null default false,
  zone_name text not null,
  subtotal integer not null,
  delivery integer not null,
  total integer not null,
  payment_status text not null default 'pending',
  fulfillment_status text not null default 'new',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null,
  line_total integer not null
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.categories (id, label, sort_order)
values
  ('promociones', 'Promociones', 1),
  ('cervezas', 'Cervezas', 2),
  ('piscos', 'Piscos', 3),
  ('vinos', 'Vinos', 4),
  ('destilados', 'Destilados', 5),
  ('extras', 'Extras', 6)
on conflict (id) do update
set label = excluded.label,
    sort_order = excluded.sort_order;

insert into public.products (id, name, category_id, price, image_url, volume, description, stock, featured)
values
  ('promo-pisco-energetica', 'Promo Pisco + Energetica', 'promociones', 12990, 'https://images.unsplash.com/photo-1605270012917-bf157c5a9541?auto=format&fit=crop&w=900&q=80', '1 botella + 2 latas', 'Pack listo para compartir, frio segun disponibilidad.', 'available', true),
  ('promo-six-pack', 'Six Pack Lager', 'promociones', 6990, 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80', '6 x 355 cc', 'Cervezas rubias para llegar rapido al carrito.', 'available', true),
  ('mistral-35', 'Mistral 35', 'piscos', 8990, 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=80', '750 cc', 'Pisco suave para piscola o sour.', 'available', false),
  ('kunstmann-torobayo', 'Kunstmann Torobayo', 'cervezas', 1790, 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?auto=format&fit=crop&w=900&q=80', '330 cc', 'Amber ale con cuerpo medio.', 'sold_out', false)
on conflict (id) do nothing;

insert into public.site_settings (key, value)
values (
  'main',
  '{
    "businessName": "Fonocopete Concepción",
    "maintenanceMode": false,
    "maintenanceMessage": "Fonocopete Penquista se encuentra temporalmente fuera de servicio. Estamos realizando mejoras para brindarte una mejor experiencia. Inténtalo nuevamente más tarde.",
    "whatsappNumber": "56989351855",
    "mercadoPagoLink": "https://www.mercadopago.cl/",
    "bankDetails": {
      "bank": "Banco de Chile",
      "accountHolder": "Fonocopete Penquista",
      "accountType": "Cuenta Corriente",
      "accountNumber": "12345678",
      "rut": "11.111.111-1",
      "email": "pagos@fonocopetepenquista.cl"
    }
  }'::jsonb
)
on conflict (key) do nothing;
