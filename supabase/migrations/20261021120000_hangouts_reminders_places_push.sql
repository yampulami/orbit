-- Hangouts and answers, reminders, pins, the campus map with student-confirmed places, onboarding answers, and push subscriptions.
-- Everything is scoped by campus the same way the feed is (public.my_campus_key()), and private things stay private:
--   hangouts and their answers are visible only to the members of the group they belong to,
--   reminders, pins and push subscriptions are visible only to their owner.
-- NOT YET RUN against a database. Read SUPABASE-PLAN.md for how to apply and check it.

-- ---------------------------------------------------------------------------------------------
-- 1. Onboarding answers live on the existing profile
-- ---------------------------------------------------------------------------------------------
alter table public.student_profiles
  add column if not exists tenure text check (tenure in ('first-semester','first-year','second-year','third-year','fourth-plus','graduate')),
  add column if not exists living text check (living in ('residence','commute','off-campus','other')),
  add column if not exists interests text[] not null default '{}',
  add column if not exists streaks_enabled boolean not null default false,
  add column if not exists nudges jsonb not null default '{"hangouts":true,"reminders":true,"places":true}'::jsonb check (jsonb_typeof(nudges) = 'object'),
  add column if not exists theme_pref text not null default 'system' check (theme_pref in ('light','dark','system')),
  add column if not exists onboarded_at timestamptz;

