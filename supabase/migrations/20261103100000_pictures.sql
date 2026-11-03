-- Pictures in Orbit: a private "media" bucket for photos in posts, comments, messages, group chats and club channels, and a choice of avatar on each profile.
-- Photos are small JPEGs made on the device. Only signed-in people can read them, and each person can add or remove only inside their own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "media read" on storage.objects;
create policy "media read" on storage.objects for select to authenticated
  using (bucket_id = 'media');

drop policy if exists "media add own" on storage.objects;
create policy "media add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media remove own" on storage.objects;
create policy "media remove own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- The avatar a person picked: "critter:seed|eyes=round|..." or "img:USER/FILE.jpg". Empty means their first letter.
alter table public.student_profiles add column if not exists avatar text check (avatar is null or char_length(avatar) <= 300);
