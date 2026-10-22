-- Usernames, friend requests, adding friends to groups, and recording payments between roommates.
-- Friends are made only through the functions below (nobody writes the friend tables directly), so the rules cannot be skipped:
-- same campus, no blocked students, no asking yourself, no duplicates.

-- ---------------------------------------------------------------------------------------------
-- 1. Usernames: lowercase letters, numbers and underscores, 3 to 20 long, unique within a campus.
--    Two students on different campuses may both be "casey".
-- ---------------------------------------------------------------------------------------------
alter table public.student_profiles add column if not exists username text;
alter table public.student_profiles drop constraint if exists student_profiles_username_check;
alter table public.student_profiles add constraint student_profiles_username_check check (username is null or username ~ '^[a-z0-9_]{3,20}$');
create unique index if not exists student_profiles_username_idx on public.student_profiles (campus_key, username) where username is not null;

-- ---------------------------------------------------------------------------------------------
-- 2. Notifications: the new kinds.
-- ---------------------------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like','comment','reply','message','event','hangout','place','friend_request','friend_accept','group_add'));

-- ---------------------------------------------------------------------------------------------
-- 3. Friends.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user <> to_user),
  unique (from_user, to_user)
);
create index if not exists friend_requests_to_idx on public.friend_requests(to_user, status);

create table if not exists public.friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);
create index if not exists friendships_high_idx on public.friendships(user_high);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

-- You can see requests you sent or received and your own friendships. Nobody writes these directly: the functions below do.
drop policy if exists "friend requests own read" on public.friend_requests;
create policy "friend requests own read" on public.friend_requests for select to authenticated using (auth.uid() in (from_user, to_user));
drop policy if exists "friendships own read" on public.friendships;
create policy "friendships own read" on public.friendships for select to authenticated using (auth.uid() in (user_low, user_high));

