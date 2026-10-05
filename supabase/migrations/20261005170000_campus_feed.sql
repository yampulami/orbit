-- Orbit campus feed. Every read is constrained to the signed-in user's campus.
create table if not exists public.campus_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  campus_key text not null check (campus_key ~ '^[a-z0-9-]{2,100}$'),
  campus_name text not null check (char_length(campus_name) between 2 and 100),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campus_groups (
  id uuid primary key default gen_random_uuid(),
  campus_key text not null,
  name text not null check (char_length(name) between 2 and 100),
  description text not null default '' check (char_length(description) <= 500),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.campus_group_memberships (
  group_id uuid not null references public.campus_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.campus_posts (
  id uuid primary key,
  campus_key text not null,
  group_id uuid references public.campus_groups(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 100),
  kind text not null check (kind in ('post', 'event', 'marketplace')),
  community text not null check (community in ('Everyone', 'Commuters', 'Residents', 'Roommates', 'Marketplace')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.campus_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key,
  post_id uuid not null references public.campus_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 100),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.event_registrations (
  post_id uuid not null references public.campus_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.poll_votes (
  post_id uuid not null references public.campus_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  choice integer not null check (choice between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists campus_posts_campus_created_idx on public.campus_posts(campus_key, created_at desc);
create index if not exists campus_posts_group_created_idx on public.campus_posts(group_id, created_at desc) where group_id is not null;
create index if not exists post_comments_post_created_idx on public.post_comments(post_id, created_at);

alter table public.campus_memberships enable row level security;
alter table public.campus_groups enable row level security;
alter table public.campus_group_memberships enable row level security;
alter table public.campus_posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.event_registrations enable row level security;
alter table public.poll_votes enable row level security;

create or replace function public.my_campus_key()
returns text language sql stable security definer set search_path = public
as $$ select campus_key from public.campus_memberships where user_id = auth.uid() $$;
revoke all on function public.my_campus_key() from public;
grant execute on function public.my_campus_key() to authenticated;

drop policy if exists "membership own read" on public.campus_memberships;
create policy "membership own read" on public.campus_memberships for select to authenticated using (user_id = auth.uid());
drop policy if exists "membership own insert" on public.campus_memberships;
create policy "membership own insert" on public.campus_memberships for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "membership own update" on public.campus_memberships;
create policy "membership own update" on public.campus_memberships for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "campus groups read" on public.campus_groups;
create policy "campus groups read" on public.campus_groups for select to authenticated using (campus_key = public.my_campus_key());
drop policy if exists "campus groups create" on public.campus_groups;
create policy "campus groups create" on public.campus_groups for insert to authenticated with check (campus_key = public.my_campus_key() and created_by = auth.uid());
drop policy if exists "group members read" on public.campus_group_memberships;
create policy "group members read" on public.campus_group_memberships for select to authenticated using (exists (select 1 from public.campus_groups g where g.id = group_id and g.campus_key = public.my_campus_key()));
drop policy if exists "join campus group" on public.campus_group_memberships;
create policy "join campus group" on public.campus_group_memberships for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.campus_groups g where g.id = group_id and g.campus_key = public.my_campus_key()));
drop policy if exists "leave campus group" on public.campus_group_memberships;
create policy "leave campus group" on public.campus_group_memberships for delete to authenticated using (user_id = auth.uid());

drop policy if exists "campus posts read" on public.campus_posts;
create policy "campus posts read" on public.campus_posts for select to authenticated using (campus_key = public.my_campus_key() and (group_id is null or exists (select 1 from public.campus_group_memberships gm where gm.group_id = campus_posts.group_id and gm.user_id = auth.uid())));
drop policy if exists "campus posts create" on public.campus_posts;
create policy "campus posts create" on public.campus_posts for insert to authenticated with check (author_id = auth.uid() and campus_key = public.my_campus_key() and (group_id is null or exists (select 1 from public.campus_group_memberships gm where gm.group_id = campus_posts.group_id and gm.user_id = auth.uid())));
drop policy if exists "campus posts delete" on public.campus_posts;
create policy "campus posts delete" on public.campus_posts for delete to authenticated using (author_id = auth.uid());

drop policy if exists "likes read" on public.post_likes;
create policy "likes read" on public.post_likes for select to authenticated using (exists (select 1 from public.campus_posts p where p.id = post_id));
drop policy if exists "likes create" on public.post_likes;
create policy "likes create" on public.post_likes for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.campus_posts p where p.id = post_id));
drop policy if exists "likes delete" on public.post_likes;
create policy "likes delete" on public.post_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "comments read" on public.post_comments;
create policy "comments read" on public.post_comments for select to authenticated using (exists (select 1 from public.campus_posts p where p.id = post_id));
drop policy if exists "comments create" on public.post_comments;
create policy "comments create" on public.post_comments for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.campus_posts p where p.id = post_id));
drop policy if exists "comments delete" on public.post_comments;
create policy "comments delete" on public.post_comments for delete to authenticated using (user_id = auth.uid());

drop policy if exists "registrations read" on public.event_registrations;
create policy "registrations read" on public.event_registrations for select to authenticated using (exists (select 1 from public.campus_posts p where p.id = post_id and p.kind = 'event'));
drop policy if exists "registrations create" on public.event_registrations;
create policy "registrations create" on public.event_registrations for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.campus_posts p where p.id = post_id and p.kind = 'event'));
drop policy if exists "registrations delete" on public.event_registrations;
create policy "registrations delete" on public.event_registrations for delete to authenticated using (user_id = auth.uid());

drop policy if exists "votes read" on public.poll_votes;
create policy "votes read" on public.poll_votes for select to authenticated using (exists (select 1 from public.campus_posts p where p.id = post_id and p.kind = 'post'));
drop policy if exists "votes create" on public.poll_votes;
create policy "votes create" on public.poll_votes for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.campus_posts p where p.id = post_id and p.kind = 'post'));
drop policy if exists "votes update" on public.poll_votes;
create policy "votes update" on public.poll_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "votes delete" on public.poll_votes;
create policy "votes delete" on public.poll_votes for delete to authenticated using (user_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.campus_posts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.post_likes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.post_comments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.event_registrations;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.poll_votes;
exception when duplicate_object then null; end $$;
