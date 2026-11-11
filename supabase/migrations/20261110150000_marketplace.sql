-- Marketplace: things students sell, give away or are looking for, shown only to their own campus.
-- Orbit never handles money: a listing has a price for information, and the buyer and seller sort out the rest in a message.

create table if not exists public.campus_listings (
  id uuid primary key default gen_random_uuid(),
  campus_key text not null check (campus_key ~ '^[a-z0-9-]{2,100}$'),
  seller_id uuid not null references auth.users(id) on delete cascade,
  seller_name text not null check (char_length(seller_name) between 1 and 80),
  kind text not null default 'sell' check (kind in ('sell', 'free', 'wanted')),
  title text not null check (char_length(title) between 2 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  -- Dollars, whole cents. Null for free items and for wanted posts with no budget.
  price_cents integer check (price_cents is null or (price_cents >= 0 and price_cents <= 1000000)),
  category text not null default 'Other' check (category in ('Textbooks', 'Furniture', 'Electronics', 'Clothing', 'Dorm and kitchen', 'Bikes and rides', 'Tickets', 'Services', 'Other')),
  condition text check (condition is null or condition in ('New', 'Like new', 'Good', 'Fair')),
  -- Paths of pictures in the private media bucket, at most four.
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  status text not null default 'active' check (status in ('active', 'sold', 'removed')),
  created_at timestamptz not null default now(),
  sold_at timestamptz
);
create index if not exists campus_listings_campus_idx on public.campus_listings (campus_key, status, created_at desc);
create index if not exists campus_listings_seller_idx on public.campus_listings (seller_id);
alter table public.campus_listings enable row level security;

-- Students save listings to look at later; the list is private to them.
create table if not exists public.campus_listing_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.campus_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.campus_listing_saves enable row level security;

-- Reports go to whoever looks after Orbit. A reporter cannot read them back.
create table if not exists public.campus_listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.campus_listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('scam', 'prohibited', 'spam', 'unsafe', 'other')),
  detail text not null default '' check (char_length(detail) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);
alter table public.campus_listing_reports enable row level security;

-- Your campus sees active listings, except from people you have blocked (or who blocked you). You always see your own, sold or active.
drop policy if exists "listings read" on public.campus_listings;
create policy "listings read" on public.campus_listings for select to authenticated
using (campus_key = public.my_campus_key() and (seller_id = auth.uid() or (status = 'active' and not public.is_blocked(seller_id, auth.uid()))));

drop policy if exists "listings create" on public.campus_listings;
create policy "listings create" on public.campus_listings for insert to authenticated
with check (seller_id = auth.uid() and campus_key = public.my_campus_key() and status = 'active');

-- Sellers change their own listings (mark sold, take down, fix a typo). They cannot move a listing to another campus or another seller.
drop policy if exists "listings update" on public.campus_listings;
create policy "listings update" on public.campus_listings for update to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid() and campus_key = public.my_campus_key());

drop policy if exists "listings delete" on public.campus_listings;
create policy "listings delete" on public.campus_listings for delete to authenticated using (seller_id = auth.uid());

-- At most 12 active listings per student at a time, so the page cannot be flooded.
create or replace function public.limit_active_listings() returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'active' and (select count(*) from public.campus_listings l where l.seller_id = new.seller_id and l.status = 'active' and l.id is distinct from new.id) >= 12 then
    raise exception 'You can have up to 12 active listings. Mark one as sold or take one down first.';
  end if;
  return new;
end $$;
drop trigger if exists campus_listings_limit on public.campus_listings;
create trigger campus_listings_limit before insert or update of status on public.campus_listings for each row execute function public.limit_active_listings();

drop policy if exists "listing saves own" on public.campus_listing_saves;
create policy "listing saves own" on public.campus_listing_saves for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "listing reports create" on public.campus_listing_reports;
create policy "listing reports create" on public.campus_listing_reports for insert to authenticated
with check (reporter_id = auth.uid() and exists (select 1 from public.campus_listings l where l.id = listing_id and l.campus_key = public.my_campus_key()));
