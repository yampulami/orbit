-- Social profiles, threaded replies, direct messages, and in-app notifications.

create table if not exists public.student_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  campus_key text not null,
  display_name text not null check (char_length(display_name) between 1 and 100),
  bio text not null default '' check (char_length(bio) <= 240),
  lifestyle text not null default '' check (char_length(lifestyle) <= 100),
  academic_year text not null default '' check (char_length(academic_year) <= 100),
  major text not null default '' check (char_length(major) <= 100),
  hobbies text[] not null default '{}',
  clubs text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

drop policy if exists "campus profiles read" on public.student_profiles;
create policy "campus profiles read" on public.student_profiles for select to authenticated
using (campus_key = public.my_campus_key());
drop policy if exists "profile own create" on public.student_profiles;
create policy "profile own create" on public.student_profiles for insert to authenticated
with check (user_id = auth.uid() and campus_key = public.my_campus_key());
drop policy if exists "profile own update" on public.student_profiles;
create policy "profile own update" on public.student_profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and campus_key = public.my_campus_key());

alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments(id) on delete cascade;
create index if not exists post_comments_parent_idx on public.post_comments(parent_id, created_at);

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  campus_key text not null,
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_low::text < user_high::text),
  unique (user_low, user_high)
);

create table if not exists public.direct_messages (
  id uuid primary key,
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists direct_conversations_updated_idx on public.direct_conversations(updated_at desc);
create index if not exists direct_messages_conversation_idx on public.direct_messages(conversation_id, created_at);
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "direct conversations read" on public.direct_conversations;
create policy "direct conversations read" on public.direct_conversations for select to authenticated
using (campus_key = public.my_campus_key() and auth.uid() in (user_low, user_high));
drop policy if exists "direct conversations create" on public.direct_conversations;
create policy "direct conversations create" on public.direct_conversations for insert to authenticated
with check (
  campus_key = public.my_campus_key()
  and auth.uid() in (user_low, user_high)
  and exists (
    select 1 from public.campus_memberships other
    where other.user_id = case when auth.uid() = user_low then user_high else user_low end
      and other.campus_key = public.my_campus_key()
  )
);
drop policy if exists "direct conversations update" on public.direct_conversations;
create policy "direct conversations update" on public.direct_conversations for update to authenticated
using (auth.uid() in (user_low, user_high)) with check (auth.uid() in (user_low, user_high));

drop policy if exists "direct messages read" on public.direct_messages;
create policy "direct messages read" on public.direct_messages for select to authenticated
using (exists (
  select 1 from public.direct_conversations c
  where c.id = conversation_id and auth.uid() in (c.user_low, c.user_high)
));
drop policy if exists "direct messages create" on public.direct_messages;
create policy "direct messages create" on public.direct_messages for insert to authenticated
with check (sender_id = auth.uid() and exists (
  select 1 from public.direct_conversations c
  where c.id = conversation_id and auth.uid() in (c.user_low, c.user_high)
));
drop policy if exists "direct messages update" on public.direct_messages;
create policy "direct messages update" on public.direct_messages for update to authenticated
using (sender_id <> auth.uid() and exists (
  select 1 from public.direct_conversations c
  where c.id = conversation_id and auth.uid() in (c.user_low, c.user_high)
));

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('like','comment','reply','message','event')),
  post_id uuid references public.campus_posts(id) on delete cascade,
  conversation_id uuid references public.direct_conversations(id) on delete cascade,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select to authenticated using (recipient_id = auth.uid());
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create or replace function public.notify_post_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare owner_id uuid; parent_owner uuid; label text;
begin
  if tg_table_name = 'post_likes' then
    select author_id into owner_id from public.campus_posts where id = new.post_id;
    if owner_id <> new.user_id then
      insert into public.notifications(recipient_id, actor_id, kind, post_id, body)
      values(owner_id, new.user_id, 'like', new.post_id, 'liked your post');
    end if;
  elsif tg_table_name = 'post_comments' then
    select author_id into owner_id from public.campus_posts where id = new.post_id;
    if new.parent_id is not null then
      select user_id into parent_owner from public.post_comments where id = new.parent_id;
    end if;
    label := case when new.parent_id is null then 'commented on your post' else 'replied to your comment' end;
    if coalesce(parent_owner, owner_id) <> new.user_id then
      insert into public.notifications(recipient_id, actor_id, kind, post_id, body)
      values(coalesce(parent_owner, owner_id), new.user_id, case when new.parent_id is null then 'comment' else 'reply' end, new.post_id, label);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists notify_like on public.post_likes;
create trigger notify_like after insert on public.post_likes for each row execute function public.notify_post_activity();
drop trigger if exists notify_comment on public.post_comments;
create trigger notify_comment after insert on public.post_comments for each row execute function public.notify_post_activity();

create or replace function public.touch_direct_conversation()
returns trigger language plpgsql security definer set search_path = public
as $$
declare recipient uuid;
begin
  update public.direct_conversations set updated_at = new.created_at where id = new.conversation_id;
  select case when user_low = new.sender_id then user_high else user_low end into recipient
  from public.direct_conversations where id = new.conversation_id;
  insert into public.notifications(recipient_id, actor_id, kind, conversation_id, body)
  values(recipient, new.sender_id, 'message', new.conversation_id, left(new.body, 120));
  return new;
end $$;
drop trigger if exists direct_message_activity on public.direct_messages;
create trigger direct_message_activity after insert on public.direct_messages for each row execute function public.touch_direct_conversation();

do $$ begin alter publication supabase_realtime add table public.student_profiles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.direct_conversations; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.direct_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;
