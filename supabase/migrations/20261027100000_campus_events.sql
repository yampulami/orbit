-- Campus events: public events put on by a department, club, instructor or staff member (a "host"), shown to everyone on the campus.
-- Groups stay for small private hangouts; these are the big events.
--
-- Who may host: only people listed in campus_hosts. Nobody can add themselves: there is no insert policy, so hosts are added by the project
-- owner in the SQL editor (see CAMPUS-EVENTS.md for the one line to run). That keeps this safe without reading anyone's email.

-- 1. Hosts ---------------------------------------------------------------------------------------------------------------------------
create table if not exists public.campus_hosts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  campus_key text not null,
  label text not null check (char_length(label) between 1 and 80),   -- shown on their events, for example "University Library"
  created_at timestamptz not null default now()
);
alter table public.campus_hosts enable row level security;
drop policy if exists "hosts read" on public.campus_hosts;
create policy "hosts read" on public.campus_hosts for select to authenticated using (campus_key = public.my_campus_key());
-- (no insert, update or delete policy on purpose)

-- 2. Events ---------------------------------------------------------------------------------------------------------------------------
create table if not exists public.campus_events (
  id uuid primary key default gen_random_uuid(),
  campus_key text not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  host_label text not null check (char_length(host_label) between 1 and 80),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  place_name text not null default '' check (char_length(place_name) <= 120),
  starts_at timestamptz not null,
  ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists campus_events_campus_time_idx on public.campus_events(campus_key, starts_at);
alter table public.campus_events enable row level security;

drop policy if exists "campus events read" on public.campus_events;
create policy "campus events read" on public.campus_events for select to authenticated
using (campus_key = public.my_campus_key() and not public.is_blocked(auth.uid(), host_id));

drop policy if exists "campus events host create" on public.campus_events;
create policy "campus events host create" on public.campus_events for insert to authenticated
with check (
  host_id = auth.uid() and campus_key = public.my_campus_key()
  and exists (select 1 from public.campus_hosts h where h.user_id = auth.uid() and h.campus_key = campus_events.campus_key)
);

drop policy if exists "campus events host update" on public.campus_events;
create policy "campus events host update" on public.campus_events for update to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid() and campus_key = public.my_campus_key());

drop policy if exists "campus events host delete" on public.campus_events;
create policy "campus events host delete" on public.campus_events for delete to authenticated using (host_id = auth.uid());

-- The host's name on the event always comes from the hosts list, and a host cannot post more than 10 events a day.
create or replace function public.campus_event_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare lbl text;
begin
  select label into lbl from public.campus_hosts where user_id = new.host_id;
  if lbl is null then raise exception 'Only campus hosts can post events.' using errcode = '42501'; end if;
  new.host_label := lbl;
  if (select count(*) from public.campus_events where host_id = new.host_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That is a lot of events for one day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists campus_event_before_insert on public.campus_events;
create trigger campus_event_before_insert before insert on public.campus_events for each row execute function public.campus_event_before_insert();

-- 3. Answers (going or interested) -----------------------------------------------------------------------------------------------------
create table if not exists public.campus_event_responses (
  event_id uuid not null references public.campus_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer text not null check (answer in ('going', 'interested')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.campus_event_responses enable row level security;

drop policy if exists "event answers read" on public.campus_event_responses;
create policy "event answers read" on public.campus_event_responses for select to authenticated
using (exists (select 1 from public.campus_events e where e.id = event_id and e.campus_key = public.my_campus_key()));

drop policy if exists "event answers write" on public.campus_event_responses;
create policy "event answers write" on public.campus_event_responses for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.campus_events e where e.id = event_id and e.campus_key = public.my_campus_key()));

drop policy if exists "event answers change" on public.campus_event_responses;
create policy "event answers change" on public.campus_event_responses for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "event answers remove" on public.campus_event_responses;
create policy "event answers remove" on public.campus_event_responses for delete to authenticated using (user_id = auth.uid());

-- 4. Telling people ---------------------------------------------------------------------------------------------------------------------
-- A new event puts a line in the bell of everyone on the campus (except the host and anyone who blocked them). A cancelled event tells the people who had said
-- going or interested. Both are written by the database, so nobody can send notifications by hand.
create or replace function public.campus_event_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.starts_at > now() then
      insert into public.notifications (recipient_id, actor_id, kind, body)
      select m.user_id, new.host_id, 'event', left(new.host_label || ': ' || new.title, 200)
      from public.campus_memberships m
      where m.campus_key = new.campus_key and m.user_id <> new.host_id and not public.is_blocked(m.user_id, new.host_id);
    end if;
  elsif tg_op = 'UPDATE' and old.canceled_at is null and new.canceled_at is not null then
    insert into public.notifications (recipient_id, actor_id, kind, body)
    select r.user_id, new.host_id, 'event', left('Cancelled: ' || new.title, 200)
    from public.campus_event_responses r where r.event_id = new.id and r.user_id <> new.host_id;
  end if;
  return null;
end $$;
drop trigger if exists campus_event_notify on public.campus_events;
create trigger campus_event_notify after insert or update on public.campus_events for each row execute function public.campus_event_notify();

-- 5. Live updates -----------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['campus_events', 'campus_event_responses'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
