-- Every running club also gets an #announcements channel. Everyone in the club reads it; only the president and people whose role includes "announce" can post.
-- (Builds on 20261031100000_club_look.sql and 20261028180000_club_channels.sql.)

alter table public.campus_club_channels add column if not exists announce_only boolean not null default false;

-- May I write in this channel? I can read it, and if it is announcements-only I may announce.
create or replace function public.can_write_channel(ch uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.can_read_channel(ch) and exists (
    select 1 from public.campus_club_channels c
    where c.id = ch and (not c.announce_only or public.is_org_owner(c.org_id) or public.has_org_perm(c.org_id, 'announce'))
  )
$$;
revoke all on function public.can_write_channel(uuid) from public;
grant execute on function public.can_write_channel(uuid) to authenticated;

drop policy if exists "channel messages create" on public.campus_club_messages;
create policy "channel messages create" on public.campus_club_messages for insert to authenticated
with check (author_id = auth.uid() and public.can_write_channel(channel_id));

-- A new running club gets #general and #announcements.
create or replace function public.campus_org_default_channel()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'active' then
    insert into public.campus_club_channels (org_id, name, description, is_default, position, created_by)
    values (new.id, 'general', 'Everyone in the club', true, 0, new.created_by) on conflict (org_id, name) do nothing;
    insert into public.campus_club_channels (org_id, name, description, announce_only, position, created_by)
    values (new.id, 'announcements', 'News from the officers', true, -1, new.created_by) on conflict (org_id, name) do nothing;
  end if;
  return null;
end $$;

-- Running clubs that already exist get one too.
insert into public.campus_club_channels (org_id, name, description, announce_only, position, created_by)
select id, 'announcements', 'News from the officers', true, -1, created_by from public.campus_orgs where status = 'active'
on conflict (org_id, name) do nothing;

-- The announcements channel stays, like #general.
create or replace function public.delete_channel(ch uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare c public.campus_club_channels;
begin
  select * into c from public.campus_club_channels where id = ch;
  if c.id is null then return; end if;
  if c.is_default or c.announce_only then raise exception 'The general and announcements channels stay.'; end if;
  if not (public.is_org_owner(c.org_id) or public.has_org_perm(c.org_id, 'channels')) then raise exception 'Your role in this club does not include managing channels.' using errcode = '42501'; end if;
  delete from public.campus_club_channels where id = ch;
end $$;
