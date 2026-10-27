-- Club chat channels, like a small Discord server. Every active club or circle gets a #general channel; people with the "manage channels" permission
-- can add more (including team-only ones for officers). Only the club's own people can read and write. Unread dots come from a per-person read marker.
-- (Builds on 20261028140000_event_cohosts.sql.)

-- 1. A new permission: manage channels --------------------------------------------------------------------------------------------------
create or replace function public.org_perms(org uuid, uid uuid)
returns text[] language sql stable security definer set search_path = public
as $$
  select case
    when m.role = 'owner' then array['announce', 'events', 'members', 'roles', 'tasks', 'polls', 'moderate', 'channels']
    when m.role_id is not null then coalesce((select r.permissions from public.campus_org_roles r where r.id = m.role_id), '{}'::text[])
    when m.role = 'officer' then array['announce', 'events', 'polls']
    else '{}'::text[]
  end
  from public.campus_org_members m where m.org_id = org and m.user_id = uid
$$;

create or replace function public.save_org_role(org uuid, role_id uuid, role_name text, perms text[])
returns uuid language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs; rid uuid; clean text[]; nm text := trim(coalesce(role_name, ''));
begin
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> public.my_campus_key() then raise exception 'That club does not exist.' using errcode = '42501'; end if;
  if not (public.is_org_owner(org) or public.has_org_perm(org, 'roles') or public.can_review_events()) then raise exception 'Only people who manage roles can do that.' using errcode = '42501'; end if;
  if char_length(nm) not between 1 and 30 then raise exception 'Give the role a name (up to 30 characters).'; end if;
  clean := array(select distinct p from unnest(coalesce(perms, '{}'::text[])) p where p = any (array['announce', 'events', 'members', 'roles', 'tasks', 'polls', 'moderate', 'channels']));
  if 'roles' = any (clean) and not (public.is_org_owner(org) or public.can_review_events()) then clean := array_remove(clean, 'roles'); end if;
  if role_id is null then
    if (select count(*) from public.campus_org_roles where org_id = org) >= 12 then raise exception 'A club can have up to 12 roles.'; end if;
    insert into public.campus_org_roles (org_id, name, permissions, position)
    values (org, nm, clean, (select coalesce(max(position), 0) + 1 from public.campus_org_roles where org_id = org)) returning id into rid;
  else
    update public.campus_org_roles set name = nm, permissions = clean where id = role_id and org_id = org returning id into rid;
    if rid is null then raise exception 'That role does not exist.'; end if;
  end if;
  return rid;
exception when unique_violation then raise exception 'There is already a role with that name.';
end $$;

-- 2. Channels, messages and read markers -------------------------------------------------------------------------------------------------
create table if not exists public.campus_club_channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.campus_orgs(id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9][a-z0-9-]{0,29}$'),
  description text not null default '' check (char_length(description) <= 120),
  team_only boolean not null default false,
  is_default boolean not null default false,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists campus_club_channels_name_idx on public.campus_club_channels (org_id, name);
alter table public.campus_club_channels enable row level security;

