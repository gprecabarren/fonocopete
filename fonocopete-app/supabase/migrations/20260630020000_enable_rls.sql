alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.site_settings enable row level security;

-- The app reads and writes data through Next.js API routes using the
-- Supabase service role key on the server. With RLS enabled and no public
-- policies, anonymous clients cannot read, edit, or delete these tables
-- directly with only the public project URL and anon key.
