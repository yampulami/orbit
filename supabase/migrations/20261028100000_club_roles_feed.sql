-- Clubs as small communities: roles with titles and permissions, a club feed (announcements, discussion, polls), and Student Circles.
--   - A club's owner makes roles (like "Treasurer" or "Event lead") and ticks what each can do. People with a role work under the owner.
--   - Announcements are public to the campus; discussion posts and polls are for the club's own people.
--   - A Student Circle is a quick, unofficial group: no approval, no verified badge, anyone can join, and it cannot post campus events.
-- (Builds on 20261027200000_club_applications.sql.)

-- 1. Circles ------------------------------------------------------------------------------------------------------------------------------
alter table public.campus_orgs drop constraint if exists campus_orgs_kind_check;
alter table public.campus_orgs add constraint campus_orgs_kind_check check (kind in ('official', 'student', 'circle'));

-- 2. Roles and permissions ---------------------------------------------------------------------------------------------------------------
create table if not exists public.campus_org_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.campus_orgs(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  permissions text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists campus_org_roles_name_idx on public.campus_org_roles (org_id, lower(name));
alter table public.campus_org_roles enable row level security;
drop policy if exists "org roles read" on public.campus_org_roles;
create policy "org roles read" on public.campus_org_roles for select to authenticated
using (exists (select 1 from public.campus_orgs o where o.id = org_id and o.campus_key = public.my_campus_key()));
-- (no insert, update or delete policy: roles are changed through the functions below)

alter table public.campus_org_members add column if not exists role_id uuid references public.campus_org_roles(id);

-- What a person may do in a club: the owner everything; someone with a role what the role says; an older officer (no role yet) the usual three.
create or replace function public.org_perms(org uuid, uid uuid)
returns text[] language sql stable security definer set search_path = public
as $$
  select case
    when m.role = 'owner' then array['announce', 'events', 'members', 'roles', 'tasks', 'polls', 'moderate']
    when m.role_id is not null then coalesce((select r.permissions from public.campus_org_roles r where r.id = m.role_id), '{}'::text[])
    when m.role = 'officer' then array['announce', 'events', 'polls']
    else '{}'::text[]
  end
  from public.campus_org_members m where m.org_id = org and m.user_id = uid
$$;
create or replace function public.has_org_perm(org uuid, perm text)
returns boolean language sql stable security definer set search_path = public
as $$ select perm = any(coalesce(public.org_perms(org, auth.uid()), '{}'::text[])) $$;
-- Someone who belongs to the club: a member, or anyone with a place on its team.
create or replace function public.is_club_member(org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.campus_club_members c where c.org_id = org and c.user_id = auth.uid() and c.status = 'member')
      or exists (select 1 from public.campus_org_members m where m.org_id = org and m.user_id = auth.uid())
$$;
revoke all on function public.org_perms(uuid, uuid) from public;
revoke all on function public.has_org_perm(uuid, text) from public;
revoke all on function public.is_club_member(uuid) from public;
grant execute on function public.org_perms(uuid, uuid) to authenticated;
grant execute on function public.has_org_perm(uuid, text) to authenticated;
grant execute on function public.is_club_member(uuid) to authenticated;

create or replace function public.save_org_role(org uuid, role_id uuid, role_name text, perms text[])
returns uuid language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs; rid uuid; clean text[]; nm text := trim(coalesce(role_name, ''));
begin
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> public.my_campus_key() then raise exception 'That club does not exist.' using errcode = '42501'; end if;
  if not (public.is_org_owner(org) or public.has_org_perm(org, 'roles') or public.can_review_events()) then raise exception 'Only people who manage roles can do that.' using errcode = '42501'; end if;
  if char_length(nm) not between 1 and 30 then raise exception 'Give the role a name (up to 30 characters).'; end if;
  clean := array(select distinct p from unnest(coalesce(perms, '{}'::text[])) p where p = any (array['announce', 'events', 'members', 'roles', 'tasks', 'polls', 'moderate']));
  -- Only the owner (or a coordinator) can hand out the power to manage roles.
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

create or replace function public.delete_org_role(role uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare r public.campus_org_roles;
begin
  select * into r from public.campus_org_roles where id = role;
  if r.id is null then return; end if;
  if not (public.is_org_owner(r.org_id) or public.has_org_perm(r.org_id, 'roles') or public.can_review_events()) then raise exception 'Only people who manage roles can do that.' using errcode = '42501'; end if;
  if exists (select 1 from public.campus_org_members where role_id = role) then raise exception 'Move the people in this role to another role first.'; end if;
  delete from public.campus_org_roles where id = role;
end $$;

-- Add someone to the team with a role, or change the role of someone already on it. The owner's own place never changes.
create or replace function public.set_member_role(org uuid, member uuid, role uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs; r public.campus_org_roles; cur text;
begin
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> public.my_campus_key() then raise exception 'That club does not exist.' using errcode = '42501'; end if;
  if not (public.is_org_owner(org) or public.has_org_perm(org, 'roles') or public.can_review_events()) then raise exception 'Only people who manage roles can do that.' using errcode = '42501'; end if;
  select * into r from public.campus_org_roles where id = role and org_id = org;
  if r.id is null then raise exception 'That role does not exist.'; end if;
  if not exists (select 1 from public.campus_memberships c where c.user_id = member and c.campus_key = o.campus_key) then raise exception 'That person is not on your campus.'; end if;
  select m.role into cur from public.campus_org_members m where m.org_id = org and m.user_id = member;
  if cur = 'owner' then raise exception 'The owner already has every permission.'; end if;
  insert into public.campus_org_members (org_id, user_id, role, role_id) values (org, member, 'officer', role)
  on conflict (org_id, user_id) do update set role_id = excluded.role_id;
  if member <> auth.uid() then
    insert into public.notifications (recipient_id, actor_id, kind, body) values (member, auth.uid(), 'event', left('You are now ' || r.name || ' in ' || o.name, 200));
  end if;
end $$;
revoke all on function public.save_org_role(uuid, uuid, text, text[]) from public;
revoke all on function public.delete_org_role(uuid) from public;
revoke all on function public.set_member_role(uuid, uuid, uuid) from public;
grant execute on function public.save_org_role(uuid, uuid, text, text[]) to authenticated;
grant execute on function public.delete_org_role(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, uuid) to authenticated;

-- 3. Circles start active; the rest of the club rules stay as they were ----------------------------------------------------------------
create or replace function public.campus_org_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.trusted := false;
  if new.kind = 'circle' then
    -- A Student Circle is quick and unofficial: active at once, never verified, no application details needed.
    new.status := 'active'; new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
    if (select count(*) from public.campus_orgs where created_by = new.created_by and kind = 'circle' and created_at > now() - interval '1 day') >= 5 then
      raise exception 'That is a lot of circles for one day. Try again tomorrow.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if auth.uid() is not null and public.can_review_events() then
    new.status := 'active'; new.kind := coalesce(new.kind, 'student'); new.reviewed_by := auth.uid(); new.reviewed_at := now();
    if new.kind = 'official' then new.trusted := true; end if;
  else
    new.status := 'pending'; new.kind := 'student'; new.reviewed_by := null; new.reviewed_at := null;
    if char_length(trim(new.purpose)) < 30 then raise exception 'Tell the coordinator what the club is for (at least a couple of sentences).' using errcode = 'P0001'; end if;
    if char_length(trim(new.advisor_name)) < 2 or position('@' in new.advisor_email) < 2 then raise exception 'A club needs a faculty or staff adviser, with their name and email.' using errcode = 'P0001'; end if;
    if char_length(trim(new.meeting)) < 3 then raise exception 'Say where and when the club meets.' using errcode = 'P0001'; end if;
    if char_length(trim(new.contact)) < 3 then raise exception 'Add a way for the coordinator to reach you.' using errcode = 'P0001'; end if;
    if (select count(*) from public.campus_orgs where created_by = new.created_by and kind <> 'circle' and created_at > now() - interval '1 day') >= 3 then
      raise exception 'That is a lot of requests for one day. Try again tomorrow.' using errcode = 'P0001';
    end if;
  end if;
  new.review_note := null;
  return new;
end $$;

-- Events: only a person whose role allows it, and not from a circle.
create or replace function public.campus_event_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare lbl text; r text; o public.campus_orgs;
begin
  if new.org_id is not null then
    select * into o from public.campus_orgs where id = new.org_id;
    if o.id is null or o.campus_key <> new.campus_key or o.status <> 'active' then raise exception 'This club cannot post events right now.' using errcode = '42501'; end if;
    if o.kind = 'circle' then raise exception 'Student circles cannot post campus events. Apply to start a club to host events.' using errcode = '42501'; end if;
    if not ('events' = any (coalesce(public.org_perms(o.id, new.host_id), '{}'::text[]))) then raise exception 'Your role in this club does not include posting events.' using errcode = '42501'; end if;
    new.host_label := o.name; new.kind := o.kind;
    new.status := case when o.kind = 'official' or o.trusted then 'published' else 'pending' end;
  else
    select label, role into lbl, r from public.campus_hosts where user_id = new.host_id;
    if lbl is null then raise exception 'Only campus hosts can post events.' using errcode = '42501'; end if;
    new.host_label := lbl;
    if r = 'student' then new.kind := 'student'; new.status := 'pending'; else new.kind := 'official'; new.status := 'published'; end if;
  end if;
  new.reviewed_by := null; new.reviewed_at := null; new.review_note := null; new.canceled_at := null;
  if (select count(*) from public.campus_events where host_id = new.host_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That is a lot of events for one day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Joining: a circle lets anyone in at once; a club asks its team. Answering requests is a permission.
create or replace function public.request_join_club(org uuid, msg text default '')
returns text language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs; cur text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> public.my_campus_key() or o.status <> 'active' then raise exception 'That club is not taking members right now.' using errcode = '42501'; end if;
  if exists (select 1 from public.campus_org_members m where m.org_id = org and m.user_id = auth.uid()) then return 'member'; end if;
  select status into cur from public.campus_club_members where org_id = org and user_id = auth.uid();
  if cur in ('pending', 'member') then return cur; end if;
  if o.kind = 'circle' then
    insert into public.campus_club_members (org_id, user_id, status, created_at, decided_at) values (org, auth.uid(), 'member', now(), now())
    on conflict (org_id, user_id) do update set status = 'member', decided_at = now();
    return 'member';
  end if;
  if (select count(*) from public.campus_club_members where user_id = auth.uid() and created_at > now() - interval '1 day' and status = 'pending') >= 10 then
    raise exception 'That is a lot of requests for one day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  insert into public.campus_club_members (org_id, user_id, status, message, created_at, decided_by, decided_at)
  values (org, auth.uid(), 'pending', left(coalesce(msg, ''), 200), now(), null, null)
  on conflict (org_id, user_id) do update set status = 'pending', message = excluded.message, created_at = now(), decided_by = null, decided_at = null;
  insert into public.notifications (recipient_id, actor_id, kind, body)
  select m.user_id, auth.uid(), 'event', left('Wants to join ' || o.name, 200)
  from public.campus_org_members m where m.org_id = org and ('members' = any (public.org_perms(org, m.user_id)));
  return 'pending';
end $$;

create or replace function public.decide_join_request(org uuid, member uuid, approve boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs;
begin
  if not (public.has_org_perm(org, 'members') or public.can_review_events()) then raise exception 'Only people who manage members can answer requests.' using errcode = '42501'; end if;
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> public.my_campus_key() then raise exception 'Not found.' using errcode = '42501'; end if;
  update public.campus_club_members set status = case when approve then 'member' else 'declined' end, decided_by = auth.uid(), decided_at = now()
  where org_id = org and user_id = member and status = 'pending';
  if found then
    insert into public.notifications (recipient_id, actor_id, kind, body)
    values (member, auth.uid(), 'event', left(case when approve then 'Welcome to ' || o.name || '. Your request was approved' else 'Not approved: your request to join ' || o.name end, 200));
  end if;
end $$;

drop policy if exists "club members read" on public.campus_club_members;
create policy "club members read" on public.campus_club_members for select to authenticated
using (
  exists (select 1 from public.campus_orgs o where o.id = org_id and o.campus_key = public.my_campus_key())
  and (status = 'member' or user_id = auth.uid() or public.has_org_perm(org_id, 'members') or public.can_review_events())
);

-- 4. The club feed ------------------------------------------------------------------------------------------------------------------------
create table if not exists public.campus_club_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.campus_orgs(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('announcement', 'post', 'poll')),
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 2000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind = 'poll' or char_length(trim(title)) > 0 or char_length(trim(body)) > 0)
);
create index if not exists campus_club_posts_org_idx on public.campus_club_posts (org_id, created_at desc);
alter table public.campus_club_posts enable row level security;

create table if not exists public.campus_club_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.campus_club_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists campus_club_post_comments_idx on public.campus_club_post_comments (post_id, created_at);
alter table public.campus_club_post_comments enable row level security;

create table if not exists public.campus_club_poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.campus_club_posts(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  position integer not null default 0
);
alter table public.campus_club_poll_options enable row level security;

create table if not exists public.campus_club_poll_votes (
  post_id uuid not null references public.campus_club_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_id uuid not null references public.campus_club_poll_options(id) on delete cascade,
  primary key (post_id, user_id)
);
alter table public.campus_club_poll_votes enable row level security;

-- Is this a club on my campus that is running?
create or replace function public.club_open(org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.campus_orgs o where o.id = org and o.campus_key = public.my_campus_key() and o.status = 'active') $$;
create or replace function public.can_discuss(post uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.campus_club_posts p where p.id = post and public.club_open(p.org_id) and public.is_club_member(p.org_id)) $$;
revoke all on function public.club_open(uuid) from public;
revoke all on function public.can_discuss(uuid) from public;
grant execute on function public.club_open(uuid) to authenticated;
grant execute on function public.can_discuss(uuid) to authenticated;

-- Announcements are for the whole campus; discussion and polls are for the club's own people (and coordinators).
drop policy if exists "club posts read" on public.campus_club_posts;
create policy "club posts read" on public.campus_club_posts for select to authenticated
using (
  exists (select 1 from public.campus_orgs o where o.id = org_id and o.campus_key = public.my_campus_key() and (o.status = 'active' or public.is_org_member(o.id) or public.can_review_events()))
  and (kind = 'announcement' or public.is_club_member(org_id) or public.can_review_events())
);
drop policy if exists "club posts create" on public.campus_club_posts;
create policy "club posts create" on public.campus_club_posts for insert to authenticated
with check (
  author_id = auth.uid() and public.club_open(org_id)
  and (
    (kind = 'announcement' and public.has_org_perm(org_id, 'announce'))
    or (kind = 'post' and public.is_club_member(org_id))
  )
);
-- (polls are made through create_club_poll below)
drop policy if exists "club posts update" on public.campus_club_posts;
create policy "club posts update" on public.campus_club_posts for update to authenticated
using (public.has_org_perm(org_id, 'announce') or public.has_org_perm(org_id, 'moderate'))
with check (public.has_org_perm(org_id, 'announce') or public.has_org_perm(org_id, 'moderate'));
drop policy if exists "club posts delete" on public.campus_club_posts;
create policy "club posts delete" on public.campus_club_posts for delete to authenticated
using (author_id = auth.uid() or public.has_org_perm(org_id, 'moderate') or public.can_review_events());

-- An update may only pin or unpin.
create or replace function public.campus_club_post_before_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.org_id := old.org_id; new.author_id := old.author_id; new.kind := old.kind; new.title := old.title; new.body := old.body; new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists campus_club_post_before_update on public.campus_club_posts;
create trigger campus_club_post_before_update before update on public.campus_club_posts for each row execute function public.campus_club_post_before_update();

-- An announcement tells everyone in the club.
create or replace function public.campus_club_post_after_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs;
begin
  if new.kind <> 'announcement' then return null; end if;
  select * into o from public.campus_orgs where id = new.org_id;
  insert into public.notifications (recipient_id, actor_id, kind, body)
  select u, new.author_id, 'event', left('Announcement from ' || o.name || ': ' || coalesce(nullif(new.title, ''), new.body), 200)
  from (
    select user_id as u from public.campus_club_members where org_id = new.org_id and status = 'member'
    union select user_id from public.campus_org_members where org_id = new.org_id
  ) t where u <> new.author_id limit 500;
  return null;
end $$;
drop trigger if exists campus_club_post_after_insert on public.campus_club_posts;
create trigger campus_club_post_after_insert after insert on public.campus_club_posts for each row execute function public.campus_club_post_after_insert();

drop policy if exists "club comments read" on public.campus_club_post_comments;
create policy "club comments read" on public.campus_club_post_comments for select to authenticated
using (exists (select 1 from public.campus_club_posts p where p.id = post_id));
drop policy if exists "club comments create" on public.campus_club_post_comments;
create policy "club comments create" on public.campus_club_post_comments for insert to authenticated
with check (author_id = auth.uid() and public.can_discuss(post_id));
drop policy if exists "club comments delete" on public.campus_club_post_comments;
create policy "club comments delete" on public.campus_club_post_comments for delete to authenticated
using (author_id = auth.uid() or exists (select 1 from public.campus_club_posts p where p.id = post_id and public.has_org_perm(p.org_id, 'moderate')));

drop policy if exists "poll options read" on public.campus_club_poll_options;
create policy "poll options read" on public.campus_club_poll_options for select to authenticated
using (exists (select 1 from public.campus_club_posts p where p.id = post_id));
drop policy if exists "poll votes read own" on public.campus_club_poll_votes;
create policy "poll votes read own" on public.campus_club_poll_votes for select to authenticated using (user_id = auth.uid());
-- (votes are anonymous: you can read only your own; the totals come from club_poll_results)

create or replace function public.create_club_poll(org uuid, question text, options text[])
returns uuid language plpgsql security definer set search_path = public
as $$
declare pid uuid; opt text; n integer := 0; q text := trim(coalesce(question, ''));
begin
  if not (public.club_open(org) and public.has_org_perm(org, 'polls')) then raise exception 'Your role in this club does not include polls.' using errcode = '42501'; end if;
  if char_length(q) not between 1 and 120 then raise exception 'Ask a question (up to 120 characters).'; end if;
  if coalesce(array_length(options, 1), 0) not between 2 and 6 then raise exception 'A poll needs two to six choices.'; end if;
  insert into public.campus_club_posts (org_id, author_id, kind, title) values (org, auth.uid(), 'poll', q) returning id into pid;
  foreach opt in array options loop
    opt := trim(opt);
    if char_length(opt) not between 1 and 80 then raise exception 'Each choice needs 1 to 80 characters.'; end if;
    n := n + 1;
    insert into public.campus_club_poll_options (post_id, label, position) values (pid, opt, n);
  end loop;
  return pid;
end $$;

create or replace function public.vote_club_poll(post uuid, option uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.can_discuss(post) then raise exception 'Only the club''s people can vote.' using errcode = '42501'; end if;
  if not exists (select 1 from public.campus_club_poll_options o where o.id = option and o.post_id = post) then raise exception 'That choice does not exist.'; end if;
  insert into public.campus_club_poll_votes (post_id, user_id, option_id) values (post, auth.uid(), option)
  on conflict (post_id, user_id) do update set option_id = excluded.option_id;
end $$;

create or replace function public.club_poll_results(org uuid)
returns table (post_id uuid, option_id uuid, votes bigint, mine boolean)
language sql stable security definer set search_path = public
as $$
  select o.post_id, o.id, count(v.user_id), coalesce(bool_or(v.user_id = auth.uid()), false)
  from public.campus_club_poll_options o
  join public.campus_club_posts p on p.id = o.post_id and p.org_id = org
  left join public.campus_club_poll_votes v on v.option_id = o.id
  where public.club_open(org) and (public.is_club_member(org) or public.can_review_events())
  group by o.post_id, o.id
$$;
revoke all on function public.create_club_poll(uuid, text, text[]) from public;
revoke all on function public.vote_club_poll(uuid, uuid) from public;
revoke all on function public.club_poll_results(uuid) from public;
grant execute on function public.create_club_poll(uuid, text, text[]) to authenticated;
grant execute on function public.vote_club_poll(uuid, uuid) to authenticated;
grant execute on function public.club_poll_results(uuid) to authenticated;

-- 5. Live updates -------------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['campus_org_roles', 'campus_club_posts', 'campus_club_post_comments'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
