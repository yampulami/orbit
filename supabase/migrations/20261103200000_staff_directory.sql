-- Coordinators and staff without anyone making them by hand.
-- A campus's public faculty and staff directory is read (supabase/functions/sync-staff-directory), every title is scored, and the people at the top of
-- the offices that run student life are listed with a role. A signed-in person whose email address is VERIFIED (they clicked the sign-up link) and is
-- on that list is given the role, with their real title as their label. People who leave the directory lose it again. Access given by hand is never touched.
-- (Builds on 20261027100000_campus_events.sql, where campus_hosts is defined.)

-- 1. Where access came from -------------------------------------------------------------------------------------------------------------------
alter table public.campus_hosts add column if not exists source text not null default 'manual';
alter table public.campus_hosts drop constraint if exists campus_hosts_source_check;
alter table public.campus_hosts add constraint campus_hosts_source_check check (source in ('manual', 'directory'));
alter table public.campus_hosts add column if not exists directory_email text;

-- 2. A campus's directory, and who it says should have access ---------------------------------------------------------------------------------
create table if not exists public.campus_directory_sources (
  campus_key text primary key,
  url text not null check (char_length(url) <= 400 and url ~* '^https://[^/@ ]+\.[^/@ ]+'),
  domains text[] not null check (cardinality(domains) between 1 and 5),     -- email domains that count, for example {caldwell.edu}
  offices text[] not null check (cardinality(offices) between 1 and 10),    -- words that mark the offices that run student life, for example {"student life","student engagement"}
  max_coordinators integer not null default 2 check (max_coordinators between 1 and 5),
  max_staff integer not null default 5 check (max_staff between 0 and 20),
  people_count integer not null default 0,
  synced_at timestamptz,
  note text check (note is null or char_length(note) <= 300)
);
alter table public.campus_directory_sources enable row level security;   -- no policies: only the sync function and the project owner see this

create table if not exists public.campus_directory_access (
  campus_key text not null,
  email text not null,
  name text not null,
  title text not null,
  department text not null default '',
  role text not null check (role in ('coordinator', 'staff')),
  score integer not null,
  primary key (campus_key, email)
);
alter table public.campus_directory_access enable row level security;    -- no policies

-- 3. Giving the roles out ----------------------------------------------------------------------------------------------------------------------
-- For every signed-in person (or just one) on a campus whose confirmed email is on the list: make or update their host row. Never overwrites a row
-- made by hand. Run by the sync function (service key) and by claim_staff_access below.
create or replace function public.grant_directory_access(ck text, only_uid uuid default null)
returns integer language plpgsql security definer set search_path = public
as $$
declare r record; n integer := 0; had text;
begin
  for r in
    select u.id as uid, a.role, a.title, a.email
    from public.campus_directory_access a
    join auth.users u on lower(u.email) = lower(a.email) and u.email_confirmed_at is not null
    join public.campus_memberships m on m.user_id = u.id and m.campus_key = a.campus_key
    where a.campus_key = ck and (only_uid is null or u.id = only_uid)
  loop
    select h.source into had from public.campus_hosts h where h.user_id = r.uid;
    if had = 'manual' then continue; end if;
    insert into public.campus_hosts (user_id, campus_key, label, role, source, directory_email)
    values (r.uid, ck, left(r.title, 80), r.role, 'directory', lower(r.email))
    on conflict (user_id) do update set label = excluded.label, role = excluded.role, directory_email = excluded.directory_email
      where public.campus_hosts.source = 'directory';
    if had is null then
      insert into public.notifications (recipient_id, actor_id, kind, body)
      values (r.uid, r.uid, 'event', left('You now have ' || r.role || ' access for your campus, from the school directory (' || r.title || ')', 200));
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.grant_directory_access(text, uuid) from public;
revoke all on function public.grant_directory_access(text, uuid) from authenticated;
grant execute on function public.grant_directory_access(text, uuid) to service_role;

-- Called by the app after sign-in: gives the signed-in person their role if the directory lists their verified email. Returns the role they now hold, or null.
create or replace function public.claim_staff_access()
returns text language plpgsql security definer set search_path = public
as $$
declare ck text; r text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select campus_key into ck from public.campus_memberships where user_id = auth.uid();
  if ck is null then return null; end if;
  perform public.grant_directory_access(ck, auth.uid());
  select role into r from public.campus_hosts where user_id = auth.uid();
  return r;
end $$;
revoke all on function public.claim_staff_access() from public;
grant execute on function public.claim_staff_access() to authenticated;

-- 4. Caldwell University ------------------------------------------------------------------------------------------------------------------------
insert into public.campus_directory_sources (campus_key, url, domains, offices)
values ('caldwell-university', 'https://www.caldwell.edu/faculty-staff-directory/', array['caldwell.edu'], array['student life', 'student engagement', 'student affairs', 'dean of students'])
on conflict (campus_key) do nothing;
