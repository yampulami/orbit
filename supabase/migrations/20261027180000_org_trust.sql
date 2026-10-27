-- Clubs are set up first, and their events wait for approval until a coordinator decides to trust the club.
--   - A student club's new events wait as "pending" (a coordinator approves each one) unless the club is marked trusted.
--   - A trusted club's events, and a staff-run (official) organization's events, go live at once.
--   - A coordinator can switch trust on or off for a club at any time.
--   - Officers can see all of their club's events, including ones that are still waiting.
-- (Builds on 20261027140000_campus_orgs.sql.)

alter table public.campus_orgs add column if not exists trusted boolean not null default false;

-- Officers see their own club's events even while they wait (and after a removal).
drop policy if exists "campus events read" on public.campus_events;
create policy "campus events read" on public.campus_events for select to authenticated
using (
  campus_key = public.my_campus_key()
  and (
    (status = 'published' and not public.is_blocked(auth.uid(), host_id))
    or host_id = auth.uid()
    or public.can_review_events()
    or (org_id is not null and public.is_org_member(org_id))
  )
);

-- Only reviewers change an organization's status or trust. (Owners can still change the description.)
create or replace function public.campus_org_before_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare reviewer boolean;
begin
  if auth.uid() is null then return new; end if;
  reviewer := public.can_review_events();
  new.campus_key := old.campus_key; new.created_by := old.created_by; new.created_at := old.created_at;
  if not reviewer then
    new.name := old.name; new.kind := old.kind; new.status := old.status; new.trusted := old.trusted;
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

-- A new organization created by a coordinator or staff host is active at once; trust is only ever set by a reviewer afterwards.
create or replace function public.campus_org_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.trusted := false;
  if auth.uid() is not null and public.can_review_events() then
    new.status := 'active'; new.kind := coalesce(new.kind, 'student'); new.reviewed_by := auth.uid(); new.reviewed_at := now();
    if new.kind = 'official' then new.trusted := true; end if;
  else
    new.status := 'pending'; new.kind := 'student'; new.reviewed_by := null; new.reviewed_at := null;
    if (select count(*) from public.campus_orgs where created_by = new.created_by and created_at > now() - interval '1 day') >= 3 then
      raise exception 'That is a lot of requests for one day. Try again tomorrow.' using errcode = 'P0001';
    end if;
  end if;
  new.review_note := null;
  return new;
end $$;

-- Events posted as an organization: official and trusted ones go live; the rest wait for approval.
create or replace function public.campus_event_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare lbl text; r text; o public.campus_orgs;
begin
  if new.org_id is not null then
    select * into o from public.campus_orgs where id = new.org_id;
    if o.id is null or o.campus_key <> new.campus_key or o.status <> 'active' then raise exception 'This club cannot post events right now.' using errcode = '42501'; end if;
    if not exists (select 1 from public.campus_org_members m where m.org_id = o.id and m.user_id = new.host_id) then raise exception 'You are not an officer of this club.' using errcode = '42501'; end if;
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

-- A host who edits a published student event sends it back for approval, unless it belongs to a trusted club or an official organization.
create or replace function public.campus_event_before_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare reviewer boolean; is_host boolean; content_changed boolean; trusted_org boolean := false;
begin
  if auth.uid() is null then return new; end if;
  reviewer := public.can_review_events();
  is_host := old.host_id = auth.uid();
  new.host_id := old.host_id; new.host_label := old.host_label; new.campus_key := old.campus_key; new.kind := old.kind; new.org_id := old.org_id;
  new.created_at := old.created_at;
  content_changed := (new.title, new.description, new.place_name, new.starts_at, new.ends_at) is distinct from (old.title, old.description, old.place_name, old.starts_at, old.ends_at);
  if old.org_id is not null then select (kind = 'official' or trusted) into trusted_org from public.campus_orgs where id = old.org_id; end if;

  if new.status is distinct from old.status then
    if not reviewer then raise exception 'Only a reviewer can approve, decline or remove events.' using errcode = '42501'; end if;
    if (old.status = 'pending' and new.status in ('published', 'rejected')) or (old.status = 'published' and new.status = 'removed') or (old.status = 'removed' and new.status = 'published') then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    else
      raise exception 'That status change is not allowed.' using errcode = '42501';
    end if;
  else
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.review_note := old.review_note;
    if content_changed and old.kind = 'student' and old.status = 'published' and not coalesce(trusted_org, false) then new.status := 'pending'; end if;
  end if;

  if not is_host and (content_changed or new.canceled_at is distinct from old.canceled_at) then
    raise exception 'Only the host can change an event.' using errcode = '42501';
  end if;
  return new;
end $$;
