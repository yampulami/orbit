-- Graduation: a student says when they graduate, confirms it once the month arrives, and a coordinator verifies it. Only verified graduates get the
-- Alumni badge and can be listed in the directory, so nobody can call themselves an alum just by typing a year.

create table if not exists public.graduations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  campus_key text not null,
  grad_month smallint not null check (grad_month between 1 and 12),
  grad_year smallint not null check (grad_year between 1990 and 2100),
  status text not null default 'expected' check (status in ('expected', 'claimed', 'verified', 'declined')),
  proof text not null default '' check (char_length(proof) <= 300), -- what the graduate tells the coordinator
  note text not null default '' check (char_length(note) <= 200), -- why a coordinator said no
  claimed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  snooze_until date,
  month_emailed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists graduations_queue_idx on public.graduations (campus_key, status, claimed_at);
alter table public.graduations enable row level security;
-- you see your own; a coordinator sees the ones on their campus that are waiting. No direct writes: everything goes through the functions below.
drop policy if exists "graduations read" on public.graduations;
create policy "graduations read" on public.graduations for select to authenticated
using (user_id = auth.uid() or (status = 'claimed' and campus_key = public.my_campus_key() and public.can_review_events()));

create or replace function public.is_verified_alum(who uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.graduations g where g.user_id = who and g.status = 'verified') $$;
revoke all on function public.is_verified_alum(uuid) from public, anon;
grant execute on function public.is_verified_alum(uuid) to authenticated;

-- who gets the badge on this campus: only the id and the year, nothing else about them
create or replace function public.campus_alumni()
returns table (user_id uuid, grad_year smallint) language sql stable security definer set search_path = public
as $$ select g.user_id, g.grad_year from public.graduations g where g.status = 'verified' and g.campus_key = public.my_campus_key() $$;
revoke all on function public.campus_alumni() from public, anon;
grant execute on function public.campus_alumni() to authenticated;

create or replace function public.set_graduation(month_in int, year_in int)
returns void language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); ck text := public.my_campus_key(); cur public.graduations;
begin
  if me is null or ck is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if month_in not between 1 and 12 or year_in not between 1990 and 2100 then raise exception 'Pick a month and a year.' using errcode = '22023'; end if;
  select * into cur from public.graduations where user_id = me;
  if found and cur.status in ('claimed', 'verified') then raise exception 'Your graduation is already sent or verified. Ask a coordinator to change it.' using errcode = '22023'; end if;
  insert into public.graduations (user_id, campus_key, grad_month, grad_year) values (me, ck, month_in, year_in)
  on conflict (user_id) do update set
    month_emailed_at = case when (public.graduations.grad_month, public.graduations.grad_year) is distinct from (excluded.grad_month, excluded.grad_year) then null else public.graduations.month_emailed_at end,
    grad_month = excluded.grad_month, grad_year = excluded.grad_year, status = 'expected', note = '', snooze_until = null, updated_at = now();
end $$;
revoke all on function public.set_graduation(int, int) from public, anon;
grant execute on function public.set_graduation(int, int) to authenticated;

create or replace function public.snooze_graduation()
returns void language sql security definer set search_path = public
as $$ update public.graduations set snooze_until = current_date + 14 where user_id = auth.uid() $$;
revoke all on function public.snooze_graduation() from public, anon;
grant execute on function public.snooze_graduation() to authenticated;

-- a new notification kind for everything about graduating
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('like','comment','reply','message','event','hangout','place','friend_request','friend_accept','group_add','intro','alumni'));

create or replace function public.claim_graduation(proof_in text)
returns void language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); cur public.graduations;
begin
  select * into cur from public.graduations where user_id = me;
  if not found then raise exception 'Set your graduation month first.' using errcode = '22023'; end if;
  if cur.status in ('claimed', 'verified') then return; end if;
  -- not before the month they named
  if make_date(cur.grad_year, cur.grad_month, 1) > current_date then raise exception 'You can confirm once your graduation month arrives.' using errcode = '22023'; end if;
  update public.graduations set status = 'claimed', proof = left(btrim(coalesce(proof_in, '')), 300), note = '', claimed_at = now(), updated_at = now() where user_id = me;
  insert into public.notifications (recipient_id, actor_id, kind, body)
    select h.user_id, me, 'alumni', 'says they graduated. Check it in Campus, Review.' from public.campus_hosts h
    where h.campus_key = cur.campus_key and h.role in ('coordinator', 'staff') and h.user_id <> me;