-- ---------------------------------------------------------------------------------------------
-- 2. The campus map: campuses, places, and the votes that confirm student-added places
-- ---------------------------------------------------------------------------------------------
create table if not exists public.campuses (
  campus_key text primary key check (campus_key ~ '^[a-z0-9-]{2,100}$'),
  name text not null check (char_length(name) between 2 and 100),
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  zoom smallint not null default 17 check (zoom between 1 and 20),
  official_map_url text check (official_map_url is null or official_map_url ~ '^https?://'),
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.campus_places (
  id uuid primary key default gen_random_uuid(),
  campus_key text not null check (campus_key ~ '^[a-z0-9-]{2,100}$'),
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'other' check (category in ('dining','study','residence','class','fun','outdoors','services','transit','other')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  blurb text check (blurb is null or char_length(blurb) <= 200),
  hours text check (hours is null or char_length(hours) <= 100),
  osm_ref text,
  -- 'open' places are student proposals waiting for confirmations. 'live' ones are on the map for everyone.
  status text not null default 'open' check (status in ('open','live','rejected')),
  source text not null default 'students' check (source in ('osm','students','staff')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists campus_places_campus_idx on public.campus_places(campus_key, status);
-- Re-running a campus import updates its places instead of duplicating them.
create unique index if not exists campus_places_osm_idx on public.campus_places(campus_key, osm_ref) where osm_ref is not null;

create table if not exists public.place_votes (
  place_id uuid not null references public.campus_places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (1, -1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (place_id, user_id)
);

alter table public.campuses enable row level security;
alter table public.campus_places enable row level security;
alter table public.place_votes enable row level security;

-- Campuses: a student reads their own. Adding or editing campuses is done with the service role (the import script), never from the app.
drop policy if exists "own campus read" on public.campuses;
create policy "own campus read" on public.campuses for select to authenticated using (campus_key = public.my_campus_key());

-- Places: read your campus's live and open places. Students may propose a place, and may take back their own proposal while it is open.
drop policy if exists "campus places read" on public.campus_places;
create policy "campus places read" on public.campus_places for select to authenticated
using (campus_key = public.my_campus_key() and status <> 'rejected');
drop policy if exists "campus places propose" on public.campus_places;
create policy "campus places propose" on public.campus_places for insert to authenticated
with check (created_by = auth.uid() and campus_key = public.my_campus_key() and status = 'open' and source = 'students');
drop policy if exists "campus places withdraw" on public.campus_places;
create policy "campus places withdraw" on public.campus_places for delete to authenticated
using (created_by = auth.uid() and status = 'open');

-- Votes: see the votes on places in your campus; vote only on someone else's open proposal in your campus.
drop policy if exists "place votes read" on public.place_votes;
create policy "place votes read" on public.place_votes for select to authenticated
using (exists (select 1 from public.campus_places p where p.id = place_id and p.campus_key = public.my_campus_key()));
drop policy if exists "place votes create" on public.place_votes;
create policy "place votes create" on public.place_votes for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.campus_places p where p.id = place_id and p.campus_key = public.my_campus_key() and p.status = 'open' and p.created_by is distinct from auth.uid())
);
drop policy if exists "place votes change" on public.place_votes;
create policy "place votes change" on public.place_votes for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (select 1 from public.campus_places p where p.id = place_id and p.campus_key = public.my_campus_key() and p.status = 'open' and p.created_by is distinct from auth.uid())
);
drop policy if exists "place votes take back" on public.place_votes;
create policy "place votes take back" on public.place_votes for delete to authenticated using (user_id = auth.uid());

-- Rules that must not depend on the browser: a daily limit, no duplicates, the creator's own first confirmation, and turning votes into a status.
create or replace function public.guard_new_place()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.source = 'students' then
    if (select count(*) from public.campus_places where created_by = new.created_by and source = 'students' and created_at > now() - interval '1 day') >= 5 then
      raise exception 'You can add up to 5 places a day.' using errcode = 'P0001';
    end if;
    -- The same name within about 60 meters is the same place.
    if exists (
      select 1 from public.campus_places p
      where p.campus_key = new.campus_key and p.status <> 'rejected'
        and lower(btrim(p.name)) = lower(btrim(new.name))
        and abs(p.lat - new.lat) < 0.00055
        and abs(p.lng - new.lng) < 0.00055 / greatest(cos(radians(new.lat)), 0.2)
    ) then
      raise exception 'That place is already on the map.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_new_place on public.campus_places;
create trigger guard_new_place before insert on public.campus_places for each row execute function public.guard_new_place();

create or replace function public.first_confirmation()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.source = 'students' and new.created_by is not null then
    insert into public.place_votes (place_id, user_id, vote) values (new.id, new.created_by, 1) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists first_confirmation on public.campus_places;
create trigger first_confirmation after insert on public.campus_places for each row execute function public.first_confirmation();

-- The same thresholds as the app: live at 3 or more confirmations with at least 70% agreeing; dropped at 3 or more "not right" that lead.
create or replace function public.settle_place()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  pid uuid := coalesce(new.place_id, old.place_id);
  yes_n int; no_n int;
begin
  select count(*) filter (where vote = 1), count(*) filter (where vote = -1) into yes_n, no_n from public.place_votes where place_id = pid;
  update public.campus_places set status = case
      when yes_n >= 3 and yes_n::numeric / nullif(yes_n + no_n, 0) >= 0.7 then 'live'
      when no_n >= 3 and no_n > yes_n then 'rejected'
      else 'open' end
  where id = pid and status = 'open';
  return null;
end $$;
drop trigger if exists settle_place on public.place_votes;
create trigger settle_place after insert or update or delete on public.place_votes for each row execute function public.settle_place();

do $$ begin alter publication supabase_realtime add table public.campus_places; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.place_votes; exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Hangouts and answers: visible only to the members of the group
-- ---------------------------------------------------------------------------------------------
create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.campus_group_memberships where group_id = gid and user_id = auth.uid()) $$;
revoke all on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;

create table if not exists public.hangouts (
  id uuid primary key default gen_random_uuid(),
  campus_key text not null check (campus_key ~ '^[a-z0-9-]{2,100}$'),
  group_id uuid not null references public.campus_groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  place_name text not null check (char_length(place_name) between 1 and 120),
  place_id uuid references public.campus_places(id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 90 check (duration_minutes between 15 and 720),
  canceled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists hangouts_group_idx on public.hangouts(group_id, starts_at);

create table if not exists public.hangout_rsvps (
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer text not null check (answer in ('yes','no')),
  updated_at timestamptz not null default now(),
  primary key (hangout_id, user_id)
);

alter table public.hangouts enable row level security;
alter table public.hangout_rsvps enable row level security;

create or replace function public.can_see_hangout(hid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.hangouts h
    where h.id = hid and h.campus_key = public.my_campus_key() and public.is_group_member(h.group_id)
  )
$$;
revoke all on function public.can_see_hangout(uuid) from public;
grant execute on function public.can_see_hangout(uuid) to authenticated;

drop policy if exists "hangouts read" on public.hangouts;
create policy "hangouts read" on public.hangouts for select to authenticated
using (campus_key = public.my_campus_key() and public.is_group_member(group_id));
drop policy if exists "hangouts plan" on public.hangouts;
create policy "hangouts plan" on public.hangouts for insert to authenticated
with check (created_by = auth.uid() and campus_key = public.my_campus_key() and public.is_group_member(group_id));
-- Only the organizer changes a hangout (cancelling sets canceled_at). Nothing is hard-deleted from the app, so a cancel can be undone.
drop policy if exists "hangouts organizer update" on public.hangouts;
create policy "hangouts organizer update" on public.hangouts for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid() and campus_key = public.my_campus_key() and public.is_group_member(group_id));

drop policy if exists "rsvps read" on public.hangout_rsvps;
create policy "rsvps read" on public.hangout_rsvps for select to authenticated using (public.can_see_hangout(hangout_id));
drop policy if exists "rsvps answer" on public.hangout_rsvps;
create policy "rsvps answer" on public.hangout_rsvps for insert to authenticated with check (user_id = auth.uid() and public.can_see_hangout(hangout_id));
drop policy if exists "rsvps change" on public.hangout_rsvps;
create policy "rsvps change" on public.hangout_rsvps for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_see_hangout(hangout_id));
drop policy if exists "rsvps clear" on public.hangout_rsvps;
create policy "rsvps clear" on public.hangout_rsvps for delete to authenticated using (user_id = auth.uid());

-- Nobody can be in two places at once: planning something that overlaps a hangout you organize or said yes to is refused, in the database as well as in the app.
create or replace function public.guard_new_hangout()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.hangouts h
    where h.canceled_at is null and h.id <> new.id
      and tstzrange(h.starts_at, h.starts_at + make_interval(mins => h.duration_minutes)) && tstzrange(new.starts_at, new.starts_at + make_interval(mins => new.duration_minutes))
      and (h.created_by = new.created_by or exists (select 1 from public.hangout_rsvps r where r.hangout_id = h.id and r.user_id = new.created_by and r.answer = 'yes'))
  ) then
    raise exception 'You already have plans then.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists guard_new_hangout on public.hangouts;
