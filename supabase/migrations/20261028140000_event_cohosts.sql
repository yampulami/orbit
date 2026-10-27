-- Co-hosted events: a club invites other clubs to co-host an event. The other club's team (people whose role includes creating events) accepts or
-- declines. An accepted co-host shows on the event ("Robotics Club and Design Club") and on its own club page, and its members can see the event.
-- Circles cannot be invited (they do not post campus events). Moderation stays with the host: approval and removal apply to the one shared event.
-- (Builds on 20261028100000_club_roles_feed.sql.)

create table if not exists public.campus_event_cohosts (
  event_id uuid not null references public.campus_events(id) on delete cascade,
  org_id uuid not null references public.campus_orgs(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (event_id, org_id)
);
alter table public.campus_event_cohosts enable row level security;
drop policy if exists "cohosts read" on public.campus_event_cohosts;
create policy "cohosts read" on public.campus_event_cohosts for select to authenticated
using (exists (select 1 from public.campus_orgs o where o.id = org_id and o.campus_key = public.my_campus_key()));
-- (no insert, update or delete policy: invitations go through the functions below)

-- Members of a club that was invited (or accepted) can see the event even while it waits for approval.
drop policy if exists "campus events read" on public.campus_events;
create policy "campus events read" on public.campus_events for select to authenticated
using (
  campus_key = public.my_campus_key()
  and (
    (status = 'published' and not public.is_blocked(auth.uid(), host_id))
    or host_id = auth.uid()
    or public.can_review_events()
    or (org_id is not null and public.is_org_member(org_id))
    or exists (select 1 from public.campus_event_cohosts c where c.event_id = campus_events.id and c.status <> 'declined' and public.is_org_member(c.org_id))
  )
);

create or replace function public.invite_cohost(event uuid, org uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare e public.campus_events; o public.campus_orgs; host_name text;
begin
  select * into e from public.campus_events where id = event;
  if e.id is null or e.campus_key <> public.my_campus_key() then raise exception 'That event does not exist.' using errcode = '42501'; end if;
  if not (e.host_id = auth.uid() or (e.org_id is not null and public.has_org_perm(e.org_id, 'events'))) then raise exception 'Only the host can invite co-hosts.' using errcode = '42501'; end if;
  if e.canceled_at is not null then raise exception 'That event was cancelled.'; end if;
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> e.campus_key or o.status <> 'active' then raise exception 'That club cannot co-host right now.'; end if;
  if o.kind = 'circle' then raise exception 'Student circles cannot co-host campus events.'; end if;
  if o.id is not distinct from e.org_id then raise exception 'That club is already the host.'; end if;
  if (select count(*) from public.campus_event_cohosts where event_id = event) >= 3 and not exists (select 1 from public.campus_event_cohosts where event_id = event and org_id = org) then
    raise exception 'An event can have up to three co-hosts.';
  end if;
  insert into public.campus_event_cohosts (event_id, org_id, status, invited_by) values (event, org, 'pending', auth.uid())
  on conflict (event_id, org_id) do update set status = 'pending', invited_by = auth.uid(), decided_at = null where public.campus_event_cohosts.status = 'declined';
  if found then
    host_name := coalesce((select name from public.campus_orgs where id = e.org_id), e.host_label);
    insert into public.notifications (recipient_id, actor_id, kind, body)
    select m.user_id, auth.uid(), 'event', left('Co-host invitation: ' || host_name || ' invites ' || o.name || ' to co-host ' || e.title, 200)
    from public.campus_org_members m where m.org_id = org and ('events' = any (public.org_perms(org, m.user_id)));
  end if;
end $$;

create or replace function public.answer_cohost(event uuid, org uuid, accept boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare e public.campus_events; o public.campus_orgs;
begin
  if not public.has_org_perm(org, 'events') then raise exception 'Only people who create events for this club can answer.' using errcode = '42501'; end if;
  select * into e from public.campus_events where id = event;
  select * into o from public.campus_orgs where id = org;
  if e.id is null or o.id is null or e.campus_key <> public.my_campus_key() then raise exception 'Not found.' using errcode = '42501'; end if;
  update public.campus_event_cohosts set status = case when accept then 'accepted' else 'declined' end, decided_at = now()
  where event_id = event and org_id = org and status = 'pending';
  if found then
    insert into public.notifications (recipient_id, actor_id, kind, body)
    values (e.host_id, auth.uid(), 'event', left(o.name || case when accept then ' will co-host ' else ' declined to co-host ' end || e.title, 200));
  end if;
end $$;

create or replace function public.remove_cohost(event uuid, org uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare e public.campus_events;
begin
  select * into e from public.campus_events where id = event;
  if e.id is null or e.campus_key <> public.my_campus_key() then raise exception 'Not found.' using errcode = '42501'; end if;
  if not (e.host_id = auth.uid() or (e.org_id is not null and public.has_org_perm(e.org_id, 'events')) or public.has_org_perm(org, 'events')) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  delete from public.campus_event_cohosts where event_id = event and org_id = org;
end $$;
revoke all on function public.invite_cohost(uuid, uuid) from public;
revoke all on function public.answer_cohost(uuid, uuid, boolean) from public;
revoke all on function public.remove_cohost(uuid, uuid) from public;
grant execute on function public.invite_cohost(uuid, uuid) to authenticated;
grant execute on function public.answer_cohost(uuid, uuid, boolean) to authenticated;
grant execute on function public.remove_cohost(uuid, uuid) to authenticated;

do $$
begin
  execute 'alter publication supabase_realtime add table public.campus_event_cohosts';
exception when duplicate_object then null;
end $$;
