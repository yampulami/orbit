-- Organizations: clubs, departments and offices that put on campus events.
-- Instead of approving every event, a coordinator approves the ORGANIZATION once. After that its events go live straight away, labelled
-- "Student event" (a club) or "Official campus event" (a staff-run office). Anyone can report an event, and a coordinator can remove it or pause the organization.
-- (Builds on 20261027100000_campus_events.sql.)

-- 1. Organizations -----------------------------------------------------------------------------------------------------------------------
create table if not exists public.campus_orgs (
  id uuid primary key default gen_random_uuid(),
  campus_key text not null,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  kind text not null default 'student' check (kind in ('official', 'student')),
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'rejected')),
  created_by uuid not null references auth.users(id) on delete cascade,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 200),
  created_at timestamptz not null default now()
);
create unique index if not exists campus_orgs_name_idx on public.campus_orgs (campus_key, lower(name));
alter table public.campus_orgs enable row level security;

create table if not exists public.campus_org_members (
  org_id uuid not null references public.campus_orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'officer' check (role in ('owner', 'officer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
alter table public.campus_org_members enable row level security;

create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.campus_org_members m where m.org_id = org and m.user_id = auth.uid()) $$;
create or replace function public.is_org_owner(org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.campus_org_members m where m.org_id = org and m.user_id = auth.uid() and m.role = 'owner') $$;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_owner(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;

-- Active organizations are seen by the whole campus. Waiting, paused or declined ones only by their members, their creator and reviewers.
drop policy if exists "orgs read" on public.campus_orgs;
create policy "orgs read" on public.campus_orgs for select to authenticated
using (campus_key = public.my_campus_key() and (status = 'active' or created_by = auth.uid() or public.is_org_member(id) or public.can_review_events()));

drop policy if exists "orgs create" on public.campus_orgs;
create policy "orgs create" on public.campus_orgs for insert to authenticated
with check (created_by = auth.uid() and campus_key = public.my_campus_key());

drop policy if exists "orgs update" on public.campus_orgs;
create policy "orgs update" on public.campus_orgs for update to authenticated
using (public.can_review_events() or public.is_org_owner(id))
with check (campus_key = public.my_campus_key());
-- (no delete policy)

drop policy if exists "org members read" on public.campus_org_members;
create policy "org members read" on public.campus_org_members for select to authenticated
using (exists (select 1 from public.campus_orgs o where o.id = org_id and o.campus_key = public.my_campus_key()));
-- (no insert, update or delete policy: members are added and removed through the functions below)

-- A new request: a coordinator or staff host makes an organization active at once (and chooses its kind); everyone else makes a student organization that waits.
create or replace function public.campus_org_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and public.can_review_events() then
    new.status := 'active'; new.kind := coalesce(new.kind, 'student'); new.reviewed_by := auth.uid(); new.reviewed_at := now();
  else
    new.status := 'pending'; new.kind := 'student'; new.reviewed_by := null; new.reviewed_at := null;
    if (select count(*) from public.campus_orgs where created_by = new.created_by and created_at > now() - interval '1 day') >= 3 then
      raise exception 'That is a lot of requests for one day. Try again tomorrow.' using errcode = 'P0001';
    end if;
  end if;
  new.review_note := null;
  return new;
end $$;
drop trigger if exists campus_org_before_insert on public.campus_orgs;
create trigger campus_org_before_insert before insert on public.campus_orgs for each row execute function public.campus_org_before_insert();

create or replace function public.campus_org_after_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.campus_org_members (org_id, user_id, role) values (new.id, new.created_by, 'owner') on conflict do nothing;
  if new.status = 'pending' then
    insert into public.notifications (recipient_id, actor_id, kind, body)
    select h.user_id, new.created_by, 'event', left('Club waiting for approval: ' || new.name, 200)
    from public.campus_hosts h where h.campus_key = new.campus_key and h.role in ('coordinator', 'staff') and h.user_id <> new.created_by;
  end if;
  return null;
end $$;
drop trigger if exists campus_org_after_insert on public.campus_orgs;
create trigger campus_org_after_insert after insert on public.campus_orgs for each row execute function public.campus_org_after_insert();

-- Updates: a non-reviewer owner can change only the description; a reviewer decides the status. The identity of an organization never changes.
create or replace function public.campus_org_before_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare reviewer boolean;
begin
  if auth.uid() is null then return new; end if;
  reviewer := public.can_review_events();
  new.campus_key := old.campus_key; new.created_by := old.created_by; new.created_at := old.created_at;
  if not reviewer then
    new.name := old.name; new.kind := old.kind; new.status := old.status;
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.review_note := old.review_note;
    return new;
  end if;
  if new.status is distinct from old.status then
    if (old.status = 'pending' and new.status in ('active', 'rejected')) or (old.status = 'active' and new.status = 'paused') or (old.status = 'paused' and new.status = 'active') then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    else
      raise exception 'That status change is not allowed.' using errcode = '42501';
    end if;
  else
    new.review_note := old.review_note; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end $$;
drop trigger if exists campus_org_before_update on public.campus_orgs;
create trigger campus_org_before_update before update on public.campus_orgs for each row execute function public.campus_org_before_update();

create or replace function public.campus_org_after_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'pending' and new.status = 'active' then
    insert into public.notifications (recipient_id, actor_id, kind, body) values (new.created_by, new.reviewed_by, 'event', left('Approved: ' || new.name || ' can now post events', 200));
  elsif old.status = 'pending' and new.status = 'rejected' then
    insert into public.notifications (recipient_id, actor_id, kind, body) values (new.created_by, new.reviewed_by, 'event', left('Not approved: ' || new.name || coalesce(' (' || new.review_note || ')', ''), 200));
  elsif old.status = 'active' and new.status = 'paused' then
    insert into public.notifications (recipient_id, actor_id, kind, body) select m.user_id, new.reviewed_by, 'event', left('Paused: ' || new.name || ' cannot post events right now', 200) from public.campus_org_members m where m.org_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists campus_org_after_update on public.campus_orgs;
create trigger campus_org_after_update after update on public.campus_orgs for each row execute function public.campus_org_after_update();

-- 2. Members -------------------------------------------------------------------------------------------------------------------------------
-- An owner (or a reviewer) adds an officer from the same campus. The person is told.
create or replace function public.add_org_member(org uuid, member uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs;
begin
  select * into o from public.campus_orgs where id = org;
  if o.id is null then raise exception 'That organization does not exist.'; end if;
  if not (public.is_org_owner(org) or public.can_review_events()) then raise exception 'Only the owner can add people.' using errcode = '42501'; end if;
  if not exists (select 1 from public.campus_memberships c where c.user_id = member and c.campus_key = o.campus_key) then raise exception 'That person is not on your campus.'; end if;
  insert into public.campus_org_members (org_id, user_id, role) values (org, member, 'officer') on conflict do nothing;
  if member <> auth.uid() then
    insert into public.notifications (recipient_id, actor_id, kind, body) values (member, auth.uid(), 'event', left('You were added to ' || o.name || ' as an officer', 200));
  end if;
end $$;
revoke all on function public.add_org_member(uuid, uuid) from public;
grant execute on function public.add_org_member(uuid, uuid) to authenticated;

-- An owner removes an officer, or anyone leaves. The last owner cannot leave.
create or replace function public.remove_org_member(org uuid, member uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare r text;
begin
  if member <> auth.uid() and not (public.is_org_owner(org) or public.can_review_events()) then raise exception 'Only the owner can remove people.' using errcode = '42501'; end if;
  select role into r from public.campus_org_members where org_id = org and user_id = member;
  if r = 'owner' and (select count(*) from public.campus_org_members where org_id = org and role = 'owner') <= 1 then raise exception 'An organization needs an owner. Add another owner first, or ask a coordinator.'; end if;
  delete from public.campus_org_members where org_id = org and user_id = member;
end $$;
revoke all on function public.remove_org_member(uuid, uuid) from public;
grant execute on function public.remove_org_member(uuid, uuid) to authenticated;

-- 3. Events can be posted as an organization, and can be removed -------------------------------------------------------------------------
alter table public.campus_events add column if not exists org_id uuid references public.campus_orgs(id) on delete set null;
alter table public.campus_events drop constraint if exists campus_events_status_check;
alter table public.campus_events add constraint campus_events_status_check check (status in ('pending', 'published', 'rejected', 'removed'));

drop policy if exists "campus events host create" on public.campus_events;
create policy "campus events host create" on public.campus_events for insert to authenticated
with check (
  host_id = auth.uid() and campus_key = public.my_campus_key()
  and (
    exists (select 1 from public.campus_hosts h where h.user_id = auth.uid() and h.campus_key = campus_events.campus_key)
    or (org_id is not null and public.is_org_member(org_id))
  )
);

-- On insert: an event posted as an organization takes the organization's name and kind and goes live (an active organization is trusted). Otherwise the
-- host's own role decides, as before.
create or replace function public.campus_event_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare lbl text; r text; o public.campus_orgs;
begin
  if new.org_id is not null then
    select * into o from public.campus_orgs where id = new.org_id;
    if o.id is null or o.campus_key <> new.campus_key or o.status <> 'active' then raise exception 'This organization cannot post events right now.' using errcode = '42501'; end if;
    if not exists (select 1 from public.campus_org_members m where m.org_id = o.id and m.user_id = new.host_id) then raise exception 'You are not an officer of this organization.' using errcode = '42501'; end if;
    new.host_label := o.name; new.kind := o.kind; new.status := 'published';
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

-- On update: reviewers can also remove a published event and bring it back. An organization's events are not sent back for approval when edited.
create or replace function public.campus_event_before_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare reviewer boolean; is_host boolean; content_changed boolean;
begin
  if auth.uid() is null then return new; end if;
  reviewer := public.can_review_events();
  is_host := old.host_id = auth.uid();
  new.host_id := old.host_id; new.host_label := old.host_label; new.campus_key := old.campus_key; new.kind := old.kind; new.org_id := old.org_id;
  new.created_at := old.created_at;
  content_changed := (new.title, new.description, new.place_name, new.starts_at, new.ends_at) is distinct from (old.title, old.description, old.place_name, old.starts_at, old.ends_at);

  if new.status is distinct from old.status then
    if not reviewer then raise exception 'Only a reviewer can approve, decline or remove events.' using errcode = '42501'; end if;
    if (old.status = 'pending' and new.status in ('published', 'rejected')) or (old.status = 'published' and new.status = 'removed') or (old.status = 'removed' and new.status = 'published') then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    else
      raise exception 'That status change is not allowed.' using errcode = '42501';
    end if;
  else
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.review_note := old.review_note;
    if content_changed and old.kind = 'student' and old.status = 'published' and old.org_id is null then new.status := 'pending'; end if;
  end if;

  if not is_host and (content_changed or new.canceled_at is distinct from old.canceled_at) then
    raise exception 'Only the host can change an event.' using errcode = '42501';
  end if;
  return new;
end $$;

-- 4. Reports ---------------------------------------------------------------------------------------------------------------------------------
create table if not exists public.campus_event_reports (
  event_id uuid not null references public.campus_events(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (event_id, reporter_id)
);
alter table public.campus_event_reports enable row level security;
drop policy if exists "event reports read" on public.campus_event_reports;
create policy "event reports read" on public.campus_event_reports for select to authenticated using (public.can_review_events());
drop policy if exists "event reports create" on public.campus_event_reports;
create policy "event reports create" on public.campus_event_reports for insert to authenticated
with check (reporter_id = auth.uid() and exists (select 1 from public.campus_events e where e.id = event_id and e.campus_key = public.my_campus_key()));
drop policy if exists "event reports clear" on public.campus_event_reports;
create policy "event reports clear" on public.campus_event_reports for delete to authenticated using (public.can_review_events());

create or replace function public.campus_event_report_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
declare e public.campus_events;
begin
  select * into e from public.campus_events where id = new.event_id;
  if (select count(*) from public.campus_event_reports where event_id = new.event_id) = 1 then
    insert into public.notifications (recipient_id, actor_id, kind, body)
    select h.user_id, new.reporter_id, 'event', left('Event reported: ' || e.title, 200)
    from public.campus_hosts h where h.campus_key = e.campus_key and h.role in ('coordinator', 'staff');
  end if;
  return null;
end $$;
drop trigger if exists campus_event_report_notify on public.campus_event_reports;
create trigger campus_event_report_notify after insert on public.campus_event_reports for each row execute function public.campus_event_report_notify();

-- 5. Live updates ------------------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['campus_orgs', 'campus_org_members'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
