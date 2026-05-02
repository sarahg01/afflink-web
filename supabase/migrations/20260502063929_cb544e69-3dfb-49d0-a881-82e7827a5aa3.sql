-- =========================
-- Brands & catalog
-- =========================
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_url text,
  default_commission_rate numeric not null default 5.00, -- percent
  created_at timestamptz not null default now()
);
alter table public.brands enable row level security;
create policy "Brands viewable by everyone" on public.brands for select using (true);

insert into public.brands (slug, name, default_commission_rate) values
  ('amazon', 'Amazon', 4.00),
  ('myntra', 'Myntra', 7.00),
  ('meesho', 'Meesho', 10.00);

create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  image_url text,
  product_url text not null,
  price_inr numeric,
  commission_rate numeric, -- override brand default if set
  category text,
  created_at timestamptz not null default now()
);
alter table public.catalog_products enable row level security;
create policy "Catalog viewable by everyone" on public.catalog_products for select using (true);
create index on public.catalog_products (brand_id);
create index on public.catalog_products using gin (to_tsvector('english', title));

-- Seed a few catalog products per brand so the UI isn't empty
insert into public.catalog_products (brand_id, title, image_url, product_url, price_inr, category)
select b.id, p.title, p.image_url, p.product_url, p.price, p.category
from public.brands b
cross join lateral (values
  ('Wireless Earbuds', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400', 'https://www.amazon.in/dp/B0BDHX8Z63', 1499, 'Electronics'),
  ('Cotton Kurta Set', 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400', 'https://www.myntra.com/kurta-sets', 999, 'Fashion'),
  ('Skincare Serum', 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400', 'https://www.meesho.com/serum', 349, 'Beauty')
) as p(title, image_url, product_url, price, category)
where (b.slug = 'amazon' and p.title = 'Wireless Earbuds')
   or (b.slug = 'myntra' and p.title = 'Cotton Kurta Set')
   or (b.slug = 'meesho' and p.title = 'Skincare Serum');

-- =========================
-- Profile additions
-- =========================
alter table public.profiles
  add column if not exists wallet_balance numeric not null default 0,
  add column if not exists lifetime_earnings numeric not null default 0;

-- =========================
-- Creator secrets (postback token)
-- =========================
create table public.creator_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  postback_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.creator_secrets enable row level security;
create policy "Owner reads own secret" on public.creator_secrets
  for select using (auth.uid() = user_id);

-- Backfill secrets for existing users
insert into public.creator_secrets (user_id)
select id from public.profiles
on conflict do nothing;

-- Auto-create secret on new user (extend existing handle_new_user)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  insert into public.creator_secrets (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- Tracking links
-- =========================
create table public.tracking_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  slug text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  clicks integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.tracking_links enable row level security;
create policy "Tracking links viewable by everyone" on public.tracking_links for select using (true);
create policy "Owner creates tracking links" on public.tracking_links for insert with check (auth.uid() = user_id);
create policy "Owner deletes tracking links" on public.tracking_links for delete using (auth.uid() = user_id);
create index on public.tracking_links (user_id);

create or replace function public.increment_tracking_click(_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.tracking_links set clicks = clicks + 1 where slug = _slug;
end;
$$;

-- =========================
-- Orders (from postback)
-- =========================
create type public.order_status as enum ('pending', 'confirmed', 'cancelled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tracking_link_id uuid references public.tracking_links(id) on delete set null,
  brand_id uuid references public.brands(id),
  external_order_id text,
  sale_amount numeric not null,
  commission_amount numeric not null, -- gross commission from merchant
  creator_earning numeric not null,    -- 80% of commission
  platform_fee numeric not null,       -- 20% of commission
  status public.order_status not null default 'confirmed',
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create policy "Owner reads own orders" on public.orders for select using (auth.uid() = user_id);
create index on public.orders (user_id, created_at desc);

-- =========================
-- Wallet transactions
-- =========================
create type public.wallet_tx_type as enum ('sale_credit', 'redeem_debit', 'adjustment');

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null, -- positive = credit, negative = debit
  type public.wallet_tx_type not null,
  reference_id uuid,       -- orders.id or redemptions.id
  note text,
  created_at timestamptz not null default now()
);
alter table public.wallet_transactions enable row level security;
create policy "Owner reads own wallet tx" on public.wallet_transactions for select using (auth.uid() = user_id);
create index on public.wallet_transactions (user_id, created_at desc);

-- =========================
-- Redemptions
-- =========================
create type public.redeem_status as enum ('requested', 'paid', 'rejected');

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null,
  upi_or_bank text not null,
  status public.redeem_status not null default 'requested',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  admin_note text
);
alter table public.redemptions enable row level security;
create policy "Owner reads own redemptions" on public.redemptions for select using (auth.uid() = user_id);
create policy "Owner requests redemption" on public.redemptions for insert with check (auth.uid() = user_id);

-- Function: request redeem with min ₹50 + balance check, atomic
create or replace function public.request_redeem(_amount numeric, _upi text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _balance numeric;
  _redeem_id uuid;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if _amount < 50 then raise exception 'Minimum redeem is ₹50'; end if;
  select wallet_balance into _balance from public.profiles where id = _uid for update;
  if _balance < _amount then raise exception 'Insufficient balance'; end if;

  insert into public.redemptions (user_id, amount, upi_or_bank)
  values (_uid, _amount, _upi) returning id into _redeem_id;

  update public.profiles set wallet_balance = wallet_balance - _amount where id = _uid;

  insert into public.wallet_transactions (user_id, amount, type, reference_id, note)
  values (_uid, -_amount, 'redeem_debit', _redeem_id, 'Redeem request');

  return _redeem_id;
end;
$$;

-- =========================
-- Notifications
-- =========================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "Owner reads own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Owner updates own notifications" on public.notifications for update using (auth.uid() = user_id);
create index on public.notifications (user_id, created_at desc);

-- =========================
-- Trigger: when order inserted as confirmed, credit wallet + notify
-- =========================
create or replace function public.handle_order_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _product_title text;
begin
  if new.status = 'confirmed' then
    -- credit creator wallet
    update public.profiles
      set wallet_balance = wallet_balance + new.creator_earning,
          lifetime_earnings = lifetime_earnings + new.creator_earning
      where id = new.user_id;

    insert into public.wallet_transactions (user_id, amount, type, reference_id, note)
    values (new.user_id, new.creator_earning, 'sale_credit', new.id, 'Sale commission');

    select cp.title into _product_title
    from public.tracking_links tl
    join public.catalog_products cp on cp.id = tl.product_id
    where tl.id = new.tracking_link_id;

    insert into public.notifications (user_id, title, body)
    values (new.user_id,
      '🎉 New sale! +₹' || round(new.creator_earning, 2),
      coalesce('Someone bought ' || _product_title, 'A product was purchased through your link.'));
  end if;
  return new;
end;
$$;

create trigger trg_order_confirmed
  after insert on public.orders
  for each row execute function public.handle_order_confirmed();

-- realtime for notifications
alter publication supabase_realtime add table public.notifications;