-- Block and report, finished.
-- The earlier safety migration already hides a blocked person's profile, posts, group messages and direct messages, and added a reports table.
-- This closes what it left out, now that there are comments, friends and hangouts.

-- 1. The "blocked people" list needs names. A blocked person's profile is hidden from the person who blocked them, so the name is kept here.
alter table public.user_blocks add column if not exists blocked_name text;
alter table public.user_blocks drop constraint if exists user_blocks_name_len;
alter table public.user_blocks add constraint user_blocks_name_len check (blocked_name is null or char_length(blocked_name) <= 100);

-- 2. A blocked person's comments disappear too (their posts already did).
drop policy if exists "comments read" on public.post_comments;
create policy "comments read" on public.post_comments for select to authenticated
using (not public.is_blocked(auth.uid(), user_id) and exists (select 1 from public.campus_posts p where p.id = post_id));

-- 3. So do hangouts they organize, whether open to the campus or in a group you share.
drop policy if exists "hangouts read" on public.campus_hangouts;
create policy "hangouts read" on public.campus_hangouts for select to authenticated
using (campus_key = public.my_campus_key() and not public.is_blocked(auth.uid(), created_by) and (visibility = 'campus' or public.is_campus_group_member(group_id)));

create or replace function public.can_see_campus_hangout(hid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.campus_hangouts h
    where h.id = hid and h.campus_key = public.my_campus_key()
      and not public.is_blocked(auth.uid(), h.created_by)
      and (h.visibility = 'campus' or public.is_campus_group_member(h.group_id))
  )
$$;

-- 4. Blocking ends any friendship and any friend request between the two, in both directions.
create or replace function public.remove_blocked_friendship()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  delete from public.friendships where user_low = least(new.blocker_id, new.blocked_id) and user_high = greatest(new.blocker_id, new.blocked_id);
  delete from public.friend_requests where (from_user = new.blocker_id and to_user = new.blocked_id) or (from_user = new.blocked_id and to_user = new.blocker_id);
  return new;
end $$;
drop trigger if exists remove_friendship_after_block on public.user_blocks;
create trigger remove_friendship_after_block after insert on public.user_blocks for each row execute function public.remove_blocked_friendship();

-- 5. A report can point at a comment, and say where it happened ("direct message", "group chat", "post", ...).
alter table public.content_reports add column if not exists comment_id uuid references public.post_comments(id) on delete set null;
alter table public.content_reports add column if not exists context text;
alter table public.content_reports drop constraint if exists content_reports_context_len;
alter table public.content_reports add constraint content_reports_context_len check (context is null or char_length(context) <= 60);

-- A little protection against someone flooding the reports: at most 20 a day each.
create or replace function public.limit_reports()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from public.content_reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You have sent a lot of reports today. We will look at them.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists limit_reports_per_day on public.content_reports;
create trigger limit_reports_per_day before insert on public.content_reports for each row execute function public.limit_reports();