create trigger guard_new_hangout before insert on public.hangouts for each row execute function public.guard_new_hangout();

-- The organizer is going, so they get a Yes automatically.
create or replace function public.organizer_says_yes()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.hangout_rsvps (hangout_id, user_id, answer) values (new.id, new.created_by, 'yes') on conflict do nothing;
  return new;
end $$;
drop trigger if exists organizer_says_yes on public.hangouts;
create trigger organizer_says_yes after insert on public.hangouts for each row execute function public.organizer_says_yes();

-- A hangout can appear in the group chat as a card.
alter table public.group_messages add column if not exists hangout_id uuid references public.hangouts(id) on delete cascade;

do $$ begin alter publication supabase_realtime add table public.hangouts; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.hangout_rsvps; exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Reminders and pins: private to their owner
-- ---------------------------------------------------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  remind_on date not null,
  remind_at time,
  done boolean not null default false,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reminders_user_idx on public.reminders(user_id, remind_on);

create table if not exists public.user_pins (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('hangout','reminder','chore')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);

alter table public.reminders enable row level security;
alter table public.user_pins enable row level security;

drop policy if exists "reminders own read" on public.reminders;
create policy "reminders own read" on public.reminders for select to authenticated using (user_id = auth.uid());
drop policy if exists "reminders own create" on public.reminders;
create policy "reminders own create" on public.reminders for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "reminders own update" on public.reminders;
create policy "reminders own update" on public.reminders for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "reminders own delete" on public.reminders;
create policy "reminders own delete" on public.reminders for delete to authenticated using (user_id = auth.uid());

drop policy if exists "pins own read" on public.user_pins;
create policy "pins own read" on public.user_pins for select to authenticated using (user_id = auth.uid());
drop policy if exists "pins own create" on public.user_pins;
create policy "pins own create" on public.user_pins for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "pins own delete" on public.user_pins;
create policy "pins own delete" on public.user_pins for delete to authenticated using (user_id = auth.uid());

-- Three pins at most, so "very important" stays rare.
create or replace function public.limit_pins()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from public.user_pins where user_id = new.user_id) >= 3 then
    raise exception 'You can pin up to 3 things.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists limit_pins on public.user_pins;
create trigger limit_pins before insert on public.user_pins for each row execute function public.limit_pins();

-- ---------------------------------------------------------------------------------------------
-- 5. Notifications: the existing table also carries hangout and map-vote nudges
-- ---------------------------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('like','comment','reply','message','event','hangout','place'));

-- ---------------------------------------------------------------------------------------------
-- 6. Web push subscriptions: only their owner can see or change them. Sending is done by a server with the service role.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists "push own read" on public.push_subscriptions;
create policy "push own read" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists "push own create" on public.push_subscriptions;
create policy "push own create" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own delete" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
