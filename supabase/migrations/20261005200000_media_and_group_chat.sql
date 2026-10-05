-- Private campus media and realtime group chat.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feed-media',
  'feed-media',
  false,
  41943040,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "campus media read" on storage.objects;
create policy "campus media read" on storage.objects for select to authenticated
using (bucket_id = 'feed-media' and (storage.foldername(name))[1] = public.my_campus_key());

drop policy if exists "campus media create" on storage.objects;
create policy "campus media create" on storage.objects for insert to authenticated
with check (
  bucket_id = 'feed-media'
  and (storage.foldername(name))[1] = public.my_campus_key()
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "campus media update" on storage.objects;
create policy "campus media update" on storage.objects for update to authenticated
using (bucket_id = 'feed-media' and owner_id = auth.uid()::text)
with check (bucket_id = 'feed-media' and owner_id = auth.uid()::text);

drop policy if exists "campus media delete" on storage.objects;
create policy "campus media delete" on storage.objects for delete to authenticated
using (bucket_id = 'feed-media' and owner_id = auth.uid()::text);

drop policy if exists "campus posts update" on public.campus_posts;
create policy "campus posts update" on public.campus_posts for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid() and campus_key = public.my_campus_key());

create unique index if not exists campus_groups_campus_name_idx
on public.campus_groups(campus_key, name);

create table if not exists public.group_messages (
  id uuid primary key,
  group_id uuid not null references public.campus_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 1 and 100),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists group_messages_group_created_idx
on public.group_messages(group_id, created_at desc);

alter table public.group_messages enable row level security;

drop policy if exists "group messages read" on public.group_messages;
create policy "group messages read" on public.group_messages for select to authenticated
using (exists (
  select 1 from public.campus_group_memberships gm
  where gm.group_id = group_messages.group_id and gm.user_id = auth.uid()
));

drop policy if exists "group messages create" on public.group_messages;
create policy "group messages create" on public.group_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.campus_group_memberships gm
    where gm.group_id = group_messages.group_id and gm.user_id = auth.uid()
  )
);

drop policy if exists "group messages delete" on public.group_messages;
create policy "group messages delete" on public.group_messages for delete to authenticated
using (sender_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.group_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.campus_groups;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.campus_group_memberships;
exception when duplicate_object then null; end $$;