end $$;
revoke all on function public.claim_graduation(text) from public, anon;
grant execute on function public.claim_graduation(text) to authenticated;

create or replace function public.review_graduation(target uuid, approve boolean, note_in text)
returns void language plpgsql security definer set search_path = public
as $$
declare g public.graduations;
begin
  if not public.can_review_events() then raise exception 'Only a coordinator can do that.' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'Another coordinator has to check yours.' using errcode = '42501'; end if;
  select * into g from public.graduations where user_id = target and campus_key = public.my_campus_key() and status = 'claimed';
  if not found then raise exception 'That request was not found.' using errcode = 'P0002'; end if;
  update public.graduations set status = case when approve then 'verified' else 'declined' end,
    note = case when approve then '' else left(btrim(coalesce(note_in, '')), 200) end, reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now() where user_id = target;
  insert into public.notifications (recipient_id, actor_id, kind, body) values (target, auth.uid(), 'alumni',
    case when approve then 'confirmed your graduation. You now have the Alumni badge.' else 'could not confirm your graduation yet. See Alumni for the reason.' end);
end $$;
revoke all on function public.review_graduation(uuid, boolean, text) from public, anon;
grant execute on function public.review_graduation(uuid, boolean, text) to authenticated;

-- the directory: only verified graduates can be listed, seen or asked
drop policy if exists "alumni read" on public.alumni_profiles;
create policy "alumni read" on public.alumni_profiles for select to authenticated
using (user_id = auth.uid() or (campus_key = public.my_campus_key() and listed and public.is_verified_alum(user_id) and not public.is_blocked(auth.uid(), user_id)));
drop policy if exists "alumni write" on public.alumni_profiles;
create policy "alumni write" on public.alumni_profiles for insert to authenticated
with check (user_id = auth.uid() and campus_key = public.my_campus_key() and public.is_verified_alum(auth.uid()));
drop policy if exists "alumni edit" on public.alumni_profiles;
create policy "alumni edit" on public.alumni_profiles for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid() and campus_key = public.my_campus_key() and public.is_verified_alum(auth.uid()));

-- the year on a listing is always the verified one
create or replace function public.alumni_profile_year()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  select g.grad_year into new.grad_year from public.graduations g where g.user_id = new.user_id and g.status = 'verified';
  return new;
end $$;
drop trigger if exists alumni_profile_year on public.alumni_profiles;
create trigger alumni_profile_year before insert or update on public.alumni_profiles for each row execute function public.alumni_profile_year();

create or replace function public.ask_alumni_intro(target uuid, note_text text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); clean text := left(btrim(coalesce(note_text, '')), 300); rid uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if target = me then raise exception 'That is you.' using errcode = '22023'; end if;
  if char_length(clean) < 1 then raise exception 'Write a line about what you are asking for.' using errcode = '22023'; end if;
  if not public.is_verified_alum(target) or not exists (select 1 from public.alumni_profiles a where a.user_id = target and a.listed and a.campus_key = public.my_campus_key()) then
    raise exception 'That person is not taking requests.' using errcode = '22023';
  end if;
  if public.is_blocked(me, target) then raise exception 'That person is not taking requests.' using errcode = '22023'; end if;
  if (select count(*) from public.alumni_requests r where r.from_user = me and r.created_at > now() - interval '1 day') >= 5 then
    raise exception 'You have asked 5 people today. Try again tomorrow.' using errcode = '54000';
  end if;
  if exists (select 1 from public.alumni_requests r where r.from_user = me and r.to_user = target and r.status = 'pending') then
    raise exception 'You already asked this person. Wait for an answer.' using errcode = '23505';
  end if;
  insert into public.alumni_requests (from_user, to_user, note) values (me, target, clean) returning id into rid;
  insert into public.notifications (recipient_id, actor_id, kind, body) values (target, me, 'intro', 'asked you for an introduction');
  return rid;
end $$;
