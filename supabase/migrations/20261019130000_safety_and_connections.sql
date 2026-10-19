-- Campus relationships and safety controls.

create table if not exists public.student_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.campus_posts(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','unsafe','misinformation','other')),
  detail text not null default '' check (char_length(detail) <= 500),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check (post_id is not null or reported_user_id is not null)
);

create index if not exists student_follows_followed_idx on public.student_follows(followed_id);
create index if not exists content_reports_status_idx on public.content_reports(status, created_at desc);
alter table public.student_follows enable row level security;
alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;

create or replace function public.is_blocked(user_a uuid, user_b uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  )
$$;
revoke all on function public.is_blocked(uuid, uuid) from public;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

create or replace function public.shares_my_campus(other_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.campus_memberships mine
    join public.campus_memberships other on other.campus_key = mine.campus_key
    where mine.user_id = auth.uid() and other.user_id = other_id
  )
$$;
revoke all on function public.shares_my_campus(uuid) from public;
grant execute on function public.shares_my_campus(uuid) to authenticated;

drop policy if exists "campus follows read" on public.student_follows;
create policy "campus follows read" on public.student_follows for select to authenticated
using (
  public.shares_my_campus(followed_id)
  and not public.is_blocked(auth.uid(), followed_id)
);
drop policy if exists "follow campus student" on public.student_follows;
create policy "follow campus student" on public.student_follows for insert to authenticated
with check (
  follower_id = auth.uid()
  and public.shares_my_campus(followed_id)
  and not public.is_blocked(auth.uid(), followed_id)
);
drop policy if exists "unfollow campus student" on public.student_follows;
create policy "unfollow campus student" on public.student_follows for delete to authenticated using (follower_id = auth.uid());

drop policy if exists "blocks own read" on public.user_blocks;
create policy "blocks own read" on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "block campus student" on public.user_blocks;
create policy "block campus student" on public.user_blocks for insert to authenticated
with check (
  blocker_id = auth.uid()
  and public.shares_my_campus(blocked_id)
);
drop policy if exists "unblock campus student" on public.user_blocks;
create policy "unblock campus student" on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());

drop policy if exists "reports own read" on public.content_reports;
create policy "reports own read" on public.content_reports for select to authenticated using (reporter_id = auth.uid());
drop policy if exists "report campus content" on public.content_reports;
create policy "report campus content" on public.content_reports for insert to authenticated
with check (
  reporter_id = auth.uid()
  and (post_id is null or exists (select 1 from public.campus_posts p where p.id = post_id))
  and (reported_user_id is null or public.shares_my_campus(reported_user_id))
);

-- Blocked accounts disappear from profiles, feed, group messages, and private conversations.
drop policy if exists "campus profiles read" on public.student_profiles;
create policy "campus profiles read" on public.student_profiles for select to authenticated
using (campus_key = public.my_campus_key() and not public.is_blocked(auth.uid(), user_id));

drop policy if exists "campus posts read" on public.campus_posts;
create policy "campus posts read" on public.campus_posts for select to authenticated
using (
  campus_key = public.my_campus_key()
  and not public.is_blocked(auth.uid(), author_id)
  and (group_id is null or exists (select 1 from public.campus_group_memberships gm where gm.group_id = campus_posts.group_id and gm.user_id = auth.uid()))
);

drop policy if exists "group messages read" on public.group_messages;
create policy "group messages read" on public.group_messages for select to authenticated
using (
  not public.is_blocked(auth.uid(), sender_id)
  and exists (select 1 from public.campus_group_memberships gm where gm.group_id = group_messages.group_id and gm.user_id = auth.uid())
);

drop policy if exists "direct conversations read" on public.direct_conversations;
create policy "direct conversations read" on public.direct_conversations for select to authenticated
using (
  campus_key = public.my_campus_key()
  and auth.uid() in (user_low, user_high)
  and not public.is_blocked(user_low, user_high)
);
drop policy if exists "direct conversations create" on public.direct_conversations;
create policy "direct conversations create" on public.direct_conversations for insert to authenticated
with check (
  campus_key = public.my_campus_key()
  and auth.uid() in (user_low, user_high)
  and not public.is_blocked(user_low, user_high)
  and public.shares_my_campus(case when auth.uid() = user_low then user_high else user_low end)
);

-- Blocking removes the blocker's follow links in both directions.
create or replace function public.remove_blocked_connections()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  delete from public.student_follows
  where (follower_id = new.blocker_id and followed_id = new.blocked_id)
     or (follower_id = new.blocked_id and followed_id = new.blocker_id);
  return new;
end $$;
drop trigger if exists remove_follows_after_block on public.user_blocks;
create trigger remove_follows_after_block after insert on public.user_blocks for each row execute function public.remove_blocked_connections();

do $$ begin alter publication supabase_realtime add table public.student_follows; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.user_blocks; exception when duplicate_object then null; end $$;
