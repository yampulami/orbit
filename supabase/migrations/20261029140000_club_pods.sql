-- Pods: small interest groups inside a club (a photography club might have Portrait, Film and Street pods). A pod has its own members and its own private chat
-- channel, without being a separately registered club. Anyone in the club can join a pod at once; the pod's chat is read by its members and by the club's team.
-- The people who manage channels (and the president) create and delete pods.
-- (Builds on 20261029100000_event_checkin.sql.)

create table if not exists public.campus_club_pods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.campus_orgs(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  description text not null default '' check (char_length(description) <= 160),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists campus_club_pods_name_idx on public.campus_club_pods (org_id, lower(name));
alter table public.campus_club_pods enable row level security;

create table if not exists public.campus_club_pod_members (
  pod_id uuid not null references public.campus_club_pods(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pod_id, user_id)
);
alter table public.campus_club_pod_members enable row level security;

alter table public.campus_club_channels add column if not exists pod_id uuid references public.campus_club_pods(id) on delete cascade;

drop policy if exists "pods read" on public.campus_club_pods;
create policy "pods read" on public.campus_club_pods for select to authenticated using (public.club_open(org_id) and public.is_club_member(org_id));
drop policy if exists "pod members read" on public.campus_club_pod_members;
create policy "pod members read" on public.campus_club_pod_members for select to authenticated using (exists (select 1 from public.campus_club_pods p where p.id = pod_id));
-- (pods and their members change through the functions below)

-- A pod's channel is read by the pod's members and the club's team; other channels work as before.
create or replace function public.can_read_channel(ch uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.campus_club_channels c join public.campus_orgs o on o.id = c.org_id
    where c.id = ch and o.campus_key = public.my_campus_key() and o.status = 'active'
      and (case
        when c.pod_id is not null then (public.is_org_member(o.id) or exists (select 1 from public.campus_club_pod_members pm where pm.pod_id = c.pod_id and pm.user_id = auth.uid()))
        when c.team_only then public.is_org_member(o.id)
        else public.is_club_member(o.id)
      end)
  )
$$;

create or replace function public.create_pod(org uuid, pod_name text, about text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare nm text := trim(coalesce(pod_name, '')); slug text; pid uuid;
begin
  if not (public.club_open(org) and (public.is_org_owner(org) or public.has_org_perm(org, 'channels'))) then raise exception 'Your role in this club does not include managing pods.' using errcode = '42501'; end if;
  if char_length(nm) not between 1 and 40 then raise exception 'Give the pod a name (up to 40 characters).'; end if;
  slug := left(regexp_replace(regexp_replace(lower(nm), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'), 24);
  if slug = '' then raise exception 'Give the pod a name with letters or numbers.'; end if;
  if (select count(*) from public.campus_club_pods where org_id = org) >= 10 then raise exception 'A club can have up to 10 pods.'; end if;
  if (select count(*) from public.campus_club_channels where org_id = org) >= 12 then raise exception 'This club has reached its limit of channels. Delete one first.'; end if;
  insert into public.campus_club_pods (org_id, name, description, created_by) values (org, nm, left(trim(coalesce(about, '')), 160), auth.uid()) returning id into pid;
  insert into public.campus_club_channels (org_id, name, description, pod_id, position, created_by)
  values (org, 'pod-' || slug, left(trim(coalesce(about, '')), 120), pid, (select coalesce(max(position), 0) + 1 from public.campus_club_channels where org_id = org), auth.uid());
  insert into public.campus_club_pod_members (pod_id, user_id) values (pid, auth.uid()) on conflict do nothing;
  return pid;
exception when unique_violation then raise exception 'There is already a pod with that name.';
end $$;

create or replace function public.join_pod(pod uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.campus_club_pods;
begin
  select * into p from public.campus_club_pods where id = pod;
  if p.id is null or not (public.club_open(p.org_id) and public.is_club_member(p.org_id)) then raise exception 'Join the club to join its pods.' using errcode = '42501'; end if;
  insert into public.campus_club_pod_members (pod_id, user_id) values (pod, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.leave_pod(pod uuid)
returns void language sql security definer set search_path = public
as $$ delete from public.campus_club_pod_members where pod_id = pod and user_id = auth.uid() $$;

create or replace function public.delete_pod(pod uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.campus_club_pods;
begin
  select * into p from public.campus_club_pods where id = pod;
  if p.id is null then return; end if;
  if not (public.is_org_owner(p.org_id) or public.has_org_perm(p.org_id, 'channels')) then raise exception 'Your role in this club does not include managing pods.' using errcode = '42501'; end if;
  delete from public.campus_club_pods where id = pod;
end $$;

-- A pod's channel goes with its pod: it is deleted by deleting the pod.
create or replace function public.delete_channel(ch uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare c public.campus_club_channels;
begin
  select * into c from public.campus_club_channels where id = ch;
  if c.id is null then return; end if;
  if c.is_default then raise exception 'The general channel stays.'; end if;
  if c.pod_id is not null then raise exception 'This is a pod channel. Delete the pod to remove it.'; end if;
  if not (public.is_org_owner(c.org_id) or public.has_org_perm(c.org_id, 'channels')) then raise exception 'Your role in this club does not include managing channels.' using errcode = '42501'; end if;
  delete from public.campus_club_channels where id = ch;
end $$;

revoke all on function public.create_pod(uuid, text, text) from public;
revoke all on function public.join_pod(uuid) from public;
revoke all on function public.leave_pod(uuid) from public;
revoke all on function public.delete_pod(uuid) from public;
grant execute on function public.create_pod(uuid, text, text) to authenticated;
grant execute on function public.join_pod(uuid) to authenticated;
grant execute on function public.leave_pod(uuid) to authenticated;
grant execute on function public.delete_pod(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['campus_club_pods', 'campus_club_pod_members'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
