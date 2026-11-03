-- Any school: someone who runs student life proves it from a page on their own school's website (supabase/functions/verify-staff-claim), with no setup
-- per school. A proof that holds up gives them the role at once; one that does not can be sent to the campus's coordinators for a decision. Coordinators
-- can see their team and take access away. Every attempt is kept, so there is a record of who was given access and on what evidence.
-- (Builds on 20261103200000_staff_directory.sql.)

alter table public.campus_hosts drop constraint if exists campus_hosts_source_check;
alter table public.campus_hosts add constraint campus_hosts_source_check check (source in ('manual', 'directory', 'claim'));

create table if not exists public.staff_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campus_key text not null,
  email text not null,
  page_url text not null check (char_length(page_url) <= 400),
  claimed_title text not null default '' check (char_length(claimed_title) <= 120),
  status text not null check (status in ('approved', 'denied', 'pending', 'declined')),
  role text check (role in ('coordinator', 'staff')),
  score integer,
  reason text check (reason is null or char_length(reason) <= 300),
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists staff_claims_user_idx on public.staff_claims (user_id, created_at desc);
create index if not exists staff_claims_campus_idx on public.staff_claims (campus_key, status);
alter table public.staff_claims enable row level security;

-- A person sees their own attempts; a coordinator sees their campus's. (No insert, update or delete policy: everything goes through the functions.)
drop policy if exists "claims read" on public.staff_claims;
create policy "claims read" on public.staff_claims for select to authenticated
using (user_id = auth.uid() or exists (select 1 from public.campus_hosts h where h.user_id = auth.uid() and h.role = 'coordinator' and h.campus_key = staff_claims.campus_key));

-- Is the caller a coordinator on this campus?
create or replace function public.is_campus_coordinator(ck text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.campus_hosts h where h.user_id = auth.uid() and h.role = 'coordinator' and h.campus_key = ck) $$;
revoke all on function public.is_campus_coordinator(text) from public;
grant execute on function public.is_campus_coordinator(text) to authenticated;

-- 1. Ask the campus's coordinators to decide, when the page did not prove it on its own ------------------------------------------------------
create or replace function public.request_staff_review(page_url text, title text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare ck text; em text; confirmed timestamptz; cid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select campus_key into ck from public.campus_memberships where user_id = auth.uid();
  select email, email_confirmed_at into em, confirmed from auth.users where id = auth.uid();
  if ck is null or em is null or confirmed is null then raise exception 'Confirm your school email first.' using errcode = '42501'; end if;
  if exists (select 1 from public.campus_hosts where user_id = auth.uid()) then raise exception 'You already have staff access.'; end if;
  if exists (select 1 from public.staff_claims where user_id = auth.uid() and status = 'pending') then raise exception 'You already have a request waiting.'; end if;
  if (select count(*) from public.staff_claims where user_id = auth.uid() and created_at > now() - interval '1 day' and status in ('pending', 'denied')) >= 8 then
    raise exception 'That is a lot of tries for one day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  insert into public.staff_claims (user_id, campus_key, email, page_url, claimed_title, status, reason)
  values (auth.uid(), ck, lower(em), left(coalesce(page_url, ''), 400), left(coalesce(title, ''), 120), 'pending', 'Asked for a coordinator to decide.') returning id into cid;
  insert into public.notifications (recipient_id, actor_id, kind, body)
  select h.user_id, auth.uid(), 'event', left('Staff access request: ' || coalesce(nullif(trim(title), ''), em), 200)
  from public.campus_hosts h where h.campus_key = ck and h.role = 'coordinator';
  return cid;
end $$;

-- 2. A coordinator decides (or the project owner, from the SQL editor) --------------------------------------------------------------------------
create or replace function public.decide_staff_claim(claim uuid, approve boolean, as_role text default 'staff')
returns void language plpgsql security definer set search_path = public
as $$
declare c public.staff_claims; r text := case when as_role = 'coordinator' then 'coordinator' else 'staff' end;
begin
  select * into c from public.staff_claims where id = claim;
  if c.id is null or c.status <> 'pending' then raise exception 'That request is not waiting any more.'; end if;
  if auth.uid() is not null and not public.is_campus_coordinator(c.campus_key) then raise exception 'Only a coordinator can decide this.' using errcode = '42501'; end if;
  if approve then
    insert into public.campus_hosts (user_id, campus_key, label, role, source, directory_email)
    values (c.user_id, c.campus_key, left(coalesce(nullif(trim(c.claimed_title), ''), 'Staff'), 80), r, 'claim', c.email)
    on conflict (user_id) do update set label = excluded.label, role = excluded.role, directory_email = excluded.directory_email where public.campus_hosts.source <> 'manual';
  end if;
  update public.staff_claims set status = case when approve then 'approved' else 'declined' end, role = case when approve then r else null end, decided_by = auth.uid() where id = claim;
  insert into public.notifications (recipient_id, actor_id, kind, body)
  values (c.user_id, coalesce(auth.uid(), c.user_id), 'event', left(case when approve then 'Approved: you now have ' || r || ' access for your campus' else 'Not approved: your staff access request' end, 200));
end $$;

-- 3. A coordinator takes someone's access away. Not their own, and never the campus's last coordinator. -------------------------------------
create or replace function public.remove_staff_access(target uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare t public.campus_hosts;
begin
  select * into t from public.campus_hosts where user_id = target;
  if t.user_id is null then return; end if;
  if not public.is_campus_coordinator(t.campus_key) then raise exception 'Only a coordinator can do that.' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'You cannot remove your own access. Ask another coordinator.'; end if;
  if t.role = 'coordinator' and (select count(*) from public.campus_hosts where campus_key = t.campus_key and role = 'coordinator') <= 1 then raise exception 'A campus needs at least one coordinator.'; end if;
  delete from public.campus_hosts where user_id = target;
  insert into public.notifications (recipient_id, actor_id, kind, body) values (target, auth.uid(), 'event', 'Your staff access for this campus was removed');
end $$;

revoke all on function public.request_staff_review(text, text) from public;
revoke all on function public.decide_staff_claim(uuid, boolean, text) from public;
revoke all on function public.remove_staff_access(uuid) from public;
grant execute on function public.request_staff_review(text, text) to authenticated;
grant execute on function public.decide_staff_claim(uuid, boolean, text) to authenticated;
grant execute on function public.remove_staff_access(uuid) to authenticated;