create table if not exists public.campus_club_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.campus_club_channels(id) on delete cascade,
  org_id uuid not null references public.campus_orgs(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists campus_club_messages_idx on public.campus_club_messages (channel_id, created_at desc);
alter table public.campus_club_messages enable row level security;

create table if not exists public.campus_club_channel_reads (
  channel_id uuid not null references public.campus_club_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
alter table public.campus_club_channel_reads enable row level security;

-- May I read this channel? A running club or circle on my campus; its people for ordinary channels, only the team for team-only ones.
create or replace function public.can_read_channel(ch uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.campus_club_channels c join public.campus_orgs o on o.id = c.org_id
    where c.id = ch and o.campus_key = public.my_campus_key() and o.status = 'active'
      and (case when c.team_only then public.is_org_member(o.id) else public.is_club_member(o.id) end)
  )
$$;
revoke all on function public.can_read_channel(uuid) from public;
grant execute on function public.can_read_channel(uuid) to authenticated;

drop policy if exists "channels read" on public.campus_club_channels;
create policy "channels read" on public.campus_club_channels for select to authenticated using (public.can_read_channel(id));
-- (channels are made and removed through the functions below)

drop policy if exists "channel messages read" on public.campus_club_messages;
create policy "channel messages read" on public.campus_club_messages for select to authenticated using (public.can_read_channel(channel_id));
drop policy if exists "channel messages create" on public.campus_club_messages;
create policy "channel messages create" on public.campus_club_messages for insert to authenticated with check (author_id = auth.uid() and public.can_read_channel(channel_id));
drop policy if exists "channel messages delete" on public.campus_club_messages;
create policy "channel messages delete" on public.campus_club_messages for delete to authenticated
using (author_id = auth.uid() or public.has_org_perm(org_id, 'moderate'));

drop policy if exists "channel reads own" on public.campus_club_channel_reads;
create policy "channel reads own" on public.campus_club_channel_reads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A message takes its club from its channel, and a person cannot flood a channel.
create or replace function public.campus_club_message_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  select org_id into new.org_id from public.campus_club_channels where id = new.channel_id;
  if (select count(*) from public.campus_club_messages where author_id = new.author_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Slow down a little, you are sending a lot of messages.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists campus_club_message_before_insert on public.campus_club_messages;
create trigger campus_club_message_before_insert before insert on public.campus_club_messages for each row execute function public.campus_club_message_before_insert();

-- 3. Every running club has a #general ---------------------------------------------------------------------------------------------------
create or replace function public.campus_org_default_channel()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'active' then
    insert into public.campus_club_channels (org_id, name, description, is_default, position, created_by)
    values (new.id, 'general', 'Everyone in the club', true, 0, new.created_by) on conflict (org_id, name) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists campus_org_default_channel on public.campus_orgs;
create trigger campus_org_default_channel after insert or update of status on public.campus_orgs for each row execute function public.campus_org_default_channel();

insert into public.campus_club_channels (org_id, name, description, is_default, position, created_by)
select id, 'general', 'Everyone in the club', true, 0, created_by from public.campus_orgs where status = 'active'
on conflict (org_id, name) do nothing;

-- 4. Making and removing channels --------------------------------------------------------------------------------------------------------
create or replace function public.create_channel(org uuid, channel_name text, about text, only_team boolean)
returns uuid language plpgsql security definer set search_path = public
as $$
declare nm text; cid uuid;
begin
  if not (public.club_open(org) and (public.is_org_owner(org) or public.has_org_perm(org, 'channels'))) then raise exception 'Your role in this club does not include managing channels.' using errcode = '42501'; end if;
  nm := regexp_replace(regexp_replace(lower(trim(coalesce(channel_name, ''))), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g');
  nm := left(nm, 30);
  if nm !~ '^[a-z0-9][a-z0-9-]{0,29}$' then raise exception 'Give the channel a name with letters or numbers.'; end if;
  if (select count(*) from public.campus_club_channels where org_id = org) >= 12 then raise exception 'A club can have up to 12 channels.'; end if;
  insert into public.campus_club_channels (org_id, name, description, team_only, position, created_by)
  values (org, nm, left(trim(coalesce(about, '')), 120), coalesce(only_team, false), (select coalesce(max(position), 0) + 1 from public.campus_club_channels where org_id = org), auth.uid())
  returning id into cid;
  return cid;
exception when unique_violation then raise exception 'There is already a channel with that name.';
end $$;

create or replace function public.delete_channel(ch uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare c public.campus_club_channels;
begin
  select * into c from public.campus_club_channels where id = ch;
  if c.id is null then return; end if;
  if c.is_default then raise exception 'The general channel stays.'; end if;
  if not (public.is_org_owner(c.org_id) or public.has_org_perm(c.org_id, 'channels')) then raise exception 'Your role in this club does not include managing channels.' using errcode = '42501'; end if;
  delete from public.campus_club_channels where id = ch;
end $$;
revoke all on function public.create_channel(uuid, text, text, boolean) from public;
revoke all on function public.delete_channel(uuid) from public;
grant execute on function public.create_channel(uuid, text, text, boolean) to authenticated;
grant execute on function public.delete_channel(uuid) to authenticated;

-- 5. Live updates ------------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['campus_club_channels', 'campus_club_messages'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
