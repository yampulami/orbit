-- Campus events: public events for the whole campus, put on by "hosts". Groups stay for small private hangouts.
--
-- Two kinds of event, so everyone can tell them apart:
--   official  posted by staff or a coordinator (a department, the library, an instructor, the dean's office). Published straight away.
--   student   posted by a student host (a club officer). It waits as "pending" until a staff host or coordinator approves it.
--
-- Who may host: only people listed in campus_hosts, with a role. Nobody can add themselves: there is no insert policy, so hosts are added
-- by the project owner in the SQL editor (see CAMPUS-EVENTS.md). No email is read anywhere.

-- 1. Hosts ---------------------------------------------------------------------------------------------------------------------------
create table if not exists public.campus_hosts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  campus_key text not null,
  label text not null check (char_length(label) between 1 and 80),   -- shown on their events, for example "University Library"
  role text not null default 'staff' check (role in ('coordinator', 'staff', 'student')),
  created_at timestamptz not null default now()
);
alter table public.campus_hosts add column if not exists role text not null default 'staff';
alter table public.campus_hosts drop constraint if exists campus_hosts_role_check;
alter table public.campus_hosts add constraint campus_hosts_role_check check (role in ('coordinator', 'staff', 'student'));
alter table public.campus_hosts enable row level security;
drop policy if exists "hosts read" on public.campus_hosts;
create policy "hosts read" on public.campus_hosts for select to authenticated using (campus_key = public.my_campus_key());
-- (no insert, update or delete policy on purpose)

-- Can this person approve student events? Coordinators and staff hosts can.
create or replace function public.can_review_events()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.campus_hosts h where h.user_id = auth.uid() and h.role in ('coordinator', 'staff') and h.campus_key = public.my_campus_key())
$$;
revoke all on function public.can_review_events() from public;
grant execute on function public.can_review_events() to authenticated;

-- 2. Events ---------------------------------------------------------------------------------------------------------------------------
create table if not exists public.campus_events (
  id uuid primary key default gen_random_uuid(),
  campus_key text not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  host_label text not null check (char_length(host_label) between 1 and 80),
  kind text not null default 'student' check (kind in ('official', 'student')),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  place_name text not null default '' check (char_length(place_name) <= 120),
  starts_at timestamptz not null,
  ends_at timestamptz,
  canceled_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 200),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists campus_events_campus_time_idx on public.campus_events(campus_key, starts_at);
alter table public.campus_events enable row level security;

-- Published events are for the whole campus. Waiting or declined ones are seen only by their host and by reviewers.
drop policy if exists "campus events read" on public.campus_events;
create policy "campus events read" on public.campus_events for select to authenticated
using (
  campus_key = public.my_campus_key()
  and ((status = 'published' and not public.is_blocked(auth.uid(), host_id)) or host_id = auth.uid() or public.can_review_events())
);

drop policy if exists "campus events host create" on public.campus_events;
create policy "campus events host create" on public.campus_events for insert to authenticated
with check (
  host_id = auth.uid() and campus_key = public.my_campus_key()
  and exists (select 1 from public.campus_hosts h where h.user_id = auth.uid() and h.campus_key = campus_events.campus_key)
);

drop policy if exists "campus events host update" on public.campus_events;
create policy "campus events host update" on public.campus_events for update to authenticated
using (host_id = auth.uid() or public.can_review_events())
with check (campus_key = public.my_campus_key());

drop policy if exists "campus events host delete" on public.campus_events;
create policy "campus events host delete" on public.campus_events for delete to authenticated using (host_id = auth.uid());

