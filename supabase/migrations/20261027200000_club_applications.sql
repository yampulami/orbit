-- A club is an APPLICATION that a coordinator reviews, and joining a club needs an officer's approval.
--   - New clubs ask for details (purpose, category, adviser, where and when they meet, how many people, a first event idea, a contact). Students must fill them in.
--   - Joining: a student asks, the club's officers (or a coordinator) approve or decline, the student is told.
-- (Builds on 20261027180000_org_trust.sql.)

-- 1. The application details -----------------------------------------------------------------------------------------------------------------
alter table public.campus_orgs
  add column if not exists purpose text not null default '' check (char_length(purpose) <= 600),
  add column if not exists category text not null default '' check (char_length(category) <= 40),
  add column if not exists advisor_name text not null default '' check (char_length(advisor_name) <= 80),
  add column if not exists advisor_email text not null default '' check (char_length(advisor_email) <= 120),
  add column if not exists meeting text not null default '' check (char_length(meeting) <= 160),
  add column if not exists expected_members integer check (expected_members is null or expected_members between 1 and 100000),
  add column if not exists first_event text not null default '' check (char_length(first_event) <= 300),
  add column if not exists contact text not null default '' check (char_length(contact) <= 120);

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
    if char_length(trim(new.purpose)) < 30 then raise exception 'Tell the coordinator what the club is for (at least a couple of sentences).' using errcode = 'P0001'; end if;
    if char_length(trim(new.advisor_name)) < 2 or position('@' in new.advisor_email) < 2 then raise exception 'A club needs a faculty or staff adviser, with their name and email.' using errcode = 'P0001'; end if;
    if char_length(trim(new.meeting)) < 3 then raise exception 'Say where and when the club meets.' using errcode = 'P0001'; end if;
    if char_length(trim(new.contact)) < 3 then raise exception 'Add a way for the coordinator to reach you.' using errcode = 'P0001'; end if;
    if (select count(*) from public.campus_orgs where created_by = new.created_by and created_at > now() - interval '1 day') >= 3 then
      raise exception 'That is a lot of requests for one day. Try again tomorrow.' using errcode = 'P0001';
    end if;
  end if;
  new.review_note := null;
  return new;
end $$;

-- After a club is approved or declined its application stays as it was sent.
create or replace function public.campus_org_before_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare reviewer boolean;
begin
  if auth.uid() is null then return new; end if;
  reviewer := public.can_review_events();
  new.campus_key := old.campus_key; new.created_by := old.created_by; new.created_at := old.created_at;
  new.purpose := old.purpose; new.category := old.category; new.advisor_name := old.advisor_name; new.advisor_email := old.advisor_email;
  new.meeting := old.meeting; new.expected_members := old.expected_members; new.first_event := old.first_event; new.contact := old.contact;
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

-- 2. Joining a club ---------------------------------------------------------------------------------------------------------------------------
create table if not exists public.campus_club_members (
  org_id uuid not null references public.campus_orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'member', 'declined')),
  message text not null default '' check (char_length(message) <= 200),
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (org_id, user_id)
);
alter table public.campus_club_members enable row level security;

-- Members are listed to the campus; a waiting or declined request is seen only by the person, the club's officers and coordinators.
drop policy if exists "club members read" on public.campus_club_members;
create policy "club members read" on public.campus_club_members for select to authenticated
using (
  exists (select 1 from public.campus_orgs o where o.id = org_id and o.campus_key = public.my_campus_key())
  and (status = 'member' or user_id = auth.uid() or public.is_org_member(org_id) or public.can_review_events())
);
-- (no insert, update or delete policy: everything goes through the functions below)

create or replace function public.request_join_club(org uuid, msg text default '')
returns text language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs; cur text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> public.my_campus_key() or o.status <> 'active' then raise exception 'That club is not taking members right now.' using errcode = '42501'; end if;
  if exists (select 1 from public.campus_org_members m where m.org_id = org and m.user_id = auth.uid()) then return 'member'; end if;
  select status into cur from public.campus_club_members where org_id = org and user_id = auth.uid();
  if cur in ('pending', 'member') then return cur; end if;
  if (select count(*) from public.campus_club_members where user_id = auth.uid() and created_at > now() - interval '1 day' and status = 'pending') >= 10 then
    raise exception 'That is a lot of requests for one day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  insert into public.campus_club_members (org_id, user_id, status, message, created_at, decided_by, decided_at)
  values (org, auth.uid(), 'pending', left(coalesce(msg, ''), 200), now(), null, null)
  on conflict (org_id, user_id) do update set status = 'pending', message = excluded.message, created_at = now(), decided_by = null, decided_at = null;
  insert into public.notifications (recipient_id, actor_id, kind, body)
  select m.user_id, auth.uid(), 'event', left('Wants to join ' || o.name, 200) from public.campus_org_members m where m.org_id = org;
  return 'pending';
end $$;

create or replace function public.decide_join_request(org uuid, member uuid, approve boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs;
begin
  if not (public.is_org_member(org) or public.can_review_events()) then raise exception 'Only the club''s officers can answer requests.' using errcode = '42501'; end if;
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> public.my_campus_key() then raise exception 'Not found.' using errcode = '42501'; end if;
  update public.campus_club_members set status = case when approve then 'member' else 'declined' end, decided_by = auth.uid(), decided_at = now()
  where org_id = org and user_id = member and status = 'pending';
  if found then
    insert into public.notifications (recipient_id, actor_id, kind, body)
    values (member, auth.uid(), 'event', left(case when approve then 'Welcome to ' || o.name || '. Your request was approved' else 'Not approved: your request to join ' || o.name end, 200));
  end if;
end $$;

create or replace function public.leave_club(org uuid)
returns void language sql security definer set search_path = public
as $$ delete from public.campus_club_members where org_id = org and user_id = auth.uid() $$;

revoke all on function public.request_join_club(uuid, text) from public;
revoke all on function public.decide_join_request(uuid, uuid, boolean) from public;
revoke all on function public.leave_club(uuid) from public;
grant execute on function public.request_join_club(uuid, text) to authenticated;
grant execute on function public.decide_join_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.leave_club(uuid) to authenticated;

-- 3. Live updates ------------------------------------------------------------------------------------------------------------------------------
do $$
begin
  execute 'alter publication supabase_realtime add table public.campus_club_members';
exception when duplicate_object then null;
end $$;