create or replace function public.send_friend_request(target uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  ck text := public.my_campus_key();
  lo uuid; hi uuid;
  rev uuid;
begin
  if me is null or ck is null then
    raise exception 'Join a campus first.' using errcode = 'P0001';
  end if;
  if target = me then
    raise exception 'You cannot add yourself.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.campus_memberships where user_id = target and campus_key = ck) then
    raise exception 'That student is not on your campus.' using errcode = 'P0001';
  end if;
  if public.is_blocked(me, target) then
    raise exception 'You cannot send that request.' using errcode = 'P0001';
  end if;

  lo := least(me, target); hi := greatest(me, target);
  if exists (select 1 from public.friendships where user_low = lo and user_high = hi) then
    return 'friends';
  end if;

  -- They already asked you: asking back means yes.
  select id into rev from public.friend_requests where from_user = target and to_user = me and status = 'pending';
  if rev is not null then
    update public.friend_requests set status = 'accepted', responded_at = now() where id = rev;
    insert into public.friendships (user_low, user_high) values (lo, hi) on conflict do nothing;
    update public.notifications set read_at = now() where recipient_id = me and actor_id = target and kind = 'friend_request' and read_at is null;
    insert into public.notifications (recipient_id, actor_id, kind, body) values (target, me, 'friend_accept', 'accepted your friend request');
    return 'friends';
  end if;

  if exists (select 1 from public.friend_requests where from_user = me and to_user = target) then
    raise exception 'You already sent that request.' using errcode = 'P0001';
  end if;

  insert into public.friend_requests (from_user, to_user) values (me, target);
  insert into public.notifications (recipient_id, actor_id, kind, body) values (target, me, 'friend_request', 'sent you a friend request');
  return 'requested';
end $$;
revoke all on function public.send_friend_request(uuid) from public;
grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.respond_friend_request(request_id uuid, accept boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  req public.friend_requests;
begin
  select * into req from public.friend_requests where id = request_id and to_user = me and status = 'pending';
  if req.id is null then
    raise exception 'That request is no longer there.' using errcode = 'P0001';
  end if;
  update public.friend_requests set status = case when accept then 'accepted' else 'declined' end, responded_at = now() where id = req.id;
  update public.notifications set read_at = now() where recipient_id = me and actor_id = req.from_user and kind = 'friend_request' and read_at is null;
  if accept then
    insert into public.friendships (user_low, user_high) values (least(me, req.from_user), greatest(me, req.from_user)) on conflict do nothing;
    insert into public.notifications (recipient_id, actor_id, kind, body) values (req.from_user, me, 'friend_accept', 'accepted your friend request');
  end if;
end $$;
revoke all on function public.respond_friend_request(uuid, boolean) from public;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Takes back a request you sent that has not been answered.
create or replace function public.cancel_friend_request(target uuid)
returns void language sql security definer set search_path = public
as $$
  delete from public.friend_requests where from_user = auth.uid() and to_user = target and status = 'pending';
$$;
revoke all on function public.cancel_friend_request(uuid) from public;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

-- Unfriends. The old requests between the two go too, so either can ask again later.
create or replace function public.remove_friend(other uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  delete from public.friendships where user_low = least(me, other) and user_high = greatest(me, other);
  delete from public.friend_requests where (from_user = me and to_user = other) or (from_user = other and to_user = me);
end $$;
revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Adding a friend to a group. Only members add people, only their own friends, and the friend is told.
-- ---------------------------------------------------------------------------------------------
create or replace function public.add_friend_to_group(gid uuid, friend uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  gname text;
  size int;
begin
  if me is null or not public.is_campus_group_member(gid) then
    raise exception 'Only members can add people to a group.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.friendships where user_low = least(me, friend) and user_high = greatest(me, friend)) then
    raise exception 'You can add friends to a group. Send them a friend request first.' using errcode = 'P0001';
  end if;
  select name into gname from public.campus_groups where id = gid;
  select count(*) into size from public.campus_group_memberships where group_id = gid;
  if size >= 60 then
    raise exception 'That group is full.' using errcode = 'P0001';
  end if;
  insert into public.campus_group_memberships (group_id, user_id) values (gid, friend) on conflict do nothing;
  if found then
    insert into public.notifications (recipient_id, actor_id, kind, body) values (friend, me, 'group_add', 'added you to ' || coalesce(gname, 'a group'));
  end if;
end $$;
revoke all on function public.add_friend_to_group(uuid, uuid) from public;
grant execute on function public.add_friend_to_group(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Roommate payments: "I paid you back". They count against what is owed, like in Splitwise. No money moves through Orbit.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.household_payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.households(group_id) on delete cascade,
  from_user uuid references auth.users(id) on delete set null,
  to_user uuid references auth.users(id) on delete set null,
  cents integer not null check (cents > 0 and cents < 100000000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_user is distinct from to_user)
);
create index if not exists household_payments_group_idx on public.household_payments(group_id, created_at desc);
alter table public.household_payments enable row level security;

drop policy if exists "household members read" on public.household_payments;
create policy "household members read" on public.household_payments for select to authenticated using (public.is_campus_group_member(group_id));
drop policy if exists "household members add" on public.household_payments;
create policy "household members add" on public.household_payments for insert to authenticated with check (public.is_campus_group_member(group_id) and created_by = auth.uid());
drop policy if exists "household members remove" on public.household_payments;
create policy "household members remove" on public.household_payments for delete to authenticated using (public.is_campus_group_member(group_id));

create or replace function public.household_payment_check()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.campus_group_memberships m where m.group_id = new.group_id and m.user_id = new.from_user)
     or not exists (select 1 from public.campus_group_memberships m where m.group_id = new.group_id and m.user_id = new.to_user) then
    raise exception 'Both people must be in this household.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists household_payments_people on public.household_payments;
create trigger household_payments_people before insert or update on public.household_payments for each row execute function public.household_payment_check();

-- ---------------------------------------------------------------------------------------------
-- 6. Live updates for the new tables.
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['friend_requests', 'friendships', 'household_payments'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