-- On insert, the database decides the kind and the status from the host's role (the app cannot choose): staff and coordinators publish officially,
-- student hosts wait for approval. The host's name always comes from the hosts list. A host can post at most 10 events a day.
create or replace function public.campus_event_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare lbl text; r text;
begin
  select label, role into lbl, r from public.campus_hosts where user_id = new.host_id;
  if lbl is null then raise exception 'Only campus hosts can post events.' using errcode = '42501'; end if;
  new.host_label := lbl;
  if r = 'student' then new.kind := 'student'; new.status := 'pending'; else new.kind := 'official'; new.status := 'published'; end if;
  new.reviewed_by := null; new.reviewed_at := null; new.review_note := null; new.canceled_at := null;
  if (select count(*) from public.campus_events where host_id = new.host_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That is a lot of events for one day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists campus_event_before_insert on public.campus_events;
create trigger campus_event_before_insert before insert on public.campus_events for each row execute function public.campus_event_before_insert();

-- On update: who and what an event is cannot be changed; only a reviewer can approve or decline a waiting event; a reviewer who is not the host cannot
-- edit the content; and a host who edits a published student event sends it back for approval. (The SQL editor, which has no signed-in person, is let through.)
create or replace function public.campus_event_before_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare reviewer boolean; is_host boolean; content_changed boolean;
begin
  if auth.uid() is null then return new; end if;
  reviewer := public.can_review_events();
  is_host := old.host_id = auth.uid();
  new.host_id := old.host_id; new.host_label := old.host_label; new.campus_key := old.campus_key; new.kind := old.kind;
  new.created_at := old.created_at;
  content_changed := (new.title, new.description, new.place_name, new.starts_at, new.ends_at) is distinct from (old.title, old.description, old.place_name, old.starts_at, old.ends_at);

  if new.status is distinct from old.status then
    if not reviewer then raise exception 'Only a reviewer can approve or decline events.' using errcode = '42501'; end if;
    if old.status = 'pending' and new.status in ('published', 'rejected') then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    else
      raise exception 'That status change is not allowed.' using errcode = '42501';
    end if;
  else
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.review_note := old.review_note;
    if content_changed and old.kind = 'student' and old.status = 'published' then new.status := 'pending'; end if;
  end if;

  if not is_host and (content_changed or new.canceled_at is distinct from old.canceled_at) then
    raise exception 'Only the host can change an event.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists campus_event_before_update on public.campus_events;
create trigger campus_event_before_update before update on public.campus_events for each row execute function public.campus_event_before_update();

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
with check (user_id = auth.uid() and exists (select 1 from public.campus_events e where e.id = event_id and e.campus_key = public.my_campus_key() and e.status = 'published'));

drop policy if exists "event answers change" on public.campus_event_responses;
create policy "event answers change" on public.campus_event_responses for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "event answers remove" on public.campus_event_responses;
create policy "event answers remove" on public.campus_event_responses for delete to authenticated using (user_id = auth.uid());

-- 4. Telling people ---------------------------------------------------------------------------------------------------------------------
-- All written by the database, so nobody can send notifications by hand.
--   a published event        -> everyone on the campus (except the host and anyone who blocked them)
--   a student event waiting  -> the reviewers on that campus
--   approved                 -> the campus, and the host ("approved")
--   declined                 -> the host, with the reason
--   cancelled                -> people who said going or interested
create or replace function public.campus_event_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
declare tell_campus boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' and new.starts_at > now() then tell_campus := true; end if;
    if new.status = 'pending' then
      insert into public.notifications (recipient_id, actor_id, kind, body)
      select h.user_id, new.host_id, 'event', left('Waiting for approval: ' || new.title, 200)
      from public.campus_hosts h where h.campus_key = new.campus_key and h.role in ('coordinator', 'staff') and h.user_id <> new.host_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status = 'pending' and new.status = 'published' then
      tell_campus := new.starts_at > now();
      insert into public.notifications (recipient_id, actor_id, kind, body) values (new.host_id, new.reviewed_by, 'event', left('Approved: ' || new.title, 200));
    elsif old.status = 'pending' and new.status = 'rejected' then
      insert into public.notifications (recipient_id, actor_id, kind, body)
      values (new.host_id, new.reviewed_by, 'event', left('Not approved: ' || new.title || coalesce(' (' || new.review_note || ')', ''), 200));
    end if;
    if old.canceled_at is null and new.canceled_at is not null then
      insert into public.notifications (recipient_id, actor_id, kind, body)
      select r.user_id, new.host_id, 'event', left('Cancelled: ' || new.title, 200)
      from public.campus_event_responses r where r.event_id = new.id and r.user_id <> new.host_id;
    end if;
  end if;
  if tell_campus then
    insert into public.notifications (recipient_id, actor_id, kind, body)
    select m.user_id, new.host_id, 'event', left(case when new.kind = 'official' then 'Official: ' else 'Student event: ' end || new.host_label || ' - ' || new.title, 200)
    from public.campus_memberships m
    where m.campus_key = new.campus_key and m.user_id <> new.host_id and not public.is_blocked(m.user_id, new.host_id);
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
