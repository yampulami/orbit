-- Alumni: graduates stay reachable. A graduate lists a short profile (where they work, what they are open to), students ask for an introduction,
-- and the graduate decides. Nobody's email is shown: the conversation goes through Orbit, and the email notifications reach them wherever they are.

create table if not exists public.alumni_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  campus_key text not null,
  grad_year smallint not null check (grad_year between 1990 and 2100),
  field text not null default '' check (char_length(field) <= 80),
  company text not null default '' check (char_length(company) <= 80),
  job_title text not null default '' check (char_length(job_title) <= 80),
  industry text not null default '' check (char_length(industry) <= 60),
  about text not null default '' check (char_length(about) <= 300),
  open_to text[] not null default '{}' check (open_to <@ array['referrals', 'mentoring', 'chats', 'hiring']::text[]),
  listed boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists alumni_profiles_campus_idx on public.alumni_profiles (campus_key, grad_year desc);
alter table public.alumni_profiles enable row level security;

-- the campus sees listed profiles (unless one of the two has blocked the other); you always see your own
drop policy if exists "alumni read" on public.alumni_profiles;
create policy "alumni read" on public.alumni_profiles for select to authenticated
using (user_id = auth.uid() or (campus_key = public.my_campus_key() and listed and not public.is_blocked(auth.uid(), user_id)));
drop policy if exists "alumni write" on public.alumni_profiles;
create policy "alumni write" on public.alumni_profiles for insert to authenticated with check (user_id = auth.uid() and campus_key = public.my_campus_key());
drop policy if exists "alumni edit" on public.alumni_profiles;
create policy "alumni edit" on public.alumni_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and campus_key = public.my_campus_key());
drop policy if exists "alumni remove" on public.alumni_profiles;
create policy "alumni remove" on public.alumni_profiles for delete to authenticated using (user_id = auth.uid());

create table if not exists public.alumni_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  note text not null check (char_length(note) between 1 and 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (from_user <> to_user)
);
create unique index if not exists alumni_requests_one_pending on public.alumni_requests (from_user, to_user) where status = 'pending';
create index if not exists alumni_requests_to_idx on public.alumni_requests (to_user, created_at desc);
alter table public.alumni_requests enable row level security;
drop policy if exists "alumni requests own" on public.alumni_requests;
create policy "alumni requests own" on public.alumni_requests for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());
-- no insert or update policy: requests are made and answered only through the two functions below

-- a notification kind for "asked for an introduction" and "accepted"
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('like','comment','reply','message','event','hangout','place','friend_request','friend_accept','group_add','intro'));

create or replace function public.ask_alumni_intro(target uuid, note_text text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); clean text := left(btrim(coalesce(note_text, '')), 300); rid uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if target = me then raise exception 'That is you.' using errcode = '22023'; end if;
  if char_length(clean) < 1 then raise exception 'Write a line about what you are asking for.' using errcode = '22023'; end if;
  if not exists (select 1 from public.alumni_profiles a where a.user_id = target and a.listed and a.campus_key = public.my_campus_key()) then
    raise exception 'That person is not taking requests.' using errcode = '22023';
  end if;
  if public.is_blocked(me, target) then raise exception 'That person is not taking requests.' using errcode = '22023'; end if;
  -- at most 5 requests a day, so nobody can mass-message the alumni
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
revoke all on function public.ask_alumni_intro(uuid, text) from public, anon;
grant execute on function public.ask_alumni_intro(uuid, text) to authenticated;

create or replace function public.answer_alumni_intro(req uuid, accept boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare r public.alumni_requests;
begin
  select * into r from public.alumni_requests where id = req and to_user = auth.uid() and status = 'pending';
  if not found then raise exception 'That request was not found.' using errcode = 'P0002'; end if;
  update public.alumni_requests set status = case when accept then 'accepted' else 'declined' end, decided_at = now() where id = req;
  -- only a yes is announced; a no is left quiet
  if accept then
    insert into public.notifications (recipient_id, actor_id, kind, body) values (r.from_user, auth.uid(), 'intro', 'accepted your request. You can message them now.');
  end if;
end $$;
revoke all on function public.answer_alumni_intro(uuid, boolean) from public, anon;
grant execute on function public.answer_alumni_intro(uuid, boolean) to authenticated;
