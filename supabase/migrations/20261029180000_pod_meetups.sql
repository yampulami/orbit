-- Pod meetups: a member of a pod plans a small get-together (a photo walk, a study session) and the rest of the pod says "I'm in". Meetups are only for the pod's
-- members and the club's team. Planning one notifies the pod. The person who planned it (or someone who moderates the club) can cancel it.
-- (Builds on 20261029140000_club_pods.sql.)

create table if not exists public.campus_club_pod_meetups (
  id uuid primary key default gen_random_uuid(),
  pod_id uuid not null references public.campus_club_pods(id) on delete cascade,
  org_id uuid not null references public.campus_orgs(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  details text not null default '' check (char_length(details) <= 300),
  place text not null default '' check (char_length(place) <= 120),
  starts_at timestamptz not null,
  canceled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists campus_club_pod_meetups_idx on public.campus_club_pod_meetups (pod_id, starts_at);
alter table public.campus_club_pod_meetups enable row level security;

create table if not exists public.campus_club_pod_meetup_rsvps (
  meetup_id uuid not null references public.campus_club_pod_meetups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
alter table public.campus_club_pod_meetup_rsvps enable row level security;

create or replace function public.can_see_pod(pod uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.campus_club_pods p join public.campus_orgs o on o.id = p.org_id
    where p.id = pod and o.campus_key = public.my_campus_key() and o.status = 'active'
      and (public.is_org_member(o.id) or exists (select 1 from public.campus_club_pod_members pm where pm.pod_id = p.id and pm.user_id = auth.uid()))
  )
$$;
revoke all on function public.can_see_pod(uuid) from public;
grant execute on function public.can_see_pod(uuid) to authenticated;

drop policy if exists "pod meetups read" on public.campus_club_pod_meetups;
create policy "pod meetups read" on public.campus_club_pod_meetups for select to authenticated using (public.can_see_pod(pod_id));
drop policy if exists "pod rsvps read" on public.campus_club_pod_meetup_rsvps;
create policy "pod rsvps read" on public.campus_club_pod_meetup_rsvps for select to authenticated using (exists (select 1 from public.campus_club_pod_meetups m where m.id = meetup_id));
-- (meetups and answers change through the functions below)

create or replace function public.create_pod_meetup(pod uuid, meetup_title text, about text, where_at text, starts timestamptz)
returns uuid language plpgsql security definer set search_path = public
as $$
declare p public.campus_club_pods; mid uuid; t text := trim(coalesce(meetup_title, ''));
begin
  select * into p from public.campus_club_pods where id = pod;
  if p.id is null or not public.can_see_pod(pod) or not exists (select 1 from public.campus_club_pod_members pm where pm.pod_id = pod and pm.user_id = auth.uid()) then
    raise exception 'Join the pod to plan a meetup.' using errcode = '42501';
  end if;
  if char_length(t) not between 1 and 80 then raise exception 'Give the meetup a title (up to 80 characters).'; end if;
  if starts < now() - interval '5 minutes' then raise exception 'That time has already passed.'; end if;
  if starts > now() + interval '1 year' then raise exception 'Pick a date within the next year.'; end if;
  if (select count(*) from public.campus_club_pod_meetups where created_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then raise exception 'That is a lot of meetups for one day. Try again tomorrow.' using errcode = 'P0001'; end if;
  insert into public.campus_club_pod_meetups (pod_id, org_id, title, details, place, starts_at, created_by)
  values (pod, p.org_id, t, left(trim(coalesce(about, '')), 300), left(trim(coalesce(where_at, '')), 120), starts, auth.uid()) returning id into mid;
  insert into public.campus_club_pod_meetup_rsvps (meetup_id, user_id) values (mid, auth.uid()) on conflict do nothing;
  insert into public.notifications (recipient_id, actor_id, kind, body)
  select pm.user_id, auth.uid(), 'event', left('New meetup in ' || p.name || ': ' || t, 200) from public.campus_club_pod_members pm where pm.pod_id = pod and pm.user_id <> auth.uid();
  return mid;
end $$;

create or replace function public.rsvp_pod_meetup(meetup uuid, going boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare m public.campus_club_pod_meetups;
begin
  select * into m from public.campus_club_pod_meetups where id = meetup;
  if m.id is null or not exists (select 1 from public.campus_club_pod_members pm where pm.pod_id = m.pod_id and pm.user_id = auth.uid()) then raise exception 'Join the pod to answer.' using errcode = '42501'; end if;
  if m.canceled_at is not null then raise exception 'That meetup was cancelled.'; end if;
  if going then insert into public.campus_club_pod_meetup_rsvps (meetup_id, user_id) values (meetup, auth.uid()) on conflict do nothing;
  else delete from public.campus_club_pod_meetup_rsvps where meetup_id = meetup and user_id = auth.uid(); end if;
end $$;

create or replace function public.cancel_pod_meetup(meetup uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare m public.campus_club_pod_meetups; p public.campus_club_pods;
begin
  select * into m from public.campus_club_pod_meetups where id = meetup;
  if m.id is null then return; end if;
  if not (m.created_by = auth.uid() or public.has_org_perm(m.org_id, 'moderate')) then raise exception 'Only the person who planned it can cancel.' using errcode = '42501'; end if;
  update public.campus_club_pod_meetups set canceled_at = now() where id = meetup and canceled_at is null;
  if found then
    select * into p from public.campus_club_pods where id = m.pod_id;
    insert into public.notifications (recipient_id, actor_id, kind, body)
    select r.user_id, auth.uid(), 'event', left('Cancelled in ' || p.name || ': ' || m.title, 200) from public.campus_club_pod_meetup_rsvps r where r.meetup_id = meetup and r.user_id <> auth.uid();
  end if;
end $$;
revoke all on function public.create_pod_meetup(uuid, text, text, text, timestamptz) from public;
revoke all on function public.rsvp_pod_meetup(uuid, boolean) from public;
revoke all on function public.cancel_pod_meetup(uuid) from public;
grant execute on function public.create_pod_meetup(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.rsvp_pod_meetup(uuid, boolean) to authenticated;
grant execute on function public.cancel_pod_meetup(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['campus_club_pod_meetups', 'campus_club_pod_meetup_rsvps'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
