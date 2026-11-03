-- Events pulled in from a club's or office's own events page (or calendar feed).
-- An organization's owner pastes the address of that page; the sync function (supabase/functions/sync-campus-events) reads it every few hours,
-- adds new events, updates edited ones, cancels the ones the page marks cancelled, and hides ones taken off the page before they happen.
-- Imported events go live at once, labelled with the organization. The campus is not notified one by one for a whole batch of imports.
-- (Builds on 20261103120000_group_icons.sql and the campus events and organizations migrations.)

-- 1. Where an organization's events come from, and how the last read went -------------------------------------------------------------------
alter table public.campus_orgs add column if not exists events_url text;
alter table public.campus_orgs add column if not exists events_synced_at timestamptz;
alter table public.campus_orgs add column if not exists events_sync_note text;
alter table public.campus_orgs drop constraint if exists campus_orgs_events_url_check;
alter table public.campus_orgs add constraint campus_orgs_events_url_check check (events_url is null or (char_length(events_url) <= 400 and events_url ~* '^https://[^/@ ]+\.[^/@ ]+'));
alter table public.campus_orgs drop constraint if exists campus_orgs_events_sync_note_check;
alter table public.campus_orgs add constraint campus_orgs_events_sync_note_check check (events_sync_note is null or char_length(events_sync_note) <= 300);

-- 2. Imported events remember which line of the page they came from -------------------------------------------------------------------------
alter table public.campus_events add column if not exists external_key text;
alter table public.campus_events add column if not exists source_url text;
create unique index if not exists campus_events_source_idx on public.campus_events (org_id, external_key) where external_key is not null;

-- Only the sync function (which has no signed-in person) sets or changes where an event came from; a person's own insert or edit cannot.
create or replace function public.campus_event_source_lock()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then new.external_key := null; new.source_url := null;
  else new.external_key := old.external_key; new.source_url := old.source_url; end if;
  return new;
end $$;
drop trigger if exists campus_event_source_lock on public.campus_events;
create trigger campus_event_source_lock before insert or update on public.campus_events for each row execute function public.campus_event_source_lock();

-- 3. Posting rules: an import (no signed-in person, with a source key) skips the per-person limits and goes live as the organization -------
create or replace function public.campus_event_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare lbl text; r text; o public.campus_orgs;
begin
  if auth.uid() is null and new.external_key is not null then
    select * into o from public.campus_orgs where id = new.org_id;
    if o.id is null or o.campus_key <> new.campus_key or o.status <> 'active' or o.kind = 'circle' then raise exception 'This organization cannot post events right now.' using errcode = '42501'; end if;
    new.host_label := o.name; new.kind := o.kind; new.status := 'published';
    new.reviewed_by := null; new.reviewed_at := null; new.review_note := null; new.canceled_at := null;
    return new;
  end if;
  if new.org_id is not null then
    select * into o from public.campus_orgs where id = new.org_id;
    if o.id is null or o.campus_key <> new.campus_key or o.status <> 'active' then raise exception 'This club cannot post events right now.' using errcode = '42501'; end if;
    if o.kind = 'circle' then raise exception 'Student circles cannot post campus events. Apply to start a club to host events.' using errcode = '42501'; end if;
    if not ('events' = any (coalesce(public.org_perms(o.id, new.host_id), '{}'::text[]))) then raise exception 'Your role in this club does not include posting events.' using errcode = '42501'; end if;
    new.host_label := o.name; new.kind := o.kind;
    new.status := case when o.kind = 'official' or o.trusted then 'published' else 'pending' end;
  else
    select label, role into lbl, r from public.campus_hosts where user_id = new.host_id;
    if lbl is null then raise exception 'Only campus hosts can post events.' using errcode = '42501'; end if;
    new.host_label := lbl;
    if r = 'student' then new.kind := 'student'; new.status := 'pending'; else new.kind := 'official'; new.status := 'published'; end if;
  end if;
  new.reviewed_by := null; new.reviewed_at := null; new.review_note := null; new.canceled_at := null;
  if (select count(*) from public.campus_events where host_id = new.host_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That is a lot of events for one day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- 4. Telling people: same as before, except an imported event does not send the whole campus its own notification ---------------------------
create or replace function public.campus_event_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
declare tell_campus boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' and new.starts_at > now() and new.external_key is null then tell_campus := true; end if;
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

-- 5. The Student Life office reads Caldwell's "The 39" events page (set here once; it can be changed in the club's Manage tab) ------------
update public.campus_orgs set events_url = 'https://sites.google.com/caldwell.edu/cougar39/event-calendar'
where lower(name) = 'student life' and kind = 'official' and events_url is null;

-- 6. The sync function (it runs with the service key) asks who may post a club's events
grant execute on function public.org_perms(uuid, uuid) to service_role;
