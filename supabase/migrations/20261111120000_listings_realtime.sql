-- Listings go out live: add the table to the realtime publication so other people's phones and browsers hear about new, changed and removed listings.
-- Row-level security still decides who gets each change (only people on the same campus can read a listing).
do $$ begin
  alter publication supabase_realtime add table public.campus_listings;
exception when duplicate_object then null;
end $$;
