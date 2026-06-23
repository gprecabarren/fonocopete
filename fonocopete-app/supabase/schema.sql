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
  stock text not null default 'available' check (stock in ('available', 'low', 'hidden')),
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
