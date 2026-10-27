-- Event check-in with a rotating code. The host (or an officer who can create events for the host or a co-host club) shows a QR code that changes every
-- 30 seconds; a student scans it, or types the six letters under it, while the event is on. The check-in is saved against the student's account, officers
-- see who came, and students keep a private record of what they attended. Officers can also check someone in by hand (for accessibility or a dead phone).
-- The secret that makes the codes is stored where no screen can read it; only the functions below can use it.
-- (Builds on 20261028220000_club_tasks.sql.)

create table if not exists public.campus_event_checkin_keys (
  event_id uuid primary key references public.campus_events(id) on delete cascade,
  secret text not null
);
alter table public.campus_event_checkin_keys enable row level security;
-- (no policies at all: nobody can read or write the secret directly)

create table if not exists public.campus_event_checkins (
  event_id uuid not null references public.campus_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null default 'qr' check (method in ('qr', 'manual')),
  by_user uuid references auth.users(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists campus_event_checkins_user_idx on public.campus_event_checkins (user_id, checked_in_at desc);
alter table public.campus_event_checkins enable row level security;

-- May I run this event's check-in? The host, an officer allowed to create events for the host club or an accepted co-host club, or a coordinator.
create or replace function public.can_manage_event(event uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.campus_events e
    where e.id = event and e.campus_key = public.my_campus_key()
      and (
        e.host_id = auth.uid()
        or (e.org_id is not null and public.has_org_perm(e.org_id, 'events'))
        or exists (select 1 from public.campus_event_cohosts c where c.event_id = e.id and c.status = 'accepted' and public.has_org_perm(c.org_id, 'events'))
        or public.can_review_events()
      )
  )
$$;
revoke all on function public.can_manage_event(uuid) from public;
grant execute on function public.can_manage_event(uuid) to authenticated;

-- Everyone sees their own check-ins; the people who run the event see everyone's.
drop policy if exists "checkins read" on public.campus_event_checkins;
create policy "checkins read" on public.campus_event_checkins for select to authenticated using (user_id = auth.uid() or public.can_manage_event(event_id));
-- (check-ins are made and removed through the functions below)

-- The code for one 30-second slot. Internal.
create or replace function public.checkin_code_for(event uuid, slot bigint)
returns text language sql stable security definer set search_path = public
as $$ select upper(substr(md5(k.secret || ':' || slot::text), 1, 6)) from public.campus_event_checkin_keys k where k.event_id = event $$;
revoke all on function public.checkin_code_for(uuid, bigint) from public;

create or replace function public.get_checkin_code(event uuid)
returns table (code text, seconds_left integer)
language plpgsql security definer set search_path = public
as $$
declare slot bigint := floor(extract(epoch from now()) / 30);
begin
  if not public.can_manage_event(event) then raise exception 'Only the people running this event can show the check-in code.' using errcode = '42501'; end if;
  insert into public.campus_event_checkin_keys (event_id, secret) values (event, gen_random_uuid()::text || gen_random_uuid()::text) on conflict (event_id) do nothing;
  return query select public.checkin_code_for(event, slot), (30 - (extract(epoch from now())::bigint % 30))::integer;
end $$;

-- A student checks in with the code. It works from an hour before the event until an hour after it ends (three hours after the start if it has no end time).
create or replace function public.check_in(event uuid, code text)
returns text language plpgsql security definer set search_path = public
as $$
declare e public.campus_events; slot bigint := floor(extract(epoch from now()) / 30); given text := upper(trim(coalesce(code, '')));
begin
  select * into e from public.campus_events where id = event;
  if e.id is null or e.campus_key <> public.my_campus_key() or e.status <> 'published' or e.canceled_at is not null then raise exception 'That event is not open for check-in.' using errcode = '42501'; end if;
  if now() < e.starts_at - interval '1 hour' or now() > coalesce(e.ends_at, e.starts_at + interval '3 hours') + interval '1 hour' then raise exception 'Check-in is not open for this event right now.'; end if;
  if given = '' or given not in (coalesce(public.checkin_code_for(event, slot), ''), coalesce(public.checkin_code_for(event, slot - 1), '')) then
    raise exception 'That code did not match. Scan the code on screen again.';
  end if;
  insert into public.campus_event_checkins (event_id, user_id, method) values (event, auth.uid(), 'qr') on conflict (event_id, user_id) do nothing;
  return 'checked_in';
end $$;

create or replace function public.manual_check_in(event uuid, member uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare e public.campus_events;
begin
  if not public.can_manage_event(event) then raise exception 'Only the people running this event can check someone in.' using errcode = '42501'; end if;
  select * into e from public.campus_events where id = event;
  if not exists (select 1 from public.campus_memberships c where c.user_id = member and c.campus_key = e.campus_key) then raise exception 'That person is not on your campus.'; end if;
  insert into public.campus_event_checkins (event_id, user_id, method, by_user) values (event, member, 'manual', auth.uid()) on conflict (event_id, user_id) do nothing;
end $$;

create or replace function public.remove_check_in(event uuid, member uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not (member = auth.uid() or public.can_manage_event(event)) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  delete from public.campus_event_checkins where event_id = event and user_id = member;
end $$;
revoke all on function public.get_checkin_code(uuid) from public;
revoke all on function public.check_in(uuid, text) from public;
revoke all on function public.manual_check_in(uuid, uuid) from public;
revoke all on function public.remove_check_in(uuid, uuid) from public;
grant execute on function public.get_checkin_code(uuid) to authenticated;
grant execute on function public.check_in(uuid, text) to authenticated;
grant execute on function public.manual_check_in(uuid, uuid) to authenticated;
grant execute on function public.remove_check_in(uuid, uuid) to authenticated;

do $$
begin
  execute 'alter publication supabase_realtime add table public.campus_event_checkins';
exception when duplicate_object then null;
end $$;
