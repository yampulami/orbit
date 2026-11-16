-- Marketplace: where to meet. Sellers can name a public spot on campus ("Student center lobby") so buyers know before they message.
-- Optional; empty means the seller did not say. The app reads every column, so listings keep loading before this is applied.

alter table public.campus_listings add column if not exists pickup text not null default '' check (char_length(pickup) <= 60);
